/**
 * Marionnaud Scraper - Version optimisée avec fetch + cheerio (pas de Playwright)
 * Implémente l'interface Scraper pour le Strategy Pattern
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
  timeout: 15000,
  delayBetweenRequests: 500,
};

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'fr-FR,fr;q=0.9',
};

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
      
      for (let pageNum = 0; pageNum < maxPages; pageNum++) {
        // Marionnaud utilise ?currentPage=0 pour page 1, ?currentPage=1 pour page 2, etc.
        const pageUrl = pageNum === 0 ? categoryUrl : `${categoryUrl}?currentPage=${pageNum}`;
        
        console.log(`[Marionnaud] Page ${pageNum + 1}/${maxPages}: ${pageUrl}`);
        
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        
        try {
          const response = await fetch(pageUrl, { headers: HEADERS, signal: controller.signal });
          clearTimeout(timeout);
          
          if (!response.ok) {
            errors.push(`HTTP ${response.status} pour ${pageUrl}`);
            continue;
          }
          
          const html = await response.text();
          const pageProducts = this.extractProductsFromHtml(html, category);
          
          console.log(`[Marionnaud] Page ${pageNum + 1}: ${pageProducts.length} produits trouvés`);

          for (const p of pageProducts) {
            if (!products.find(existing => existing.productUrl === p.productUrl)) {
              products.push(p);
            }
          }
          
          // Si on n'a pas trouvé de produits, on arrête
          if (pageProducts.length === 0) break;
          
        } catch (fetchErr) {
          clearTimeout(timeout);
          if ((fetchErr as Error).name === 'AbortError') {
            console.log(`[Marionnaud] Timeout page ${pageNum + 1}, skip...`);
            errors.push(`Timeout pour ${pageUrl}`);
          } else {
            throw fetchErr;
          }
        }

        if (pageNum < maxPages - 1) {
          await this.delay(this.config.delayBetweenRequests);
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

        // Image
        const $img = $tile.find('.product-list-item__image img, e2core-media img');
        const imageUrl = $img.attr('src') || '';

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
