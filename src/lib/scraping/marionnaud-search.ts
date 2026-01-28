/**
 * =============================================================================
 * MARIONNAUD-SEARCH.TS - Recherche de prix sur Marionnaud.fr
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
  domain: 'marionnaud.fr',
  excludePatterns: ['/recherche', '/search', '/c/', '/b/', '/v/'],
  productPattern: '/p/'
};

/**
 * Prend un screenshot de la page produit Marionnaud
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
    
    // Marionnaud: Cliquer sur le bon contenant si targetVolume spécifié
    if (targetVolume) {
      try {
        await page.waitForTimeout(1500);
        
        // Normaliser le volume (ex: "50ml" -> "50")
        const targetNum = targetVolume.replace(/[^\d]/g, '');
        
        const slides = page.locator('.product-carousel-variant__size-name');
        const count = await slides.count();
        
        for (let i = 0; i < count; i++) {
          const slideText = await slides.nth(i).textContent() || '';
          const slideNum = slideText.replace(/[^\d]/g, '');
          
          if (slideNum === targetNum) {
            console.log(`[MARIONNAUD] Clic sur contenance ${slideText.trim()}...`);
            await slides.nth(i).click();
            await page.waitForTimeout(1000);
            break;
          }
        }
      } catch {
        console.log(`[MARIONNAUD] Pas de sélecteur de contenance trouvé`);
      }
    }
    
    const screenshot = await page.screenshot({ type: 'jpeg', quality: 80 });
    saveScreenshot(screenshot, 'marionnaud');
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
      '.product-price .current-price',
      '[data-testid="product-price"]',
      '.price-current',
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
 * Recherche le prix d'un produit sur Marionnaud
 */
export async function searchMarionnaudPrice(
  searchQuery: string,
  targetVolume?: string
): Promise<CompetitorPriceResult> {
  console.log(`\n[MARIONNAUD] Recherche: "${searchQuery}"${targetVolume ? ` (${targetVolume})` : ''}`);
  
  // 1. Trouver l'URL via Google
  const productUrl = await findProductUrl(searchQuery, SITE_CONFIG);
  
  if (!productUrl) {
    return { found: false, site: 'marionnaud', error: 'Produit non trouvé sur Google' };
  }
  
  // 2. Prendre un screenshot
  const screenshot = await takeScreenshot(productUrl, targetVolume);
  
  if (!screenshot) {
    return { found: false, site: 'marionnaud', productUrl, error: 'Impossible de charger la page' };
  }
  
  // 3. Analyser avec GPT-4o-mini
  const analysis = await analyzeScreenshotWithVision(screenshot, 'marionnaud', targetVolume);
  
  // 4. Fallback HTML si LLM échoue
  if (!analysis.currentPrice) {
    console.log(`[MARIONNAUD] LLM n'a pas trouvé le prix, tentative fallback HTML...`);
    const htmlPrice = await extractPriceFromHTML(productUrl);
    
    if (htmlPrice) {
      console.log(`[MARIONNAUD] ✓ Fallback HTML: ${htmlPrice}€`);
      return {
        found: true,
        site: 'marionnaud',
        productUrl,
        currentPrice: htmlPrice,
        volume: analysis.volume,
        rawLLMResponse: analysis.raw
      };
    }
    
    return {
      found: false,
      site: 'marionnaud',
      productUrl,
      productName: analysis.productName,
      volume: analysis.volume,
      error: 'Prix non détecté',
      rawLLMResponse: analysis.raw
    };
  }
  
  console.log(`[MARIONNAUD] ✓ ${analysis.volume || '?'}: ${analysis.currentPrice}€`);
  
  return {
    found: true,
    site: 'marionnaud',
    productUrl,
    productName: analysis.productName,
    currentPrice: analysis.currentPrice,
    originalPrice: analysis.originalPrice,
    volume: analysis.volume,
    inStock: analysis.inStock,
    rawLLMResponse: analysis.raw
  };
}
