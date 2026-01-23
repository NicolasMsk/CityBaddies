/**
 * Test: scraper une page produit Nocibé pour debug
 */
import * as cheerio from 'cheerio';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'fr-FR,fr;q=0.9',
};

async function testScrape() {
  // Page catégorie qui contient le produit Clinique
  const url = 'https://www.nocibe.fr/fr/c/soin-visage/soin-contours-des-yeux/gel-contour-des-yeux/120403';
  
  console.log('Fetching:', url);
  const response = await fetch(url, { headers: HEADERS });
  const html = await response.text();
  const $ = cheerio.load(html);
  
  console.log('\n=== Recherche produits Clinique ===\n');
  
  $('.product-tile').each((_, tile) => {
    const $tile = $(tile);
    const name = $tile.find('.top-brand').text().trim() + ' ' + 
                 $tile.find('.brand-line').text().trim() + ' ' +
                 $tile.find('.name').text().trim();
    
    if (!name.toLowerCase().includes('clinique')) return;
    
    console.log('Produit:', name);
    
    // Prix discount (actuel)
    const priceDiscount = $tile.find('[data-testid="price-discount"]').text().trim();
    console.log('  price-discount:', priceDiscount);
    
    // Prix original (barré)
    const priceOriginal = $tile.find('[data-testid="price-original"]').text().trim();
    console.log('  price-original:', priceOriginal);
    
    // Badge réduction
    const discountBadge = $tile.find('[data-testid="product-eyecatcher-discountFlag"]').text().trim();
    console.log('  discountFlag badge:', discountBadge || '(aucun)');
    
    // Badge SOLDES
    const salesBadge = $tile.find('[data-testid="product-eyecatcher-sales"]').text().trim();
    console.log('  sales badge:', salesBadge || '(aucun)');
    
    // Autres eyecatchers
    const otherBadges = $tile.find('.eyecatcher').map((_, el) => $(el).text().trim()).get();
    console.log('  autres badges:', otherBadges.length ? otherBadges.join(', ') : '(aucun)');
    
    // aria-label complet
    const ariaLabels = $tile.find('[aria-label]').map((_, el) => $(el).attr('aria-label')).get();
    console.log('  aria-labels:', ariaLabels.slice(0, 5).join(' | '));
    
    console.log('');
  });
}

testScrape().catch(console.error);
