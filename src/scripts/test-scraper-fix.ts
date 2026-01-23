/**
 * Test du scraper Nocibé corrigé
 */
import { NocibeScraper } from '../lib/scraping/nocibe';

async function test() {
  const scraper = new NocibeScraper();
  
  console.log('Test scraping page dissolvant...\n');
  
  const result = await scraper.scrapeCategoryPage('https://www.nocibe.fr/fr/c/maquillage/ongles/dissolvant/030407', 50);
  
  // Afficher les produits Chanel
  const chanelProducts = result.products.filter(p => 
    p.brand.toLowerCase().includes('chanel') || p.name.toLowerCase().includes('douceur')
  );
  
  console.log(`\n=== Produits CHANEL/Douceur trouvés (${chanelProducts.length}) ===\n`);
  
  for (const p of chanelProducts) {
    console.log(`${p.name}`);
    console.log(`  URL: ${p.productUrl}`);
    console.log(`  Prix actuel: ${p.currentPrice}€`);
    console.log(`  Prix original: ${p.originalPrice}€`);
    console.log(`  Réduction: ${p.discountPercent}%`);
    console.log(`  Volume: ${p.size}`);
    console.log('');
  }
  
  // Afficher tous les produits pour debug
  console.log(`\n=== Tous les produits (${result.products.length}) ===\n`);
  for (const p of result.products.slice(0, 10)) {
    const hasDiscount = p.discountPercent > 0 ? `✅ -${p.discountPercent}%` : '❌ pas de réduc';
    console.log(`${p.brand} ${p.productLine} - ${p.currentPrice}€ (orig: ${p.originalPrice}€) ${hasDiscount}`);
  }
}

test().catch(console.error);
