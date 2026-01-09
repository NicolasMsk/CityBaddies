/**
 * Nocibé Scraper - Version optimisée avec fetch + cheerio (pas de Playwright)
 * Beaucoup plus rapide car le HTML est rendu côté serveur
 * Implémente l'interface Scraper pour le Strategy Pattern
 */
import * as cheerio from 'cheerio';
import { Scraper, ScrapedProduct, ScrapingResult, ScraperConfig, DEFAULT_SCRAPER_CONFIG } from './types';

export interface NocibeProduct {
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

export interface NocibeProductDetails {
  description?: string;
  conseils?: string;
  ingredients?: string;
  notesOlfactives?: string;
  bulletPoints?: string[];
}

export interface NocibeScrapingResult {
  success: boolean;
  products: NocibeProduct[];
  errors: string[];
  duration: number;
}

export interface NocibeConfig {
  headless: boolean;
  timeout: number;
  delayBetweenRequests: number;
}

const DEFAULT_CONFIG: NocibeConfig = {
  headless: true,
  timeout: 15000,
  delayBetweenRequests: 500,
};

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'fr-FR,fr;q=0.9',
};

export class NocibeScraper implements Scraper {
  private config: NocibeConfig;
  
  /** Identifiant du scraper pour l'ImportEngine */
  readonly merchantSlug = 'nocibe';

