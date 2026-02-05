/**
 * Script pour enrichir les deals avec les prix concurrents
 * 
 * TECHNOLOGIE: Playwright + GPT-4o-mini Vision
 * Pour chaque page produit, prend un screenshot et laisse le LLM extraire le prix.
 * Plus besoin de maintenir des sélecteurs CSS par site !
 * 
 * Pour chaque deal avec un score >= minScore :
 * - Si le deal vient de Nocibé -> chercher le prix chez Sephora ET Marionnaud
 * - Si le deal vient de Sephora -> chercher le prix chez Nocibé ET Marionnaud
 * - Si le deal vient de Marionnaud -> chercher le prix chez Sephora ET Nocibé
 * 
 * Usage:
 *   npx tsx src/scripts/enrich-competitor-prices.ts
 *   npx tsx src/scripts/enrich-competitor-prices.ts --min-score=8
 *   npx tsx src/scripts/enrich-competitor-prices.ts --limit=10
 *   npx tsx src/scripts/enrich-competitor-prices.ts --source=sephora
 */

import { PrismaClient, Merchant } from '@prisma/client';
import { 
  searchCompetitorPrice, 
  closeBrowser, 
  CompetitorSite, 
  CompetitorPriceResult 
} from '../lib/scraping/competitor-price-search';

const prisma = new PrismaClient();

// Types pour les résultats de recherche (wrapper pour uniformiser)
interface SearchResult {
  found: boolean;
  currentPrice?: number;
  originalPrice?: number;
  discountPercent?: number;
  productName?: string;
  productUrl?: string;
  volume?: string;
  inStock?: boolean;
  error?: string;
}

interface EnrichmentStats {
  totalDeals: number;
  processed: number;
  found: number;
  notFound: number;
  errors: number;
  skipped: number;
  byMerchant: Record<string, { found: number; notFound: number }>;
}

// Mapping des concurrents pour chaque source
interface CompetitorInfo {
  merchant: Merchant;
  site: CompetitorSite;
}

async function delay(ms: number): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Nettoie et optimise la query de recherche pour Google/Serper
 * - Supprime les doublons de marque (ex: "Lancôme - Lancôme -" → "Lancôme")
 * - Supprime les tirets et caractères spéciaux inutiles
 * - Supprime les infos de volume entre parenthèses
 * - Supprime les mentions de promo (ex: "-50% :")
 * - Ajoute la marque si absente
 */
