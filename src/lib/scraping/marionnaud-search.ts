/**
 * Recherche de produits Marionnaud pour comparaison de prix
 * Utilise Serper API pour Google Search puis parse HTML
 */

import * as cheerio from 'cheerio';

const SERPER_API_KEY = process.env.SERPER_API_KEY || '';

interface ProductVariant {
  volume: string;
  price: number;
  originalPrice?: number;
  available: boolean;
}

export interface MarionnaudSearchResult {
  found: boolean;
  productName?: string;
  productUrl?: string;
  brand?: string;
  currentPrice?: number;
  originalPrice?: number;
  volume?: string;
  inStock?: boolean;
  allVariants?: ProductVariant[];
  error?: string;
}

function normalizeVolume(vol: string): number {
  // Normaliser "100ml", "100 ml", "100ML" -> 100
  const match = vol?.match(/([\d,.]+)\s*(ml|g|l)/i);
  if (!match) return 0;
  let value = parseFloat(match[1].replace(',', '.'));
  const unit = match[2].toLowerCase();
  // Convertir L en ml
  if (unit === 'l') value *= 1000;
  return Math.round(value);
}

async function googleSearchMarionnaud(query: string): Promise<string | null> {
  if (!SERPER_API_KEY) {
    console.log('[MARIONNAUD] Pas de clé API Serper');
    return null;
  }

  try {
    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': SERPER_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: query,
        gl: 'fr',
        hl: 'fr',
        num: 5,
      }),
    });

    if (!response.ok) {
      console.log(`[MARIONNAUD] Erreur Serper: ${response.status}`);
      return null;
    }

    const data = await response.json();
    
    // Trouver le premier résultat Marionnaud
    for (const result of data.organic || []) {
      if (result.link?.includes('marionnaud.fr') && 
          result.link.includes('/p/') && 
          !result.link.includes('/c/')) {
        return result.link;
      }
    }
    
    return null;
  } catch (error) {
    console.error('[MARIONNAUD] Erreur recherche:', error);
    return null;
  }
}

async function fetchProductPage(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9',
      },
    });
    
    clearTimeout(timeout);
    
    if (!response.ok) {
      console.log(`[MARIONNAUD] Erreur HTTP ${response.status}`);
      return null;
    }
    
    return await response.text();
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      console.log('[MARIONNAUD] Timeout');
    } else {
      console.error('[MARIONNAUD] Erreur fetch:', error);
    }
    return null;
  }
}

