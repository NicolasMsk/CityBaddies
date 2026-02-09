/**
 * =============================================================================
 * ENRICH-COMPETITOR-PRICES.TS — ULTIMATE WORKFLOW V2
 * =============================================================================
 *
 * Pipeline en 3 étapes :
 *   1. RECHERCHE INTERNE → Chercher le produit via la barre de recherche du site
 *   2. SÉLECTION GPT     → GPT choisit le meilleur match (texte, pas vision)
 *   3. EXTRACTION DOM    → Parser le sélecteur de variantes (prix structuré)
 *
 * Usage:
 *   npx tsx src/scripts/enrich-competitor-prices.ts --source=sephora --limit=5 --target=nocibe
 *   npx tsx src/scripts/enrich-competitor-prices.ts --min-score=5 --limit=50
 *   npx tsx src/scripts/enrich-competitor-prices.ts --source=sephora --limit=3 --target=nocibe --dry-run
 *
 * =============================================================================
 */

import { PrismaClient, Merchant } from '@prisma/client';
import {
  searchCompetitorPrice,
  closeBrowser,
  CompetitorSite,
  CompetitorPriceResult,
} from '../lib/scraping/competitor-price-search';

const prisma = new PrismaClient();

// =============================================================================
// TYPES
// =============================================================================

interface EnrichmentStats {
  totalDeals: number;
  processed: number;
  found: number;
  notFound: number;
  errors: number;
  skipped: number;
  byMerchant: Record<string, { found: number; notFound: number; errors: number }>;
  byMethod: Record<string, number>;
  details: ResultDetail[];
}

interface ResultDetail {
  dealTitle: string;
  brand: string;
  dealPrice: number;
  volume: string;
  competitor: string;
  found: boolean;
  competitorPrice?: number;
  competitorVolume?: string;
  matchConfidence?: number;
  matchMethod?: string;
  savings?: number;
  savingsPercent?: number;
  error?: string;
}

interface CompetitorInfo {
  merchant: Merchant;
  site: CompetitorSite;
}

// =============================================================================
// HELPERS
// =============================================================================

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Nettoie la query de recherche
 */
