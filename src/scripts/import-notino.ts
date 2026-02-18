/**
 * =============================================================================
 * IMPORT-NOTINO.TS - Import des produits Notino dans la base de données
 * =============================================================================
 * 
 * Calqué sur import-sephora.ts :
 *   1. Récupère les ScrapingSource Notino depuis la BDD
 *   2. Scrape chaque page avec NotinoScraper (Playwright + Cheerio)
 *   3. Batch query des produits existants (URL puis nom+marque)
 *   4. Update les existants / Crée les nouveaux (avec catégorisation AI)
 *   5. Tous les deals Notino sont créés en PENDING (scoring LLM ensuite)
 * 
 * Usage:
 *   npx tsx src/scripts/import-notino.ts
 *   npx tsx src/scripts/import-notino.ts --clean  (reset + import)
 * =============================================================================
 */

import { NotinoScraper, NotinoProduct } from '../lib/scraping/notino';
import { PrismaClient } from '@prisma/client';
import { categorizeProductsBatch } from '../lib/ai/categorize';
import { findOrCreateBrand } from '../lib/brands';
import { calculatePricePerUnit, findOrCreateVariant } from '../lib/utils/volume';

const prisma = new PrismaClient() as any;

function generateSlug(name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 50);
}

const DB_CATEGORIES = [
  { slug: 'maquillage', name: 'Maquillage', icon: 'Sparkles', description: 'Fonds de teint, rouges a levres...' },
  { slug: 'soins-visage', name: 'Soins visage', icon: 'Droplets', description: 'Cremes, serums...' },
  { slug: 'soins-corps', name: 'Soins corps', icon: 'Droplets', description: 'Laits corps, gommages...' },
  { slug: 'cheveux', name: 'Cheveux', icon: 'Scissors', description: 'Shampoings, soins...' },
  { slug: 'ongles', name: 'Ongles', icon: 'Palette', description: 'Vernis, nail art...' },
  { slug: 'parfums', name: 'Parfums', icon: 'Gem', description: 'Parfums femme, homme...' },
  { slug: 'accessoires', name: 'Accessoires', icon: 'Crown', description: 'Trousses, miroirs...' },
];

const MAX_TOTAL_PRODUCTS = 1000;

