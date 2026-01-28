/**
 * =============================================================================
 * MARIONNAUD.TS - SCRAPING EN MASSE DES PAGES CATÉGORIES
 * =============================================================================
 * 
 * FONCTION : Parcourir les pages catégories Marionnaud pour récupérer TOUS les
 *            produits en promotion (scraping en masse)
 * 
 * UTILISÉ PAR : import-marionnaud.ts, ImportEngine.ts
 * 
 * TECHNOLOGIE : Cheerio + fetch (HTML statique) - fonctionne car les pages
 *               catégories Marionnaud rendent le HTML côté serveur
 * 
 * NE PAS CONFONDRE AVEC : marionnaud-search.ts (recherche d'UN produit spécifique)
 * =============================================================================
 */
import * as cheerio from 'cheerio';
import { Scraper, ScrapedProduct, ScrapingResult } from './types';

export interface MarionnaudProduct {
  name: string;
  brand: string;
  productLine: string;
  productType: string;
  currentPrice: number;
  originalPrice: number;
  discountPercent: number;
  promoCode?: string;
  priceWithCode?: number;
  productUrl: string;
  imageUrl: string;
  category: string;
  size?: string;
  rating?: number;
  reviewCount?: number;
  sku?: string;
}

export interface MarionnaudScrapingResult {
  success: boolean;
  products: MarionnaudProduct[];
  errors: string[];
  duration: number;
}

export interface MarionnaudConfig {
  headless: boolean;
  timeout: number;
  delayBetweenRequests: number;
}

const DEFAULT_CONFIG: MarionnaudConfig = {
  headless: true,
  timeout: 30000,
  delayBetweenRequests: 2000,
};

// Rotation de User-Agents pour éviter la détection
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
];

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function getHeaders(referer?: string): Record<string, string> {
  return {
    'User-Agent': getRandomUserAgent(),
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Sec-Ch-Ua': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': referer ? 'same-origin' : 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
    'Referer': referer || 'https://www.marionnaud.fr/',
  };
}

export class MarionnaudScraper implements Scraper {
  private config: MarionnaudConfig;
  
  /** Identifiant du scraper pour l'ImportEngine */
  readonly merchantSlug = 'marionnaud';