function cleanSearchQuery(rawQuery: string, brand: string): string {
  let query = rawQuery;
  
  // Helper pour échapper les caractères spéciaux regex
  const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  // 1. Supprimer les mentions de promo au début (ex: "-50% : EISENBERG")
  query = query.replace(/^-?\d+%\s*:?\s*/i, '');
  
  // 2. Supprimer les infos de volume entre parenthèses
  query = query.replace(/\(\d+(?:[.,]\d+)?\s*(ml|g|oz|l)\)/gi, '');
  
  // 3. Supprimer les doublons de marque
  // Ex: "Lancôme - Lancôme - Produit" → "Lancôme - Produit"
  // Ex: "Giorgio Armani Armani" → "Giorgio Armani"
  if (brand) {
    const brandLower = brand.toLowerCase();
    const brandRegex = new RegExp(`${escapeRegex(brand)}\\s*[-–—]?\\s*${escapeRegex(brand)}`, 'gi');
    query = query.replace(brandRegex, brand);
    
    // Aussi: "Marque Marque" sans tiret
    const doubleRegex = new RegExp(`\\b${escapeRegex(brand)}\\s+${escapeRegex(brand)}\\b`, 'gi');
    query = query.replace(doubleRegex, brand);
    
    // Cas spécial: "Giorgio Armani Armani" → enlever le 2ème mot si c'est la fin de la marque
    // Ex: brand="Giorgio Armani", query contient "Giorgio Armani Armani"
    const brandWords = brand.split(' ');
    if (brandWords.length > 1) {
      const lastWord = brandWords[brandWords.length - 1];
      const pattern = new RegExp(`${escapeRegex(brand)}\\s+${escapeRegex(lastWord)}\\b`, 'gi');
      query = query.replace(pattern, brand);
    }
  }
  
  // 4. Remplacer les tirets par des espaces (sauf dans les mots composés)
  query = query.replace(/\s+-\s+/g, ' ');
  query = query.replace(/\s+–\s+/g, ' '); // tiret moyen
  query = query.replace(/\s+—\s+/g, ' '); // tiret long
  
  // 5. Supprimer les caractères spéciaux en trop
  query = query.replace(/["""«»]/g, '');
  
  // 6. Nettoyer les espaces multiples
  query = query.replace(/\s+/g, ' ').trim();
  
  // 7. Ajouter la marque si elle n'est pas dans la query
  if (brand && !query.toLowerCase().includes(brand.toLowerCase())) {
    query = `${brand} ${query}`;
  }
  
  // 8. Limiter la longueur (Google n'aime pas les queries trop longues)
  const words = query.split(' ');
  if (words.length > 8) {
    query = words.slice(0, 8).join(' ');
  }
  
  return query;
}

async function enrichCompetitorPrices(
  minScore: number = 5, 
  limit: number = 50,
  sourceFilter?: string
): Promise<EnrichmentStats> {
  const stats: EnrichmentStats = {
    totalDeals: 0,
    processed: 0,
    found: 0,
    notFound: 0,
    errors: 0,
    skipped: 0,
    byMerchant: {}
  };

  console.log(`\n${'='.repeat(70)}`);
  console.log(`   ENRICHISSEMENT PRIX CONCURRENTS (score >= ${minScore})`);
  if (sourceFilter) {
    console.log(`   Filtré par source: ${sourceFilter}`);
  }
  console.log(`${'='.repeat(70)}\n`);

  // Récupérer tous les merchants
  const sephora = await prisma.merchant.findFirst({ where: { slug: 'sephora' } });
  const nocibe = await prisma.merchant.findFirst({ where: { slug: 'nocibe' } });
  const marionnaud = await prisma.merchant.findFirst({ where: { slug: 'marionnaud' } });

  if (!sephora || !nocibe || !marionnaud) {
    console.error('Erreur: Un ou plusieurs merchants non trouvés');
    console.log(`  Sephora: ${sephora ? 'OK' : 'MANQUANT'}`);
    console.log(`  Nocibé: ${nocibe ? 'OK' : 'MANQUANT'}`);
    console.log(`  Marionnaud: ${marionnaud ? 'OK' : 'MANQUANT'}`);
    return stats;
  }

  console.log(`Merchants trouvés:`);
  console.log(`  Sephora ID: ${sephora.id}`);
  console.log(`  Nocibé ID: ${nocibe.id}`);
  console.log(`  Marionnaud ID: ${marionnaud.id}`);

  // Construire le filtre de requête
  const whereClause: any = {
    score: { gte: minScore },
    status: { not: 'EXPIRED' },
    volume: { not: null }
  };

  // Filtre par source si spécifié
  if (sourceFilter) {
    whereClause.product = {
      merchant: {
        slug: sourceFilter
      }
    };
  }

  // Récupérer les deals avec score >= minScore
  const deals = await prisma.deal.findMany({
    where: whereClause,
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
    take: limit
  });

  stats.totalDeals = deals.length;
  console.log(`\nDeals à traiter: ${deals.length}\n`);

  // Définir les concurrents pour chaque source
  const getCompetitors = (sourceSlug: string): CompetitorInfo[] => {
    const competitors: CompetitorInfo[] = [];
    
    if (sourceSlug !== 'sephora') {
      competitors.push({ merchant: sephora!, site: 'sephora' });
    }
    if (sourceSlug !== 'nocibe') {
      competitors.push({ merchant: nocibe!, site: 'nocibe' });
    }
    if (sourceSlug !== 'marionnaud') {
      competitors.push({ merchant: marionnaud!, site: 'marionnaud' });
    }
    
    return competitors;
  };

  for (const deal of deals) {
    const merchant = deal.product.merchant;
    const brand = deal.product.brandRef?.name || deal.product.brand || '';
    const productName = deal.refinedTitle || deal.title;
    const volume = deal.volume || '';

    console.log(`\n${'─'.repeat(70)}`);
    console.log(`[${stats.processed + 1}/${stats.totalDeals}] ${brand} - ${productName}`);
    console.log(`   Volume: ${volume} | Score: ${deal.score} | Source: ${merchant.name}`);
    console.log(`   Prix deal: ${deal.dealPrice}€ (était ${deal.originalPrice}€)`);

    // Récupérer les concurrents déjà enrichis pour ce deal
    const existingCompetitors = new Set(deal.competitorPrices.map(cp => cp.merchantId));
    
    // Obtenir les concurrents à checker
    const competitors = getCompetitors(merchant.slug);
    const competitorsToCheck = competitors.filter(c => !existingCompetitors.has(c.merchant.id));

    if (competitorsToCheck.length === 0) {
      console.log(`   SKIP: Tous les concurrents déjà enrichis`);
      stats.skipped++;
      stats.processed++;
      continue;
    }

    console.log(`   Concurrents à vérifier: ${competitorsToCheck.map(c => c.merchant.name).join(', ')}`);

    // Construire la query de recherche optimisée pour Google
    let searchQuery = deal.refinedTitle || deal.product.name;
    
    // Nettoyer la query pour optimiser la recherche Google
    searchQuery = cleanSearchQuery(searchQuery, brand);
    
    console.log(`   Query: "${searchQuery}"`);

    // Chercher chez chaque concurrent (avec le nouveau système Vision LLM)
    for (const competitor of competitorsToCheck) {
      console.log(`\n   🔍 Recherche chez ${competitor.merchant.name}...`);
      
      // Init stats par merchant
      if (!stats.byMerchant[competitor.merchant.slug]) {
        stats.byMerchant[competitor.merchant.slug] = { found: 0, notFound: 0 };
      }

      try {
        // Utiliser le nouveau système unifié Screenshot + Vision
        // Passer le volume du deal pour cibler la bonne contenance
        const result = await searchCompetitorPrice(searchQuery, competitor.site, volume || undefined);

        if (result.found && result.currentPrice) {
          // Sauvegarder le prix concurrent
          await prisma.competitorPrice.create({
            data: {
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
              inStock: result.inStock ?? true
            }
          });

          // Calculer la différence de prix
          const diff = deal.dealPrice - result.currentPrice;
          const diffPct = Math.round((diff / result.currentPrice) * 100);
          const cheaper = diff < 0 ? merchant.name : (diff > 0 ? competitor.merchant.name : 'égal');

          console.log(`   ✅ TROUVÉ: ${result.currentPrice}€ chez ${competitor.merchant.name}`);
          console.log(`      Comparaison: ${deal.dealPrice}€ vs ${result.currentPrice}€`);
          
          if (diff < 0) {
            console.log(`      🏆 ${Math.abs(diff).toFixed(2)}€ MOINS CHER chez ${merchant.name} (${Math.abs(diffPct)}%)`);
          } else if (diff > 0) {
            console.log(`      ⚠️  ${diff.toFixed(2)}€ plus cher chez ${merchant.name} (+${diffPct}%)`);
          } else {
            console.log(`      ➡️  Prix identique`);
          }

          stats.found++;
          stats.byMerchant[competitor.merchant.slug].found++;
        } else {
          console.log(`   ❌ NON TROUVÉ: ${result.error || 'Produit non trouvé'}`);
          stats.notFound++;
          stats.byMerchant[competitor.merchant.slug].notFound++;
        }
      } catch (error) {
        console.error(`   ⚠️  ERREUR: ${error instanceof Error ? error.message : error}`);
        stats.errors++;
      }

      // Pause entre chaque recherche
      console.log(`   ⏳ Pause 3s...`);
      await delay(3000);
    }

    stats.processed++;
  }

  return stats;
}

async function main() {
  const args = process.argv.slice(2);
  
  // Parser les arguments
  let minScore = 5;
  let limit = 50;
  let source: string | undefined;

  for (const arg of args) {
    if (arg.startsWith('--min-score=')) {
      minScore = parseFloat(arg.split('=')[1]);
    } else if (arg.startsWith('--limit=')) {
      limit = parseInt(arg.split('=')[1]);
    } else if (arg.startsWith('--source=')) {
      source = arg.split('=')[1];
    }
  }

  console.log(`\n🚀 Démarrage de l'enrichissement des prix concurrents`);
  console.log(`   Score minimum: ${minScore}`);
  console.log(`   Limite: ${limit} deals`);
  if (source) {
    console.log(`   Source filtrée: ${source}`);
  }

  try {
    const startTime = Date.now();
    const stats = await enrichCompetitorPrices(minScore, limit, source);
    const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

    console.log(`\n${'='.repeat(70)}`);
    console.log(`   📊 RÉSULTATS FINAUX`);
    console.log(`${'='.repeat(70)}`);
    console.log(`   Durée:           ${duration} minutes`);
    console.log(`   Total deals:     ${stats.totalDeals}`);
    console.log(`   Traités:         ${stats.processed}`);
    console.log(`   Trouvés:         ${stats.found} ✅`);
    console.log(`   Non trouvés:     ${stats.notFound} ❌`);
    console.log(`   Erreurs:         ${stats.errors} ⚠️`);
    console.log(`   Ignorés:         ${stats.skipped}`);
    
    if (Object.keys(stats.byMerchant).length > 0) {
      console.log(`\n   📈 Par concurrent:`);
      for (const [slug, data] of Object.entries(stats.byMerchant)) {
        const total = data.found + data.notFound;
        const rate = total > 0 ? Math.round((data.found / total) * 100) : 0;
        console.log(`      ${slug}: ${data.found}/${total} trouvés (${rate}%)`);
      }
    }
    
    console.log(`${'='.repeat(70)}\n`);

  } catch (error) {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  } finally {
    // Fermer le navigateur Playwright
    await closeBrowser();
    await prisma.$disconnect();
  }
}

main();
