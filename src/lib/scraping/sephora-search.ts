/**
 * Sephora Search Scraper - Avec sélection précise du volume
 * 
 * Workflow:
 * 1. Utiliser Serper API pour trouver l'URL produit Sephora via Google
 * 2. Aller sur la page produit
 * 3. Cliquer sur le sélecteur de contenance pour ouvrir la modal
 * 4. Parcourir les variantes et trouver celle qui correspond au volume cible
 * 5. Extraire le prix exact de cette variante
 */
import { chromium, type Page, type Browser } from 'playwright';

const TIMEOUTS = {
  NAVIGATION: 30000,
  ELEMENT: 10000
};

const SERPER_API_KEY = "a7bc1e66280fcbf540a0d6072fc342ef4fdfaeaf";
const SERPER_URL = "https://google.serper.dev/search";

async function delay(ms: number): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Utilise Serper API pour trouver l'URL Sephora via Google
 */
async function getSephoraUrlViaSerper(product: string, volume: string): Promise<string | null> {
  const query = `${product} ${volume} site:sephora.fr`;
  console.log(`[SERPER] Recherche: "${query}"`);
  
  try {
    const response = await fetch(SERPER_URL, {
      method: 'POST',
      headers: {
        'X-API-KEY': SERPER_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        q: query,
        num: 10,
        gl: 'fr',
        hl: 'fr'
      })
    });
    
    if (!response.ok) {
      console.log(`[SERPER] Erreur HTTP: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    const organic = data.organic || [];
    
    // Prendre le premier resultat sephora.fr qui est une page produit (/p/)
    for (const result of organic) {
      const url = result.link || '';
      if (url.includes('sephora.fr') && url.includes('/p/')) {
        console.log(`[SERPER] URL trouvee: ${url}`);
        return url;
      }
    }
    
    console.log('[SERPER] Aucune page produit trouvee');
    return null;
  } catch (error) {
    console.log(`[SERPER] Erreur: ${error}`);
    return null;
  }
}

export interface SephoraSearchResult {
  found: boolean;
  productName?: string;
  productUrl?: string;
  brand?: string;
  currentPrice?: number;
  originalPrice?: number;
  discountPercent?: number;
  volume?: string;
  inStock?: boolean;
  allVariants?: Array<{
    volume: string;
    price: number;
    originalPrice?: number;
    available: boolean;
  }>;
  error?: string;
}

/**
 * Normalise le volume pour comparaison (ex: "50 ml" -> 50)
 */
function normalizeVolume(volume: string): number {
  const match = volume.match(/(\d+(?:[.,]\d+)?)/);
  if (match) {
    return parseFloat(match[1].replace(',', '.'));
  }
  return 0;
}

/**
 * Recherche un produit sur Sephora et récupère le prix pour un volume spécifique
 */
export async function searchSephoraProduct(
  searchQuery: string,
  targetVolume: string
): Promise<SephoraSearchResult> {
  let browser: Browser | null = null;
  
  if (!targetVolume) {
    return { found: false, error: 'Le volume cible est obligatoire' };
  }
  
  const targetVolumeNum = normalizeVolume(targetVolume);
  console.log(`\n[SEPHORA] Recherche: "${searchQuery}" - Volume: ${targetVolume} (${targetVolumeNum}ml)`);
  
  try {
    // ETAPE 1: Utiliser Serper pour trouver l'URL du produit via Google
    const productUrl = await getSephoraUrlViaSerper(searchQuery, targetVolume);
    
    if (!productUrl) {
      return { found: false, error: 'Produit non trouve via Google/Serper' };
    }
    
    console.log(`[SEPHORA] URL produit: ${productUrl}`);
    
    // ETAPE 2: Ouvrir le navigateur et aller sur la page produit
    browser = await chromium.launch({
      headless: true,
      args: ['--disable-blink-features=AutomationControlled', '--no-sandbox']
    });
    
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 720 },
      locale: 'fr-FR'
    });
    
    const page = await context.newPage();
    
    await page.goto(productUrl, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATION });
    await delay(1000);
    await closeCookiePopup(page);
    
    // Extraire nom et marque
    let productName = '';
    let brand = '';
    
    try {
      brand = await page.locator('.brand-name, .product-brand').first().textContent() || '';
      brand = brand.trim();
    } catch {}
    
    try {
      productName = await page.locator('.product-title, h1.product-title-heading').first().textContent() || '';
      productName = productName.trim();
    } catch {}
    
    console.log(`[SEPHORA] Produit: ${brand} - ${productName}`);
    
    // ETAPE 3: Ouvrir le selecteur de contenance
    let allVariants: Array<{volume: string; price: number; originalPrice?: number; available: boolean}> = [];
    let selectedVariant: typeof allVariants[0] | null = null;
    
    // Chercher le selecteur de taille avec plusieurs variantes possibles
    const sizeSelectorOptions = [
      '.variations-size-selected',
      '.open-selector-dialog',
      '[data-js-open-selector-dialog]',
      '.product-variations .size-selector',
      '.pdp-size-selector',
      'button[aria-label*="contenance"]',
      '.variation-size-selector'
    ];
    
    let sizeSelector = null;
    for (const sel of sizeSelectorOptions) {
      const elem = page.locator(sel).first();
      if (await elem.isVisible({ timeout: 1000 }).catch(() => false)) {
        sizeSelector = elem;
        console.log(`[SEPHORA] Selecteur taille trouve: ${sel}`);
        break;
      }
    }
    
    try {
      if (sizeSelector) {
        console.log('[SEPHORA] ETAPE 3.1: Click sur selecteur taille...');
        
        // Essayer plusieurs methodes de click
        try {
          await sizeSelector.click({ force: true });
          console.log('[SEPHORA] ETAPE 3.1a: Click playwright OK');
        } catch (e) {
          console.log('[SEPHORA] ETAPE 3.1a: Click playwright echoue, essai JS...');
          await page.evaluate(() => {
            const el = document.querySelector('.variations-size-selected, .open-selector-dialog') as HTMLElement;
            if (el) el.click();
          });
          console.log('[SEPHORA] ETAPE 3.1b: Click JS OK');
        }
        
        console.log('[SEPHORA] ETAPE 3.2: Click effectue, attente 1s...');
        await delay(1000);
        
        // Lister les elements de modal presents dans le DOM
        const modalInfo = await page.evaluate(() => {
          const colorguide = document.querySelector('#colorguide-modal');
          const variations = document.querySelector('.colorguide-variations');
          const buttons = document.querySelectorAll('.variation-button-line');
          const dialog = document.querySelector('.ui-dialog');
          
          return {
            colorguideExists: !!colorguide,
            colorguideVisible: colorguide ? (colorguide as HTMLElement).offsetParent !== null : false,
            variationsExists: !!variations,
            variationsVisible: variations ? (variations as HTMLElement).offsetParent !== null : false,
            buttonCount: buttons.length,
            dialogExists: !!dialog,
            dialogVisible: dialog ? (dialog as HTMLElement).offsetParent !== null : false
          };
        });
        console.log('[SEPHORA] ETAPE 3.4: Etat DOM:', JSON.stringify(modalInfo));
        
        // Si les boutons existent meme si pas "visible", on les extrait
        if (modalInfo.buttonCount > 0) {
          console.log('[SEPHORA] ETAPE 4: Extraction des variantes...');
          
          // ETAPE 4: Extraire toutes les variantes de la modal
          // Structure: .variation-button-line contient button.variation-button avec title="XX ml"
          // Prix dans .price-sales, prix barre dans .price-standard
          allVariants = await page.evaluate(() => {
            const variants: Array<{volume: string; price: number; originalPrice?: number; available: boolean}> = [];
            // Prendre uniquement le premier .colorguide-variations-list pour eviter les doublons
            const container = document.querySelector('.colorguide-variations-list');
            if (!container) return variants;
            
            const buttons = container.querySelectorAll('.variation-button-line');
            
            console.log(`[EVAL] Nombre de .variation-button-line: ${buttons.length}`);
            
            buttons.forEach((btn, index) => {
              try {
                // Volume depuis l'attribut title du button
                const buttonEl = btn.querySelector('button.variation-button');
                const volume = buttonEl?.getAttribute('title') || '';
                
                // Prix actuel - chercher .price-sales dans .variation-info (pas dans .hide)
                const variationInfo = btn.querySelector('.variation-info');
                const priceEl = variationInfo?.querySelector('.product-variant-price-wrapper .price-sales');
                let priceText = priceEl?.textContent?.trim() || '0';
                // Nettoyer: garder que les chiffres et la virgule, puis remplacer virgule par point
                priceText = priceText.replace(/[^\d,]/g, '').replace(',', '.');
                const price = parseFloat(priceText) || 0;
                
                // Prix original barre (.price-standard)
                const originalPriceEl = variationInfo?.querySelector('.price-standard');
                let originalPrice: number | undefined;
                if (originalPriceEl) {
                  let origText = originalPriceEl.textContent?.trim() || '0';
                  origText = origText.replace(/[^\d,]/g, '').replace(',', '.');
                  originalPrice = parseFloat(origText) || undefined;
                }
                
                // Disponibilite
                const availEl = btn.querySelector('.variation-avaibility');
                const availText = availEl?.textContent?.toLowerCase() || '';
                const available = availText.includes('disponible');
                
                console.log(`[EVAL] Variante ${index}: volume="${volume}", prix=${price}, dispo=${available}`);
                
                if (volume && price > 0) {
                  variants.push({ volume, price, originalPrice, available });
                }
              } catch (e) {
                console.log(`[EVAL] Erreur variante ${index}:`, e);
              }
            });
            
            return variants;
          });
          
          console.log(`[SEPHORA] ETAPE 4.1: ${allVariants.length} variantes extraites`);
          for (const v of allVariants) {
            const marker = normalizeVolume(v.volume) === targetVolumeNum ? '>>>' : '   ';
            console.log(`${marker} ${v.volume}: ${v.price}E${v.originalPrice ? ` (etait ${v.originalPrice}E)` : ''} ${v.available ? 'OK' : 'X'}`);
          }
        
          // ETAPE 5: Trouver la variante correspondant au volume cible
          for (const variant of allVariants) {
            if (normalizeVolume(variant.volume) === targetVolumeNum) {
              selectedVariant = variant;
              console.log(`[SEPHORA] Volume ${targetVolume} trouve: ${variant.price}E`);
              break;
            }
          }
        
          // Si pas de match exact, prendre le plus proche
          if (!selectedVariant && allVariants.length > 0) {
            let closest = allVariants[0];
            let closestDiff = Math.abs(normalizeVolume(closest.volume) - targetVolumeNum);
          
            for (const v of allVariants) {
              const diff = Math.abs(normalizeVolume(v.volume) - targetVolumeNum);
              if (diff < closestDiff) {
                closestDiff = diff;
                closest = v;
              }
            }
          
            console.log(`[SEPHORA] Volume exact non trouve, plus proche: ${closest.volume}`);
            selectedVariant = closest;
          }
        
          // Fermer la modal
          await page.keyboard.press('Escape');
        }
      }
    } catch (e) {
      console.log('[SEPHORA] Pas de selecteur de contenance:', e);
    }
    
    // Fallback: extraire le prix de la page si pas de variantes
    if (!selectedVariant) {
      console.log('[SEPHORA] Extraction prix depuis la page...');
      
      const pageData = await page.evaluate(() => {
        const priceEl = document.querySelector('.price-sales, .price-sales-standard');
        const priceText = priceEl?.textContent?.replace(/[^\d,\.]/g, '').replace(',', '.') || '0';
        const price = parseFloat(priceText) || 0;
        
        const origEl = document.querySelector('.price-standard');
        const origText = origEl?.textContent?.replace(/[^\d,\.]/g, '').replace(',', '.') || '0';
        const originalPrice = parseFloat(origText) || undefined;
        
        const volEl = document.querySelector('.variation-selected, .product-variation-name');
        const volume = volEl?.textContent?.trim() || '';
        
        return { price, originalPrice, volume };
      });
      
      if (pageData.price > 0) {
        selectedVariant = {
          volume: pageData.volume || targetVolume,
          price: pageData.price,
          originalPrice: pageData.originalPrice,
          available: true
        };
      }
    }
    
    if (!selectedVariant) {
      return {
        found: false,
        productName: `${brand} ${productName}`.trim(),
        productUrl,
        brand,
        allVariants,
        error: 'Impossible de recuperer le prix'
      };
    }
    
    // Calculer reduction
    let discountPercent = 0;
    if (selectedVariant.originalPrice && selectedVariant.originalPrice > selectedVariant.price) {
      discountPercent = Math.round((1 - selectedVariant.price / selectedVariant.originalPrice) * 100);
    }
    
    return {
      found: true,
      productName: `${brand} ${productName}`.trim(),
      productUrl,
      brand,
      currentPrice: selectedVariant.price,
      originalPrice: selectedVariant.originalPrice,
      discountPercent,
      volume: selectedVariant.volume,
      inStock: selectedVariant.available,
      allVariants
    };
    
  } catch (error) {
    console.error('[SEPHORA] Erreur:', error);
    return { found: false, error: error instanceof Error ? error.message : 'Erreur inconnue' };
  } finally {
    if (browser) await browser.close();
  }
}

async function closeCookiePopup(page: Page): Promise<void> {
  try {
    const selectors = [
      '#onetrust-accept-btn-handler',
      'button#footer_tc_privacy_button_2',
      'button:has-text("Tout accepter")'
    ];
    
    for (const sel of selectors) {
      const btn = page.locator(sel).first();
      if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await btn.click();
        console.log('[SEPHORA] Cookies acceptes');
        await delay(500);
        break;
      }
    }
  } catch {}
}

/**
 * Compare un deal avec le prix Sephora
 */
export async function compareWithSephora(deal: {
  title: string;
  brand?: string;
  volume: string;
  dealPrice: number;
}): Promise<{
  sephoraResult: SephoraSearchResult;
  comparison?: {
    priceDifference: number;
    percentageDifference: number;
    cheaperAt: 'nocibe' | 'sephora' | 'equal';
  };
}> {
  let searchQuery = deal.title;
  if (deal.brand && !searchQuery.toLowerCase().includes(deal.brand.toLowerCase())) {
    searchQuery = `${deal.brand} ${searchQuery}`;
  }
  
  const sephoraResult = await searchSephoraProduct(searchQuery, deal.volume);
  
  if (!sephoraResult.found || !sephoraResult.currentPrice) {
    return { sephoraResult };
  }
  
  const diff = deal.dealPrice - sephoraResult.currentPrice;
  const pctDiff = Math.round((diff / sephoraResult.currentPrice) * 100);
  
  return {
    sephoraResult,
    comparison: {
      priceDifference: Math.round(diff * 100) / 100,
      percentageDifference: pctDiff,
      cheaperAt: Math.abs(diff) < 0.5 ? 'equal' : diff < 0 ? 'nocibe' : 'sephora'
    }
  };
}
