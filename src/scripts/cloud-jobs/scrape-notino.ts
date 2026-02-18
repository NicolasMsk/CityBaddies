/**
 * Cloud Run Job - Scrape Notino
 * Exécuté quotidiennement pour alimenter la base de données
 * 
 * Utilise NotinoScraper (Playwright + Cheerio) directement
 * car Notino nécessite un nouveau contexte browser par page (Cloudflare)
 */

import { NotinoScraper } from '../../lib/scraping/notino';
import { PrismaClient } from '@prisma/client';
import { categorizeProductsBatch } from '../../lib/ai/categorize';
import { findOrCreateBrand } from '../../lib/brands';
import { calculatePricePerUnit, findOrCreateVariant } from '../../lib/utils/volume';

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

const MAX_TOTAL_PRODUCTS = parseInt(process.env.MAX_PRODUCTS || '1000');

async function main() {
  const startTime = Date.now();
  console.log('🚀 [CLOUD JOB] Scraping Notino...');
  console.log(`📅 Date: ${new Date().toISOString()}`);
  console.log(`⚙️ Max produits: ${MAX_TOTAL_PRODUCTS}`);

  try {
    // Marchand
    let merchant = await prisma.merchant.findFirst({ where: { slug: 'notino' } });
    if (!merchant) {
      merchant = await prisma.merchant.create({
        data: { name: 'Notino', slug: 'notino', logoUrl: 'https://www.notino.fr/favicon.ico', website: 'https://www.notino.fr' }
      });
    }

    for (const cat of DB_CATEGORIES) {
      await prisma.category.upsert({ where: { slug: cat.slug }, update: {}, create: cat });
    }

    // Sources
    const scrapingSources = await prisma.scrapingSource.findMany({
      where: { merchantId: merchant.id, isActive: true },
      orderBy: { priority: 'desc' },
    });

    if (scrapingSources.length === 0) {
      console.log('⚠️ Aucune source Notino. Exécutez seed-scraping-sources.ts');
      process.exit(0);
    }

    console.log(`📋 ${scrapingSources.length} sources à scraper`);

    // Scraping
    const scraper = new NotinoScraper({ headless: true, delayBetweenRequests: 3000, maxClicks: 20 });
    const allProducts: any[] = [];

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
      await prisma.scrapingSource.update({ where: { id: source.id }, data: { lastScraped: new Date() } });
    }
    await scraper.close();

    const productsToImport = allProducts.slice(0, MAX_TOTAL_PRODUCTS);
    console.log(`\n📦 ${allProducts.length} scrapés, ${productsToImport.length} à importer`);

    // Batch query existants
    const productUrls = productsToImport.map((p: any) => p.productUrl);
    const productNames = productsToImport.map((p: any) => p.name.substring(0, 200));

    const existingByUrl = await prisma.product.findMany({
      where: { productUrl: { in: productUrls } },
      include: { deals: true }
    });
    const urlMap = new Map(existingByUrl.map((p: any) => [p.productUrl, p]));

    const existingByName = await prisma.product.findMany({
      where: { merchantId: merchant.id, name: { in: productNames } },
      include: { deals: true }
    });
    const nameMap = new Map(existingByName.map((p: any) => [`${p.name}|${p.brand}`, p]));

    const existingProducts: any[] = [];
    const newProducts: any[] = [];

    for (const product of productsToImport) {
      let dbProduct: any = urlMap.get(product.productUrl) || null;
      if (!dbProduct) {
        const key = `${product.name.substring(0, 200)}|${product.brand}`;
        dbProduct = nameMap.get(key) || null;
        if (dbProduct) {
          const existingDeal = dbProduct.deals[0];
          if (existingDeal && existingDeal.volume !== product.volume) dbProduct = null;
        }
      }
      if (dbProduct) {
        existingProducts.push(product);
        product._dbProduct = dbProduct;
        product._existingDeal = dbProduct.deals[0];
      } else {
        newProducts.push(product);
      }
    }

    console.log(`📊 ${existingProducts.length} existants, ${newProducts.length} nouveaux`);

    // Update existants
    const existingProductIds = existingProducts.map((p: any) => p._dbProduct.id);
    const lastPrices = await prisma.priceHistory.findMany({
      where: { productId: { in: existingProductIds } },
      orderBy: { date: 'desc' },
      distinct: ['productId'],
      select: { productId: true, price: true }
    });
    const lastPriceMap = new Map(lastPrices.map((p: any) => [p.productId, p.price]));

    const errors: Array<{ product: string; error: string }> = [];
    let updated = 0;
    let priceChanges = 0;

    for (const product of existingProducts) {
      try {
        const dbProduct = product._dbProduct;
        const existingDeal = product._existingDeal;
        const effectivePrice = product.priceWithCode || product.currentPrice;

        await prisma.product.update({
          where: { id: dbProduct.id },
          data: { imageUrl: product.imageUrl, productUrl: product.productUrl }
        });

        const variant = await findOrCreateVariant(prisma, dbProduct.id, product.volume);
        const priceInfo = calculatePricePerUnit(effectivePrice, product.volume);

        if (existingDeal) {
          const discountPercent = product.priceWithCode
            ? Math.round((1 - product.priceWithCode / product.currentPrice) * 100) : 0;

          await prisma.deal.update({
            where: { id: existingDeal.id },
            data: {
              title: product.brand + (discountPercent > 0 ? ' -' + discountPercent + '% : ' : ' : ') + product.name.substring(0, 100),
              dealPrice: effectivePrice, originalPrice: product.currentPrice,
              discountPercent, discountAmount: product.currentPrice - effectivePrice,
              variantId: variant?.id || null, volume: product.volume || null,
              volumeValue: priceInfo?.volumeValue || null, volumeUnit: priceInfo?.volumeUnit || null,
              pricePerUnit: priceInfo?.pricePerUnit || null,
              sourceUrl: product.sourceUrl || existingDeal.sourceUrl || null,
              isTrending: product.isTrending || false,
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
              productId: dbProduct.id, price: effectivePrice,
              variantId: variant?.id || null,
              volumeValue: priceInfo?.volumeValue || null, volumeUnit: priceInfo?.volumeUnit || null,
              volumeRaw: product.volume || null, date: new Date()
            }
          });
          priceChanges++;
        }
        updated++;
      } catch (err) {
        errors.push({ product: product.name, error: err instanceof Error ? err.message : String(err) });
      }
    }

    console.log(`✅ ${updated} mis à jour (${priceChanges} changements de prix)`);

    // Créer les nouveaux avec AI
    if (newProducts.length > 0) {
      console.log(`\n[AI] Classification de ${newProducts.length} nouveaux produits...`);
      const productsForAI = newProducts.map((p: any) => ({ name: p.name, brand: p.brand, volume: p.volume }));
      const classifications = await categorizeProductsBatch(productsForAI);

      const allSlugs = await prisma.product.findMany({ select: { slug: true } });
      const existingSlugs = new Set(allSlugs.map((p: any) => p.slug));
      const allCategories = await prisma.category.findMany();
      const categoryMap = new Map(allCategories.map((c: any) => [c.slug, c]));
      const brandCache = new Map<string, string | null>();

      let created = 0;
      for (const product of newProducts) {
        try {
          const classification = classifications.get(product.name);
          const categorySlug = classification?.categorySlug || product.category || 'parfums';
          const category: any = categoryMap.get(categorySlug);
          if (!category) continue;

          let brandId = brandCache.get(product.brand);
          if (brandId === undefined) {
            brandId = await findOrCreateBrand(product.brand);
            brandCache.set(product.brand, brandId);
          }

          let slug = generateSlug(product.name);
          let counter = 1;
          while (existingSlugs.has(slug)) { slug = generateSlug(product.name) + '-' + counter; counter++; }
          existingSlugs.add(slug);

          const effectivePrice = product.priceWithCode || product.currentPrice;
          const discountPercent = product.priceWithCode
            ? Math.round((1 - product.priceWithCode / product.currentPrice) * 100) : 0;

          await prisma.$transaction(async (tx: any) => {
            const dbProduct = await tx.product.create({
              data: {
                name: product.name.substring(0, 200), slug,
                description: (product.brand + ' - ' + product.name).substring(0, 500),
                imageUrl: product.imageUrl, brand: product.brand,
                brandId, categoryId: category.id,
                subcategory: classification?.subcategorySlug || null,
                subsubcategory: classification?.subsubcategorySlug || null,
                merchantId: merchant.id, productUrl: product.productUrl,
              }
            });

            const variant = await findOrCreateVariant(tx, dbProduct.id, product.volume);
            const priceInfo = calculatePricePerUnit(effectivePrice, product.volume);

            await tx.deal.create({
              data: {
                productId: dbProduct.id, variantId: variant?.id || null,
                title: product.brand + (discountPercent > 0 ? ' -' + discountPercent + '% : ' : ' : ') + product.name.substring(0, 100),
                refinedTitle: classification?.refinedTitle || null,
                description: discountPercent > 0
                  ? `${discountPercent}% de réduction${product.promoCode ? ' avec le code ' + product.promoCode : ''} !`
                  : `${product.brand} en promo sur Notino`,
                dealPrice: effectivePrice, originalPrice: product.currentPrice,
                discountPercent, discountAmount: product.currentPrice - effectivePrice,
                volume: product.volume || null,
                volumeValue: priceInfo?.volumeValue || null, volumeUnit: priceInfo?.volumeUnit || null,
                pricePerUnit: priceInfo?.pricePerUnit || null,
                brandTier: classification?.brandTier || 2,
                sourceUrl: product.sourceUrl || null,
                isHot: false, isTrending: product.isTrending || false,
                status: 'PENDING', votes: 0, views: 0,
              }
            });

            await tx.priceHistory.create({
              data: {
                productId: dbProduct.id, price: effectivePrice,
                variantId: variant?.id || null,
                volumeValue: priceInfo?.volumeValue || null, volumeUnit: priceInfo?.volumeUnit || null,
                volumeRaw: product.volume || null, date: new Date()
              }
            });
          });

          created++;
          if (created % 20 === 0) console.log(`🆕 ${created}/${newProducts.length} créés...`);
        } catch (err) {
          errors.push({ product: product.name, error: err instanceof Error ? err.message : String(err) });
        }
      }

      console.log(`✅ ${created} nouveaux créés`);
    }

    // Rapport final
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('\n' + '='.repeat(60));
    console.log('📊 [CLOUD JOB] RAPPORT FINAL - NOTINO');
    console.log('='.repeat(60));
    console.log(`⏱️  Durée totale: ${duration}s`);
    console.log(`📦 Produits scrapés: ${allProducts.length}`);
    console.log(`🔄 Existants: ${existingProducts.length}`);
    console.log(`✅ Mis à jour: ${updated}`);
    console.log(`🆕 Nouveaux: ${newProducts.length}`);
    console.log(`💰 Changements de prix: ${priceChanges}`);

    if (errors.length > 0) {
      console.log(`\n⚠️ ${errors.length} erreurs:`);
      errors.slice(0, 10).forEach(e => console.log(`   ❌ ${e.product}: ${e.error}`));
    }

    console.log('\n✅ [CLOUD JOB] Scraping Notino terminé!');
    await prisma.$disconnect();
    process.exit(0);

  } catch (error) {
    console.error('❌ [CLOUD JOB] Erreur fatale:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

main().catch(err => {
  console.error('❌ [CLOUD JOB] Erreur non gérée:', err);
  process.exit(1);
});