async function importProducts() {
  const startTime = Date.now();
  console.log('🚀 Import des produits Notino...');
  let merchant = await prisma.merchant.findFirst({ where: { slug: 'notino' } });
  if (!merchant) {
    merchant = await prisma.merchant.create({ 
      data: { 
        name: 'Notino', 
        slug: 'notino', 
        logoUrl: 'https://www.notino.fr/favicon.ico', 
        website: 'https://www.notino.fr' 
      } 
    });
    console.log('✅ Marchand Notino créé');
  }

  for (const cat of DB_CATEGORIES) {
    await prisma.category.upsert({ where: { slug: cat.slug }, update: {}, create: cat });
  }

  // Récupérer les sources de scraping depuis la BDD
  const scrapingSources = await prisma.scrapingSource.findMany({
    where: { merchantId: merchant.id, isActive: true },
    orderBy: { priority: 'desc' },
  });

  if (scrapingSources.length === 0) {
    console.log('⚠️ Aucune source de scraping trouvée pour Notino.');
    console.log('   Exécutez: npx tsx src/scripts/seed-scraping-sources.ts');
    return;
  }

  console.log(`📋 ${scrapingSources.length} sources à scraper`);

  const scraper = new NotinoScraper({ headless: true, delayBetweenRequests: 3000, maxClicks: 20 });
  const allProducts: NotinoProduct[] = [];

  try {
    await scraper.init();
    for (const source of scrapingSources) {
      console.log(`\n🔍 ${source.name} (${source.type})`);
      
      try {
        const result = await scraper.scrapeCategoryPage(source.url, source.maxProducts);
        for (const product of result.products) {
          product.category = source.category;
          (product as any).sourceUrl = source.url;
          (product as any).isTrending = source.type === 'trending';
          if (!allProducts.find(p => p.productUrl === product.productUrl)) {
            allProducts.push(product);
          }
        }
        console.log(`   ✅ ${result.products.length} produits`);
      } catch (err) {
        console.log(`   ❌ Erreur: ${(err as Error).message}`);
      }

      // Mettre à jour lastScraped
      await prisma.scrapingSource.update({
        where: { id: source.id },
        data: { lastScraped: new Date() },
      });
    }
    await scraper.close();
  } catch (error) {
    await scraper.close();
    console.error('❌ Erreur fatale scraper:', error);
    return;
  }

  // Notino: on garde TOUS les produits même sans volume (deal en PENDING)
  const productsToImport = allProducts.slice(0, MAX_TOTAL_PRODUCTS);
  console.log(`\n📦 ${allProducts.length} produits scrapés, ${productsToImport.length} à importer`);

  // ÉTAPE 1: Batch query - récupérer tous les produits existants en 2 requêtes
  const productUrls = productsToImport.map(p => p.productUrl);
  const productNames = productsToImport.map(p => p.name.substring(0, 200));

  const existingByUrl = await prisma.product.findMany({
    where: { productUrl: { in: productUrls } },
    include: { deals: true }
  });
  const urlMap = new Map<string, any>(existingByUrl.map((p: any) => [p.productUrl, p]));

  const existingByName = await prisma.product.findMany({
    where: { 
      merchantId: merchant.id,
      name: { in: productNames }
    },
    include: { deals: true }
  });
  const nameMap = new Map<string, any>(existingByName.map((p: any) => [`${p.name}|${p.brand}`, p]));

  // Séparer existants / nouveaux
  const existingProducts: typeof productsToImport = [];
  const newProducts: typeof productsToImport = [];

  for (const product of productsToImport) {
    let dbProduct = urlMap.get(product.productUrl) || null;

    if (!dbProduct) {
      const key = `${product.name.substring(0, 200)}|${product.brand}`;
      dbProduct = nameMap.get(key) || null;
      if (dbProduct) {
        const existingDeal = dbProduct.deals[0];
        if (existingDeal && existingDeal.volume !== product.volume) {
          dbProduct = null;
        }
      }
    }

    if (dbProduct) {
      existingProducts.push(product);
      (product as any)._dbProduct = dbProduct;
      (product as any)._existingDeal = dbProduct.deals[0];
    } else {
      newProducts.push(product);
    }
  }

  console.log(`📊 ${existingProducts.length} existants, ${newProducts.length} nouveaux`);

  // ÉTAPE 2: Mettre à jour les produits existants (pas d'appel AI)
  const existingProductIds = existingProducts.map(p => (p as any)._dbProduct.id);
  const lastPrices = await prisma.priceHistory.findMany({
    where: { productId: { in: existingProductIds } },
    orderBy: { date: 'desc' },
    distinct: ['productId'],
    select: { productId: true, price: true }
  });
  const lastPriceMap = new Map<number, number>(lastPrices.map((p: any) => [p.productId, p.price]));

  const errors: Array<{ product: string; error: string }> = [];
  let updated = 0;
  let priceChanges = 0;

  const updatePromises: Promise<void>[] = [];
  
  for (const product of existingProducts) {
    const updateFn = async () => {
      const dbProduct = (product as any)._dbProduct;
      const existingDeal = (product as any)._existingDeal;

      // Le prix effectif (avec code promo si dispo)
      const effectivePrice = product.priceWithCode || product.currentPrice;

      await prisma.product.update({
        where: { id: dbProduct.id },
        data: { 
          imageUrl: product.imageUrl,
          productUrl: product.productUrl,
        }
      });

      const variant = await findOrCreateVariant(prisma, dbProduct.id, product.volume);
      const priceInfo = calculatePricePerUnit(effectivePrice, product.volume);

      if (existingDeal) {
        const isTrending = (product as any).isTrending || false;
        const discountPercent = product.priceWithCode
          ? Math.round((1 - product.priceWithCode / product.currentPrice) * 100)
          : 0;
        
        await prisma.deal.update({
          where: { id: existingDeal.id },
          data: {
            title: product.brand + (discountPercent > 0 ? ' -' + discountPercent + '% : ' : ' : ') + product.name.substring(0, 100),
            dealPrice: effectivePrice,
            originalPrice: product.currentPrice,
            discountPercent,
            discountAmount: product.currentPrice - effectivePrice,
            variantId: variant?.id || null,
            volume: product.volume || null,
            volumeValue: priceInfo?.volumeValue || null,
            volumeUnit: priceInfo?.volumeUnit || null,
            pricePerUnit: priceInfo?.pricePerUnit || null,
            sourceUrl: (product as any).sourceUrl || existingDeal.sourceUrl || null,
            isTrending,
            // Si EXPIRED re-détecté en promo → PENDING + reset score pour re-évaluation LLM
            status: existingDeal.status === 'EXPIRED' ? 'PENDING' : existingDeal.status,
            ...(existingDeal.status === 'EXPIRED' && { score: null, tags: null, whyGoodDeal: null }),
            isHot: existingDeal.votes >= 20,
            updatedAt: new Date(),
          }
        });
      }

      const lastPrice = lastPriceMap.get(dbProduct.id);
      if (lastPrice !== effectivePrice) {
        await prisma.priceHistory.create({ 
          data: { 
            productId: dbProduct.id, 
            price: effectivePrice,
            variantId: variant?.id || null,
            volumeValue: priceInfo?.volumeValue || null,
            volumeUnit: priceInfo?.volumeUnit || null,
            volumeRaw: product.volume || null,
            date: new Date() 
          } 
        });
        priceChanges++;
      }
      updated++;
    };

    updatePromises.push(
      updateFn().catch(err => {
        errors.push({ product: product.name, error: err instanceof Error ? err.message : String(err) });
      })
    );
  }

  // Exécuter par batch de 50
  const BATCH_SIZE = 50;
  for (let i = 0; i < updatePromises.length; i += BATCH_SIZE) {
    await Promise.all(updatePromises.slice(i, i + BATCH_SIZE));
    if (i + BATCH_SIZE < updatePromises.length) console.log(`⏳ ${Math.min(i + BATCH_SIZE, updatePromises.length)} mis à jour...`);
  }
  console.log(`✅ ${updated} produits mis à jour (${priceChanges} changements de prix)`);

  // ÉTAPE 3: Catégoriser et créer les nouveaux produits (appel AI)
  if (newProducts.length === 0) {
    console.log('✅ Aucun nouveau produit à catégoriser');
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n⏱️ Import terminé en ${duration}s`);
    return;
  }

  console.log(`\n[AI] Classification de ${newProducts.length} nouveaux produits...`);
  const productsForAI = newProducts.map(p => ({ name: p.name, brand: p.brand, volume: p.volume }));
  const classifications = await categorizeProductsBatch(productsForAI);

  // Batch query: charger tous les slugs existants
  const allSlugs = await prisma.product.findMany({ select: { slug: true } });
  const existingSlugs = new Set<string>(allSlugs.map((p: any) => p.slug));

  // Cache catégories
  const allCategories = await prisma.category.findMany();
  const categoryMap = new Map<string, any>(allCategories.map((c: any) => [c.slug, c]));

  // Cache marques
  const brandCache = new Map<string, string | null>();
  async function findOrCreateBrandCached(brandName: string): Promise<string | null> {
    if (brandCache.has(brandName)) return brandCache.get(brandName)!;
    const brandId = await findOrCreateBrand(brandName);
    brandCache.set(brandName, brandId);
    return brandId;
  }

  let created = 0;
  for (const product of newProducts) {
    try {
      const classification = classifications.get(product.name);
      const categorySlug = classification?.categorySlug || product.category || 'parfums';
      const category = categoryMap.get(categorySlug);
      if (!category) continue;

      const brandId = await findOrCreateBrandCached(product.brand);

      // Génération de slug
      let slug = generateSlug(product.name);
      let counter = 1;
      while (existingSlugs.has(slug)) { slug = generateSlug(product.name) + '-' + counter; counter++; }
      existingSlugs.add(slug);

      // Le prix effectif
      const effectivePrice = product.priceWithCode || product.currentPrice;
      const discountPercent = product.priceWithCode
        ? Math.round((1 - product.priceWithCode / product.currentPrice) * 100)
        : 0;

      // Transaction Product + Deal + PriceHistory
      await prisma.$transaction(async (tx: any) => {
        const dbProduct = await tx.product.create({
          data: {
            name: product.name.substring(0, 200), slug,
            description: (product.brand + ' - ' + product.name + (product.variant ? ' - ' + product.variant : '')).substring(0, 500),
            imageUrl: product.imageUrl, brand: product.brand,
            brandId: brandId,
            categoryId: category.id,
            subcategory: classification?.subcategorySlug || null,
            subsubcategory: classification?.subsubcategorySlug || null,
            merchantId: merchant.id, productUrl: product.productUrl,
          }
        });

        const variant = await findOrCreateVariant(tx, dbProduct.id, product.volume);
        const priceInfo = calculatePricePerUnit(effectivePrice, product.volume);

        const isTrending = (product as any).isTrending || false;

        // Créer le deal en PENDING (sera scoré par score-deals ensuite)
        await tx.deal.create({
          data: {
            productId: dbProduct.id,
            variantId: variant?.id || null,
            title: product.brand + (discountPercent > 0 ? ' -' + discountPercent + '% : ' : ' : ') + product.name.substring(0, 100),
            refinedTitle: classification?.refinedTitle || null,
            description: discountPercent > 0 
              ? `${discountPercent}% de réduction${product.promoCode ? ' avec le code ' + product.promoCode : ''} !`
              : `${product.brand} en promo sur Notino${product.promoCode ? ' avec le code ' + product.promoCode : ''}`,
            dealPrice: effectivePrice, 
            originalPrice: product.currentPrice,
            discountPercent,
            discountAmount: product.currentPrice - effectivePrice,
            volume: product.volume || null,
            volumeValue: priceInfo?.volumeValue || null,
            volumeUnit: priceInfo?.volumeUnit || null,
            pricePerUnit: priceInfo?.pricePerUnit || null,
            brandTier: classification?.brandTier || 2,
            sourceUrl: (product as any).sourceUrl || null,
            isHot: false,
            isTrending,
            status: 'PENDING',
            votes: 0, views: 0,
          }
        });

        await tx.priceHistory.create({ 
          data: { 
            productId: dbProduct.id, 
            price: effectivePrice,
            variantId: variant?.id || null,
            volumeValue: priceInfo?.volumeValue || null,
            volumeUnit: priceInfo?.volumeUnit || null,
            volumeRaw: product.volume || null,
            date: new Date() 
          } 
        });
      });

      created++;
      if (created % 20 === 0) console.log(`🆕 ${created}/${newProducts.length} nouveaux créés...`);
    } catch (err) {
      errors.push({ product: product.name, error: err instanceof Error ? err.message : String(err) });
    }
  }

  // Rapport final
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n⏱️ Import terminé en ${duration}s`);
  console.log(`📊 Résumé: ${created} nouveaux, ${updated} mis à jour, ${priceChanges} changements de prix`);
  if (errors.length > 0) {
    console.log(`⚠️ ${errors.length} erreurs:`);
    errors.slice(0, 5).forEach(e => console.log(`  ❌ ${e.product}: ${e.error}`));
    if (errors.length > 5) console.log(`  ... et ${errors.length - 5} autres`);
  }
}

async function cleanAndImport() {
  // Attention: ne supprime que les produits Notino
  const merchant = await prisma.merchant.findFirst({ where: { slug: 'notino' } });
  if (merchant) {
    const products = await prisma.product.findMany({ where: { merchantId: merchant.id }, select: { id: true } });
    const productIds = products.map((p: any) => p.id);
    if (productIds.length > 0) {
      await prisma.priceHistory.deleteMany({ where: { productId: { in: productIds } } });
      await prisma.deal.deleteMany({ where: { productId: { in: productIds } } });
      await prisma.product.deleteMany({ where: { merchantId: merchant.id } });
      console.log(`🗑️ ${productIds.length} produits Notino supprimés`);
    }
  }
  await importProducts();
}

const args = process.argv.slice(2);
if (args.includes('--clean')) { cleanAndImport().catch(console.error).finally(() => prisma.$disconnect()); }
else { importProducts().catch(console.error).finally(() => prisma.$disconnect()); }
