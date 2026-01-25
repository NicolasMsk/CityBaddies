/**
 * Script d'import Marionnaud - Version production
 * Utilise l'ImportEngine avec le Strategy Pattern
 * 
 * Usage: npx tsx src/scripts/import-marionnaud.ts [--clean] [--max=N] [--verbose]
 */

import { ImportEngine, MarionnaudScraper } from '../lib/scraping';

async function main() {
  const args = process.argv.slice(2);
  const cleanFirst = args.includes('--clean');
  const verboseArg = args.find(a => a.startsWith('--verbose'));
  const verbose = verboseArg !== undefined || !args.includes('--quiet');
  const maxArg = args.find(a => a.startsWith('--max='));
  const maxProducts = maxArg ? parseInt(maxArg.split('=')[1]) : Infinity;

  console.log('🚀 Import Marionnaud - Version Production');
  console.log(`📋 Options: clean=${cleanFirst}, max=${maxProducts === Infinity ? 'all' : maxProducts}, verbose=${verbose}`);
  console.log('');

  // Créer le scraper et l'engine
  const scraper = new MarionnaudScraper({
    headless: true,
    delayBetweenRequests: 500,
  });

  const engine = new ImportEngine({
    batchSize: 50,
    minDiscountPercent: 5,
    maxProducts,
    verbose,
  });

  try {
    // Lancer l'import via l'ImportEngine
    const stats = await engine.import(scraper, cleanFirst);

    // Rapport final
    console.log('\n' + '='.repeat(60));
    console.log('📊 RAPPORT FINAL - MARIONNAUD');
    console.log('='.repeat(60));
    console.log(`⏱️  Durée: ${stats.duration.toFixed(1)}s`);
    console.log(`📦 Produits scrapés: ${stats.scraped}`);
    console.log(`📏 Avec volume: ${stats.withVolume}`);
    console.log(`🔄 Existants: ${stats.existing}`);
    console.log(`✅ Mis à jour: ${stats.updated}`);
    console.log(`🆕 Créés: ${stats.created}`);
    console.log(`💰 Changements de prix: ${stats.priceChanges}`);
    
    if (stats.errors.length > 0) {
      console.log(`\n⚠️ ${stats.errors.length} erreurs:`);
      stats.errors.slice(0, 10).forEach(e => {
        console.log(`   ❌ ${e.product}: ${e.error}`);
      });
      if (stats.errors.length > 10) {
        console.log(`   ... et ${stats.errors.length - 10} autres`);
      }
    }

    console.log('\n✅ Import Marionnaud terminé!');
    
  } catch (error) {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  }
}

main().catch(console.error);
