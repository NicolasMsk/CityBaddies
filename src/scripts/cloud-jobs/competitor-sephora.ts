/**
 * =============================================================================
 * COMPETITOR-SEPHORA.TS — Cloud Run Job
 * =============================================================================
 *
 * Lancé tous les jours à 9h.
 * Récupère TOUS les deals LIVE qui ne viennent PAS de Sephora,
 * cherche le même produit sur Sephora via sephora-search.ts,
 * et upsert le résultat dans CompetitorPrice.
 *
 * =============================================================================
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { searchSephoraPrice, extractSephoraPriceFromUrl } from '../../lib/scraping/sephora-search';
import { closeBrowser } from '../../lib/scraping/search-utils';

const prisma = new PrismaClient();

const DELAY_BETWEEN_DEALS = parseInt(process.env.DELAY_BETWEEN_DEALS || '3000');
const MAX_DEALS = parseInt(process.env.MAX_DEALS || '500');
const SKIP_RECENT_DAYS = parseInt(process.env.SKIP_RECENT_DAYS || '0');

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function cleanSearchQuery(rawQuery: string, brand: string): string {
  let query = rawQuery;
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  query = query.replace(/^-?\d+%\s*:?\s*/i, '');
  query = query.replace(/\(?\d+(?:[.,]\d+)?\s*(ml|g|oz|l|kg)\)?/gi, '');

  if (brand) {
    query = query.replace(new RegExp(`${esc(brand)}\\s*[-–—]?\\s*${esc(brand)}`, 'gi'), brand);
    query = query.replace(new RegExp(`\\b${esc(brand)}\\s+${esc(brand)}\\b`, 'gi'), brand);
  }

  query = query.replace(/\s+[-–—]\s+/g, ' ').replace(/["""«»]/g, '').replace(/\s+/g, ' ').trim();

  if (brand && !query.toLowerCase().includes(brand.toLowerCase())) {
    query = `${brand} ${query}`;
  }

  const words = query.split(' ');
  return words.length > 12 ? words.slice(0, 12).join(' ') : query;
}

async function main() {
  const startTime = Date.now();
  console.log('🚀 [CLOUD JOB] Competitor Sephora — Prix concurrents sur sephora.fr');
  console.log(`📅 ${new Date().toISOString()}`);
  console.log(`⚙️  Max deals: ${MAX_DEALS} | Délai: ${DELAY_BETWEEN_DEALS}ms | Skip si < ${SKIP_RECENT_DAYS}j`);

  const stats = { total: 0, processed: 0, found: 0, notFound: 0, errors: 0, skipped: 0 };

  try {
    // Récupérer le merchant Sephora
    const sephora = await prisma.merchant.findFirst({ where: { slug: 'sephora' } });
    if (!sephora) {
      console.error('❌ Merchant Sephora introuvable');
      process.exit(1);
    }

    // Tous les deals ACTIVE qui ne sont PAS de Sephora
    const deals = await prisma.deal.findMany({
      where: {
        status: 'ACTIVE',
        product: {
          merchant: { slug: { not: 'sephora' } },
        },
      },
      include: {
        product: {
          include: {
            merchant: true,
            brandRef: true,
          },
        },
        competitorPrices: {
          where: { merchantId: sephora.id },
        },
      },
      orderBy: { score: 'desc' },
      take: MAX_DEALS,
    });

    stats.total = deals.length;
    console.log(`\n📦 ${deals.length} deals LIVE (hors Sephora) à traiter\n`);

    for (let i = 0; i < deals.length; i++) {
      const deal = deals[i];
      const product = deal.product;
      const brand = product.brandRef?.name || product.brand || '';
      const productName = deal.refinedTitle || deal.title;
      const volume = deal.volume || '';
      const category = product.subcategory || '';

      console.log(`\n${'─'.repeat(70)}`);
      console.log(`  [${i + 1}/${deals.length}] ${brand} — ${productName}`);
      console.log(`  🏪 ${product.merchant?.name} | 💰 ${deal.dealPrice}€ | 📏 ${volume || '?'}`);

      // Skip si déjà enrichi récemment
      const existing = deal.competitorPrices[0];
      if (existing) {
        const ageMs = Date.now() - new Date(existing.updatedAt).getTime();
        const ageDays = ageMs / (1000 * 60 * 60 * 24);
        if (ageDays < SKIP_RECENT_DAYS) {
          console.log(`  ⏭️  Skip — déjà enrichi il y a ${ageDays.toFixed(1)}j (${existing.currentPrice}€)`);
          stats.skipped++;
          continue;
        }
      }

      try {
        let result;

        // Si productUrl existe déjà, extraction directe (skip search + GPT)
        if (existing?.productUrl) {
          console.log(`  🔗 URL connue — extraction directe`);
          result = await extractSephoraPriceFromUrl(existing.productUrl, volume || undefined);
        } else {
          // Sinon, flow complet (search + GPT + extraction)
          const searchQuery = cleanSearchQuery(`${brand} ${productName}`, brand);
          console.log(`  🔍 Query: "${searchQuery}"`);
          result = await searchSephoraPrice(searchQuery, volume || undefined, {
            brand,
            name: productName,
            category,
          });
        }

        if (result.found && result.currentPrice) {
          const diff = deal.dealPrice - result.currentPrice;
          const diffPct = result.currentPrice > 0 ? Math.round((diff / result.currentPrice) * 100) : 0;

          await prisma.competitorPrice.upsert({
            where: {
              dealId_merchantId: {
                dealId: deal.id,
                merchantId: sephora.id,
              },
            },
            create: {
              dealId: deal.id,
              merchantId: sephora.id,
              merchantName: 'Sephora',
              productName: result.productName || productName,
              productUrl: result.productUrl || '',
              currentPrice: result.currentPrice,
              originalPrice: result.originalPrice || null,
              discountPercent: result.originalPrice
                ? Math.round(((result.originalPrice - result.currentPrice) / result.originalPrice) * 100)
                : undefined,
              volume: result.volume || volume,
              inStock: result.inStock ?? true,
              matchConfidence: result.matchConfidence,
              matchMethod: result.matchMethod,
            },
            update: {
              productName: result.productName || productName,
              productUrl: result.productUrl || '',
              currentPrice: result.currentPrice,
              originalPrice: result.originalPrice || null,
              discountPercent: result.originalPrice
                ? Math.round(((result.originalPrice - result.currentPrice) / result.originalPrice) * 100)
                : undefined,
              volume: result.volume || volume,
              inStock: result.inStock ?? true,
              matchConfidence: result.matchConfidence,
              matchMethod: result.matchMethod,
            },
          });

          if (diff < 0) {
            console.log(`  ✅ ${result.currentPrice}€ sur Sephora — 🏆 ${Math.abs(diff).toFixed(2)}€ moins cher ici (${Math.abs(diffPct)}%)`);
          } else if (diff > 0) {
            console.log(`  ✅ ${result.currentPrice}€ sur Sephora — ⚠️ ${diff.toFixed(2)}€ plus cher ici (+${diffPct}%)`);
          } else {
            console.log(`  ✅ ${result.currentPrice}€ sur Sephora — ➡️ Prix identique`);
          }
          console.log(`  💾 Sauvegardé en BDD`);

          stats.found++;
        } else {
          console.log(`  ❌ Non trouvé sur Sephora: ${result.error || '?'}`);
          stats.notFound++;
        }
      } catch (err) {
        console.error(`  ⚠️ Erreur:`, err instanceof Error ? err.message : err);
        stats.errors++;
      }

      stats.processed++;
      await delay(DELAY_BETWEEN_DEALS);
    }

    // Rapport final
    const duration = ((Date.now() - startTime) / 60000).toFixed(1);
    const rate = stats.processed > 0 ? Math.round((stats.found / stats.processed) * 100) : 0;

    console.log(`\n${'═'.repeat(70)}`);
    console.log(`  📊 RAPPORT — COMPETITOR SEPHORA`);
    console.log(`${'═'.repeat(70)}`);
    console.log(`  ⏱️  Durée         : ${duration} min`);
    console.log(`  📦 Total deals    : ${stats.total}`);
    console.log(`  🔄 Traités        : ${stats.processed}`);
    console.log(`  ✅ Trouvés        : ${stats.found} (${rate}%)`);
    console.log(`  ❌ Non trouvés    : ${stats.notFound}`);
    console.log(`  ⚠️  Erreurs       : ${stats.errors}`);
    console.log(`  ⏭️  Skippés       : ${stats.skipped}`);
    console.log(`${'═'.repeat(70)}`);
    console.log(`\n✅ [CLOUD JOB] Competitor Sephora terminé!`);

    process.exit(0);
  } catch (error) {
    console.error('❌ [CLOUD JOB] Erreur fatale:', error);
    process.exit(1);
  } finally {
    await closeBrowser();
    await prisma.$disconnect();
  }
}

main().catch(err => {
  console.error('❌ Erreur non gérée:', err);
  process.exit(1);
});