  constructor(config: Partial<MarionnaudConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async init(): Promise<void> {
    // Plus besoin d'initialiser un navigateur
  }

  async close(): Promise<void> {
    // Plus rien à fermer
  }

  /**
   * Méthode standard de l'interface Scraper
   * Convertit MarionnaudProduct[] en ScrapedProduct[] standardisés
   */
  async scrape(url: string, maxProducts: number = 100): Promise<ScrapingResult> {
    const result = await this.scrapeCategoryPage(url, maxProducts);
    
    // NOTE: Les images HD sont récupérées APRÈS le filtrage des deals valides
    // via la méthode publique enrichProductsWithHDImages()
    
    // Convertir MarionnaudProduct -> ScrapedProduct
    const standardProducts: ScrapedProduct[] = result.products.map(p => ({
      name: p.name,
      brand: p.brand,
      productUrl: p.productUrl,
      sku: p.sku,
      currentPrice: p.currentPrice,
      originalPrice: p.originalPrice,
      discountPercent: p.discountPercent,
      imageUrl: p.imageUrl,
      volume: p.size,
      category: p.category,
      rating: p.rating,
      reviewCount: p.reviewCount,
      sourceUrl: url,
    }));

    return {
      success: result.success,
      products: standardProducts,
      errors: result.errors,
      duration: result.duration,
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Récupère l'image haute résolution depuis la page produit individuelle
   * Les pages produits ont des images en 380x380 ou 2000x2000 dans le srcset
   */
  private async fetchHDImage(productUrl: string): Promise<string | null> {
    try {
      // Extraire le SKU de l'URL (ex: /p/BP_100234912 -> 100234912)
      const skuMatch = productUrl.match(/\/p\/(?:BP_)?(\d+)/);
      const sku = skuMatch ? skuMatch[1] : null;
      
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(productUrl, {
        headers: getHeaders('https://www.marionnaud.fr/'),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      
      if (!response.ok) return null;
      
      const html = await response.text();
      const $ = cheerio.load(html);
      
      // Chercher l'image qui correspond au SKU du produit
      let hdUrl: string | null = null;
      
      $('img[srcset]').each((_, img) => {
        const $img = $(img);
        const srcset = $img.attr('srcset') || '';
        const src = $img.attr('src') || '';
        
        // Vérifier si cette image correspond au SKU du produit
        if (sku && (srcset.includes(sku) || src.includes(sku))) {
          // Extraire la plus haute résolution du srcset (2000x2000)
          if (srcset.includes('2000x2000')) {
            const sources = srcset.split(',').map(s => s.trim());
            for (const source of sources) {
              if (source.includes('2000x2000')) {
                hdUrl = source.split(' ')[0];
                if (hdUrl.startsWith('//')) hdUrl = 'https:' + hdUrl;
                return false; // break
              }
            }
          }
          // Fallback sur src si pas de 2000x2000
          if (!hdUrl && src.includes('2000x2000')) {
            hdUrl = src.startsWith('//') ? 'https:' + src : src;
            return false;
          }
        }
      });
      
      return hdUrl;
    } catch (error) {
      // Silently fail - on gardera l'image catalogue
      return null;
    }
  }

  /**
   * Enrichit les produits avec leurs images HD depuis les pages produits
   * Traite en parallèle par batch pour optimiser le temps
   * 
   * @param products - Liste de ScrapedProduct à enrichir (modifiés in-place)
   */
  async enrichProductsWithHDImages(products: ScrapedProduct[]): Promise<void> {
    const BATCH_SIZE = 5; // 5 requêtes en parallèle
    const DELAY_BETWEEN_BATCHES = 1000; // 1s entre chaque batch
    
    console.log(`[Marionnaud] Récupération des images HD pour ${products.length} produits...`);
    
    for (let i = 0; i < products.length; i += BATCH_SIZE) {
      const batch = products.slice(i, i + BATCH_SIZE);
      
      await Promise.all(batch.map(async (product: ScrapedProduct) => {
        const hdImageUrl = await this.fetchHDImage(product.productUrl);
        if (hdImageUrl) {
          product.imageUrl = hdImageUrl;
        }
      }));
      
      // Progress log
      if ((i + BATCH_SIZE) % 50 === 0 || i + BATCH_SIZE >= products.length) {
        console.log(`[Marionnaud] ${Math.min(i + BATCH_SIZE, products.length)}/${products.length} images HD récupérées`);
      }
      
      // Delay entre batches pour éviter le rate limiting
      if (i + BATCH_SIZE < products.length) {
        await this.delay(DELAY_BETWEEN_BATCHES);
      }
    }
  }

  private getCategoryFromUrl(url: string): string {
    if (url.includes('parfum')) return 'parfums';
    if (url.includes('maquillage')) return 'maquillage';
    if (url.includes('soin-visage')) return 'soins-visage';
    if (url.includes('soin-corps')) return 'soins-corps';
    if (url.includes('cheveux')) return 'cheveux';
    if (url.includes('solaires')) return 'soins-corps';
    if (url.includes('hygiene')) return 'soins-corps';
    return 'maquillage';
  }

  async scrapeCategoryPage(categoryUrl: string, maxProducts: number = 100): Promise<MarionnaudScrapingResult> {
    const startTime = Date.now();
    const products: MarionnaudProduct[] = [];
    const errors: string[] = [];
    const category = this.getCategoryFromUrl(categoryUrl);

    try {
      const maxPages = 3;
      let referer = 'https://www.marionnaud.fr/';
      
      for (let pageNum = 0; pageNum < maxPages; pageNum++) {
        // Marionnaud utilise ?currentPage=0 pour page 1, ?currentPage=1 pour page 2, etc.
        const pageUrl = pageNum === 0 ? categoryUrl : `${categoryUrl}?currentPage=${pageNum}`;
        
        console.log(`[Marionnaud] Page ${pageNum + 1}/${maxPages}: ${pageUrl}`);
        
        // Retry logic avec backoff
        let html: string | null = null;
        for (let attempt = 1; attempt <= 3; attempt++) {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), this.config.timeout);
          
          try {
            const response = await fetch(pageUrl, { 
              headers: getHeaders(referer), 
              signal: controller.signal 
            });
            clearTimeout(timeout);
            
            if (response.status === 403 || response.status === 429) {
              console.log(`[Marionnaud] Bloqué (${response.status}), attente ${attempt * 5}s...`);
              await this.delay(attempt * 5000);
              continue;
            }
            
            if (!response.ok) {
              errors.push(`HTTP ${response.status} pour ${pageUrl}`);
              break;
            }
            
            html = await response.text();
            referer = pageUrl; // Mise à jour du referer pour la prochaine requête
            break;
            
          } catch (fetchErr) {
            clearTimeout(timeout);
            if ((fetchErr as Error).name === 'AbortError') {
              console.log(`[Marionnaud] Timeout attempt ${attempt}/3, retry...`);
              await this.delay(attempt * 2000);
            } else {
              throw fetchErr;
            }
          }
        }
        
        if (!html) {
          errors.push(`Échec après 3 tentatives pour ${pageUrl}`);
          continue;
        }
        
        const pageProducts = this.extractProductsFromHtml(html, category);
        
        console.log(`[Marionnaud] Page ${pageNum + 1}: ${pageProducts.length} produits trouvés`);

        for (const p of pageProducts) {
          if (!products.find(existing => existing.productUrl === p.productUrl)) {
            products.push(p);
          }
        }
        
        // Si on n'a pas trouvé de produits, on arrête
        if (pageProducts.length === 0) break;

        if (pageNum < maxPages - 1) {
          // Délai aléatoire entre 2 et 4 secondes pour paraître plus humain
          const randomDelay = this.config.delayBetweenRequests + Math.random() * 2000;
          await this.delay(randomDelay);
        }
      }

      console.log(`[Marionnaud] Total: ${products.length} produits valides`);

    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown';
      errors.push('Erreur scraping: ' + error);
      console.error('[Marionnaud] Erreur:', error);
    }

    return { success: products.length > 0, products, errors, duration: Date.now() - startTime };
  }

  private extractProductsFromHtml(html: string, category: string): MarionnaudProduct[] {
    const $ = cheerio.load(html);
    const products: MarionnaudProduct[] = [];

    // Sélecteur principal: e2-flex.product-grid__product-item ou .product-list-item
    $('e2-flex.product-grid__product-item, .product-grid__product-item').each((_, tile) => {
      try {
        const $tile = $(tile);
        
        // SKU depuis l'attribut id ou data-base-code
        const sku = $tile.attr('id') || $tile.attr('data-base-code') || '';
        
        // URL du produit
        const href = $tile.find('a.product-list-item__link, a.product-list-item__details-wrapper').first().attr('href') || '';
        const productUrl = href ? 'https://www.marionnaud.fr' + href : '';
        if (!productUrl) return;

        // Image - prioriser les URLs haute qualité
        const $img = $tile.find('.product-list-item__image img, e2core-media img');
        let imageUrl = '';
        
        // 1. Essayer srcset (généralement contient des URLs haute résolution)
        const srcset = $img.attr('srcset');
        if (srcset) {
          // Prendre la plus haute résolution disponible dans srcset
          const sources = srcset.split(',').map(s => s.trim());
          const highestRes = sources[sources.length - 1]; // Dernière = plus haute résolution
          imageUrl = highestRes.split(' ')[0]; // Extraire juste l'URL
        }
        
        // 2. Sinon essayer data-src ou data-image (lazy loading)
        if (!imageUrl) {
          imageUrl = $img.attr('data-src') || $img.attr('data-image') || '';
        }
        
        // 3. Fallback sur src classique
        if (!imageUrl) {
          imageUrl = $img.attr('src') || '';
        }
        
        // 4. Nettoyer l'URL et forcer HTTPS si besoin
        if (imageUrl) {
          imageUrl = imageUrl.trim();
          if (imageUrl.startsWith('//')) {
            imageUrl = 'https:' + imageUrl;
          } else if (imageUrl.startsWith('/')) {
            imageUrl = 'https://www.marionnaud.fr' + imageUrl;
          }
          // Retirer les paramètres de redimensionnement
          imageUrl = imageUrl.replace(/[?&](w|h|width|height)=\d+/gi, '');
          
          // Note: Les images Marionnaud catalogue sont en 195x195 pixels
          // Les images haute résolution (380x380, 2000x2000) existent mais avec des chemins différents
          // qu'on ne peut pas déduire de l'URL catalogue. On garde donc le 195x195.
        }

        // Marque
        const brand = $tile.find('.product-list-item__brand').text().trim();

        // Ligne de produit (gamme)
        const productLine = $tile.find('.product-list-item__range').text().trim();

        // Nom du produit
        const productName = $tile.find('.product-list-item__name').contents().first().text().trim();
        
        // Taille depuis .product-list-item__size
        const sizeText = $tile.find('.product-list-item__size').text().trim().replace(/^-\s*/, '');
        
        // Nom complet
        const name = [brand, productLine, productName].filter(Boolean).join(' ');

        // Prix et réduction
        let currentPrice = 0;
        let originalPrice = 0;
        let discountPercent = 0;

        // Vérifier si c'est un produit en promotion (classe price--discounted)
        const isDiscounted = $tile.find('e2core-price.price--discounted, .price--discounted').length > 0;

        // Prix actuel (price__default-value)
        const currentPriceText = $tile.find('.price__default-value').text().trim();
        const currentMatch = currentPriceText.match(/([\d]+[,.]?[\d]*)\s*€/);
        if (currentMatch) currentPrice = parseFloat(currentMatch[1].replace(',', '.'));

        // Prix barré (price__was)
        const wasPriceText = $tile.find('.price__was').text().trim();
        const wasMatch = wasPriceText.match(/([\d]+[,.]?[\d]*)\s*€/);
        if (wasMatch) originalPrice = parseFloat(wasMatch[1].replace(',', '.'));

        // Badge de réduction (promotion-badge avec pourcentage)
        const promoBadge = $tile.find('.promotion-badge, e2core-promotion-product-badge .promotion-badge').text().trim();
        const discountMatch = promoBadge.match(/(\d+)%/);
        if (discountMatch) discountPercent = parseInt(discountMatch[1]);

        // Si on a un % mais pas de prix original, le calculer
        if (originalPrice === 0 && discountPercent > 0 && currentPrice > 0) {
          originalPrice = Math.round((currentPrice / (1 - discountPercent / 100)) * 100) / 100;
        }

        // Si pas de réduction détectée, originalPrice = currentPrice
        const isRealDeal = originalPrice > currentPrice || discountPercent > 0 || isDiscounted;
        if (!isRealDeal) {
          originalPrice = currentPrice;
          discountPercent = 0;
        }

        // Calculer réduction si manquante
        if (discountPercent === 0 && originalPrice > currentPrice && currentPrice > 0) {
          discountPercent = Math.round((1 - currentPrice / originalPrice) * 100);
        }

        // Rating
        let rating: number | undefined;
        let reviewCount: number | undefined;
        
        const starRating = $tile.find('e2-star-rating');
        const starFill = starRating.attr('style');
        if (starFill) {
          const ratingMatch = starFill.match(/--star-fill:\s*([\d.]+)/);
          if (ratingMatch) rating = parseFloat(ratingMatch[1]);
        }
        
        // Fallback: texte après les étoiles
        const ratingText = $tile.find('.product-list-item__rating > span').first().text().trim();
        if (!rating && ratingText) {
          const rMatch = ratingText.match(/([\d.]+)/);
          if (rMatch) rating = parseFloat(rMatch[1]);
        }
        
        const reviewCountText = $tile.find('.product-list-item__rating-total').text().trim();
        if (reviewCountText) {
          const rcMatch = reviewCountText.match(/(\d+)/);
          if (rcMatch) reviewCount = parseInt(rcMatch[1]);
        }

        // Taille normalisée
        let size = '';
        if (sizeText) {
          const sizeMatch = sizeText.match(/([\d]+[,.]?[\d]*)\s*(ml|mL|g|L)/i);
          if (sizeMatch) {
            const volume = sizeMatch[1].replace(',', '.');
            const unit = sizeMatch[2].toLowerCase();
            size = volume + unit;
          } else {
            size = sizeText;
          }
        }

        if (name && currentPrice > 0 && productUrl) {
          products.push({
            name,
            brand,
            productLine,
            productType: '',
            currentPrice,
            originalPrice,
            discountPercent,
            productUrl,
            imageUrl,
            category,
            size,
            sku,
            rating,
            reviewCount,
          });
        }
      } catch (e) {
        // Ignorer les erreurs individuelles
      }
    });

    return products;
  }
}
