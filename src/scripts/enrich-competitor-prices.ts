/**
 * Script pour enrichir les deals avec les prix concurrents
 * 
 * Pour chaque deal avec un score > 7 :
 * - Si le deal vient de Nocibé -> chercher le prix chez Sephora
 * - Si le deal vient de Sephora -> chercher le prix chez Nocibé
 * 
 * Usage:
 *   npx tsx src/scripts/enrich-competitor-prices.ts
 *   npx tsx src/scripts/enrich-competitor-prices.ts --min-score=8
 *   npx tsx src/scripts/enrich-competitor-prices.ts --limit=10
 */

import { PrismaClient } from '@prisma/client';
import { searchSephoraProduct } from '../lib/scraping/sephora-search';
import { searchNocibeProduct } from '../lib/scraping/nocibe-search';

const prisma = new PrismaClient();

interface EnrichmentStats {
  totalDeals: number;
  processed: number;
  found: number;
  notFound: number;
  errors: number;
  skipped: number;
}

async function delay(ms: number): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms));
}

async function enrichCompetitorPrices(minScore: number = 7, limit: number = 50): Promise<EnrichmentStats> {
  const stats: EnrichmentStats = {
    totalDeals: 0,
    processed: 0,
    found: 0,
    notFound: 0,
    errors: 0,
    skipped: 0
  };

  console.log(`\n${'='.repeat(70)}`);
  console.log(`   ENRICHISSEMENT PRIX CONCURRENTS (score >= ${minScore})`);
  console.log(`${'='.repeat(70)}\n`);

  // Recuperer les merchants Sephora et Nocibe
  const sephora = await prisma.merchant.findFirst({ where: { slug: 'sephora' } });
  const nocibe = await prisma.merchant.findFirst({ where: { slug: 'nocibe' } });

  if (!sephora || !nocibe) {
    console.error('Erreur: Merchants Sephora ou Nocibe non trouves');
    return stats;
  }

  console.log(`Sephora ID: ${sephora.id}`);
  console.log(`Nocibe ID: ${nocibe.id}`);

  // Recuperer les deals avec score >= minScore qui n'ont pas encore de prix concurrent
  const deals = await prisma.deal.findMany({
    where: {
      score: { gte: minScore },
      isExpired: false,
      volume: { not: null }, // On a besoin du volume pour chercher
      // Exclure les deals qui ont deja un prix concurrent
      competitorPrices: {
        none: {}
      }
    },
    include: {
      product: {
        include: {
          merchant: true,
          brandRef: true
        }
      }
    },
    orderBy: { score: 'desc' },
    take: limit
  });

  stats.totalDeals = deals.length;
  console.log(`\nDeals a traiter: ${deals.length}\n`);

  for (const deal of deals) {
    const merchant = deal.product.merchant;
    const brand = deal.product.brandRef?.name || deal.product.brand || '';
    const productName = deal.refinedTitle || deal.title;
    const volume = deal.volume || '';

    console.log(`\n${'─'.repeat(70)}`);
    console.log(`[${stats.processed + 1}/${stats.totalDeals}] ${brand} - ${productName}`);
    console.log(`   Volume: ${volume} | Score: ${deal.score} | Source: ${merchant.name}`);
    console.log(`   Prix deal: ${deal.dealPrice}€ (etait ${deal.originalPrice}€)`);

    // Determiner le concurrent
    let competitorMerchant: typeof sephora | typeof nocibe;
    let searchFunction: typeof searchSephoraProduct | typeof searchNocibeProduct;

    if (merchant.slug === 'nocibe') {
      competitorMerchant = sephora;
      searchFunction = searchSephoraProduct;
    } else if (merchant.slug === 'sephora') {
      competitorMerchant = nocibe;
      searchFunction = searchNocibeProduct;
    } else {
      console.log(`   SKIP: Merchant ${merchant.name} non supporte`);
      stats.skipped++;
      stats.processed++;
      continue;
    }

    console.log(`   Recherche chez: ${competitorMerchant.name}...`);

    try {
      // Construire la query de recherche - utiliser le titre raffine ou le nom du produit
      // Eviter les doublons de marque
      let searchQuery = deal.refinedTitle || deal.product.name;
      
      // Si le titre ne contient pas la marque, l'ajouter
      if (brand && !searchQuery.toLowerCase().includes(brand.toLowerCase())) {
        searchQuery = `${brand} ${searchQuery}`;
      }
      
      // Nettoyer: enlever les infos de volume deja presentes dans le titre
      searchQuery = searchQuery.replace(/\(\d+(?:\.\d+)?\s*(ml|g|oz)\)/gi, '').trim();
      
      console.log(`   Query: "${searchQuery}"`);
      
      // Rechercher chez le concurrent
      const result = await searchFunction(searchQuery, volume);

      if (result.found && result.currentPrice) {
        // Sauvegarder le prix concurrent
        await prisma.competitorPrice.create({
          data: {
            dealId: deal.id,
            merchantId: competitorMerchant.id,
            merchantName: competitorMerchant.name,
            productName: result.productName || productName,
            productUrl: result.productUrl || '',
            currentPrice: result.currentPrice,
            originalPrice: result.originalPrice,
            discountPercent: result.discountPercent,
            volume: result.volume || volume,
            inStock: result.inStock ?? true
          }
        });

        // Calculer la difference de prix
        const diff = deal.dealPrice - result.currentPrice;
        const diffPct = Math.round((diff / result.currentPrice) * 100);
        const cheaper = diff < 0 ? merchant.name : (diff > 0 ? competitorMerchant.name : 'egal');

        console.log(`   TROUVE: ${result.currentPrice}€ chez ${competitorMerchant.name}`);
        console.log(`   Comparaison: ${deal.dealPrice}€ vs ${result.currentPrice}€`);
        console.log(`   => ${Math.abs(diff).toFixed(2)}€ ${diff < 0 ? 'moins cher' : 'plus cher'} (${diffPct}%) chez ${cheaper}`);

        stats.found++;
      } else {
        console.log(`   NON TROUVE: ${result.error || 'Produit non trouve'}`);
        stats.notFound++;
      }
    } catch (error) {
      console.error(`   ERREUR: ${error instanceof Error ? error.message : error}`);
      stats.errors++;
    }

    stats.processed++;

    // Attendre entre chaque recherche pour eviter d'etre bloque
    if (stats.processed < stats.totalDeals) {
      console.log(`   Pause 5s...`);
      await delay(5000);
    }
  }

  return stats;
}

async function main() {
  const args = process.argv.slice(2);
  
  // Parser les arguments
  let minScore = 7;
  let limit = 50;

  for (const arg of args) {
    if (arg.startsWith('--min-score=')) {
      minScore = parseFloat(arg.split('=')[1]);
    } else if (arg.startsWith('--limit=')) {
      limit = parseInt(arg.split('=')[1]);
    }
  }

  try {
    const stats = await enrichCompetitorPrices(minScore, limit);

    console.log(`\n${'='.repeat(70)}`);
    console.log(`   RESULTATS`);
    console.log(`${'='.repeat(70)}`);
    console.log(`   Total deals:     ${stats.totalDeals}`);
    console.log(`   Traites:         ${stats.processed}`);
    console.log(`   Trouves:         ${stats.found}`);
    console.log(`   Non trouves:     ${stats.notFound}`);
    console.log(`   Erreurs:         ${stats.errors}`);
    console.log(`   Ignores:         ${stats.skipped}`);
    console.log(`${'='.repeat(70)}\n`);

  } catch (error) {
    console.error('Erreur:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