export async function searchMarionnaudProduct(
  productName: string, 
  targetVolume: string
): Promise<MarionnaudSearchResult> {
  console.log(`\n[MARIONNAUD] Recherche: "${productName}" (${targetVolume})`);
  
  const targetVolumeNum = normalizeVolume(targetVolume);
  if (targetVolumeNum === 0) {
    return { found: false, error: 'Volume invalide' };
  }

  try {
    // 1. Recherche Google
    const searchQuery = `${productName} ${targetVolume} site:marionnaud.fr`;
    const productUrl = await googleSearchMarionnaud(searchQuery);
    
    if (!productUrl) {
      return { found: false, error: 'Produit non trouvé sur Marionnaud' };
    }
    
    console.log(`[MARIONNAUD] URL trouvée: ${productUrl}`);

    // 2. Récupérer la page produit
    const html = await fetchProductPage(productUrl);
    if (!html) {
      return { found: false, productUrl, error: 'Impossible de charger la page' };
    }

    // 3. Parser le HTML
    const $ = cheerio.load(html);
    const variants: ProductVariant[] = [];

    // Chercher les variantes de taille (sélecteur de volume)
    // Structure Marionnaud: .product-variant-selector ou boutons de taille
    $('.product-variant-selector__item, .size-selector__item').each((_, el) => {
      const $el = $(el);
      const vol = $el.find('.variant-size, .size-label').text().trim() || 
                  $el.attr('data-size') || '';
      
      const priceText = $el.find('.variant-price, .price').text().trim();
      const priceMatch = priceText.match(/([\d]+[,.]?[\d]*)\s*€/);
      const price = priceMatch ? parseFloat(priceMatch[1].replace(',', '.')) : 0;
      
      if (vol && price > 0) {
        variants.push({ volume: vol, price, available: !$el.hasClass('disabled') });
      }
    });

    // Si pas de variantes trouvées, essayer la structure principale
    if (variants.length === 0) {
      // Prix principal
      const priceText = $('.product-detail__price .price__default-value, .pdp-price__current').text().trim();
      const priceMatch = priceText.match(/([\d]+[,.]?[\d]*)\s*€/);
      const currentPrice = priceMatch ? parseFloat(priceMatch[1].replace(',', '.')) : 0;
      
      // Prix barré
      const wasPriceText = $('.product-detail__price .price__was, .pdp-price__was').text().trim();
      const wasMatch = wasPriceText.match(/([\d]+[,.]?[\d]*)\s*€/);
      const originalPrice = wasMatch ? parseFloat(wasMatch[1].replace(',', '.')) : undefined;
      
      // Volume depuis le titre ou l'attribut
      const sizeText = $('.product-detail__size, .pdp-size').text().trim() ||
                       $('h1.product-detail__title').text().match(/(\d+(?:[,.]?\d+)?\s*(?:ml|g|L))/i)?.[1] || '';

      if (currentPrice > 0) {
        variants.push({ 
          volume: sizeText || targetVolume, 
          price: currentPrice, 
          originalPrice,
          available: true 
        });
      }
    }

    // Extraire marque et nom
    const brand = $('.product-detail__brand, .pdp-brand').text().trim() || '';
    const name = $('h1.product-detail__title, h1.pdp-title').text().trim() || '';

    console.log(`[MARIONNAUD] ${brand || name}`);
    console.log(`[MARIONNAUD] ${variants.length} variante(s)`);

    if (variants.length === 0) {
      return { found: false, productUrl, error: 'Aucune variante trouvée' };
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
        error: `Volume ${targetVolume} non disponible`,
      };
    }

    console.log(`[MARIONNAUD] ✓ ${exactMatch.volume}: ${exactMatch.price}€`);

    return {
      found: true,
      productName: `${brand} ${name}`.trim(),
      productUrl,
      brand,
      currentPrice: exactMatch.price,
      originalPrice: exactMatch.originalPrice,
      volume: exactMatch.volume,
      inStock: exactMatch.available,
      allVariants: variants,
    };

  } catch (error) {
    console.error('[MARIONNAUD] Erreur:', error);
    return { found: false, error: error instanceof Error ? error.message : 'Erreur' };
  }
}

export async function compareWithMarionnaud(deal: {
  title: string;
  brand?: string;
  volume: string;
  dealPrice: number;
}): Promise<{
  marionnaudResult: MarionnaudSearchResult;
  comparison?: {
    priceDifference: number;
    percentageDifference: number;
    cheaperAt: 'source' | 'marionnaud' | 'equal';
  };
}> {
  const searchQuery = deal.brand && !deal.title.toLowerCase().includes(deal.brand.toLowerCase())
    ? `${deal.brand} ${deal.title}`
    : deal.title;

  const marionnaudResult = await searchMarionnaudProduct(searchQuery, deal.volume);

  if (!marionnaudResult.found || !marionnaudResult.currentPrice) {
    return { marionnaudResult };
  }

  const diff = deal.dealPrice - marionnaudResult.currentPrice;
  return {
    marionnaudResult,
    comparison: {
      priceDifference: Math.round(diff * 100) / 100,
      percentageDifference: Math.round((diff / marionnaudResult.currentPrice) * 100),
      cheaperAt: Math.abs(diff) < 0.5 ? 'equal' : diff < 0 ? 'source' : 'marionnaud',
    },
  };
}
