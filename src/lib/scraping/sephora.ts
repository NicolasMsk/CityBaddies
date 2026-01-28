/**
 * =============================================================================
 * SEPHORA.TS - SCRAPING EN MASSE DES PAGES CATÉGORIES
 * =============================================================================
 * 
 * FONCTION : Parcourir les pages catégories Sephora pour récupérer TOUS les
 *            produits en promotion (scraping en masse)
 * 
 * UTILISÉ PAR : import-sephora.ts, ImportEngine.ts
 * 
 * TECHNOLOGIE : Playwright (navigateur headless) - nécessaire car Sephora
 *               a des protections anti-bot
 * 
 * NE PAS CONFONDRE AVEC : sephora-search.ts (recherche d'UN produit spécifique)
 * =============================================================================
 */
import { chromium, Browser, Page } from 'playwright';
import { chromium as playwrightExtra } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Scraper, ScrapedProduct, ScrapingResult } from './types';

// Ajouter le plugin stealth pour éviter la détection
playwrightExtra.use(StealthPlugin());

export interface SephoraProduct {
  name: string;
  brand: string;
  currentPrice: number;
  originalPrice: number;
  discountPercent: number;
  productUrl: string;
  imageUrl: string;
  category: string;
  volume?: string;
  sku?: string;
}

export interface SephoraScrapingResult {
  success: boolean;
  products: SephoraProduct[];
  errors: string[];
  duration: number;
}

export interface SephoraConfig {
  headless: boolean;
  timeout: number;
  delayBetweenRequests: number;
}

const DEFAULT_CONFIG: SephoraConfig = {
  headless: true,
  timeout: 30000,
  delayBetweenRequests: 2000,
};

export class SephoraScraper implements Scraper {
  private config: SephoraConfig;
  private browser: Browser | null = null;

  /** Identifiant du scraper pour l'ImportEngine */
  readonly merchantSlug = 'sephora';

