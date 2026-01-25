/**
 * Test: scraper quelques pages Marionnaud pour vérifier le parsing
 */
import { MarionnaudScraper } from '../lib/scraping/marionnaud';

const TEST_URLS = [
  'https://www.marionnaud.fr/soin-visage/hydratant-et-nourrissant/soin-de-jour/c/V0102',
  'https://www.marionnaud.fr/soin-visage/anti-rides-et-anti-age/soin-de-jour/c/V0301',
  'https://www.marionnaud.fr/parfum/parfum-femme/eau-de-parfum/c/P0101',
  'https://www.marionnaud.fr/maquillage/teint/fond-de-teint/c/M0101',
  'https://www.marionnaud.fr/cheveux/shampooing/c/C0100',
];

async function testScrape() {
  console.log('🧪 Test Marionnaud Scraper\n');
  console.log('=' .repeat(60));
  
  const scraper = new MarionnaudScraper({
    delayBetweenRequests: 1000,
  });

  await scraper.init();

  let totalProducts = 0;
  let totalWithDiscount = 0;
  let totalWithSize = 0;

  for (const url of TEST_URLS) {
    console.log(`\n📦 Scraping: ${url}`);
    console.log('-'.repeat(60));
    
    const result = await scraper.scrape(url, 50);
    
    console.log(`✅ ${result.products.length} produits trouvés`);
    
    if (result.errors.length > 0) {
      console.log(`⚠️ Erreurs: ${result.errors.join(', ')}`);
    }
    
    // Afficher les 3 premiers produits en détail
    const samples = result.products.slice(0, 3);
    for (const p of samples) {
      console.log(`\n  🏷️  ${p.name}`);
      console.log(`      Marque: ${p.brand || '(non trouvée)'}`);
      console.log(`      Prix: ${p.currentPrice}€ ${p.originalPrice > p.currentPrice ? `(au lieu de ${p.originalPrice}€)` : ''}`);
      console.log(`      Réduction: ${p.discountPercent > 0 ? `-${p.discountPercent}%` : '(aucune)'}`);
      console.log(`      Volume: ${p.volume || '(non trouvé)'}`);
      console.log(`      Rating: ${p.rating || '-'} (${p.reviewCount || 0} avis)`);
      console.log(`      SKU: ${p.sku || '-'}`);
      console.log(`      URL: ${p.productUrl.substring(0, 80)}...`);
    }
    
    totalProducts += result.products.length;
    totalWithDiscount += result.products.filter(p => p.discountPercent > 0).length;
    totalWithSize += result.products.filter(p => p.volume).length;
    
    // Pause entre les URLs
    await new Promise(r => setTimeout(r, 1500));
  }

  await scraper.close();

  console.log('\n' + '='.repeat(60));
  console.log('📊 RÉSUMÉ');
  console.log('='.repeat(60));
  console.log(`Total produits: ${totalProducts}`);
  console.log(`Avec réduction: ${totalWithDiscount} (${Math.round(totalWithDiscount / totalProducts * 100)}%)`);
  console.log(`Avec volume: ${totalWithSize} (${Math.round(totalWithSize / totalProducts * 100)}%)`);
  console.log('\n✅ Test terminé!');
}

testScrape().catch(console.error);
