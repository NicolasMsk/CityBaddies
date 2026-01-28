/**
 * =============================================================================
 * SEPHORA-SEARCH.TS - Recherche de prix sur Sephora.fr
 * =============================================================================
 */

import {
  CompetitorPriceResult,
  SiteConfig,
  getBrowser,
  createStealthPage,
  closePage,
  findProductUrl,
  analyzeScreenshotWithVision,
  saveScreenshot,
  closeCookiePopup,
  simulateHumanBehavior,
} from './search-utils';

const SITE_CONFIG: SiteConfig = {
  domain: 'sephora.fr',
  excludePatterns: ['/recherche', '/search', '/c/', '/b/'],
  productPattern: '/p/'
};

/**
 * Prend un screenshot de la page produit Sephora
 */
async function takeScreenshot(url: string, targetVolume?: string): Promise<Buffer | null> {
  const browser = await getBrowser();
  const page = await createStealthPage(browser);
  
  try {
    console.log(`[SCREENSHOT] Chargement: ${url}`);
    
    await simulateHumanBehavior(page);
    
    await page.goto(url, { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });
    
    await page.waitForTimeout(2000);
    await closeCookiePopup(page);
    
    // Sephora: Cliquer sur le sélecteur de contenance pour afficher toutes les options
    try {
      const sizeSelector = page.locator('.variations-size-selected, [data-js-open-selector-dialog]').first();
      if (await sizeSelector.isVisible({ timeout: 1000 }).catch(() => false)) {
        console.log(`[SEPHORA] Clic sur sélecteur de contenance...`);
        await sizeSelector.click();
        await page.waitForTimeout(1500);
      }
    } catch {
      console.log(`[SEPHORA] Pas de sélecteur de contenance trouvé`);
    }
    
    const screenshot = await page.screenshot({ type: 'jpeg', quality: 80 });
    saveScreenshot(screenshot, 'sephora');
    console.log(`[SCREENSHOT] Capturé (${Math.round(screenshot.length / 1024)}KB)`);
    
    return screenshot;
    
  } catch (error) {
    console.error('[SCREENSHOT] Erreur:', error);
    return null;
  } finally {
    await closePage(page);
  }
}

/**
 * Fallback: Extraire le prix directement depuis le HTML
 */
async function extractPriceFromHTML(url: string): Promise<number | null> {
  const browser = await getBrowser();
  const page = await createStealthPage(browser);
  
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    
    const priceSelectors = [
      '[data-testid="current-price"]',
      '.ProductPrices_current-price__OD9Vf',
      '.product-price .current-price',
      '[data-at="product_current_price"]',
    ];
    
    for (const selector of priceSelectors) {
      try {
        const element = page.locator(selector).first();
        if (await element.isVisible({ timeout: 500 }).catch(() => false)) {
          const text = await element.textContent() || '';
          const priceMatch = text.match(/(\d+)[,.](\d{2})/);
          if (priceMatch) {
            const price = parseFloat(`${priceMatch[1]}.${priceMatch[2]}`);
            console.log(`[HTML] Prix trouvé via ${selector}: ${price}€`);
            return price;
          }
        }
      } catch {
        continue;
      }
    }
    
    return null;
    
  } catch (error) {
    console.error('[HTML] Erreur extraction:', error);
    return null;
  } finally {
    await closePage(page);
  }
}

/**
 * Recherche le prix d'un produit sur Sephora
 */
export async function searchSephoraPrice(
  searchQuery: string,
  targetVolume?: string
): Promise<CompetitorPriceResult> {
  console.log(`\n[SEPHORA] Recherche: "${searchQuery}"${targetVolume ? ` (${targetVolume})` : ''}`);
  
  // 1. Trouver l'URL via Google
  const productUrl = await findProductUrl(searchQuery, SITE_CONFIG);
  
  if (!productUrl) {
    return { found: false, site: 'sephora', error: 'Produit non trouvé sur Google' };
  }
  
  // 2. Prendre un screenshot
  const screenshot = await takeScreenshot(productUrl, targetVolume);
  
  if (!screenshot) {
    return { found: false, site: 'sephora', productUrl, error: 'Impossible de charger la page' };
  }
  
  // 3. Analyser avec GPT-4o-mini
  const analysis = await analyzeScreenshotWithVision(screenshot, 'sephora', targetVolume);
  
  // 4. Fallback HTML si LLM échoue
  if (!analysis.currentPrice) {
    console.log(`[SEPHORA] LLM n'a pas trouvé le prix, tentative fallback HTML...`);
    const htmlPrice = await extractPriceFromHTML(productUrl);
    
    if (htmlPrice) {
      console.log(`[SEPHORA] ✓ Fallback HTML: ${htmlPrice}€`);
      return {
        found: true,
        site: 'sephora',
        productUrl,
        currentPrice: htmlPrice,
        volume: analysis.volume,
        rawLLMResponse: analysis.raw
      };
    }
    
    return {
      found: false,
      site: 'sephora',
      productUrl,
      productName: analysis.productName,
      volume: analysis.volume,
      error: 'Prix non détecté',
      rawLLMResponse: analysis.raw
    };
  }
  
  console.log(`[SEPHORA] ✓ ${analysis.volume || '?'}: ${analysis.currentPrice}€`);
  
  return {
    found: true,
    site: 'sephora',
    productUrl,
    productName: analysis.productName,
    currentPrice: analysis.currentPrice,
    originalPrice: analysis.originalPrice,
    volume: analysis.volume,
    inStock: analysis.inStock,
    rawLLMResponse: analysis.raw
  };
}
