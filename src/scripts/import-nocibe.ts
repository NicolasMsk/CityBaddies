import { NocibeScraper, NocibeProduct } from '../lib/scraping/nocibe';
import { PrismaClient } from '@prisma/client';
import { categorizeProductsBatch } from '../lib/ai/categorize';
import { findOrCreateBrand } from '../lib/brands';
import { calculatePricePerUnit, findOrCreateVariant } from '../lib/utils/volume';
import { calculateDealScore, tagsToString } from '../lib/utils/scoring';

const prisma = new PrismaClient() as any;

function generateSlug(name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 50);
}

// Les URLs sont maintenant dans la table ScrapingSource
// Pour ajouter/modifier des URLs: npx tsx src/scripts/seed-scraping-sources.ts

const DB_CATEGORIES = [
  { slug: 'maquillage', name: 'Maquillage', icon: 'Sparkles', description: 'Fonds de teint' },
  { slug: 'soins-visage', name: 'Soins visage', icon: 'Droplets', description: 'Cremes serums' },
  { slug: 'soins-corps', name: 'Soins corps', icon: 'Heart', description: 'Lotions' },
  { slug: 'cheveux', name: 'Cheveux', icon: 'Scissors', description: 'Shampoings' },
  { slug: 'parfums', name: 'Parfums', icon: 'Gem', description: 'Parfums' },
  { slug: 'accessoires', name: 'Accessoires', icon: 'Crown', description: 'Trousses' },
];

