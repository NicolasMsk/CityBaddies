/**
 * =============================================================================
 * NOCIBE.TS - SCRAPING EN MASSE DES PAGES CATÉGORIES
 * =============================================================================
 * 
 * FONCTION : Parcourir les pages catégories Nocibé pour récupérer TOUS les
 *            produits en promotion (scraping en masse)
 * 
 * UTILISÉ PAR : import-nocibe.ts, ImportEngine.ts
 * 
 * TECHNOLOGIE : Cheerio + fetch (HTML statique) - possible car Nocibé
 *               rend le HTML côté serveur (pas de JavaScript nécessaire)
 * 
 * NE PAS CONFONDRE AVEC : nocibe-search.ts (recherche d'UN produit spécifique)
 * =============================================================================
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

// IMPORTANT: Nocibé (Akamai) bloque les User-Agents desktop (403 Access Denied),
// y compris un vrai Chrome. Un User-Agent mobile iOS passe (HTTP 200). NE PAS
// repasser en UA desktop sans revérifier l'accès.
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
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
      promoCode: p.promoCode,
      sourceUrl: url, // URL de la page de catégorie source (pour debug)
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

        // Prix actuel (réduit) - IMPORTANT: utiliser uniquement price-discount, pas discounted-price
        const priceEl = $tile.find('[data-testid="price-discount"] span[aria-label]');
        const priceLabel = priceEl.attr('aria-label') || priceEl.text() || '';
        const priceMatch = priceLabel.match(/([\d]+[,.]?[\d]*)\s*€/);
        if (priceMatch) currentPrice = parseFloat(priceMatch[1].replace(',', '.'));

        // Fallback prix - si pas de price-discount, prendre le premier prix trouvé
        // MAIS seulement s'il n'y a pas de price-original (sinon c'est pas un deal)
        if (currentPrice === 0) {
          const hasOriginal = $tile.find('[data-testid="price-original"]').length > 0;
          if (!hasOriginal) {
            const anyPriceEl = $tile.find('[data-testid="product-info-price"] span[aria-label]');
            const anyLabel = anyPriceEl.attr('aria-label') || anyPriceEl.text() || '';
            const anyMatch = anyLabel.match(/([\d]+[,.]?[\d]*)\s*€/);
            if (anyMatch) currentPrice = parseFloat(anyMatch[1].replace(',', '.'));
          }
        }

        // Prix original (DOIT EXISTER pour être un vrai deal)
        const origEl = $tile.find('[data-testid="price-original"] span[aria-label]');
        const origLabel = origEl.attr('aria-label') || origEl.text() || '';
        const origMatch = origLabel.match(/([\d]+[,.]?[\d]*)\s*€/);
        if (origMatch) originalPrice = parseFloat(origMatch[1].replace(',', '.'));

        // Vérifier s'il y a un badge promo (SOLDES, -XX%, etc.)
        const hasPromoBadge = $tile.find('[data-testid="product-eyecatcher-sales"], [data-testid="product-eyecatcher-discountFlag"], .eyecatcher--pop').length > 0;

        // Si on a un % de réduction mais pas de prix original, le calculer
        if (originalPrice === 0 && discountPercent > 0 && currentPrice > 0) {
          // Prix original = prix actuel / (1 - réduction%)
          // Ex: 53.90€ avec -23% → prix original = 53.90 / 0.77 = 70€
          originalPrice = Math.round((currentPrice / (1 - discountPercent / 100)) * 100) / 100;
        }

        // PAS DE FALLBACK ! Si pas de prix original et pas de badge, c'est pas un deal
        // On garde quand même le produit mais avec originalPrice = currentPrice
        const isRealDeal = originalPrice > 0 || discountPercent > 0 || hasPromoBadge;
        if (!isRealDeal) {
          originalPrice = currentPrice; // Pas de réduction
          discountPercent = 0;
        }

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

}
