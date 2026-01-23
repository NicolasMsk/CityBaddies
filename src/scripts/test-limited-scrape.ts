/**
 * Script de test : nettoie la DB et scrape 10 pages par site
 */

import { PrismaClient } from '@prisma/client';
import { ImportEngine } from '../lib/scraping/ImportEngine';
import { NocibeScraper } from '../lib/scraping/nocibe';
import { SephoraScraper } from '../lib/scraping/sephora';

const prisma = new PrismaClient();

async function main() {
  console.log('=== NETTOYAGE DE LA DB ===\n');
  
  // Supprimer dans le bon ordre (relations)
  const prices = await prisma.priceHistory.deleteMany();
  console.log(`Supprimé: ${prices.count} entrées d'historique de prix`);
  
  const deals = await prisma.deal.deleteMany();
  console.log(`Supprimé: ${deals.count} deals`);
  
  const products = await prisma.product.deleteMany();
  console.log(`Supprimé: ${products.count} produits`);
  
  console.log('\n=== LIMITATION DES SOURCES À 10 PAR SITE ===\n');
  
  // D'abord, désactiver toutes les sources
  await prisma.scrapingSource.updateMany({
    data: { isActive: false }
  });
  
  // Récupérer les IDs des 10 premières sources Sephora
  const sephoraSources = await prisma.scrapingSource.findMany({
    where: { merchant: { slug: 'sephora' } },
    take: 10,
    select: { id: true, name: true, url: true }
  });
  
  // Récupérer les IDs des 10 premières sources Nocibé
  const nocibeSources = await prisma.scrapingSource.findMany({
    where: { merchant: { slug: 'nocibe' } },
    take: 10,
    select: { id: true, name: true, url: true }
  });
  
  // Réactiver seulement ces 20 sources
  const idsToActivate = [...sephoraSources, ...nocibeSources].map(s => s.id);
  await prisma.scrapingSource.updateMany({
    where: { id: { in: idsToActivate } },
    data: { isActive: true }
  });
  
  console.log(`Sources activées:`);
  console.log(`  Sephora (${sephoraSources.length}):`);
  sephoraSources.forEach(s => console.log(`    - ${s.name}: ${s.url}`));
  console.log(`  Nocibé (${nocibeSources.length}):`);
  nocibeSources.forEach(s => console.log(`    - ${s.name}: ${s.url}`));
  
  console.log(`\n=== LANCEMENT DU SCRAPING ===\n`);
  
  const engine = new ImportEngine({
    batchSize: 50,
    minDiscountPercent: 5,
    verbose: true,
  });
  
  // Scraper Nocibé
  console.log('\n--- NOCIBÉ ---');
  const nocibeScraper = new NocibeScraper({ headless: true, delayBetweenRequests: 2000 });
  try {
    const nocStats = await engine.import(nocibeScraper, false);
    console.log(`✅ Nocibé: ${nocStats.created} créés, ${nocStats.updated} mis à jour`);
  } catch (error) {
    console.error(`❌ Erreur Nocibé:`, error instanceof Error ? error.message : error);
  }
  
  // Scraper Sephora
  console.log('\n--- SEPHORA ---');
  const sephoraScraper = new SephoraScraper({ headless: true, delayBetweenRequests: 2000 });
  try {
    const sepStats = await engine.import(sephoraScraper, false);
    console.log(`✅ Sephora: ${sepStats.created} créés, ${sepStats.updated} mis à jour`);
  } catch (error) {
    console.error(`❌ Erreur Sephora:`, error instanceof Error ? error.message : error);
  }
  
  // Résumé final
  console.log('\n=== RÉSUMÉ FINAL ===\n');
  
  const totalProducts = await prisma.product.count();
  const totalDeals = await prisma.deal.count();
  const dealsWithDiscount = await prisma.deal.count({
    where: { discountPercent: { gt: 5 } }
  });
  
  console.log(`Produits en base: ${totalProducts}`);
  console.log(`Deals en base: ${totalDeals}`);
  console.log(`Deals avec réduction > 5%: ${dealsWithDiscount}`);
  
  // Afficher quelques exemples
  const sampleDeals = await prisma.deal.findMany({
    where: { discountPercent: { gt: 5 } },
    take: 10,
    include: { product: { include: { merchant: true } } },
    orderBy: { discountPercent: 'desc' }
  });
  
  if (sampleDeals.length > 0) {
    console.log('\nTop 10 des meilleures réductions:');
    sampleDeals.forEach(d => {
      console.log(`  ${d.discountPercent}% - ${d.product.name.substring(0, 40)} (${d.product.merchant.name}) - ${d.dealPrice}€`);
    });
  }
  
  // Réactiver toutes les sources pour plus tard
  console.log('\n🔄 Réactivation de toutes les sources...');
  await prisma.scrapingSource.updateMany({
    data: { isActive: true }
  });
  console.log('✅ Toutes les sources sont réactivées');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
