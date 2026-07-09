/**
 * Point d'entrée unique du scraping quotidien.
 *
 * Usage:
 *   npx tsx src/scripts/scrape.ts <sephora|nocibe|marionnaud> [--limit N] [--dry-run]
 *
 * --limit N   : max N produits par source (test rapide)
 * --dry-run   : scrape et affiche un échantillon, n'écrit RIEN en base
 *
 * Exit codes: 0 = OK, 1 = échec (0 deal valide importé ou erreur fatale)
 */
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { Scraper, ScrapedProduct } from '../lib/scraping/types';
import { NocibeScraper } from '../lib/scraping/nocibe';
import { MarionnaudScraper } from '../lib/scraping/marionnaud';
import { SephoraScraper } from '../lib/scraping/sephora';
import { normalizePrices, isValidDeal } from '../lib/scraping/validate';

interface Source {
  url: string;
  category: string;
}

function buildScraper(merchant: string): Scraper {
  switch (merchant) {
    case 'nocibe': return new NocibeScraper();
    case 'marionnaud': return new MarionnaudScraper();
    case 'sephora': return new SephoraScraper();
    default: throw new Error(`Marchand inconnu: ${merchant} (attendu: sephora|nocibe|marionnaud)`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const merchant = args[0];
  const limitIdx = args.indexOf('--limit');
  const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : 100;
  const dryRun = args.includes('--dry-run');

  if (!merchant) {
    console.error('Usage: npx tsx src/scripts/scrape.ts <sephora|nocibe|marionnaud> [--limit N] [--dry-run]');
    process.exit(1);
  }

  const sourcesPath = path.join(process.cwd(), 'data', 'scrape-sources.json');
  const allSources: Record<string, Source[]> = JSON.parse(fs.readFileSync(sourcesPath, 'utf-8'));
  const sources = allSources[merchant];
  if (!sources?.length) {
    console.error(`Aucune source pour "${merchant}" dans data/scrape-sources.json`);
    process.exit(1);
  }

  console.log(`🚀 Scraping ${merchant} — ${sources.length} sources${dryRun ? ' (DRY RUN)' : ''}`);
  const scraper = buildScraper(merchant);
  const products: ScrapedProduct[] = [];

  try {
    await scraper.init();
    for (const source of sources) {
      console.log(`\n🔍 ${source.url}`);
      try {
        const res = await scraper.scrape(source.url, limit);
        for (const p of res.products) {
          p.category = source.category; // la source fait foi pour la catégorie
          products.push(p);
        }
        console.log(`   → ${res.products.length} produits`);
      } catch (err) {
        console.error(`   ❌ Source en erreur (on continue): ${err instanceof Error ? err.message : err}`);
      }
    }
  } finally {
    await scraper.close();
  }

  console.log(`\n📦 Total scrapé: ${products.length} produits`);

  if (dryRun) {
    const valid = products.map(normalizePrices).filter((p) => isValidDeal(p));
    console.log(`✅ ${valid.length} deals valides (réduction ≥15%, prix >1€, volume OK)`);
    console.log('\nÉchantillon:');
    for (const p of valid.slice(0, 10)) {
      console.log(`  - [${p.category}] ${p.brand} | ${p.name} | ${p.volume} | ${p.currentPrice}€ (était ${p.originalPrice}€, -${p.discountPercent}%)`);
      console.log(`    img: ${p.imageUrl ? 'oui' : 'NON'} | url: ${p.productUrl}`);
    }
    process.exit(valid.length > 0 ? 0 : 1);
  }

  // Import en base — chargé dynamiquement pour que --dry-run marche sans DATABASE_URL
  const { importProducts } = await import('../lib/scraping/import');
  const result = await importProducts(merchant, products);

  console.log('\n📊 Résultat:');
  console.log(`   scrapés: ${result.scraped} | valides: ${result.valid} | importés: ${result.imported}`);
  console.log(`   changements de prix: ${result.priceChanges} | expirés: ${result.expired}`);
  if (result.errors.length > 0) {
    console.log(`   ⚠️ ${result.errors.length} erreurs:`);
    result.errors.slice(0, 5).forEach((e) => console.log(`     - ${e.product}: ${e.error}`));
  }

  process.exit(result.imported > 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('❌ Erreur fatale:', err);
  process.exit(1);
});
