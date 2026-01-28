/**
 * Cloud Run Job - Scrape Marionnaud
 * Exécuté quotidiennement pour alimenter la base de données
 * 
 * Utilise l'ImportEngine avec le Strategy Pattern
 */

import { ImportEngine, MarionnaudScraper } from '../../lib/scraping';

// Configuration Cloud Run
const MAX_PRODUCTS = parseInt(process.env.MAX_PRODUCTS || '5000');

async function main() {
  const startTime = Date.now();
  console.log('🚀 [CLOUD JOB] Scraping Marionnaud...');
  console.log(`📅 Date: ${new Date().toISOString()}`);
  console.log(`⚙️ Max produits: ${MAX_PRODUCTS}`);

  try {
    // Créer le scraper et l'engine
    const scraper = new MarionnaudScraper({
      headless: true,
      delayBetweenRequests: 500,
    });

    const engine = new ImportEngine({
      batchSize: 50,
      minDiscountPercent: 5,
      maxProducts: MAX_PRODUCTS,
      verbose: true,
    });

    // Lancer l'import
    const stats = await engine.import(scraper, false);

    // Rapport final
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('\n' + '='.repeat(60));
    console.log('📊 [CLOUD JOB] RAPPORT FINAL - MARIONNAUD');
    console.log('='.repeat(60));
    console.log(`⏱️  Durée totale: ${duration}s`);
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
    }

    console.log('\n✅ [CLOUD JOB] Scraping Marionnaud terminé!');
    process.exit(0);

  } catch (error) {
    console.error('❌ [CLOUD JOB] Erreur fatale:', error);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('❌ [CLOUD JOB] Erreur non gérée:', err);
  process.exit(1);
});
