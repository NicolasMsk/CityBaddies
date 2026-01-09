/**
 * Nocibe Search - Simple HTTP fetch (pas de Playwright)
 */
import * as cheerio from 'cheerio';

const SERPER_API_KEY = "a7bc1e66280fcbf540a0d6072fc342ef4fdfaeaf";

export interface NocibeSearchResult {
  found: boolean;
  productName?: string;
  productUrl?: string;
  brand?: string;
  currentPrice?: number;
  originalPrice?: number;
  discountPercent?: number;
  volume?: string;
  inStock?: boolean;
  allVariants?: Array<{ volume: string; price: number; originalPrice?: number; available: boolean }>;
  error?: string;
}

function normalizeVolume(volume: string): number {
  const match = volume.match(/(\d+(?:[.,]\d+)?)/);
  return match ? parseFloat(match[1].replace(',', '.')) : 0;
}

async function getNocibeUrlViaSerper(product: string, volume: string): Promise<string | null> {
  const query = `${product} ${volume} site:nocibe.fr`;
  console.log(`[SERPER] "${query}"`);
  
  const response = await fetch("https://google.serper.dev/search", {
    method: 'POST',
    headers: { 'X-API-KEY': SERPER_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: query, num: 5, gl: 'fr', hl: 'fr' })
  });
  
  if (!response.ok) return null;
  
  const data = await response.json();
  for (const result of (data.organic || [])) {
    const url = result.link || '';
    if (url.includes('nocibe.fr') && !url.includes('/recherche') && !url.includes('/c/')) {
      console.log(`[SERPER] URL: ${url}`);
      return url;
    }
  }
  return null;
}

export async function searchNocibeProduct(searchQuery: string, targetVolume: string): Promise<NocibeSearchResult> {
  if (!targetVolume) {
    return { found: false, error: 'Volume obligatoire' };
  }
  
  const targetVolumeNum = normalizeVolume(targetVolume);
  console.log(`\n[NOCIBE] "${searchQuery}" - ${targetVolume}`);
  
  try {
    // 1. Trouver l'URL via Serper
    const productUrl = await getNocibeUrlViaSerper(searchQuery, targetVolume);
    if (!productUrl) {
      return { found: false, error: 'Produit non trouve sur Google' };
    }
    
    // 2. Fetch la page HTML (comme en Python avec requests)
    const response = await fetch(productUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9'
      }
    });
    
    if (!response.ok) {
      return { found: false, error: `HTTP ${response.status}` };
    }
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // 3. Extraire les variantes (comme BeautifulSoup)
    const variants: Array<{ volume: string; price: number; originalPrice?: number; available: boolean }> = [];
    
    $('.size-variants-radio__radio-item').each((_, item) => {
      const $item = $(item);
      const vol = $item.find('.product-detail__variant-name').text().trim();
      
      // Le prix est dans [data-testid="price-discount"] > span > span[aria-label]
      // Ex: aria-label="Actuellement 14,89 €"
      const priceEl = $item.find('[data-testid="price-discount"] span[aria-label]');
      const ariaLabel = priceEl.attr('aria-label') || '';
      const priceMatch = ariaLabel.match(/([\d]+[,.]?[\d]*)\s*€/);
      const price = priceMatch ? parseFloat(priceMatch[1].replace(',', '.')) : 0;
      
      // Prix original (barré) si présent
      const origEl = $item.find('[data-testid="price-original"] span[aria-label]');
      const origLabel = origEl.attr('aria-label') || '';
      const origMatch = origLabel.match(/([\d]+[,.]?[\d]*)\s*€/);
      const originalPrice = origMatch ? parseFloat(origMatch[1].replace(',', '.')) : undefined;
      
      if (vol && price > 0) {
        variants.push({ volume: vol, price, originalPrice, available: true });
      }
    });
    
    // Extraire marque et nom
    const brand = $('.brand-line').text().trim() || '';
    const name = $('h1').text().trim() || '';
    
    console.log(`[NOCIBE] ${brand || name}`);
    console.log(`[NOCIBE] ${variants.length} variante(s)`);
    
    if (variants.length === 0) {
      return { found: false, productUrl, error: 'Aucune variante trouvee' };
    }
    
    for (const v of variants) {
      const marker = normalizeVolume(v.volume) === targetVolumeNum ? '>>>' : '   ';
      console.log(`${marker} ${v.volume}: ${v.price}€`);
    }
    
    // 4. Trouver le volume exact
    const exactMatch = variants.find(v => normalizeVolume(v.volume) === targetVolumeNum);
    
    if (!exactMatch) {
      return { 
        found: false, 
        productUrl,
        productName: `${brand} ${name}`.trim(),
        brand,
        allVariants: variants,
        error: `Volume ${targetVolume} non disponible`
      };
    }
    
    console.log(`[NOCIBE] ✓ ${exactMatch.volume}: ${exactMatch.price}€`);
    
    return {
      found: true,
      productName: `${brand} ${name}`.trim(),
      productUrl,
      brand,
      currentPrice: exactMatch.price,
      volume: exactMatch.volume,
      inStock: exactMatch.available,
      allVariants: variants
    };
    
  } catch (error) {
    console.error('[NOCIBE] Erreur:', error);
    return { found: false, error: error instanceof Error ? error.message : 'Erreur' };
  }
}

export async function compareWithNocibe(deal: {
  title: string;
  brand?: string;
  volume: string;
  dealPrice: number;
}): Promise<{
  nocibeResult: NocibeSearchResult;
  comparison?: {
    priceDifference: number;
    percentageDifference: number;
    cheaperAt: 'sephora' | 'nocibe' | 'equal';
  };
}> {
  const searchQuery = deal.brand && !deal.title.toLowerCase().includes(deal.brand.toLowerCase())
    ? `${deal.brand} ${deal.title}`
    : deal.title;
  
  const nocibeResult = await searchNocibeProduct(searchQuery, deal.volume);
  
  if (!nocibeResult.found || !nocibeResult.currentPrice) {
    return { nocibeResult };
  }
  
  const diff = deal.dealPrice - nocibeResult.currentPrice;
  return {
    nocibeResult,
    comparison: {
      priceDifference: Math.round(diff * 100) / 100,
      percentageDifference: Math.round((diff / nocibeResult.currentPrice) * 100),
      cheaperAt: Math.abs(diff) < 0.5 ? 'equal' : diff < 0 ? 'sephora' : 'nocibe'
    }
  };
}