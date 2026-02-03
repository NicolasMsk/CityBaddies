/**
 * ImportEngine - Moteur universel d'importation de produits
 * Architecture Strategy Pattern
 * 
 * Ce moteur gère:
 * - La boucle sur les ScrapingSource de la BDD
 * - L'appel à la catégorisation AI (batch de 50)
 * - La normalisation des marques et volumes
 * - Les upsert Prisma (Product, Deal, PriceHistory) en transaction
 */

import { PrismaClient } from '@prisma/client';
import { Scraper, ScrapedProduct, ImportStats, ImportEngineOptions } from './types';
import { categorizeProductsBatch } from '../ai/categorize';
import { findOrCreateBrand } from '../brands';
import { calculatePricePerUnit, findOrCreateVariant } from '../utils/volume';
import { calculateDealScore, tagsToString } from '../utils/scoring';

const prisma = new PrismaClient() as any;

// ============================================
// CONFIGURATION PAR DÉFAUT
// ============================================

const DEFAULT_OPTIONS: Required<ImportEngineOptions> = {
  batchSize: 50,
  minDiscountPercent: 5,
  maxProducts: Infinity,
  verbose: true,
};

const DB_CATEGORIES = [
  { slug: 'maquillage', name: 'Maquillage', icon: 'Sparkles', description: 'Fonds de teint, rouges à lèvres...' },
  { slug: 'soins-visage', name: 'Soins visage', icon: 'Droplets', description: 'Crèmes, sérums...' },
  { slug: 'soins-corps', name: 'Soins corps', icon: 'Heart', description: 'Lotions, gommages...' },
  { slug: 'cheveux', name: 'Cheveux', icon: 'Scissors', description: 'Shampoings, soins...' },
  { slug: 'parfums', name: 'Parfums', icon: 'Gem', description: 'Parfums femme, homme...' },
  { slug: 'ongles', name: 'Ongles', icon: 'Palette', description: 'Vernis, nail art...' },
  { slug: 'accessoires', name: 'Accessoires', icon: 'Crown', description: 'Trousses, miroirs...' },
];

// ============================================
// UTILITAIRES
// ============================================

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
}

function log(message: string, verbose: boolean) {
  if (verbose) console.log(message);
}

// ============================================
// CLASSE IMPORTENGINE
// ============================================

export class ImportEngine {
  private options: Required<ImportEngineOptions>;
  private brandCache = new Map<string, string | null>();
  private existingSlugs = new Set<string>();

