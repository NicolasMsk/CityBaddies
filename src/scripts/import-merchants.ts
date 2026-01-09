/**
 * Script d'import unifié pour tous les marchands
 * Utilise l'architecture Strategy Pattern avec ImportEngine
 * 
 * Usage:
 *   npx tsx src/scripts/import-merchants.ts                    # Import tous les marchands
 *   npx tsx src/scripts/import-merchants.ts --merchant nocibe  # Import Nocibé uniquement
 *   npx tsx src/scripts/import-merchants.ts --merchant sephora # Import Sephora uniquement
 *   npx tsx src/scripts/import-merchants.ts --clean            # Nettoyer avant import
 *   npx tsx src/scripts/import-merchants.ts --merchant nocibe --clean
 */

import { ImportEngine } from '../lib/scraping/ImportEngine';
import { Scraper } from '../lib/scraping/types';
import { NocibeScraper } from '../lib/scraping/nocibe';
import { SephoraScraper } from '../lib/scraping/sephora';

// ============================================
// REGISTRE DES SCRAPERS DISPONIBLES
// ============================================

/**
 * Factory pour créer les scrapers
 * Pour ajouter un nouveau marchand:
 * 1. Créer une classe qui implémente Scraper
 * 2. L'ajouter à ce registre
 */
const SCRAPERS: Record<string, () => Scraper> = {
  nocibe: () => new NocibeScraper({ headless: true, delayBetweenRequests: 2000 }),
  sephora: () => new SephoraScraper({ headless: true, delayBetweenRequests: 2000 }),
  // Ajouter d'autres marchands ici:
  // marionnaud: () => new MarionnaudScraper({ headless: true }),
  // amazon: () => new AmazonScraper({ headless: true }),
};

// ============================================
// LOGIQUE PRINCIPALE
// ============================================

async function main() {
  const args = process.argv.slice(2);
  const cleanFirst = args.includes('--clean');
  
  // Déterminer quels marchands importer
  const merchantIndex = args.indexOf('--merchant');
  const merchantArg = merchantIndex !== -1 ? args[merchantIndex + 1] : null;

  let merchantsToImport: string[];

  if (merchantArg) {
    if (!SCRAPERS[merchantArg]) {
      console.error(`❌ Marchand inconnu: ${merchantArg}`);
      console.log(`   Marchands disponibles: ${Object.keys(SCRAPERS).join(', ')}`);
      process.exit(1);
    }
    merchantsToImport = [merchantArg];
  } else {
    merchantsToImport = Object.keys(SCRAPERS);
  }

  console.log('═══════════════════════════════════════════');
  console.log('  🛒 IMPORT MARCHANDS - BeautyDeals');
  console.log('═══════════════════════════════════════════');
  console.log(`📋 Marchands: ${merchantsToImport.join(', ')}`);
  console.log(`🧹 Clean: ${cleanFirst ? 'Oui' : 'Non'}`);
  console.log('═══════════════════════════════════════════\n');

  // Créer l'engine avec les options
  const engine = new ImportEngine({
    batchSize: 50,
    minDiscountPercent: 5,
    verbose: true,
  });

  // Statistiques globales
  const globalStats = {
    totalCreated: 0,
    totalUpdated: 0,
    totalErrors: 0,
    duration: 0,
  };

  const startTime = Date.now();

  // Importer chaque marchand séquentiellement
  for (const merchantSlug of merchantsToImport) {
    console.log(`\n${'─'.repeat(50)}`);
    
    const scraper = SCRAPERS[merchantSlug]();
    
    try {
      const stats = await engine.import(scraper, cleanFirst);
      
      globalStats.totalCreated += stats.created;
      globalStats.totalUpdated += stats.updated;
      globalStats.totalErrors += stats.errors.length;
    } catch (error) {
      console.error(`❌ Erreur import ${merchantSlug}:`, error);
      globalStats.totalErrors++;
    }
  }

  globalStats.duration = (Date.now() - startTime) / 1000;

  // Rapport final global
  console.log('\n═══════════════════════════════════════════');
  console.log('  📊 RAPPORT FINAL');
  console.log('═══════════════════════════════════════════');
  console.log(`✅ Créés:     ${globalStats.totalCreated}`);
  console.log(`🔄 Mis à jour: ${globalStats.totalUpdated}`);
  console.log(`❌ Erreurs:   ${globalStats.totalErrors}`);
  console.log(`⏱️  Durée:     ${globalStats.duration.toFixed(1)}s`);
  console.log('═══════════════════════════════════════════\n');
}

// Exécution
main()
  .catch(console.error)
  .finally(() => {
    // Prisma se déconnecte automatiquement via ImportEngine
    process.exit(0);
  });
