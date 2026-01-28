/**
 * Cloud Run Job - Enrichissement Prix Concurrents
 * 
 * Exécuté périodiquement pour enrichir les deals avec les prix des concurrents
 * Utilise Playwright + GPT-4o-mini Vision pour extraire les prix
 * 
 * Pour chaque deal avec un score >= MIN_SCORE :
 * - Si le deal vient de Nocibé -> chercher le prix chez Sephora ET Marionnaud
 * - Si le deal vient de Sephora -> chercher le prix chez Nocibé ET Marionnaud
 * - Si le deal vient de Marionnaud -> chercher le prix chez Sephora ET Nocibé
 */

import { PrismaClient, Merchant } from '@prisma/client';
import { 
  searchCompetitorPrice, 
  closeBrowser, 
  CompetitorSite 
} from '../../lib/scraping/competitor-price-search';

const prisma = new PrismaClient();

// Configuration Cloud Run
const MIN_SCORE = parseFloat(process.env.MIN_SCORE || '5');
const MAX_DEALS = parseInt(process.env.MAX_DEALS || '100');
const DELAY_BETWEEN_DEALS = parseInt(process.env.DELAY_BETWEEN_DEALS || '2000');

interface CompetitorInfo {
  merchant: Merchant;
  site: CompetitorSite;
}

async function delay(ms: number): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Nettoie et optimise la query de recherche pour Google/Serper
 */