  constructor(options: ImportEngineOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Point d'entrée principal: importer les produits d'un scraper
   */
  async import(scraper: Scraper, cleanFirst: boolean = false): Promise<ImportStats> {
    const startTime = Date.now();
    const stats: ImportStats = {
      scraped: 0,
      withVolume: 0,
      existing: 0,
      updated: 0,
      created: 0,
      priceChanges: 0,
      errors: [],
      duration: 0,
    };

    log(`\n🚀 Import ${scraper.merchantSlug.toUpperCase()}...`, this.options.verbose);

    // 1. Récupérer ou créer le merchant
    const merchant = await this.getOrCreateMerchant(scraper.merchantSlug);
    log(`🏪 Merchant: ${merchant.name}`, this.options.verbose);

    // 2. S'assurer que les catégories existent
    await this.ensureCategories();

    // 3. Clean si demandé
    if (cleanFirst) {
      await this.cleanMerchantData(merchant.id);
    }

    // 4. Récupérer les sources de scraping
    const sources = await this.getScrapingSources(merchant.id);
    if (sources.length === 0) {
      log(`⚠️ Aucune source de scraping trouvée pour ${scraper.merchantSlug}.`, this.options.verbose);
      log(`   Exécutez: npx tsx src/scripts/seed-scraping-sources.ts`, this.options.verbose);
      stats.duration = (Date.now() - startTime) / 1000;
      return stats;
    }
    log(`📋 ${sources.length} sources à scraper`, this.options.verbose);

    // 5. Scraper toutes les sources
    const allProducts = await this.scrapeAllSources(scraper, sources);
    stats.scraped = allProducts.length;

    // 6. Filtrer les produits avec volume
    const productsWithVolume = allProducts
      .filter(p => p.volume)
      .slice(0, this.options.maxProducts);
    stats.withVolume = productsWithVolume.length;
    log(`📦 ${stats.scraped} produits scrapés, ${stats.withVolume} avec volume`, this.options.verbose);

    if (productsWithVolume.length === 0) {
      stats.duration = (Date.now() - startTime) / 1000;
      return stats;
    }

    // 6.5 Filtrer les produits avec discount suffisant pour être des deals valides
    const validDeals = productsWithVolume.filter(p => p.discountPercent >= this.options.minDiscountPercent);
    log(`🏷️ ${validDeals.length} deals valides (discount >= ${this.options.minDiscountPercent}%)`, this.options.verbose);

    // 6.6 Enrichir les images HD pour Marionnaud (uniquement les deals valides)
    if (scraper.merchantSlug === 'marionnaud' && validDeals.length > 0) {
      const marionnaudScraper = scraper as any;
      if (typeof marionnaudScraper.enrichProductsWithHDImages === 'function') {
        await marionnaudScraper.enrichProductsWithHDImages(validDeals);
      }
    }

    // 7. Séparer existants vs nouveaux (batch queries)
    const { existing, newProducts } = await this.separateExistingAndNew(productsWithVolume, merchant.id);
    stats.existing = existing.length;
    log(`📊 ${existing.length} existants, ${newProducts.length} nouveaux`, this.options.verbose);

    // 8. Mettre à jour les produits existants
    const updateResult = await this.updateExistingProducts(existing);
    stats.updated = updateResult.updated;
    stats.priceChanges = updateResult.priceChanges;
    stats.errors.push(...updateResult.errors);

    // 9. Catégoriser et créer les nouveaux produits
    if (newProducts.length > 0) {
      const createResult = await this.createNewProducts(newProducts, merchant);
      stats.created = createResult.created;
      stats.errors.push(...createResult.errors);
    }

    // 10. Rapport final
    stats.duration = (Date.now() - startTime) / 1000;
    this.printReport(stats);

    return stats;
  }

  // ============================================
  // MÉTHODES PRIVÉES - SETUP
  // ============================================

  private async getOrCreateMerchant(slug: string) {
    let merchant = await prisma.merchant.findFirst({ where: { slug } });
    if (!merchant) {
      const name = slug.charAt(0).toUpperCase() + slug.slice(1);
      merchant = await prisma.merchant.create({
        data: {
          name,
          slug,
          logoUrl: `https://www.${slug}.fr/favicon.ico`,
          website: `https://www.${slug}.fr`,
        },
      });
    }
    return merchant;
  }

  private async ensureCategories() {
    for (const cat of DB_CATEGORIES) {
      await prisma.category.upsert({
        where: { slug: cat.slug },
        update: {},
        create: cat,
      });
    }
  }

  private async getScrapingSources(merchantId: number) {
    return prisma.scrapingSource.findMany({
      where: { merchantId, isActive: true },
      orderBy: { priority: 'desc' },
    });
  }

  private async cleanMerchantData(merchantId: number) {
    log(`🧹 Nettoyage des données existantes...`, this.options.verbose);
    const products = await prisma.product.findMany({
      where: { merchantId },
      select: { id: true },
    });
    const productIds = products.map((p: any) => p.id);

    await prisma.priceHistory.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.deal.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.product.deleteMany({ where: { merchantId } });
    log(`✅ Données nettoyées`, this.options.verbose);
  }

  // ============================================
  // MÉTHODES PRIVÉES - SCRAPING
  // ============================================

  private async scrapeAllSources(scraper: Scraper, sources: any[]): Promise<ScrapedProduct[]> {
    const allProducts: ScrapedProduct[] = [];
    const seenUrls = new Set<string>();

    try {
      await scraper.init();

      for (const source of sources) {
        log(`\n🔍 ${source.name} (${source.type})`, this.options.verbose);

        const result = await scraper.scrape(source.url, source.maxProducts);

        for (const product of result.products) {
          // Enrichir avec les infos de la source
          product.category = source.category;
          product.isTrending = source.type === 'trending';

          // Dédupliquer par URL uniquement (même URL = même page produit)
          // Les produits existants en DB seront mis à jour (pas recatégorisés)
          if (!seenUrls.has(product.productUrl)) {
            seenUrls.add(product.productUrl);
            allProducts.push(product);
          }
        }

        // Mettre à jour lastScraped
        await prisma.scrapingSource.update({
          where: { id: source.id },
          data: { lastScraped: new Date() },
        });
      }

      log(`🔄 ${allProducts.length} produits uniques scrapés`, this.options.verbose);

      await scraper.close();
    } catch (error) {
      await scraper.close();
      throw error;
    }

    return allProducts;
  }

  // ============================================
  // MÉTHODES PRIVÉES - SÉPARATION EXISTANTS/NOUVEAUX
  // ============================================

  private async separateExistingAndNew(products: ScrapedProduct[], merchantId: number) {
    // Batch queries pour éviter N+1
    const productUrls = products.map(p => p.productUrl);
    const productNames = products.map(p => p.name.substring(0, 200));

    const existingByUrl = await prisma.product.findMany({
      where: { productUrl: { in: productUrls } },
      include: { deals: true },
    });
    const urlMap = new Map<string, any>(existingByUrl.map((p: any) => [p.productUrl, p]));

    const existingByName = await prisma.product.findMany({
      where: { merchantId, name: { in: productNames } },
      include: { deals: true },
    });
    const nameMap = new Map<string, any>(existingByName.map((p: any) => [`${p.name}|${p.brand}`, p]));

    const existing: Array<ScrapedProduct & { _dbProduct: any; _existingDeal: any }> = [];
    const newProducts: ScrapedProduct[] = [];

    for (const product of products) {
      // 1. Chercher par URL (critère infaillible)
      let dbProduct = urlMap.get(product.productUrl) || null;

      // 2. Fallback: nom + marque
      if (!dbProduct) {
        const key = `${product.name.substring(0, 200)}|${product.brand}`;
        dbProduct = nameMap.get(key) || null;

        // Vérifier le volume pour éviter les faux positifs
        if (dbProduct) {
          const existingDeal = dbProduct.deals[0];
          if (existingDeal && existingDeal.volume !== product.volume) {
            dbProduct = null; // Variante de taille = nouveau produit
          }
        }
      }

      if (dbProduct) {
        (product as any)._dbProduct = dbProduct;
        (product as any)._existingDeal = dbProduct.deals[0];
        existing.push(product as any);
      } else {
        newProducts.push(product);
      }
    }

    return { existing, newProducts };
  }

  // ============================================
  // MÉTHODES PRIVÉES - UPDATE EXISTANTS
  // ============================================

  private async updateExistingProducts(products: Array<ScrapedProduct & { _dbProduct: any; _existingDeal: any }>) {
    const errors: Array<{ product: string; error: string }> = [];
    let updated = 0;
    let priceChanges = 0;

    if (products.length === 0) return { updated, priceChanges, errors };

    // Batch query: récupérer les derniers prix
    const productIds = products.map(p => p._dbProduct.id);
    const lastPrices = await prisma.priceHistory.findMany({
      where: { productId: { in: productIds } },
      orderBy: { date: 'desc' },
      distinct: ['productId'],
      select: { productId: true, price: true },
    });
    const lastPriceMap = new Map<number, number>(lastPrices.map((p: any) => [p.productId, p.price]));

    // Préparer les updates en batch
    const updatePromises: Promise<void>[] = [];

    for (const product of products) {
      const updateFn = async () => {
        const dbProduct = product._dbProduct;
        const existingDeal = product._existingDeal;

        // Mettre à jour les infos produit
        await prisma.product.update({
          where: { id: dbProduct.id },
          data: {
            imageUrl: product.imageUrl,
            productUrl: product.productUrl,
          },
        });

        // Créer/trouver la variante
        const variant = await findOrCreateVariant(prisma, dbProduct.id, product.volume);

        // Mettre à jour le deal si réduction suffisante
        if (existingDeal && product.discountPercent >= this.options.minDiscountPercent) {
          // FALLBACK: Recalculer le prix original si discountAmount = 0 mais discountPercent > 0
          let { currentPrice, originalPrice, discountPercent } = product;
          if (originalPrice === currentPrice && discountPercent > 0) {
            originalPrice = Math.round((currentPrice / (1 - discountPercent / 100)) * 100) / 100;
          }
          const discountAmount = originalPrice - currentPrice;

          const priceInfo = calculatePricePerUnit(currentPrice, product.volume);
          const isTrending = product.isTrending || false;

          const scoreResult = calculateDealScore({
            discountPercent,
            brandTier: existingDeal.brandTier,
            pricePerUnit: priceInfo?.pricePerUnit || null,
            isHot: existingDeal.votes >= 20,
            isTrending,
            categorySlug: product.category,
            subcategorySlug: existingDeal.product?.subcategory || undefined,
            subsubcategorySlug: existingDeal.product?.subsubcategory || undefined,
            productName: product.name,
          });

          await prisma.deal.update({
            where: { id: existingDeal.id },
            data: {
              title: `${product.brand} -${discountPercent}% : ${product.name.substring(0, 100)}`,
              dealPrice: currentPrice,
              originalPrice,
              discountPercent,
              discountAmount,
              variantId: variant?.id || null,
              volume: product.volume || null,
              volumeValue: priceInfo?.volumeValue || null,
              volumeUnit: priceInfo?.volumeUnit || null,
              pricePerUnit: priceInfo?.pricePerUnit || null,
              score: scoreResult.score,
              tags: tagsToString(scoreResult.tags),
              isTrending,
              isExpired: false,
              isHot: existingDeal.votes >= 20,
              lastSeenAt: new Date(),
              updatedAt: new Date(),
            },
          });
        }

        // PriceHistory uniquement si prix changé (avec contenance)
        const lastPrice = lastPriceMap.get(dbProduct.id);
        if (lastPrice !== product.currentPrice) {
          const volumeInfo = calculatePricePerUnit(product.currentPrice, product.volume);
          await prisma.priceHistory.create({
            data: {
              productId: dbProduct.id,
              price: product.currentPrice,
              variantId: variant?.id || null,
              volumeValue: volumeInfo?.volumeValue || null,
              volumeUnit: volumeInfo?.volumeUnit || null,
              volumeRaw: product.volume || null,
              date: new Date(),
            },
          });
          priceChanges++;
        }

        updated++;
      };

      updatePromises.push(
        updateFn().catch(err => {
          errors.push({
            product: product.name,
            error: err instanceof Error ? err.message : String(err),
          });
        })
      );
    }

    // Exécuter par batch
    for (let i = 0; i < updatePromises.length; i += this.options.batchSize) {
      await Promise.all(updatePromises.slice(i, i + this.options.batchSize));
      if (i + this.options.batchSize < updatePromises.length) {
        log(`⏳ ${Math.min(i + this.options.batchSize, updatePromises.length)} mis à jour...`, this.options.verbose);
      }
    }

    log(`✅ ${updated} produits mis à jour (${priceChanges} changements de prix)`, this.options.verbose);
    return { updated, priceChanges, errors };
  }

  // ============================================
  // MÉTHODES PRIVÉES - CRÉATION NOUVEAUX
  // ============================================

  private async createNewProducts(products: ScrapedProduct[], merchant: any) {
    const errors: Array<{ product: string; error: string }> = [];
    let created = 0;

    log(`\n[AI] Classification de ${products.length} nouveaux produits...`, this.options.verbose);

    // Appel AI batch
    const productsForAI = products.map(p => ({
      name: p.name,
      brand: p.brand,
      volume: p.volume,
    }));
    const classifications = await categorizeProductsBatch(productsForAI);

    // Charger les slugs existants
    if (this.existingSlugs.size === 0) {
      const allSlugs = await prisma.product.findMany({ select: { slug: true } });
      allSlugs.forEach((p: any) => this.existingSlugs.add(p.slug));
    }

    // Charger les catégories
    const allCategories = await prisma.category.findMany();
    const categoryMap = new Map<string, any>(allCategories.map((c: any) => [c.slug, c]));

    for (const product of products) {
      try {
        const classification = classifications.get(product.name);
        const categorySlug = classification?.categorySlug || product.category;
        const category = categoryMap.get(categorySlug);

        if (!category) continue;

        const brandId = await this.findOrCreateBrandCached(product.brand);

        // Générer slug unique
        let slug = generateSlug(product.name);
        let counter = 1;
        while (this.existingSlugs.has(slug)) {
          slug = generateSlug(product.name) + '-' + counter;
          counter++;
        }
        this.existingSlugs.add(slug);

        // Transaction pour cohérence
        await prisma.$transaction(async (tx: any) => {
          const dbProduct = await tx.product.create({
            data: {
              name: product.name.substring(0, 200),
              slug,
              description: `${product.brand} - ${product.name}`.substring(0, 500),
              imageUrl: product.imageUrl,
              brand: product.brand,
              brandId,
              categoryId: category.id,
              subcategory: classification?.subcategorySlug || null,
              subsubcategory: classification?.subsubcategorySlug || null,
              merchantId: merchant.id,
              productUrl: product.productUrl,
            },
          });

          // Créer la variante
          const variant = await findOrCreateVariant(tx, dbProduct.id, product.volume);

          // Créer le deal si réduction suffisante
          if (product.discountPercent >= this.options.minDiscountPercent) {
            // FALLBACK: Recalculer le prix original si discountAmount = 0 mais discountPercent > 0
            let { currentPrice, originalPrice, discountPercent } = product;
            if (originalPrice === currentPrice && discountPercent > 0) {
              originalPrice = Math.round((currentPrice / (1 - discountPercent / 100)) * 100) / 100;
            }
            const discountAmount = originalPrice - currentPrice;

            const priceInfo = calculatePricePerUnit(currentPrice, product.volume);
            const isTrending = product.isTrending || false;

            const scoreResult = calculateDealScore({
              discountPercent,
              brandTier: classification?.brandTier || null,
              pricePerUnit: priceInfo?.pricePerUnit || null,
              isHot: false,
              isTrending,
              categorySlug,
              subcategorySlug: classification?.subcategorySlug || undefined,
              subsubcategorySlug: classification?.subsubcategorySlug || undefined,
              productName: product.name,
            });

            await tx.deal.create({
              data: {
                productId: dbProduct.id,
                variantId: variant?.id || null,
                title: `${product.brand} -${discountPercent}% : ${product.name.substring(0, 100)}`,
                refinedTitle: classification?.refinedTitle || null,
                description: `${discountPercent}% de réduction !`,
                dealPrice: currentPrice,
                originalPrice,
                discountPercent,
                discountAmount,
                volume: product.volume || null,
                volumeValue: priceInfo?.volumeValue || null,
                volumeUnit: priceInfo?.volumeUnit || null,
                pricePerUnit: priceInfo?.pricePerUnit || null,
                brandTier: classification?.brandTier || 2,
                score: scoreResult.score,
                tags: tagsToString(scoreResult.tags),
                isHot: false,
                isTrending,
                isExpired: false,
                lastSeenAt: new Date(),
                votes: 0,
                views: 0,
              },
            });
          }

          // PriceHistory initial (avec contenance)
          await tx.priceHistory.create({
            data: {
              productId: dbProduct.id,
              price: product.currentPrice,
              variantId: variant?.id || null,
              volumeValue: priceInfo?.volumeValue || null,
              volumeUnit: priceInfo?.volumeUnit || null,
              volumeRaw: product.volume || null,
              date: new Date(),
            },
          });
        });

        created++;
        if (created % 20 === 0) {
          log(`🆕 ${created}/${products.length} nouveaux créés...`, this.options.verbose);
        }
      } catch (err) {
        errors.push({
          product: product.name,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return { created, errors };
  }

  private async findOrCreateBrandCached(brandName: string): Promise<string | null> {
    if (this.brandCache.has(brandName)) {
      return this.brandCache.get(brandName)!;
    }
    const brandId = await findOrCreateBrand(brandName);
    this.brandCache.set(brandName, brandId);
    return brandId;
  }

  // ============================================
  // RAPPORT FINAL
  // ============================================

  private printReport(stats: ImportStats) {
    console.log(`\n⏱️ Import terminé en ${stats.duration.toFixed(1)}s`);
    console.log(`📊 Résumé: ${stats.created} nouveaux, ${stats.updated} mis à jour, ${stats.priceChanges} changements de prix`);

    if (stats.errors.length > 0) {
      console.log(`⚠️ ${stats.errors.length} erreurs:`);
      stats.errors.slice(0, 5).forEach(e => console.log(`  ❌ ${e.product}: ${e.error}`));
      if (stats.errors.length > 5) {
        console.log(`  ... et ${stats.errors.length - 5} autres`);
      }
    }
  }
}

// Export pour utilisation directe
export const importEngine = new ImportEngine();