async function importProducts() {
  const startTime = Date.now();
  console.log('🚀 Import Nocibe...');
  let merchant = await prisma.merchant.findFirst({ where: { slug: 'nocibe' } });
  if (!merchant) {
    merchant = await prisma.merchant.create({ data: { name: 'Nocibe', slug: 'nocibe', logoUrl: 'https://www.nocibe.fr/favicon.ico', website: 'https://www.nocibe.fr' } });
  }
  console.log(`🏪 Merchant: ${merchant.name}`);

  for (const cat of DB_CATEGORIES) {
    await prisma.category.upsert({ where: { slug: cat.slug }, update: {}, create: cat });
  }

  // Debug: Afficher toutes les sources sans filtre
  const allSources = await prisma.scrapingSource.findMany();
  console.log(`📊 Total sources en BDD: ${allSources.length}`);
  if (allSources.length > 0) {
    console.log(`   Première source: merchantId=${allSources[0].merchantId}, isActive=${allSources[0].isActive}`);
  }

  // Récupérer les sources de scraping depuis la BDD
  const scrapingSources = await prisma.scrapingSource.findMany({
    where: { merchantId: merchant.id, isActive: true },
    orderBy: { priority: 'desc' },
  });

  if (scrapingSources.length === 0) {
    console.log('⚠️ Aucune source de scraping trouvée pour Nocibé.');
    console.log(`   merchantId recherché: ${merchant.id}`);
    console.log('   Exécutez: npx tsx src/scripts/seed-scraping-sources.ts');
    return;
  }

  console.log(`📋 ${scrapingSources.length} sources à scraper`);

  const scraper = new NocibeScraper({ headless: true, delayBetweenRequests: 2000 });
  const allProducts: NocibeProduct[] = [];
  try {
    await scraper.init();
    for (const source of scrapingSources) {
      console.log(`\n🔍 ${source.name} (${source.type})`);
      const result = await scraper.scrapeCategoryPage(source.url, source.maxProducts);
      for (const product of result.products) {
        product.category = source.category;
        // Marquer les produits comme trending si la source est de type trending
        (product as any).isTrending = source.type === 'trending';
        if (!allProducts.find(p => p.productUrl === product.productUrl)) allProducts.push(product);
      }
      // Mettre à jour lastScraped
      await prisma.scrapingSource.update({
        where: { id: source.id },
        data: { lastScraped: new Date() },
      });
    }
    await scraper.close();
  } catch (error) { await scraper.close(); return; }

  // Filtrer uniquement les produits avec un volume
  const productsWithSize = allProducts.filter(p => p.size);
  console.log(`${allProducts.length} produits scraped, ${productsWithSize.length} avec volume`);

  // ÉTAPE 1: Batch query - récupérer tous les produits existants en 2 requêtes
  const productUrls = productsWithSize.map(p => p.productUrl);
  const productNames = productsWithSize.map(p => p.name.substring(0, 200));

  // Requête batch par URL (critère principal)
  const existingByUrl = await prisma.product.findMany({
    where: { productUrl: { in: productUrls } },
    include: { deals: true }
  });
  const urlMap = new Map<string, any>(existingByUrl.map((p: any) => [p.productUrl, p]));

  // Requête batch par nom+marque+marchand (fallback)
  const existingByName = await prisma.product.findMany({
    where: { 
      merchantId: merchant.id,
      name: { in: productNames }
    },
    include: { deals: true }
  });
  const nameMap = new Map<string, any>(existingByName.map((p: any) => [`${p.name}|${p.brand}`, p]));

  // Séparer les produits existants des nouveaux (sans requête DB)
  const existingProducts: typeof productsWithSize = [];
  const newProducts: typeof productsWithSize = [];

  for (const product of productsWithSize) {
    // 1. Chercher d'abord par URL (critère infaillible)
    let dbProduct = urlMap.get(product.productUrl) || null;

    // 2. Fallback: nom + marque (pour migration)
    if (!dbProduct) {
      const key = `${product.name.substring(0, 200)}|${product.brand}`;
      dbProduct = nameMap.get(key) || null;
      // Si trouvé par nom, vérifier le volume pour éviter les faux positifs
      if (dbProduct) {
        const existingDeal = dbProduct.deals[0];
        if (existingDeal && existingDeal.volume !== product.size) {
          dbProduct = null; // Variante de taille = nouveau produit
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
  // Batch query: récupérer les derniers prix pour éviter les PriceHistory inutiles
  const existingProductIds = existingProducts.map(p => (p as any)._dbProduct.id);
  const lastPrices = await prisma.priceHistory.findMany({
    where: { productId: { in: existingProductIds } },
    orderBy: { date: 'desc' },
    distinct: ['productId'],
    select: { productId: true, price: true }
  });
  const lastPriceMap = new Map<number, number>(lastPrices.map((p: any) => [p.productId, p.price]));

  // Collecter les erreurs au lieu de les ignorer
  const errors: Array<{ product: string; error: string }> = [];
  let updated = 0;
  let priceChanges = 0;

  // Préparer les updates en batch
  const updatePromises: Promise<void>[] = [];
  
  for (const product of existingProducts) {
    const updateFn = async () => {
      const dbProduct = (product as any)._dbProduct;
      const existingDeal = (product as any)._existingDeal;

      // Mettre à jour uniquement les infos produit (pas les prix - ils sont dans Deal)
      await prisma.product.update({
        where: { id: dbProduct.id },
        data: { 
          imageUrl: product.imageUrl,
          productUrl: product.productUrl,
        }
      });

      // Créer/trouver la variante pour ce volume
      const variant = await findOrCreateVariant(prisma, dbProduct.id, product.size);

      if (existingDeal && product.discountPercent >= 5) {
        const priceInfo = calculatePricePerUnit(product.currentPrice, product.size);
        const isTrending = (product as any).isTrending || false;
        
        const scoreResult = calculateDealScore({
          discountPercent: product.discountPercent,
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
            title: product.brand + ' -' + product.discountPercent + '% : ' + product.name.substring(0, 100),
            dealPrice: product.currentPrice, 
            originalPrice: product.originalPrice,
            discountPercent: product.discountPercent, 
            discountAmount: product.originalPrice - product.currentPrice,
            variantId: variant?.id || null,
            volume: product.size || null,
            volumeValue: priceInfo?.volumeValue || null,
            volumeUnit: priceInfo?.volumeUnit || null,
            pricePerUnit: priceInfo?.pricePerUnit || null,
            score: scoreResult.score,
            tags: tagsToString(scoreResult.tags),
            isTrending,
            isExpired: false,
            isHot: existingDeal.votes >= 20,
            updatedAt: new Date(),
          }
        });
      }

      // PriceHistory uniquement si le prix a changé
      const lastPrice = lastPriceMap.get(dbProduct.id);
      if (lastPrice !== product.currentPrice) {
        await prisma.priceHistory.create({ data: { productId: dbProduct.id, price: product.currentPrice, date: new Date() } });
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

  // Exécuter tous les updates en parallèle (par batch de 50 pour éviter surcharge)
  const BATCH_SIZE = 50;
  for (let i = 0; i < updatePromises.length; i += BATCH_SIZE) {
    await Promise.all(updatePromises.slice(i, i + BATCH_SIZE));
    if (i + BATCH_SIZE < updatePromises.length) console.log(`⏳ ${Math.min(i + BATCH_SIZE, updatePromises.length)} mis à jour...`);
  }
  console.log(`✅ ${updated} produits mis à jour (${priceChanges} changements de prix)`);

  // ÉTAPE 3: Catégoriser et créer les nouveaux produits (appel AI)
  if (newProducts.length === 0) {
    console.log('✅ Aucun nouveau produit à catégoriser');
    return;
  }

  console.log(`\n[AI] Classification de ${newProducts.length} nouveaux produits...`);
  const productsForAI = newProducts.map(p => ({ name: p.name, brand: p.brand, volume: p.size }));
  const classifications = await categorizeProductsBatch(productsForAI);

  // Batch query: charger tous les slugs existants une seule fois
  const allSlugs = await prisma.product.findMany({ select: { slug: true } });
  const existingSlugs = new Set<string>(allSlugs.map((p: any) => p.slug));

  // Cache: charger toutes les catégories une seule fois
  const allCategories = await prisma.category.findMany();
  const categoryMap = new Map<string, any>(allCategories.map((c: any) => [c.slug, c]));

  // Cache: éviter les requêtes répétées pour les mêmes marques
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
      const categorySlug = classification?.categorySlug || product.category;
      const category = categoryMap.get(categorySlug);
      if (!category) continue;

      const brandId = await findOrCreateBrandCached(product.brand);

      // Génération de slug avec cache Set (pas de requête DB)
      let slug = generateSlug(product.name);
      let counter = 1;
      while (existingSlugs.has(slug)) { slug = generateSlug(product.name) + '-' + counter; counter++; }
      existingSlugs.add(slug); // Ajouter au cache pour les prochains produits

      // Transaction pour cohérence Product + Deal + PriceHistory
      await prisma.$transaction(async (tx: any) => {
        const dbProduct = await tx.product.create({
          data: {
            name: product.name.substring(0, 200), slug,
            description: (product.brand + ' - ' + product.name).substring(0, 500),
            imageUrl: product.imageUrl, brand: product.brand, brandId,
            categoryId: category.id, 
            subcategory: classification?.subcategorySlug || null,
            subsubcategory: classification?.subsubcategorySlug || null,
            merchantId: merchant.id, productUrl: product.productUrl,
          }
        });

        // Créer la variante pour ce volume
        const variant = await findOrCreateVariant(tx, dbProduct.id, product.size);

        if (product.discountPercent >= 5) {
          const priceInfo = calculatePricePerUnit(product.currentPrice, product.size);
          const isTrending = (product as any).isTrending || false;
          
          const scoreResult = calculateDealScore({
            discountPercent: product.discountPercent,
            brandTier: classification?.brandTier || null,
            pricePerUnit: priceInfo?.pricePerUnit || null,
            isHot: false,
            isTrending,
            categorySlug: categorySlug,
            subcategorySlug: classification?.subcategorySlug || undefined,
            subsubcategorySlug: classification?.subsubcategorySlug || undefined,
            productName: product.name,
          });

          await tx.deal.create({
            data: {
              productId: dbProduct.id,
              variantId: variant?.id || null,
              title: product.brand + ' -' + product.discountPercent + '% : ' + product.name.substring(0, 100),
              refinedTitle: classification?.refinedTitle || null,
              description: product.discountPercent + '% de reduction !',
              dealPrice: product.currentPrice, originalPrice: product.originalPrice,
              discountPercent: product.discountPercent, discountAmount: product.originalPrice - product.currentPrice,
              volume: product.size || null,
              volumeValue: priceInfo?.volumeValue || null,
              volumeUnit: priceInfo?.volumeUnit || null,
              pricePerUnit: priceInfo?.pricePerUnit || null,
              brandTier: classification?.brandTier || 2,
              score: scoreResult.score,
              tags: tagsToString(scoreResult.tags),
              isHot: false,
              isTrending,
              isExpired: false,
              votes: 0, views: 0,
            }
          });
        }

        await tx.priceHistory.create({ data: { productId: dbProduct.id, price: product.currentPrice, date: new Date() } });
      });

      created++;
      if (created % 20 === 0) console.log(`🆕 ${created}/${newProducts.length} nouveaux créés...`);
    } catch (err) {
      errors.push({ product: product.name, error: err instanceof Error ? err.message : String(err) });
    }
  }

  // Rapport final avec timing
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
  const merchant = await prisma.merchant.findFirst({ where: { slug: 'nocibe' } });
  if (merchant) {
    const products = await prisma.product.findMany({ where: { merchantId: merchant.id }, select: { id: true } });
    const productIds = products.map((p: any) => p.id);
    await prisma.priceHistory.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.deal.deleteMany({ where: { productId: { in: productIds } } });
    await prisma.product.deleteMany({ where: { merchantId: merchant.id } });
  }
  await importProducts();
}

const args = process.argv.slice(2);
if (args.includes('--clean')) { cleanAndImport().catch(console.error).finally(() => prisma.$disconnect()); }
else { importProducts().catch(console.error).finally(() => prisma.$disconnect()); }
