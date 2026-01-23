/**
 * Vérifier un produit sur Nocibé - page listing
 */
import * as cheerio from 'cheerio';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  'Accept': 'text/html',
  'Accept-Language': 'fr-FR,fr;q=0.9',
};

async function checkCategoryPage(url: string, searchTerm: string) {
  console.log('Fetching:', url);
  const response = await fetch(url, { headers: HEADERS });
  const html = await response.text();
  const $ = cheerio.load(html);
  
  console.log(`\nRecherche de "${searchTerm}" dans les produits...\n`);
  
  $('.product-tile').each((_, tile) => {
    const $tile = $(tile);
    const name = $tile.find('.top-brand, .brand-line, .name').map((_, el) => $(el).text().trim()).get().join(' ');
    
    if (!name.toLowerCase().includes(searchTerm.toLowerCase())) return;
    
    console.log('=== PRODUIT TROUVÉ ===');
    console.log('Nom:', name);
    
    // Prix discount (actuel réduit)
    const priceDiscountEl = $tile.find('[data-testid="price-discount"]');
    const priceDiscount = priceDiscountEl.text().trim();
    const priceDiscountLabel = priceDiscountEl.find('span[aria-label]').attr('aria-label');
    console.log('price-discount:', priceDiscount, '| aria-label:', priceDiscountLabel);
    
    // Prix original (barré)
    const priceOriginalEl = $tile.find('[data-testid="price-original"]');
    const priceOriginal = priceOriginalEl.text().trim();
    const priceOriginalLabel = priceOriginalEl.find('span[aria-label]').attr('aria-label');
    console.log('price-original:', priceOriginal, '| aria-label:', priceOriginalLabel);
    
    // discounted-price (parent container)
    const discountedPriceEl = $tile.find('[data-testid="discounted-price"]');
    const discountedPrice = discountedPriceEl.find('span[aria-label]').first().attr('aria-label');
    console.log('discounted-price aria-label:', discountedPrice);
    
    // product-info-price (fallback)
    const productInfoPrice = $tile.find('[data-testid="product-info-price"] span[aria-label]').first().attr('aria-label');
    console.log('product-info-price aria-label:', productInfoPrice);
    
    // Badge
    const badge = $tile.find('[data-testid="product-eyecatcher-discountFlag"]').text().trim();
    console.log('Badge réduction:', badge || '(aucun)');
    
    console.log('');
  });
}

// Chercher Chanel dans les bons plans maquillage (où on trouve le dissolvant)
checkCategoryPage('https://www.nocibe.fr/fr/c/bons-plans/maquillages/0510', 'chanel').catch(console.error);