  constructor(config: Partial<SephoraConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async init(): Promise<void> {
    if (this.config.headless) {
      this.browser = await playwrightExtra.launch({
        headless: true,
        args: [
          '--disable-blink-features=AutomationControlled',
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process',
        ],
      });
    } else {
      this.browser = await chromium.launch({
        headless: false,
        args: [
          '--disable-blink-features=AutomationControlled',
          '--no-sandbox',
        ],
      });
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Méthode standard de l'interface Scraper
   * Convertit SephoraProduct[] en ScrapedProduct[] standardisés
   */
  async scrape(url: string, maxProducts: number = 100): Promise<ScrapingResult> {
    const result = await this.scrapeCategoryPage(url, maxProducts);
    
    // Convertir SephoraProduct -> ScrapedProduct
    const standardProducts: ScrapedProduct[] = result.products.map(p => ({
      name: p.name,
      brand: p.brand,
      productUrl: p.productUrl,
      sku: p.sku,
      currentPrice: p.currentPrice,
      originalPrice: p.originalPrice,
      discountPercent: p.discountPercent,
      imageUrl: p.imageUrl,
      volume: p.volume,
      category: p.category,
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

  // Mapper les catégories Sephora vers nos catégories
  private mapCategory(sephoraCategory: string): string {
    const categoryMap: Record<string, string> = {
      'C302': 'maquillage',      // Maquillage
      'C301': 'parfums',         // Parfums
      'C304': 'soins-visage',    // Corps et Bain -> Soins visage
      'C307': 'cheveux',         // Cheveux
      'C303': 'soins-visage',    // Skincare
      'C305': 'ongles',          // Ongles
      'maquillage': 'maquillage',
      'parfum': 'parfums',
      'corps-et-bain': 'soins-visage',
      'cheveux': 'cheveux',
      'skincare': 'soins-visage',
    };
    
    return categoryMap[sephoraCategory] || 'maquillage';
  }

  // Scraper une page catégorie Sephora
  async scrapeCategoryPage(categoryUrl: string, maxProducts: number = 100): Promise<SephoraScrapingResult> {
    const startTime = Date.now();
    const products: SephoraProduct[] = [];
    const errors: string[] = [];

    if (!this.browser) await this.init();
    const page = await this.browser!.newPage();

    try {
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'fr-FR,fr;q=0.9',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });

      console.log('[Sephora] Chargement de la page:', categoryUrl);
      await page.goto(categoryUrl, { waitUntil: 'domcontentloaded', timeout: this.config.timeout });
      
      // Attendre que les produits soient chargés
      console.log('[Sephora] Attente du chargement des produits...');
      await page.waitForSelector('.product-tile', { timeout: 15000 }).catch(() => {
        console.log('[Sephora] Timeout, on essaie avec grid-tile...');
      });
      
      await page.waitForSelector('.grid-tile', { timeout: 10000 }).catch(() => {
        console.log('[Sephora] Pas de grid-tile trouvé');
      });
      
      await this.delay(2000);

      // Cliquer sur "Voir plus de produits" plusieurs fois pour charger plus d'offres
      await this.loadMoreProducts(page, maxProducts);

      // Extraire les données des produits directement depuis le JSON data-tcproduct
      const extractedProducts = await page.evaluate(() => {
        const productTiles = document.querySelectorAll('.product-tile[data-tcproduct]');
        const products: any[] = [];
        
        productTiles.forEach((tile) => {
          try {
            const dataAttr = tile.getAttribute('data-tcproduct');
            if (!dataAttr) return;
            
            const data = JSON.parse(dataAttr);
            
            // Extraire l'image - priorité aux sources haute qualité
            const imgEl = tile.querySelector('.product-first-img') as HTMLImageElement;
            let imageUrl = imgEl?.dataset?.src || imgEl?.src || '';
            
            // Améliorer la qualité de l'image Sephora
            // Remplacer scaleWidth=240 par scaleWidth=500 pour avoir des images HD
            if (imageUrl.includes('sephora')) {
              imageUrl = imageUrl
                .replace(/scaleWidth=\d+/, 'scaleWidth=500')
                .replace(/scaleHeight=\d+/, 'scaleHeight=500');
            }
            
            // Extraire le lien produit
            const linkEl = tile.querySelector('a.product-tile-link') as HTMLAnchorElement;
            const productUrl = linkEl?.href || data.product_url_page || '';
            
            // Extraire le volume depuis product-variation-name (ex: "75 ml")
            const volumeEl = tile.querySelector('.product-variation-name');
            let volume = volumeEl?.textContent?.trim() || '';
            
            // Si pas trouvé, essayer d'extraire depuis product_sku_name (ex: "j.p. gault le male edp 75ml-515091")
            if (!volume && data.product_sku_name) {
              const volumeMatch = data.product_sku_name.match(/(\d+)\s*(ml|g|ML|G)/i);
              if (volumeMatch) {
                volume = volumeMatch[1] + ' ' + volumeMatch[2].toLowerCase();
              }
            }
            
            // Calculer la réduction
            const currentPrice = parseFloat(data.product_price_ati) || 0;
            const originalPrice = parseFloat(data.product_old_price_ati) || currentPrice;
            const discount = originalPrice > currentPrice 
              ? Math.round((1 - currentPrice / originalPrice) * 100) 
              : 0;
            
            products.push({
              name: data.product_pid_name || '',
              brand: data.product_brand || data.product_trademark || '',
              currentPrice: currentPrice,
              originalPrice: originalPrice,
              discountPercent: discount,
              productUrl: productUrl,
              imageUrl: imageUrl,
              category: data.product_breadcrumb_id?.[0] || '',
              volume: volume,
              sku: data.product_sku || '',
            });
          } catch (e) {
            // Ignorer les erreurs de parsing
          }
        });
        
        return products;
      });

      console.log(`[Sephora] ${extractedProducts.length} produits extraits depuis data-tcproduct`);

      // Si aucun produit trouvé avec data-tcproduct, essayer la méthode manuelle
      if (extractedProducts.length === 0) {
        console.log('[Sephora] Tentative extraction manuelle...');
        const manualProducts = await this.extractProductsManually(page);
        products.push(...manualProducts.slice(0, maxProducts));
      } else {
        // Mapper les catégories et ajouter les produits
        for (const p of extractedProducts.slice(0, maxProducts)) {
          if (p.name && p.currentPrice > 0 && p.productUrl) {
            products.push({
              ...p,
              category: this.mapCategory(p.category),
            });
          }
        }
      }

      console.log(`[Sephora] ${products.length} produits valides trouvés`);

    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown';
      errors.push('Erreur scraping catégorie: ' + error);
      console.error('[Sephora] Erreur:', error);
    } finally {
      await page.close();
    }

    return { success: products.length > 0, products, errors, duration: Date.now() - startTime };
  }

  // Extraction manuelle si data-tcproduct n'est pas disponible
  private async extractProductsManually(page: Page): Promise<SephoraProduct[]> {
    const products: SephoraProduct[] = [];
    
    const extractedData = await page.evaluate(() => {
      const tiles = document.querySelectorAll('.grid-tile, .product-tile');
      const data: any[] = [];
      
      tiles.forEach((tile) => {
        try {
          // Nom du produit
          const titleEl = tile.querySelector('.product-title, h3.product-title');
          const name = titleEl?.textContent?.trim() || '';
          
          // Marque
          const brandEl = tile.querySelector('.product-brand');
          const brand = brandEl?.textContent?.trim() || '';
          
          // Prix
          const priceEl = tile.querySelector('.price-sales, .price-sales-standard');
          const priceText = priceEl?.textContent?.replace(/[^\d,\.]/g, '').replace(',', '.') || '0';
          const currentPrice = parseFloat(priceText) || 0;
          
          // Prix barré
          const oldPriceEl = tile.querySelector('.price-standard');
          const oldPriceText = oldPriceEl?.textContent?.replace(/[^\d,\.]/g, '').replace(',', '.') || '0';
          const originalPrice = parseFloat(oldPriceText) || currentPrice;
          
          // Image
          const imgEl = tile.querySelector('img.product-first-img, img.primary-image') as HTMLImageElement;
          const imageUrl = imgEl?.src || '';
          
          // URL
          const linkEl = tile.querySelector('a.product-tile-link, a[href*="/p/"]') as HTMLAnchorElement;
          const productUrl = linkEl?.href || '';
          
          if (name && currentPrice > 0) {
            data.push({
              name: `${brand} - ${name}`.trim(),
              brand,
              currentPrice,
              originalPrice,
              productUrl,
              imageUrl,
            });
          }
        } catch (e) {}
      });
      
      return data;
    });
    
    for (const p of extractedData) {
      products.push({
        ...p,
        discountPercent: p.originalPrice > p.currentPrice 
          ? Math.round((1 - p.currentPrice / p.originalPrice) * 100)
          : 0,
        category: 'maquillage',
      });
    }
    
    return products;
  }

  // Cliquer sur "Voir plus de produits" une fois puis scroller pour charger plus d'offres (infinite scroll)
  private async loadMoreProducts(page: Page, maxProducts: number): Promise<void> {
    const maxScrolls = Math.max(20, Math.ceil(maxProducts / 24)); // Plus de scrolls pour charger plus
    let scrollCount = 0;
    let lastProductCount = 0;
    let noNewProductsCount = 0;
    
    // D'abord, fermer la popup de cookies si elle existe
    await this.closeCookiePopup(page);
    
    console.log(`[Sephora] Chargement de plus de produits (infinite scroll, max ${maxScrolls} scrolls)...`);
    
    // Cliquer une seule fois sur le bouton "Voir plus" pour activer l'infinite scroll
    try {
      const seeMoreButton = await page.$('button.see-more-button, button[data-js-infinitescroll-see-more]');
      if (seeMoreButton && await seeMoreButton.isVisible()) {
        await seeMoreButton.click({ force: true, timeout: 5000 });
        console.log(`[Sephora] Bouton "Voir plus" cliqué - Infinite scroll activé`);
        await this.delay(2000);
      }
    } catch (err) {
      console.log(`[Sephora] Pas de bouton "Voir plus" ou déjà en infinite scroll`);
    }
    
    // Maintenant scroller pour charger les produits via infinite scroll
    while (scrollCount < maxScrolls) {
      try {
        // Compter les produits actuels
        const currentCount = await page.evaluate(() => {
          return document.querySelectorAll('.product-tile[data-tcproduct]').length;
        });
        
        // Vérifier si de nouveaux produits ont été chargés
        if (currentCount === lastProductCount) {
          noNewProductsCount++;
          if (noNewProductsCount >= 3) {
            console.log(`[Sephora] Fin du scroll - Plus de nouveaux produits après 3 tentatives (${currentCount} produits)`);
            break;
          }
        } else {
          noNewProductsCount = 0;
          lastProductCount = currentCount;
        }
        
        // Si on a assez de produits, on arrête
        if (currentCount >= maxProducts) {
          console.log(`[Sephora] Objectif atteint: ${currentCount} produits`);
          break;
        }
        
        // Scroll progressif vers le bas
        await page.evaluate(() => {
          window.scrollBy(0, window.innerHeight * 1.5);
        });
        await this.delay(500);
        
        // Scroll jusqu'en bas de la page
        await page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight);
        });
        
        scrollCount++;
        
        // Attendre 2 secondes pour que les nouveaux produits se chargent
        await this.delay(2000);
        
        // Log tous les 5 scrolls
        if (scrollCount % 5 === 0) {
          const newCount = await page.evaluate(() => {
            return document.querySelectorAll('.product-tile[data-tcproduct]').length;
          });
          console.log(`[Sephora] Scroll ${scrollCount}/${maxScrolls} - ${newCount} produits chargés`);
        }
        
      } catch (err) {
        console.log(`[Sephora] Erreur pendant le scroll, on continue...`);
        await this.delay(1000);
      }
    }
    
    // Compter final
    const finalCount = await page.evaluate(() => {
      return document.querySelectorAll('.product-tile[data-tcproduct]').length;
    });
    console.log(`[Sephora] Scroll terminé - ${finalCount} produits chargés après ${scrollCount} scrolls`);
  }

  // Fermer la popup de cookies/consentement
  private async closeCookiePopup(page: Page): Promise<void> {
    try {
      // Essayer de cliquer sur "Accepter" ou fermer la popup de cookies
      const cookieSelectors = [
        'button#footer_tc_privacy_button_2', // Bouton "Tout accepter" Sephora
        'button.tc-privacy-button',
        'button[id*="accept"]',
        'button[class*="accept"]',
        '.tc-privacy-wrapper button',
        '#tc-privacy-wrapper button:first-child',
      ];
      
      for (const selector of cookieSelectors) {
        const button = await page.$(selector);
        if (button && await button.isVisible()) {
          await button.click({ force: true, timeout: 3000 });
          console.log(`[Sephora] Popup cookies fermée`);
          await this.delay(1000);
          return;
        }
      }
      
      // Si pas de bouton trouvé, essayer de supprimer l'overlay avec JavaScript
      await page.evaluate(() => {
        const overlay = document.querySelector('#tc-privacy-wrapper');
        if (overlay) overlay.remove();
        
        const banner = document.querySelector('#tc-privacy-overlay-banner');
        if (banner) banner.remove();
        
        // Réactiver le scroll
        document.body.style.overflow = 'auto';
      });
      
    } catch (err) {
      // Ignorer les erreurs silencieusement
    }
  }

  // Faire défiler la page pour charger plus de produits (lazy loading)
  private async scrollPage(page: Page): Promise<void> {
    await page.evaluate(async () => {
      const scrollStep = 500;
      const scrollDelay = 300;
      let currentPosition = 0;
      const maxScroll = Math.min(document.body.scrollHeight, 5000);
      
      while (currentPosition < maxScroll) {
        window.scrollTo(0, currentPosition);
        currentPosition += scrollStep;
        await new Promise(r => setTimeout(r, scrollDelay));
      }
      
      // Remonter en haut
      window.scrollTo(0, 0);
    });
    
    await this.delay(1000);
  }

  // Scraper une page produit individuelle pour plus de détails
  async scrapeProductPage(productUrl: string): Promise<SephoraProduct | null> {
    if (!this.browser) await this.init();
    const page = await this.browser!.newPage();

    try {
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'fr-FR,fr;q=0.9',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });

      await page.goto(productUrl, { waitUntil: 'domcontentloaded', timeout: this.config.timeout });
      await this.delay(2000);

      const productData = await page.evaluate(() => {
        // Essayer d'extraire depuis tc_vars (variable JavaScript globale de Sephora)
        const tcVars = (window as any).tc_vars;
        
        if (tcVars) {
          return {
            name: tcVars.product_pid_name || '',
            brand: tcVars.product_brand || tcVars.product_trademark || '',
            currentPrice: parseFloat(tcVars.product_price_ati) || 0,
            originalPrice: parseFloat(tcVars.product_old_price_ati) || 0,
            category: tcVars.product_breadcrumb_id?.[0] || tcVars.page_top_cat || '',
            sku: tcVars.product_sku || '',
            rating: tcVars.product_rating || 0,
          };
        }
        
        // Sinon extraction manuelle
        const brandEl = document.querySelector('.brand-name, .product-brand');
        const titleEl = document.querySelector('.product-name, .product-title-heading h1');
        const priceEl = document.querySelector('.price-sales-standard, .price-sales');
        const oldPriceEl = document.querySelector('.price-standard');
        const imgEl = document.querySelector('.primary-image, .product-primary-image img') as HTMLImageElement;
        const ratingEl = document.querySelector('.bv_numReviews_text');
        const descEl = document.querySelector('.description-content, [itemprop="description"]');
        
        const priceText = priceEl?.textContent?.replace(/[^\d,\.]/g, '').replace(',', '.') || '0';
        const oldPriceText = oldPriceEl?.textContent?.replace(/[^\d,\.]/g, '').replace(',', '.') || '0';
        
        return {
          name: titleEl?.textContent?.trim() || '',
          brand: brandEl?.textContent?.trim() || '',
          currentPrice: parseFloat(priceText) || 0,
          originalPrice: parseFloat(oldPriceText) || 0,
          imageUrl: imgEl?.src || '',
          description: descEl?.textContent?.trim().substring(0, 500) || '',
          reviewCount: parseInt(ratingEl?.textContent?.replace(/\D/g, '') || '0') || 0,
          category: '',
          sku: '',
          rating: 0,
        };
      });

      if (!productData.name || productData.currentPrice <= 0) {
        return null;
      }

      // Récupérer l'image si pas déjà fait
      let imageUrl = productData.imageUrl || '';
      if (!imageUrl) {
        imageUrl = await page.evaluate(() => {
          const img = document.querySelector('.primary-image, .product-first-img') as HTMLImageElement;
          return img?.src || '';
        });
      }

      const originalPrice = productData.originalPrice || productData.currentPrice;
      const discountPercent = originalPrice > productData.currentPrice
        ? Math.round((1 - productData.currentPrice / originalPrice) * 100)
        : 0;

      return {
        name: productData.name,
        brand: productData.brand,
        currentPrice: productData.currentPrice,
        originalPrice: originalPrice,
        discountPercent: discountPercent,
        productUrl: productUrl,
        imageUrl: imageUrl,
        category: this.mapCategory(productData.category),
        sku: productData.sku,
      };

    } catch (err) {
      console.error('[Sephora] Erreur scraping produit:', err);
      return null;
    } finally {
      await page.close();
    }
  }

  // Scraper plusieurs catégories
  async scrapeMultipleCategories(categoryUrls: string[], maxPerCategory: number = 20): Promise<SephoraScrapingResult> {
    const startTime = Date.now();
    const allProducts: SephoraProduct[] = [];
    const allErrors: string[] = [];

    for (const url of categoryUrls) {
      console.log(`\n📦 Scraping catégorie: ${url}`);
      const result = await this.scrapeCategoryPage(url, maxPerCategory);
      
      // Éviter les doublons
      for (const product of result.products) {
        if (!allProducts.find(p => p.productUrl === product.productUrl)) {
          allProducts.push(product);
        }
      }
      
      allErrors.push(...result.errors);
      
      // Délai entre catégories
      await this.delay(this.config.delayBetweenRequests);
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