  constructor(config: Partial<NocibeConfig> = {}) {
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
   * Convertit NocibeProduct[] en ScrapedProduct[] standardisés
   */
  async scrape(url: string, maxProducts: number = 100): Promise<ScrapingResult> {
    const result = await this.scrapeCategoryPage(url, maxProducts);
    
    // Convertir NocibeProduct -> ScrapedProduct
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

  private mapCategory(nocibeCategory: string): string {
    const categoryMap: Record<string, string> = {
      '0501': 'parfums',
      '0510': 'maquillage',
      '0502': 'soins-visage',
      '0504': 'soins-corps',
      '0512': 'cheveux',
      'parfum': 'parfums',
      'maquillages': 'maquillage',
      'soin-visage': 'soins-visage',
      'soin-corps': 'soins-corps',
      'cheveux': 'cheveux',
    };
    return categoryMap[nocibeCategory] || 'maquillage';
  }

  private getCategoryFromUrl(url: string): string {
    const match = url.match(/\/(\d{4})$/);
    if (match) return this.mapCategory(match[1]);
    if (url.includes('parfum')) return 'parfums';
    if (url.includes('maquillage')) return 'maquillage';
    if (url.includes('soin-visage')) return 'soins-visage';
    if (url.includes('soin-corps')) return 'soins-corps';
    if (url.includes('cheveux')) return 'cheveux';
    return 'maquillage';
  }

  async scrapeCategoryPage(categoryUrl: string, maxProducts: number = 100): Promise<NocibeScrapingResult> {
    const startTime = Date.now();
    const products: NocibeProduct[] = [];
    const errors: string[] = [];
    const category = this.getCategoryFromUrl(categoryUrl);

    try {
      const maxPages = 2;
      
      for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
        const pageUrl = pageNum === 1 ? categoryUrl : `${categoryUrl}?page=${pageNum}`;
        
        console.log(`[Nocibe] Page ${pageNum}/${maxPages}: ${pageUrl}`);
        
        // Timeout de 10 secondes pour éviter les blocages
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        
        try {
          const response = await fetch(pageUrl, { headers: HEADERS, signal: controller.signal });
          clearTimeout(timeout);
          
          if (!response.ok) {
            errors.push(`HTTP ${response.status} pour ${pageUrl}`);
            continue;
          }
          
          const html = await response.text();
          const pageProducts = this.extractProductsFromHtml(html, category);
          
          console.log(`[Nocibe] Page ${pageNum}: ${pageProducts.length} produits trouvés`);

          for (const p of pageProducts) {
            if (!products.find(existing => existing.productUrl === p.productUrl)) {
              products.push(p);
            }
          }
        } catch (fetchErr) {
          clearTimeout(timeout);
          if ((fetchErr as Error).name === 'AbortError') {
            console.log(`[Nocibe] Timeout page ${pageNum}, skip...`);
            errors.push(`Timeout pour ${pageUrl}`);
          } else {
            throw fetchErr;
          }
        }

        if (pageNum < maxPages) {
          await this.delay(this.config.delayBetweenRequests);
        }
      }

      console.log(`[Nocibe] Total: ${products.length} produits valides`);

    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown';
      errors.push('Erreur scraping: ' + error);
      console.error('[Nocibe] Erreur:', error);
    }

    return { success: products.length > 0, products, errors, duration: Date.now() - startTime };
  }

  private extractProductsFromHtml(html: string, category: string): NocibeProduct[] {
    const $ = cheerio.load(html);
    const products: NocibeProduct[] = [];

    $('.product-tile').each((_, tile) => {
      try {
        const $tile = $(tile);
        
        // URL du produit
        const href = $tile.find('a.product-tile__main-link, a[data-testid="main-link"]').attr('href') || '';
        const productUrl = href ? 'https://www.nocibe.fr' + href : '';
        if (!productUrl) return;

        // Image
        const $img = $tile.find('img.image');
        const imageUrl = $img.attr('src') || $img.attr('data-lazy-src') || '';

        // Marque
        const brand = $tile.find('.top-brand, [class*="top-brand"]').text().trim();

        // Ligne de produit
        const productLine = $tile.find('.brand-line, [class*="brand-line"]').text().trim();

        // Nom variant
        const variantName = $tile.find('.name, [class*="product-name"]').text().trim();

        // Type de produit
        const productType = $tile.find('.category').text().trim();

        // Nom complet
        const name = [brand, productLine, variantName].filter(Boolean).join(' ');

        // Prix et réduction
        let currentPrice = 0;
        let originalPrice = 0;
        let discountPercent = 0;

        // Badge de réduction
        const discountBadge = $tile.find('[data-testid="product-eyecatcher-discountFlag"]').text().trim();
        const discountMatch = discountBadge.match(/-(\d+)%/);
        if (discountMatch) discountPercent = parseInt(discountMatch[1]);

        // Prix actuel
        const priceEl = $tile.find('[data-testid="price-discount"] span[aria-label], [data-testid="discounted-price"] span[aria-label]');
        const priceLabel = priceEl.attr('aria-label') || priceEl.text() || '';
        const priceMatch = priceLabel.match(/([\d]+[,.]?[\d]*)\s*€/);
        if (priceMatch) currentPrice = parseFloat(priceMatch[1].replace(',', '.'));

        // Fallback prix
        if (currentPrice === 0) {
          const anyPriceEl = $tile.find('[data-testid="product-info-price"] span[aria-label]');
          const anyLabel = anyPriceEl.attr('aria-label') || anyPriceEl.text() || '';
          const anyMatch = anyLabel.match(/([\d]+[,.]?[\d]*)\s*€/);
          if (anyMatch) currentPrice = parseFloat(anyMatch[1].replace(',', '.'));
        }

        // Prix original
        const origEl = $tile.find('[data-testid="price-original"] span[aria-label]');
        const origLabel = origEl.attr('aria-label') || origEl.text() || '';
        const origMatch = origLabel.match(/([\d]+[,.]?[\d]*)\s*€/);
        if (origMatch) originalPrice = parseFloat(origMatch[1].replace(',', '.'));

        // Si on a un % de réduction mais pas de prix original, le calculer
        if (originalPrice === 0 && discountPercent > 0 && currentPrice > 0) {
          // Prix original = prix actuel / (1 - réduction%)
          // Ex: 53.90€ avec -23% → prix original = 53.90 / 0.77 = 70€
          originalPrice = Math.round((currentPrice / (1 - discountPercent / 100)) * 100) / 100;
        }

        // Fallback: si toujours pas de prix original, utiliser le prix actuel
        if (originalPrice === 0) originalPrice = currentPrice;

        // Calculer réduction si manquante
        if (discountPercent === 0 && originalPrice > currentPrice && currentPrice > 0) {
          discountPercent = Math.round((1 - currentPrice / originalPrice) * 100);
        }

        // Taille
        let size = '';
        const sizeEl = $tile.find('[data-testid="price-base-unit"] span[aria-label]');
        const sizeText = sizeEl.attr('aria-label') || sizeEl.text() || '';
        const sizeMatch = sizeText.match(/([\d]+[,.]?[\d]*)\s*(millilitre|ml|gramme|g)\b/i);
        if (sizeMatch) {
          const volume = sizeMatch[1].replace(',', '.');
          const unit = sizeMatch[2].toLowerCase().startsWith('milli') ? 'ml' : 
                       sizeMatch[2].toLowerCase().startsWith('gram') ? 'g' : sizeMatch[2];
          size = volume + ' ' + unit;
        }

        // Code promo
        const promoCode = $tile.find('.eyecatcher--coupon-promotion').text().trim() || undefined;

        // SKU
        let sku = '';
        const skuMatch = href.match(/\/p\/(\d+)/);
        if (skuMatch) sku = skuMatch[1];

        if (name && currentPrice > 0 && productUrl) {
          products.push({
            name,
            brand,
            productLine,
            productType,
            currentPrice,
            originalPrice,
            discountPercent,
            promoCode,
            productUrl,
            imageUrl,
            category,
            size,
            sku,
          });
        }
      } catch (e) {
        // Ignorer
      }
    });

    return products;
  }

  async scrapeProductDetails(productUrl: string): Promise<NocibeProductDetails> {
    try {
      const response = await fetch(productUrl, { headers: HEADERS });
      if (!response.ok) return {};
      
      const html = await response.text();
      const $ = cheerio.load(html);

      const bulletPoints: string[] = [];
      $('[data-testid="bullet-points"] li').each((_, li) => {
        const text = $(li).text().trim();
        if (text) bulletPoints.push(text);
      });

      const description = $('#srchOpt-product-details .product-details__description').text().trim() ||
                          $('[data-testid="product-details-description"]').text().trim() || '';

      const conseils = $('#srchOpt--application .product-detail-other-info__html').text().trim() || '';
      const ingredients = $('#srchOpt--ingredients .product-detail-other-info__html').text().trim() || '';

      return { description: description.substring(0, 2000), conseils, ingredients, bulletPoints };
    } catch (err) {
      console.error('[Nocibe] Erreur scraping détails:', err);
      return {};
    }
  }

  async scrapeProductFullDetails(productUrl: string): Promise<NocibeProduct | null> {
    try {
      const response = await fetch(productUrl, { headers: HEADERS });
      if (!response.ok) return null;
      
      const html = await response.text();
      const $ = cheerio.load(html);

      // Marque
      let brand = $('.brand-name__seo-only').text().trim();
      if (!brand) brand = $('.brand-line').text().trim();

      // Ligne de produit
      const productLine = $('a.brand-line').text().trim();

      // Type de produit
      let productType = '';
      const feedbackText = $('.product-feedback__container').text();
      if (feedbackText) {
        productType = feedbackText.split(/[0-9]/)[0].trim();
      }

      // Rating
      const rating = parseFloat($('[data-testid="rating-stars"]').attr('data-average-rating') || '0');

      // Review count
      let reviewCount = 0;
      const reviewText = $('[data-testid="ratings-info"]').text();
      const reviewMatch = reviewText.match(/\(([\d\.]+)\)/);
      if (reviewMatch) reviewCount = parseInt(reviewMatch[1].replace('.', ''));

      // Variante sélectionnée
      const $selected = $('.product-detail__variant--selected');
      const size = $selected.find('.product-detail__variant-name').text().trim();
      
      let currentPrice = 0;
      const priceLabel = $selected.find('[data-testid="price-discount"]').text().trim();
      const priceMatch = priceLabel.match(/([\d,]+)/);
      if (priceMatch) currentPrice = parseFloat(priceMatch[1].replace(',', '.'));

      // Code promo
      const promoCode = $selected.find('[data-testid="variant-copy-coupon-code"] .dacc09ebcc0caa6da034').text().trim() || undefined;

      // Prix avec code
      let priceWithCode: number | undefined;
      const promoPriceText = $selected.find('[data-testid="variant-product-price"]').text().replace(/[^\d,]/g, '').replace(',', '.');
      if (promoPriceText) priceWithCode = parseFloat(promoPriceText) || undefined;

      // Image
      const imageUrl = $('.product-cockpit img.image, [data-testid="product-image"] img').attr('src') || '';

      if (!currentPrice) return null;

      const name = [brand, productLine, productType, size].filter(Boolean).join(' ').trim();

      return {
        name,
        brand,
        productLine,
        productType,
        currentPrice,
        originalPrice: currentPrice,
        discountPercent: priceWithCode ? Math.round((1 - priceWithCode / currentPrice) * 100) : 0,
        promoCode,
        priceWithCode,
        productUrl,
        imageUrl,
        category: 'parfums',
        size,
        rating,
        reviewCount,
      };
    } catch (err) {
      console.error('[Nocibe] Erreur scraping produit:', err);
      return null;
    }
  }

  async scrapeMultipleCategories(categoryUrls: string[], maxPerCategory: number = 50): Promise<NocibeScrapingResult> {
    const startTime = Date.now();
    const allProducts: NocibeProduct[] = [];
    const allErrors: string[] = [];

    for (const url of categoryUrls) {
      console.log(`\n📦 [Nocibe] Scraping: ${url}`);
      const result = await this.scrapeCategoryPage(url, maxPerCategory);
      
      for (const product of result.products) {
        if (!allProducts.find(p => p.productUrl === product.productUrl)) {
          allProducts.push(product);
        }
      }
      
      allErrors.push(...result.errors);
      await this.delay(this.config.delayBetweenRequests);
    }

    console.log(`\n✅ [Nocibe] Total: ${allProducts.length} produits uniques`);

    return {
      success: allProducts.length > 0,
      products: allProducts,
      errors: allErrors,
      duration: Date.now() - startTime,
    };
  }

  async scrapeMultipleProductDetails(
    productUrls: string[], 
    concurrency: number = 5,
    onProgress?: (completed: number, total: number) => void
  ): Promise<Map<string, NocibeProductDetails>> {
    const results = new Map<string, NocibeProductDetails>();
    const total = productUrls.length;
    let completed = 0;

    for (let i = 0; i < productUrls.length; i += concurrency) {
      const batch = productUrls.slice(i, i + concurrency);
      
      const batchResults = await Promise.all(
        batch.map(async (url) => {
          const details = await this.scrapeProductDetails(url);
          return { url, details };
        })
      );

      for (const { url, details } of batchResults) {
        results.set(url, details);
        completed++;
      }

      if (onProgress) onProgress(completed, total);

      if (i + concurrency < productUrls.length) {
        await this.delay(this.config.delayBetweenRequests);
      }
    }

    return results;
  }
}
