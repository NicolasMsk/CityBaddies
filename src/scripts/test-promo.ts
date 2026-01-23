import { SephoraScraper } from '../lib/scraping/sephora';

async function testPromo() {
  console.log('🧪 Lancement du test scraper Sephora (limite 10 produits)...');
  
  // URL de test : Promos Maquillage
  const testUrl = 'https://www.sephora.fr/promotion-exclu-web-maquillage/';
  console.log(`📍 URL cible : ${testUrl}`);

  // Config avec headless: false pour voir ce qui se passe (optionnel, remettre true en prod)
  // On met un timeout plus court pour le test
  const scraper = new SephoraScraper({ 
    headless: true,
    timeout: 60000 
  });

  try {
    await scraper.init();
    console.log('✅ Navigateur initialisé');

    console.log('🕵️  Scraping en cours...');
    // On limite à 10 produits comme demandé
    const result = await scraper.scrape(testUrl, 10);

    if (result.success) {
      console.log('\n✨ Succès ! Voici les 10 premiers produits trouvés :\n');
      result.products.forEach((product, index) => {
        console.log(`[${index + 1}] ${product.brand} - ${product.name}`);
        console.log(`    Prix: ${product.currentPrice}€ (vs ${product.originalPrice}€) | -${product.discountPercent}%`);
        console.log(`    Lien: ${product.productUrl}`);
        console.log('---');
      });
      console.log(`\n📊 Total récupéré : ${result.products.length} produits`);
    } else {
      console.error('❌ Erreur lors du scraping :', result.errors);
    }

  } catch (error) {
    console.error('❌ Erreur critique :', error);
  } finally {
    await scraper.close();
    console.log('👋 Navigateur fermé');
  }
}

testPromo();