function cleanSearchQuery(rawQuery: string, brand: string): string {
  let query = rawQuery;

  const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Supprimer promos
  query = query.replace(/^-?\d+%\s*:?\s*/i, '');

  // Supprimer volume entre parenthèses
  query = query.replace(/\(\d+(?:[.,]\d+)?\s*(ml|g|oz|l)\)/gi, '');

  // Dédupliquer marque
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

  // Tirets → espaces
  query = query.replace(/\s+[-–—]\s+/g, ' ');

  // Caractères spéciaux
  query = query.replace(/["""«»]/g, '');

  // Espaces multiples
  query = query.replace(/\s+/g, ' ').trim();

  // Ajouter marque si absente
  if (brand && !query.toLowerCase().includes(brand.toLowerCase())) {
    query = `${brand} ${query}`;
  }

  // Limiter à 12 mots (garder le nom complet)
  const words = query.split(' ');
  if (words.length > 12) {
    query = words.slice(0, 12).join(' ');
  }

  return query;
}

// =============================================================================
// ENRICHISSEMENT PRINCIPAL
// =============================================================================

async function enrichCompetitorPrices(opts: {
  minScore: number;
  limit: number;
  sourceFilter?: string;
  targetFilter?: string;
  dryRun: boolean;
}): Promise<EnrichmentStats> {
  const { minScore, limit, sourceFilter, targetFilter, dryRun } = opts;

  const stats: EnrichmentStats = {
    totalDeals: 0,
    processed: 0,
    found: 0,
    notFound: 0,
    errors: 0,
    skipped: 0,
    byMerchant: {},
    byMethod: {},
    details: [],
  };

  console.log(`\n${'═'.repeat(70)}`);
  console.log(`   🚀 ENRICHISSEMENT PRIX CONCURRENTS — ULTIMATE V2`);
  console.log(`${'═'.repeat(70)}`);
  console.log(`   Score minimum : ${minScore}`);
  console.log(`   Limite        : ${limit} deals`);
  if (sourceFilter) console.log(`   Source         : ${sourceFilter}`);
  if (targetFilter) console.log(`   Cible          : ${targetFilter}`);
  if (dryRun) console.log(`   🧪 MODE DRY-RUN (pas de sauvegarde en BDD)`);
  console.log(`${'═'.repeat(70)}\n`);

  // ─── Récupérer les merchants ───────────────────────────────────────
  const sephora = await prisma.merchant.findFirst({ where: { slug: 'sephora' } });
  const nocibe = await prisma.merchant.findFirst({ where: { slug: 'nocibe' } });
  const marionnaud = await prisma.merchant.findFirst({ where: { slug: 'marionnaud' } });

  if (!sephora || !nocibe || !marionnaud) {
    console.error('❌ Merchants manquants:');
    console.log(`   Sephora    : ${sephora ? '✅' : '❌'}`);
    console.log(`   Nocibé     : ${nocibe ? '✅' : '❌'}`);
    console.log(`   Marionnaud : ${marionnaud ? '✅' : '❌'}`);
    return stats;
  }

  const merchantMap: Record<string, Merchant> = {
    sephora,
    nocibe,
    marionnaud,
  };

  // ─── Construire le filtre de requête ────────────────────────────────
  const whereClause: any = {
    score: { gte: minScore },
    status: { not: 'EXPIRED' },
  };

  if (sourceFilter) {
    whereClause.product = {
      merchant: { slug: sourceFilter },
    };
  }

  // ─── Récupérer les deals ────────────────────────────────────────────
  const deals = await prisma.deal.findMany({
    where: whereClause,
    include: {
      product: {
        include: {
          merchant: true,
          brandRef: true,
        },
      },
      competitorPrices: true,
    },
    orderBy: { score: 'desc' },
    take: limit,
  });

  stats.totalDeals = deals.length;
  console.log(`📦 ${deals.length} deal(s) à traiter\n`);

  // ─── Déterminer les concurrents ─────────────────────────────────────
  const getCompetitors = (sourceSlug: string): CompetitorInfo[] => {
    const all: CompetitorInfo[] = [];
    if (sourceSlug !== 'sephora') all.push({ merchant: sephora, site: 'sephora' });
    if (sourceSlug !== 'nocibe') all.push({ merchant: nocibe, site: 'nocibe' });
    if (sourceSlug !== 'marionnaud') all.push({ merchant: marionnaud, site: 'marionnaud' });

    // Filtrer si --target spécifié
    if (targetFilter) {
      return all.filter(c => c.merchant.slug === targetFilter);
    }
    return all;
  };

  // ─── Boucle principale ─────────────────────────────────────────────
  for (const deal of deals) {
    const merchant = deal.product.merchant;
    const brand = deal.product.brandRef?.name || deal.product.brand || '';
    const productName = deal.refinedTitle || deal.title;
    const volume = deal.volume || '';
    const category = deal.product.type || '';

    console.log(`\n${'─'.repeat(70)}`);
    console.log(`  [${stats.processed + 1}/${stats.totalDeals}] ${brand} — ${productName}`);
    console.log(`  📏 Volume: ${volume || '?'} | ⭐ Score: ${deal.score} | 🏪 Source: ${merchant.name}`);
    console.log(`  💰 Prix deal: ${deal.dealPrice}€ (original: ${deal.originalPrice}€)`);

    // Concurrents déjà enrichis
    const existingCompetitors = new Set(deal.competitorPrices.map(cp => cp.merchantId));

    // Concurrents à checker
    const competitors = getCompetitors(merchant.slug);
    const competitorsToCheck = dryRun
      ? competitors // En dry-run, on teste tous
      : competitors.filter(c => !existingCompetitors.has(c.merchant.id));

    if (competitorsToCheck.length === 0) {
      console.log(`  ⏭️  SKIP: Tous les concurrents déjà enrichis`);
      stats.skipped++;
      stats.processed++;
      continue;
    }

    console.log(`  🎯 Concurrents à vérifier: ${competitorsToCheck.map(c => c.merchant.name).join(', ')}`);

    // Construire la query de recherche optimisée
    const searchQuery = cleanSearchQuery(deal.refinedTitle || deal.product.name, brand);
    console.log(`  🔍 Query: "${searchQuery}"`);

    // Construire le dealInfo pour le matching GPT (Nocibé V2)
    const dealInfo = {
      brand,
      name: productName,
      category,
    };

    // Chercher chez chaque concurrent
    for (const competitor of competitorsToCheck) {
      const competitorSlug = competitor.merchant.slug;

      // Init stats
      if (!stats.byMerchant[competitorSlug]) {
        stats.byMerchant[competitorSlug] = { found: 0, notFound: 0, errors: 0 };
      }

      console.log(`\n  🔎 Recherche chez ${competitor.merchant.name}...`);

      try {
        const result: CompetitorPriceResult = await searchCompetitorPrice(
          searchQuery,
          competitor.site,
          volume || undefined,
          dealInfo
        );

        if (result.found && result.currentPrice) {
          // ─── Calcul comparaison prix ──────────────────────
          const diff = deal.dealPrice - result.currentPrice;
          const diffPct = result.currentPrice > 0
            ? Math.round((diff / result.currentPrice) * 100)
            : 0;

          console.log(`  ✅ TROUVÉ: ${result.currentPrice}€ chez ${competitor.merchant.name}`);
          console.log(`     Volume   : ${result.volume || '?'}`);
          console.log(`     Méthode  : ${result.matchMethod || '?'}`);
          console.log(`     Confiance: ${result.matchConfidence || '?'}%`);

          if (diff < 0) {
            console.log(`     🏆 ${Math.abs(diff).toFixed(2)}€ MOINS CHER sur ${merchant.name} (${Math.abs(diffPct)}%)`);
          } else if (diff > 0) {
            console.log(`     ⚠️  ${diff.toFixed(2)}€ plus cher sur ${merchant.name} (+${diffPct}%)`);
          } else {
            console.log(`     ➡️  Prix identique`);
          }

          // Sauvegarder en BDD si pas dry-run
          if (!dryRun) {
            await prisma.competitorPrice.upsert({
              where: {
                dealId_merchantId: {
                  dealId: deal.id,
                  merchantId: competitor.merchant.id,
                },
              },
              create: {
                dealId: deal.id,
                merchantId: competitor.merchant.id,
                merchantName: competitor.merchant.name,
                productName: result.productName || productName,
                productUrl: result.productUrl || '',
                currentPrice: result.currentPrice,
                originalPrice: result.originalPrice,
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
                originalPrice: result.originalPrice,
                discountPercent: result.originalPrice
                  ? Math.round(((result.originalPrice - result.currentPrice) / result.originalPrice) * 100)
                  : undefined,
                volume: result.volume || volume,
                inStock: result.inStock ?? true,
                matchConfidence: result.matchConfidence,
                matchMethod: result.matchMethod,
              },
            });
            console.log(`     💾 Sauvegardé en BDD`);
          }

          stats.found++;
          stats.byMerchant[competitorSlug].found++;
          stats.byMethod[result.matchMethod || 'unknown'] = (stats.byMethod[result.matchMethod || 'unknown'] || 0) + 1;

          stats.details.push({
            dealTitle: productName,
            brand,
            dealPrice: deal.dealPrice,
            volume,
            competitor: competitor.merchant.name,
            found: true,
            competitorPrice: result.currentPrice,
            competitorVolume: result.volume,
            matchConfidence: result.matchConfidence,
            matchMethod: result.matchMethod,
            savings: diff,
            savingsPercent: diffPct,
          });

        } else {
          console.log(`  ❌ NON TROUVÉ: ${result.error || 'Produit non trouvé'}`);
          if (result.matchMethod) console.log(`     Méthode: ${result.matchMethod}`);

          stats.notFound++;
          stats.byMerchant[competitorSlug].notFound++;

          stats.details.push({
            dealTitle: productName,
            brand,
            dealPrice: deal.dealPrice,
            volume,
            competitor: competitor.merchant.name,
            found: false,
            error: result.error,
          });
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`  ⚠️  ERREUR: ${msg}`);
        stats.errors++;
        stats.byMerchant[competitorSlug].errors++;

        stats.details.push({
          dealTitle: productName,
          brand,
          dealPrice: deal.dealPrice,
          volume,
          competitor: competitor.merchant.name,
          found: false,
          error: msg,
        });
      }

      // Pause entre chaque recherche
      console.log(`  ⏳ Pause 3s...`);
      await delay(3000);
    }

    stats.processed++;
  }

  return stats;
}

// =============================================================================
// AFFICHAGE RÉSULTATS
// =============================================================================

function printResults(stats: EnrichmentStats, duration: string) {
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`   📊 RÉSULTATS FINAUX`);
  console.log(`${'═'.repeat(70)}`);
  console.log(`   Durée           : ${duration} minutes`);
  console.log(`   Total deals     : ${stats.totalDeals}`);
  console.log(`   Traités         : ${stats.processed}`);
  console.log(`   Trouvés         : ${stats.found} ✅`);
  console.log(`   Non trouvés     : ${stats.notFound} ❌`);
  console.log(`   Erreurs         : ${stats.errors} ⚠️`);
  console.log(`   Ignorés         : ${stats.skipped}`);

  const total = stats.found + stats.notFound;
  if (total > 0) {
    console.log(`   Taux de succès  : ${Math.round((stats.found / total) * 100)}%`);
  }

  // Par concurrent
  if (Object.keys(stats.byMerchant).length > 0) {
    console.log(`\n   📈 Par concurrent:`);
    for (const [slug, data] of Object.entries(stats.byMerchant)) {
      const t = data.found + data.notFound;
      const rate = t > 0 ? Math.round((data.found / t) * 100) : 0;
      console.log(`      ${slug}: ${data.found}/${t} trouvés (${rate}%) — ${data.errors} erreurs`);
    }
  }

  // Par méthode
  if (Object.keys(stats.byMethod).length > 0) {
    console.log(`\n   🔧 Par méthode de matching:`);
    for (const [method, count] of Object.entries(stats.byMethod)) {
      console.log(`      ${method}: ${count} résultats`);
    }
  }

  // Tableau récapitulatif détaillé
  if (stats.details.length > 0) {
    console.log(`\n   ${'─'.repeat(66)}`);
    console.log(`   📋 DÉTAILS PAR DEAL:`);
    console.log(`   ${'─'.repeat(66)}`);

    for (const d of stats.details) {
      const status = d.found ? '✅' : '❌';
      const priceInfo = d.found
        ? `${d.competitorPrice}€ (${d.competitorVolume || '?'})`
        : d.error || 'non trouvé';
      const confidence = d.matchConfidence ? `[${d.matchConfidence}%]` : '';
      const savings = d.savings
        ? d.savings < 0
          ? `🏆 ${Math.abs(d.savings).toFixed(2)}€ moins cher`
          : `⚠️ +${d.savings.toFixed(2)}€`
        : '';

      console.log(`\n   ${status} ${d.brand} — ${d.dealTitle}`);
      console.log(`      Deal: ${d.dealPrice}€ (${d.volume}) → ${d.competitor}: ${priceInfo} ${confidence}`);
      if (savings) console.log(`      ${savings}`);
    }
  }

  console.log(`\n${'═'.repeat(70)}\n`);
}

// =============================================================================
// CLI ENTRY POINT
// =============================================================================

async function main() {
  const args = process.argv.slice(2);

  let minScore = 0;
  let limit = 50;
  let source: string | undefined;
  let target: string | undefined;
  let dryRun = false;

  for (const arg of args) {
    if (arg.startsWith('--min-score=')) {
      minScore = parseFloat(arg.split('=')[1]);
    } else if (arg.startsWith('--limit=')) {
      limit = parseInt(arg.split('=')[1]);
    } else if (arg.startsWith('--source=')) {
      source = arg.split('=')[1];
    } else if (arg.startsWith('--target=')) {
      target = arg.split('=')[1];
    } else if (arg === '--dry-run') {
      dryRun = true;
    }
  }

  console.log(`\n🚀 Démarrage enrichissement prix concurrents V2`);

  try {
    const startTime = Date.now();

    const stats = await enrichCompetitorPrices({
      minScore,
      limit,
      sourceFilter: source,
      targetFilter: target,
      dryRun,
    });

    const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    printResults(stats, duration);

  } catch (error) {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  } finally {
    await closeBrowser();
    await prisma.$disconnect();
  }
}

main();
