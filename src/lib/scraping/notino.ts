/**
 * =============================================================================
 * NOTINO.TS - SCRAPING EN MASSE DES PAGES CATÉGORIES NOTINO
 * =============================================================================
 * 
 * FONCTION : Parcourir les pages catégories Notino pour récupérer TOUS les
 *            produits en promotion (scraping en masse)
 * 
 * UTILISÉ PAR : import-notino.ts, ImportEngine.ts
 * 
 * TECHNOLOGIE : Playwright (navigateur headless) + Cheerio extraction
 *               Notino a une protection Cloudflare → Playwright obligatoire
 *               Pas de JSON intégré dans le DOM → parsing HTML avec Cheerio
 * 
 * PARTICULARITÉS :
 *   - Cloudflare → nouveau contexte browser par page
 *   - Cookie popup Usercentrics → acceptAllConsents() via API
 *   - Pagination via bouton "Afficher plus" (pas d'infinite scroll)
 *   - Codes promo dans le texte brut ("X,XX € avec le code XXX")
 * 
 * NE PAS CONFONDRE AVEC : test-notino.ts (script de test sans DB)
 * =============================================================================
 */
import { chromium, Browser, BrowserContext, Page } from 'playwright';
import * as cheerio from 'cheerio';
import { Scraper, ScrapedProduct, ScrapingResult } from './types';

// ============================================
// TYPES
// ============================================

export interface NotinoProduct {
  name: string;
  brand: string;
  variant: string;
  currentPrice: number;
  priceWithCode: number | null;
  promoCode: string | null;
  productUrl: string;
  imageUrl: string;
  category: string;
  sku: string;
  rating: number | null;
  reviewCount: number | null;
  labels: string[];
  volume: string | null;
}

export interface NotinoScrapingResult {
  success: boolean;
  products: NotinoProduct[];
  errors: string[];
  duration: number;
}

export interface NotinoConfig {
  headless: boolean;
  timeout: number;
  delayBetweenRequests: number;
  maxClicks: number;
}

const DEFAULT_CONFIG: NotinoConfig = {
  headless: true,
  timeout: 30000,
  delayBetweenRequests: 3000,
  maxClicks: 20,
};

// ============================================
// HELPERS
// ============================================

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function extractVolume(text: string): string | null {
  const match = text.match(/([\d]+(?:[,.][\d]+)?)\s*(ml|g|l|cl|oz)\b/i);
  if (match) {
    const value = match[1].replace(',', '.');
    const unit = match[2].toLowerCase();
    return `${value}${unit}`;
  }
  return null;
}

function parsePrice(text: string): number | null {
  const match = text.replace(/\s/g, '').match(/([\d]+[,.]?[\d]*)/);
  if (match) return parseFloat(match[1].replace(',', '.'));
  return null;
}

// ============================================
// CLASSE NOTINOSCRAPER
// ============================================

export class NotinoScraper implements Scraper {
  private config: NotinoConfig;
  private browser: Browser | null = null;

  /** Identifiant du scraper pour l'ImportEngine */
  readonly merchantSlug = 'notino';

  constructor(config: Partial<NotinoConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async init(): Promise<void> {
    this.browser = await chromium.launch({
      headless: this.config.headless,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
      ],
    });
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Méthode standard de l'interface Scraper
   * Convertit NotinoProduct[] en ScrapedProduct[] standardisés
   */
  async scrape(url: string, maxProducts: number = 500): Promise<ScrapingResult> {
    const result = await this.scrapeCategoryPage(url, maxProducts);

    // Convertir NotinoProduct -> ScrapedProduct
    const standardProducts: ScrapedProduct[] = result.products.map(p => ({
      name: p.name,
      brand: p.brand,
      productUrl: p.productUrl,
      sku: p.sku,
      currentPrice: p.priceWithCode || p.currentPrice, // Prendre le prix code promo si dispo
      originalPrice: p.currentPrice, // Le prix affiché est déjà le prix remisé
      discountPercent: p.priceWithCode
        ? Math.round((1 - p.priceWithCode / p.currentPrice) * 100)
        : 0,
      imageUrl: p.imageUrl,
      volume: p.volume || undefined,
      category: p.category,
      rating: p.rating || undefined,
      reviewCount: p.reviewCount || undefined,
      sourceUrl: url,
    }));

    return {
      success: result.success,
      products: standardProducts,
      errors: result.errors,
      duration: result.duration,
    };
  }

  // ============================================
  // SCRAPER UNE PAGE CATÉGORIE
  // ============================================

  async scrapeCategoryPage(categoryUrl: string, maxProducts: number = 500): Promise<NotinoScrapingResult> {
    const startTime = Date.now();
    const products: NotinoProduct[] = [];
    const errors: string[] = [];

    if (!this.browser) await this.init();

    // Nouveau contexte par page (anti-Cloudflare)
    const context: BrowserContext = await this.browser!.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      locale: 'fr-FR',
      viewport: { width: 1920, height: 1080 },
    });
    const page: Page = await context.newPage();