function cleanSearchQuery(rawQuery: string, brand: string): string {
  let query = rawQuery;
  
  const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  // Supprimer les mentions de promo
  query = query.replace(/^-?\d+%\s*:?\s*/i, '');
  
  // Supprimer les infos de volume entre parenthèses
  query = query.replace(/\(\d+(?:[.,]\d+)?\s*(ml|g|oz|l)\)/gi, '');
  
  // Supprimer les doublons de marque
  if (brand) {
    const brandRegex = new RegExp(`${escapeRegex(brand)}\\s*[-–—]?\\s*${escapeRegex(brand)}`, 'gi');
    query = query.replace(brandRegex, brand);
    
    const doubleRegex = new RegExp(`\\b${escapeRegex(brand)}\\s+${escapeRegex(brand)}\\b`, 'gi');
    query = query.replace(doubleRegex, brand);
    
    const brandWords = brand.split(' ');
    if (brandWords.length > 1) {
      const lastWord = brandWords[brandWords.length - 1];
      const pattern = new RegExp(`${escapeRegex(brand)}\\s+${escapeRegex(lastWord)}\\b`, 'gi');
      query = query.replace(pattern, brand);
    }
  }
  
  // Nettoyer les tirets et caractères spéciaux
  query = query.replace(/\s+[-–—]\s+/g, ' ');
  query = query.replace(/["""«»]/g, '');
  query = query.replace(/\s+/g, ' ').trim();
  
  // Ajouter la marque si absente
  if (brand && !query.toLowerCase().includes(brand.toLowerCase())) {
    query = `${brand} ${query}`;
  }
  
  // Limiter la longueur
  const words = query.split(' ');
  if (words.length > 8) {
    query = words.slice(0, 8).join(' ');
  }
  
  return query;
}

async function main() {
  const startTime = Date.now();
  console.log('🚀 [CLOUD JOB] Enrichissement Prix Concurrents...');
  console.log(`📅 Date: ${new Date().toISOString()}`);
  console.log(`⚙️ Score minimum: ${MIN_SCORE}`);
  console.log(`⚙️ Max deals: ${MAX_DEALS}`);
  console.log(`⚙️ Délai entre deals: ${DELAY_BETWEEN_DEALS}ms`);

  const stats = {
    totalDeals: 0,
    processed: 0,
    found: 0,
    notFound: 0,
    errors: 0,
    skipped: 0,
    byMerchant: {} as Record<string, { found: number; notFound: number }>
  };

  try {
    // Récupérer tous les merchants
    const sephora = await prisma.merchant.findFirst({ where: { slug: 'sephora' } });
    const nocibe = await prisma.merchant.findFirst({ where: { slug: 'nocibe' } });
    const marionnaud = await prisma.merchant.findFirst({ where: { slug: 'marionnaud' } });

    if (!sephora || !nocibe || !marionnaud) {
      console.error('❌ Merchants non trouvés');
      process.exit(1);
    }

    console.log(`\n🏪 Merchants: Sephora=${sephora.id}, Nocibé=${nocibe.id}, Marionnaud=${marionnaud.id}`);

    // Mapping des concurrents par merchant
    const competitorsMap: Record<string, CompetitorInfo[]> = {
      [sephora.id]: [
        { merchant: nocibe, site: 'nocibe' },
        { merchant: marionnaud, site: 'marionnaud' }
      ],
      [nocibe.id]: [
        { merchant: sephora, site: 'sephora' },
        { merchant: marionnaud, site: 'marionnaud' }
      ],
      [marionnaud.id]: [
        { merchant: sephora, site: 'sephora' },
        { merchant: nocibe, site: 'nocibe' }
      ]
    };

    // Récupérer les deals avec score >= minScore
    const deals = await prisma.deal.findMany({
      where: {
        score: { gte: MIN_SCORE },
        isExpired: false,
        volume: { not: null }
      },
      include: {
        product: {
          include: {
            merchant: true,
            brandRef: true
          }
        },
        competitorPrices: true
      },
      orderBy: { score: 'desc' },
      take: MAX_DEALS
    });

    stats.totalDeals = deals.length;
    console.log(`\n📦 ${deals.length} deals à enrichir (score >= ${MIN_SCORE})\n`);

    for (let i = 0; i < deals.length; i++) {
      const deal = deals[i];
      const product = deal.product;
      const merchantSlug = product.merchant?.slug || 'unknown';
      const brand = product.brandRef?.name || product.brand || 'Unknown';

      console.log(`\n[${i + 1}/${deals.length}] ${product.name}`);
      console.log(`   Merchant: ${merchantSlug} | Score: ${deal.score} | Volume: ${deal.volume}`);

      // Vérifier si déjà enrichi récemment (moins de 7 jours)
      const recentPrices = deal.competitorPrices.filter(cp => {
        const age = Date.now() - new Date(cp.updatedAt).getTime();
        return age < 7 * 24 * 60 * 60 * 1000;
      });

      if (recentPrices.length >= 2) {
        console.log(`   ⏭️ Déjà enrichi récemment (${recentPrices.length} prix)`);
        stats.skipped++;
        continue;
      }

      // Trouver les concurrents pour ce merchant
      const competitors = competitorsMap[product.merchantId];
      if (!competitors) {
        console.log(`   ⏭️ Merchant inconnu: ${product.merchantId}`);
        stats.skipped++;
        continue;
      }

      // Construire la query de recherche
      const searchQuery = cleanSearchQuery(
        `${brand} ${product.name} ${deal.volume}`,
        brand
      );
      console.log(`   🔍 Query: "${searchQuery}"`);

      // Chercher sur chaque concurrent
      for (const competitor of competitors) {
        const competitorSlug = competitor.site;

        // Initialiser les stats si besoin
        if (!stats.byMerchant[competitorSlug]) {
          stats.byMerchant[competitorSlug] = { found: 0, notFound: 0 };
        }

        try {
          const result = await searchCompetitorPrice(searchQuery, competitorSlug, deal.volume || undefined);

          if (result.found && result.currentPrice) {
            // Sauvegarder le prix trouvé
            await prisma.competitorPrice.upsert({
              where: {
                dealId_merchantId: {
                  dealId: deal.id,
                  merchantId: competitor.merchant.id
                }
              },
              update: {
                currentPrice: result.currentPrice,
                originalPrice: result.originalPrice || null,
                productUrl: result.productUrl || '',
                productName: result.productName || deal.title,
                volume: result.volume || deal.volume,
                inStock: result.inStock ?? true,
                lastChecked: new Date()
              },
              create: {
                dealId: deal.id,
                merchantId: competitor.merchant.id,
                merchantName: competitorSlug,
                productName: result.productName || deal.title,
                currentPrice: result.currentPrice,
                originalPrice: result.originalPrice || null,
                productUrl: result.productUrl || '',
                volume: result.volume || deal.volume,
                inStock: result.inStock ?? true
              }
            });

            console.log(`   ✅ ${competitorSlug}: ${result.currentPrice}€`);
            stats.found++;
            stats.byMerchant[competitorSlug].found++;
          } else {
            console.log(`   ❌ ${competitorSlug}: ${result.error || 'Non trouvé'}`);
            stats.notFound++;
            stats.byMerchant[competitorSlug].notFound++;
          }

        } catch (error) {
          console.error(`   ⚠️ ${competitorSlug}: Erreur - ${error}`);
          stats.errors++;
        }

        // Délai entre les recherches
        await delay(DELAY_BETWEEN_DEALS);
      }

      stats.processed++;
    }

    // Rapport final
    const duration = ((Date.now() - startTime) / 60000).toFixed(1);
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 [CLOUD JOB] RAPPORT FINAL - ENRICHISSEMENT');
    console.log('='.repeat(60));
    console.log(`⏱️  Durée: ${duration} minutes`);
    console.log(`📦 Total deals: ${stats.totalDeals}`);
    console.log(`🔄 Traités: ${stats.processed}`);
    console.log(`✅ Trouvés: ${stats.found}`);
    console.log(`❌ Non trouvés: ${stats.notFound}`);
    console.log(`⚠️ Erreurs: ${stats.errors}`);
    console.log(`⏭️ Ignorés: ${stats.skipped}`);

    if (Object.keys(stats.byMerchant).length > 0) {
      console.log(`\n📈 Par concurrent:`);
      for (const [slug, data] of Object.entries(stats.byMerchant)) {
        const total = data.found + data.notFound;
        const rate = total > 0 ? Math.round((data.found / total) * 100) : 0;
        console.log(`   ${slug}: ${data.found}/${total} trouvés (${rate}%)`);
      }
    }

    console.log('\n✅ [CLOUD JOB] Enrichissement terminé!');
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
  console.error('❌ [CLOUD JOB] Erreur non gérée:', err);
  process.exit(1);
});
