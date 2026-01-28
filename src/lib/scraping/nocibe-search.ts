/**
 * =============================================================================
 * NOCIBE-SEARCH.TS - Recherche de prix sur Nocibe.fr
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
  domain: 'nocibe.fr',
  excludePatterns: ['/recherche', '/search', '/c/', '/b/'],
  productPattern: '/p/'
};

/**
 * Prend un screenshot de la page produit Nocibé (zone droite avec les prix)
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
    
    // Nocibé: Scroll en haut et screenshot de la zone droite (prix)
    await page.waitForTimeout(1500);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);
    
    // Screenshot ciblé sur la partie droite où sont les prix
    const screenshot = await page.screenshot({ 
      type: 'jpeg',
      quality: 85,
      clip: {
        x: 600,
        y: 50,
        width: 900,
        height: 750
      }
    });
    
    saveScreenshot(screenshot, 'nocibe');
    console.log(`[SCREENSHOT] Capturé zone droite (${Math.round(screenshot.length / 1024)}KB)`);
    
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
      '[data-testid="discounted-price"] span[aria-label*="€"]',
      '[data-testid="price-discount"] span',
      '.discounted-price__row span',
      '.product-price span',
      '[aria-label*="Actuellement"]',
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
    
    // Fallback regex sur le HTML
    const html = await page.content();
    const pricePatterns = [
      /aria-label="Actuellement\s+([\d,]+)\s*€"/,
      /data-testid="discounted-price"[^>]*>([\d,]+)\s*€/,
      /"currentPrice":\s*([\d.]+)/,
    ];
    
    for (const pattern of pricePatterns) {
      const match = html.match(pattern);
      if (match) {
        const priceStr = match[1].replace(',', '.');
        const price = parseFloat(priceStr);
        if (price > 0 && price < 10000) {
          console.log(`[HTML] Prix trouvé via regex: ${price}€`);
          return price;
        }
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
 * Recherche le prix d'un produit sur Nocibé
 */
export async function searchNocibePrice(
  searchQuery: string,
  targetVolume?: string
): Promise<CompetitorPriceResult> {
  console.log(`\n[NOCIBE] Recherche: "${searchQuery}"${targetVolume ? ` (${targetVolume})` : ''}`);
  
  // 1. Trouver l'URL via Google
  const productUrl = await findProductUrl(searchQuery, SITE_CONFIG);
  
  if (!productUrl) {
    return { found: false, site: 'nocibe', error: 'Produit non trouvé sur Google' };
  }
  
  // 2. Prendre un screenshot
  const screenshot = await takeScreenshot(productUrl, targetVolume);
  
  if (!screenshot) {
    return { found: false, site: 'nocibe', productUrl, error: 'Impossible de charger la page' };
  }
  
  // 3. Analyser avec GPT-4o-mini
  const analysis = await analyzeScreenshotWithVision(screenshot, 'nocibe', targetVolume);
  
  // 4. Fallback HTML si LLM échoue
  if (!analysis.currentPrice) {
    console.log(`[NOCIBE] LLM n'a pas trouvé le prix, tentative fallback HTML...`);
    const htmlPrice = await extractPriceFromHTML(productUrl);
    
    if (htmlPrice) {
      console.log(`[NOCIBE] ✓ Fallback HTML: ${htmlPrice}€`);
      return {
        found: true,
        site: 'nocibe',
        productUrl,
        currentPrice: htmlPrice,
        volume: analysis.volume,
        rawLLMResponse: analysis.raw
      };
    }
    
    return {
      found: false,
      site: 'nocibe',
      productUrl,
      productName: analysis.productName,
      volume: analysis.volume,
      error: 'Prix non détecté',
      rawLLMResponse: analysis.raw
    };
  }
  
  console.log(`[NOCIBE] ✓ ${analysis.volume || '?'}: ${analysis.currentPrice}€`);
  
  return {
    found: true,
    site: 'nocibe',
    productUrl,
    productName: analysis.productName,
    currentPrice: analysis.currentPrice,
    originalPrice: analysis.originalPrice,
    volume: analysis.volume,
    inStock: analysis.inStock,
    rawLLMResponse: analysis.raw
  };
}
