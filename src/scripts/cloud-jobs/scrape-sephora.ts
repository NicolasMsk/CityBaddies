/**
 * Cloud Run Job - Scrape Sephora
 * Exécuté quotidiennement pour alimenter la base de données
 * 
 * Ce script réutilise la logique de import-sephora.ts
 */

import { SephoraScraper, SephoraProduct } from '../../lib/scraping/sephora';
import { PrismaClient } from '@prisma/client';
import { categorizeProductsBatch } from '../../lib/ai/categorize';
import { findOrCreateBrand } from '../../lib/brands';
import { calculatePricePerUnit, findOrCreateVariant } from '../../lib/utils/volume';
import { calculateDealScore, tagsToString } from '../../lib/utils/scoring';

const prisma = new PrismaClient() as any;

// Configuration Cloud Run
const MAX_PRODUCTS_PER_SOURCE = parseInt(process.env.MAX_PRODUCTS_PER_SOURCE || '100');
const MAX_TOTAL_PRODUCTS = parseInt(process.env.MAX_TOTAL_PRODUCTS || '500');

function generateSlug(name: string): string {
  return name.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
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

async function main() {
  const startTime = Date.now();
  console.log('🚀 [CLOUD JOB] Scraping Sephora...');
  console.log(`📅 Date: ${new Date().toISOString()}`);
  console.log(`⚙️ Max produits par source: ${MAX_PRODUCTS_PER_SOURCE}`);
  console.log(`⚙️ Max total produits: ${MAX_TOTAL_PRODUCTS}`);

  try {
    // Récupérer ou créer le merchant
    let merchant = await prisma.merchant.findFirst({ where: { slug: 'sephora' } });
    if (!merchant) {
      merchant = await prisma.merchant.create({
        data: {
          name: 'Sephora',
          slug: 'sephora',
          logoUrl: '/images/sephora_logo.png',
          website: 'https://www.sephora.fr'
        }
      });
      console.log('✅ Merchant Sephora créé');
    }
    console.log(`🏪 Merchant: ${merchant.name}`);

    // S'assurer que les catégories existent
    for (const cat of DB_CATEGORIES) {
      await prisma.category.upsert({ where: { slug: cat.slug }, update: {}, create: cat });
    }

    // Récupérer les sources actives
    const scrapingSources = await prisma.scrapingSource.findMany({
      where: { merchantId: merchant.id, isActive: true },
      orderBy: { priority: 'desc' },
    });

    if (scrapingSources.length === 0) {
      console.log('⚠️ Aucune source de scraping active pour Sephora');
      return;
    }

    console.log(`📋 ${scrapingSources.length} sources à scraper`);

    // Scraper toutes les sources
    const scraper = new SephoraScraper({ headless: true, delayBetweenRequests: 2000 });
    const allProducts: SephoraProduct[] = [];

    try {
      await scraper.init();

      for (const source of scrapingSources) {
        console.log(`\n🔍 ${source.name} (${source.type})`);
        console.log(`   URL: ${source.url}`);

        try {
          const maxProducts = Math.min(source.maxProducts || 50, MAX_PRODUCTS_PER_SOURCE);
          const result = await scraper.scrapeCategoryPage(source.url, maxProducts);
          
          for (const product of result.products) {
            product.category = source.category;
            (product as any).sourceUrl = source.url;
            (product as any).isTrending = source.type === 'trending';
            if (!allProducts.find(p => p.productUrl === product.productUrl)) {
              allProducts.push(product);
            }
          }

          // Mettre à jour lastScraped
          await prisma.scrapingSource.update({
            where: { id: source.id },
            data: { lastScraped: new Date() },
          });

          console.log(`   ✅ ${result.products.length} produits`);
        } catch (error) {
          console.error(`   ❌ Erreur: ${error}`);
        }
      }

      await scraper.close();
    } catch (error) {
      await scraper.close();
      throw error;
    }

    // Filtrer les produits avec volume et limiter
    const productsWithVolume = allProducts.filter(p => p.volume).slice(0, MAX_TOTAL_PRODUCTS);
    console.log(`\n📊 ${allProducts.length} produits scrapés, ${productsWithVolume.length} avec volume`);

    // Récupérer les produits existants
    const productUrls = productsWithVolume.map(p => p.productUrl);
    const existingByUrl = await prisma.product.findMany({
      where: { productUrl: { in: productUrls } },
      include: { deals: true }
    });
    const urlMap = new Map<string, any>(existingByUrl.map((p: any) => [p.productUrl, p]));

    // Séparer existants vs nouveaux
    const existingProducts: typeof productsWithVolume = [];
    const newProducts: typeof productsWithVolume = [];

    for (const product of productsWithVolume) {
      const dbProduct = urlMap.get(product.productUrl);
      if (dbProduct) {
        existingProducts.push(product);
        (product as any)._dbProduct = dbProduct;
        (product as any)._existingDeal = dbProduct.deals[0];
      } else {
        newProducts.push(product);
      }
    }

    console.log(`📊 ${existingProducts.length} existants, ${newProducts.length} nouveaux`);

    let totalCreated = 0;
    let totalUpdated = 0;
    let priceChanges = 0;

    // Mettre à jour les existants
    for (const product of existingProducts) {
      const existingDeal = (product as any)._existingDeal;

      if (existingDeal && existingDeal.dealPrice !== product.currentPrice) {
        const priceInfo = calculatePricePerUnit(product.currentPrice, product.volume);
        const isTrending = (product as any).isTrending || false;
        
        const scoreResult = calculateDealScore({
          discountPercent: product.discountPercent,
          brandTier: existingDeal.brandTier,
          pricePerUnit: priceInfo?.pricePerUnit || null,
          isHot: existingDeal.votes >= 20,
          isTrending,
          categorySlug: product.category,
        });

        await prisma.deal.update({
          where: { id: existingDeal.id },
          data: {
            dealPrice: product.currentPrice,
            originalPrice: product.originalPrice || product.currentPrice,
            discountPercent: product.discountPercent || 0,
            discountAmount: (product.originalPrice || product.currentPrice) - product.currentPrice,
            score: scoreResult.score,
            tags: tagsToString(scoreResult.tags),
            isTrending,
            updatedAt: new Date(),
          }
        });
        priceChanges++;
        totalUpdated++;
      }
    }

    // Créer les nouveaux produits
    if (newProducts.length > 0) {
      console.log(`\n[AI] Classification de ${newProducts.length} nouveaux produits...`);
      const productsForAI = newProducts.map(p => ({ name: p.name, brand: p.brand, volume: p.volume }));
      const classificationsMap = await categorizeProductsBatch(productsForAI);

      for (let i = 0; i < newProducts.length; i++) {
        const product = newProducts[i];
        const classification = classificationsMap.get(product.name);

        if (!classification) continue;

        try {
          // Trouver ou créer la marque (retourne l'ID directement)
          const brandId = await findOrCreateBrand(product.brand);

          // Créer le produit
          const slug = generateSlug(`${product.brand}-${product.name}-${Date.now()}`);
          const dbProduct = await prisma.product.create({
            data: {
              name: product.name.substring(0, 200),
              slug,
              description: `${product.brand} - ${product.name}`,
              imageUrl: product.imageUrl,
              brand: product.brand,
              brandId: brandId,
              categoryId: (await prisma.category.findFirst({ where: { slug: classification.categorySlug } }))?.id || 
                         (await prisma.category.findFirst({ where: { slug: 'soins-visage' } }))!.id,
              subcategory: classification.subcategorySlug,
              subsubcategory: classification.subsubcategorySlug,
              merchantId: merchant.id,
              productUrl: product.productUrl,
              isActive: true,
            }
          });

          // Créer la variante
          const variant = await findOrCreateVariant(prisma, dbProduct.id, product.volume);

          // Calculer le score
          const priceInfo = calculatePricePerUnit(product.currentPrice, product.volume);
          const scoreResult = calculateDealScore({
            discountPercent: product.discountPercent || 0,
            brandTier: classification.brandTier,
            pricePerUnit: priceInfo?.pricePerUnit || null,
            isHot: false,
            isTrending: (product as any).isTrending || false,
            categorySlug: classification.categorySlug,
          });

          // Créer le deal
          await prisma.deal.create({
            data: {
              productId: dbProduct.id,
              variantId: variant?.id,
              title: `${product.brand} ${product.name}`.substring(0, 200),
              refinedTitle: `${product.brand} ${product.name} (${product.volume})`.substring(0, 200),
              dealPrice: product.currentPrice,
              originalPrice: product.originalPrice || product.currentPrice,
              discountPercent: product.discountPercent || 0,
              discountAmount: (product.originalPrice || product.currentPrice) - product.currentPrice,
              volume: product.volume,
              volumeValue: priceInfo?.volumeValue || null,
              volumeUnit: priceInfo?.volumeUnit || null,
              pricePerUnit: priceInfo?.pricePerUnit || null,
              brandTier: classification.brandTier,
              score: scoreResult.score,
              tags: tagsToString(scoreResult.tags),
              sourceUrl: (product as any).sourceUrl,
              isTrending: (product as any).isTrending || false,
              type: 'scraped',
            }
          });

          totalCreated++;
          if (totalCreated % 20 === 0) {
            console.log(`🆕 ${totalCreated}/${newProducts.length} nouveaux créés...`);
          }
        } catch (error) {
          console.error(`   ❌ Erreur produit "${product.name}": ${error}`);
        }
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('\n' + '='.repeat(50));
    console.log('📊 RÉSUMÉ SEPHORA');
    console.log('='.repeat(50));
    console.log(`✅ Nouveaux produits: ${totalCreated}`);
    console.log(`🔄 Mis à jour: ${totalUpdated}`);
    console.log(`💰 Changements de prix: ${priceChanges}`);
    console.log(`⏱️ Durée: ${elapsed}s`);
    console.log(`📅 Terminé: ${new Date().toISOString()}`);

  } catch (error) {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter
main()
  .then(() => {
    console.log('✅ Job terminé avec succès');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Job échoué:', error);
    process.exit(1);
  });