    try {
      console.log(`[Notino] Chargement: ${categoryUrl}`);
      await page.goto(categoryUrl, { waitUntil: 'domcontentloaded', timeout: this.config.timeout });

      // Attendre les produits
      await page.waitForSelector('[data-testid="product-container"]', { timeout: 25000 });
      console.log(`[Notino] Page chargée`);

      // Fermer le popup cookies Usercentrics
      await this.closeCookiePopup(page);

      // Charger tous les produits via "Afficher plus"
      await this.loadMoreProducts(page, maxProducts);

      // Extraire les produits avec Cheerio
      const extracted = await this.extractProducts(page, '');
      products.push(...extracted.slice(0, maxProducts));

      console.log(`[Notino] ${products.length} produits extraits`);

    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown';
      errors.push('Erreur scraping catégorie: ' + error);
      console.error('[Notino] Erreur:', error);
    } finally {
      await page.close();
      await context.close();
    }

    return { success: products.length > 0, products, errors, duration: Date.now() - startTime };
  }

  // ============================================
  // FERMER LE POPUP COOKIES (USERCENTRICS)
  // ============================================

  private async closeCookiePopup(page: Page): Promise<void> {
    try {
      await delay(2000);
      const dismissed = await page.evaluate(() => {
        // Méthode 1: API Usercentrics
        if (typeof (window as any).UC_UI !== 'undefined') {
          (window as any).UC_UI.acceptAllConsents();
          (window as any).UC_UI.closeCMP();
          return true;
        }
        // Méthode 2: supprimer l'overlay directement
        const aside = document.querySelector('#usercentrics-cmp-ui');
        if (aside) { aside.remove(); return true; }
        return false;
      });
      if (dismissed) console.log('[Notino] Popup cookies fermé');
    } catch {
      // Pas de cookie popup
    }
  }

  // ============================================
  // CLIQUER SUR "AFFICHER PLUS" POUR CHARGER PLUS
  // ============================================

  private async loadMoreProducts(page: Page, maxProducts: number): Promise<void> {
    let clickCount = 0;
    const maxClicks = this.config.maxClicks;

    while (clickCount < maxClicks) {
      const showMoreBtn = page.locator('[data-testid="footer-action-button"]');
      const btnCount = await showMoreBtn.count();

      if (btnCount === 0) break;

      const isVisible = await showMoreBtn.first().isVisible().catch(() => false);
      if (!isVisible) break;

      // Scroll vers le bouton puis clic
      await showMoreBtn.first().scrollIntoViewIfNeeded();
      await delay(500);
      await showMoreBtn.first().click();
      clickCount++;

      // Attendre le chargement des nouveaux produits
      await delay(2000);

      // Compter les produits actuels
      const productCount = await page.locator('[data-testid="product-container"]').count();
      
      if (clickCount % 5 === 0) {
        console.log(`[Notino] Clic ${clickCount} — ${productCount} produits chargés`);
      }

      // Si on a assez de produits, arrêter
      if (productCount >= maxProducts) {
        console.log(`[Notino] Objectif atteint: ${productCount} produits`);
        break;
      }
    }

    if (clickCount > 0) {
      const finalCount = await page.locator('[data-testid="product-container"]').count();
      console.log(`[Notino] ${clickCount} clics "Afficher plus" — ${finalCount} produits chargés`);
    }
  }

  // ============================================
  // EXTRACTION DES PRODUITS (CHEERIO)
  // ============================================

  private async extractProducts(page: Page, category: string): Promise<NotinoProduct[]> {
    const html = await page.content();
    const $ = cheerio.load(html);
    const products: NotinoProduct[] = [];

    $('[data-testid="product-container"]').each((_, container) => {
      try {
        const $c = $(container);

        // SKU
        const sku = $c.attr('data-product') || '';

        // URL
        const href = $c.find('a').first().attr('href') || '';
        const productUrl = href ? `https://www.notino.fr${href}` : '';
        if (!productUrl) return;

        // Image (srcset haute résolution → forcer detail_zoom pour HD)
        const $img = $c.find('img[loading="lazy"]').first();
        let imageUrl = '';
        const srcset = $img.attr('srcset') || '';
        if (srcset) {
          const sources = srcset.split(',').map(s => s.trim());
          const lastSource = sources[sources.length - 1];
          if (lastSource) imageUrl = lastSource.split(' ')[0];
        }
        if (!imageUrl) imageUrl = $img.attr('src') || '';
        // Upgrade vers detail_zoom (30KB HD) au lieu de list_2k (5KB flou)
        if (imageUrl.includes('cdn.notinoimg.com')) {
          imageUrl = imageUrl.replace(/\/(list|list_2k|detail)\//, '/detail_zoom/');
        }

        // Brand
        const brand = $c.find('[data-testid="product-tile-brand"]').first().text().trim();

        // Nom produit
        const rawName = $c.find('[data-testid="product-tile-name"]').first().text().trim();

        // Variant (contient souvent le volume)
        const variant = $c.find('[data-testid="product-tile-variant-name"]').first().text().trim();

        // Labels (Promo, Cadeaux offerts, etc.)
        const labels: string[] = [];
        $c.find('[data-testid="default-product-label"]').each((_, label) => {
          const text = $(label).text().trim();
          if (text) labels.push(text);
        });

        // Prix principal
        const priceText = $c.find('[data-testid="price-component"]').first().text().trim();
        const currentPrice = parsePrice(priceText);
        if (!currentPrice || currentPrice <= 0) return;

        // Prix avec code promo — chercher "X,XX € avec le code XXX"
        let priceWithCode: number | null = null;
        let promoCode: string | null = null;
        const fullText = $c.text();
        const codeMatch = fullText.match(/([\d]+[,.][\d]+)\s*€\s*avec le code\s+(\w+)/i);
        if (codeMatch) {
          priceWithCode = parseFloat(codeMatch[1].replace(',', '.'));
          promoCode = codeMatch[2];
        }

        // Rating
        let rating: number | null = null;
        let reviewCount: number | null = null;
        const ratingWrapper = $c.find('[data-testid="ratings-wrapper"]').first();
        if (ratingWrapper.length > 0) {
          const ratingTexts = ratingWrapper.text();
          const rMatch = ratingTexts.match(/([\d]+[,.][\d]+)/);
          if (rMatch) rating = parseFloat(rMatch[1].replace(',', '.'));
          const rcMatch = ratingTexts.match(/\((\d+)\)/);
          if (rcMatch) reviewCount = parseInt(rcMatch[1]);
        }

        // Volume
        const volume = extractVolume(variant);
        const fullName = [brand, rawName].filter(Boolean).join(' ');

        products.push({
          brand,
          name: fullName,
          variant,
          currentPrice,
          priceWithCode,
          promoCode,
          productUrl,
          imageUrl,
          category,
          sku,
          rating,
          reviewCount,
          labels,
          volume,
        });
      } catch {
        // skip produit malformé
      }
    });

    return products;
  }

  // ============================================
  // SCRAPER PLUSIEURS CATÉGORIES
  // ============================================

  async scrapeMultipleCategories(categoryUrls: Array<{ url: string; category: string }>, maxPerCategory: number = 200): Promise<NotinoScrapingResult> {
    const startTime = Date.now();
    const allProducts: NotinoProduct[] = [];
    const allErrors: string[] = [];

    for (const { url, category } of categoryUrls) {
      console.log(`\n📦 Scraping catégorie: ${category} — ${url}`);
      const result = await this.scrapeCategoryPage(url, maxPerCategory);

      // Mettre la catégorie sur les produits
      for (const p of result.products) {
        p.category = category;
      }

      // Dédoublonner
      for (const product of result.products) {
        if (!allProducts.find(p => p.productUrl === product.productUrl)) {
          allProducts.push(product);
        }
      }

      allErrors.push(...result.errors);

      // Délai entre catégories
      await delay(this.config.delayBetweenRequests + Math.random() * 2000);
    }

    console.log(`\n✅ Total: ${allProducts.length} produits uniques`);

    return {
      success: allProducts.length > 0,
      products: allProducts,
      errors: allErrors,
      duration: Date.now() - startTime,
    };
  }
}
