/**
 * Cloud Job: Validation des deals Sephora
 * 
 * Ce script vérifie que les prix des deals correspondent à la réalité sur Sephora.
 * Pour chaque deal, il:
 * 1. Scrape la page produit pour récupérer toutes les variantes (contenances) avec leurs prix
 * 2. Compare avec le deal en base
 * 3. Actions possibles:
 *    - Si plus de promo → deal status = EXPIRED
 *    - Si prix différent → update le prix + recalcul description
 *    - Si prix identique → deal validé ✓
 */

import { chromium, Browser, Page } from 'playwright';
import { chromium as playwrightExtra } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { PrismaClient } from '@prisma/client';

// Ajouter le plugin stealth pour éviter la détection (comme le scraper)
playwrightExtra.use(StealthPlugin());

// Fonction locale pour éviter les imports relatifs
function calculatePricePerUnit(price: number, volumeStr: string | null | undefined): { pricePerUnit: number; volumeValue: number; volumeUnit: string } | null {
  if (!volumeStr) return null;
  const normalized = volumeStr.toLowerCase().trim();
  const match = normalized.match(/(\d+(?:[.,]\d+)?)\s*(ml|l|cl|g|gr|gramme|grammes|kg|oz|fl\.?\s*oz)/i);
  if (!match) return null;
  let value = parseFloat(match[1].replace(',', '.'));
  let unit = match[2].toLowerCase();
  switch (unit) {
    case 'l': value *= 1000; unit = 'ml'; break;
    case 'cl': value *= 10; unit = 'ml'; break;
    case 'kg': value *= 1000; unit = 'g'; break;
    case 'gr': case 'gramme': case 'grammes': unit = 'g'; break;
    case 'oz': case 'fl oz': case 'fl. oz': value *= 29.57; unit = 'ml'; break;
  }
  if (value <= 0) return null;
  return { pricePerUnit: price / value, volumeValue: Math.round(value * 100) / 100, volumeUnit: unit };
}

const prisma = new PrismaClient() as any;

// Type pour une variante de produit
interface ProductVariant {
  name: string;            // "01 Light Glow (10 g)"
  volume: string;          // "10 g"
  volumeValue: number;     // 10
  volumeUnit: string;      // "g"
  currentPrice: number;    // Prix actuel
  originalPrice: number;   // Prix barré (si promo)
  discountPercent: number; // % de réduction
  isPromo: boolean;        // true si en promo
  sku: string;             // data-pid
}

// Résultat du scraping d'une page produit
interface ScrapedProductInfo {
  name: string;
  brand: string;
  variants: ProductVariant[];
  mainPrice: {
    currentPrice: number;
    originalPrice: number;
    discountPercent: number;
    isPromo: boolean;
  };
  url: string;
  scrapedAt: Date;
}

// Résultat de la validation
interface ValidationResult {
  dealId: number;
  productName: string;
  dealVolume: string;
  status: 'VALID' | 'PRICE_CHANGED' | 'VOLUME_CHANGED' | 'EXPIRED' | 'NOT_FOUND' | 'ERROR';
  oldPrice?: number;
  newPrice?: number;
  oldDiscount?: number;
  newDiscount?: number;
  oldVolume?: string;
  newVolume?: string;
  message: string;
  variants: ProductVariant[];
  matchedVariant?: ProductVariant;
}

class SephoraProductScraper {
  private browser: Browser | null = null;
  private headless: boolean;
  private context: any = null;

  constructor(headless: boolean = true) {
    this.headless = headless;
  }

  async init() {
    console.log(`🌐 Lancement du navigateur (headless: ${this.headless})...`);
    
    // Utiliser playwright-extra avec StealthPlugin en mode headless (comme le scraper)
    if (this.headless) {
      this.browser = await playwrightExtra.launch({
        headless: true,
        args: [
          '--disable-blink-features=AutomationControlled',
          '--disable-dev-shm-usage',
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process',
          '--disable-infobars',
          '--window-size=1920,1080',
          '--start-maximized',
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

    // Créer un context avec options anti-bot (comme enrich-sephora)
    this.context = await this.browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      locale: 'fr-FR',
      timezoneId: 'Europe/Paris',
      extraHTTPHeaders: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
        'sec-ch-ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
      },
    });

    // Masquer webdriver
    await this.context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });
  }

  async close() {
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  private delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Ferme les popups de cookies Sephora
   */
  private async closeCookiePopup(page: Page) {
    try {
      // Attendre un peu que la popup apparaisse
      await this.delay(1000);
      
      // Sélecteurs possibles pour le bouton "Accepter"
      const cookieSelectors = [
        'button#footer_tc_privacy_button_2',      // Bouton "Tout accepter"
        'button.tc-privacy-button',
        '#tc-privacy-wrapper button:first-child',
        'button[id*="accept"]',
        '.tc-privacy-wrapper button',
      ];
      
      for (const selector of cookieSelectors) {
        try {
          const button = await page.$(selector);
          if (button && await button.isVisible()) {
            console.log('  🍪 Fermeture popup cookies...');
            await button.click({ force: true, timeout: 3000 });
            await this.delay(500);
            return;
          }
        } catch (e) {
          // Continuer avec le prochain sélecteur
        }
      }
      
      // Si pas de bouton trouvé, essayer de supprimer l'overlay avec JavaScript
      await page.evaluate(() => {
        const overlay = document.querySelector('#tc-privacy-wrapper');
        if (overlay) overlay.remove();
        const banner = document.querySelector('#tc-privacy-overlay-banner');
        if (banner) banner.remove();
        document.body.style.overflow = 'auto';
      });
      
    } catch (err) {
      // Ignorer
    }
  }

  /**
   * Scrape une page produit Sephora pour récupérer TOUTES les variantes avec leurs prix
   */
  async scrapeProductVariants(productUrl: string): Promise<ScrapedProductInfo | null> {
    if (!this.browser) await this.init();
    
    const page = await this.context.newPage();
    
    try {
      // Délai aléatoire avant navigation (2-4s) comme dans enrich-sephora
      await this.delay(2000 + Math.random() * 2000);

      console.log(`  📄 Chargement: ${productUrl}`);
      await page.goto(productUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await this.delay(3000);

      // Fermer les popups de cookies
      await this.closeCookiePopup(page);

      // Extraire nom et marque
      const productInfo = await page.evaluate(() => {
        const tcVars = (window as any).tc_vars;
        let name = '';
        let brand = '';
        
        if (tcVars) {
          name = tcVars.product_pid_name || '';
          brand = tcVars.product_brand || tcVars.product_trademark || '';
        }
        
        if (!name) {
          const titleEl = document.querySelector('.product-name, .product-title-heading h1, h1.product-name');
          name = titleEl?.textContent?.trim() || '';
        }
        
        if (!brand) {
          const brandEl = document.querySelector('.brand-name, .product-brand');
          brand = brandEl?.textContent?.trim() || '';
        }
        
        return { name, brand };
      });

      console.log(`  🏷️ Produit: ${productInfo.brand} - ${productInfo.name}`);

      // Extraire le prix principal de la page
      // Prix promo: span.price-sales.prior-price-red
      // Prix normal: span.price-sales.price-sales-standard
      // Prix barré: span.price-standard
      // Réduction: span.original-price-discount
      const mainPrice = await page.evaluate(() => {
        const promoPrice = document.querySelector('span.price-sales.prior-price-red');
        const normalPrice = document.querySelector('span.price-sales.price-sales-standard');
        
        let currentPrice = 0;
        let originalPrice = 0;
        let discountPercent = 0;
        let isPromo = false;
        
        if (promoPrice) {
          isPromo = true;
          const priceText = promoPrice.textContent?.replace(/[^\d,\.]/g, '').replace(',', '.') || '0';
          currentPrice = parseFloat(priceText) || 0;
          
          const oldPriceEl = document.querySelector('span.price-standard');
          if (oldPriceEl) {
            const oldPriceText = oldPriceEl.textContent?.replace(/[^\d,\.]/g, '').replace(',', '.') || '0';
            originalPrice = parseFloat(oldPriceText) || currentPrice;
          }
          
          const discountEl = document.querySelector('span.original-price-discount');
          if (discountEl) {
            const discountText = discountEl.textContent?.replace(/[^\d]/g, '') || '0';
            discountPercent = parseInt(discountText) || 0;
          } else if (originalPrice > currentPrice) {
            discountPercent = Math.round((1 - currentPrice / originalPrice) * 100);
          }
        } else if (normalPrice) {
          const priceText = normalPrice.textContent?.replace(/[^\d,\.]/g, '').replace(',', '.') || '0';
          currentPrice = parseFloat(priceText) || 0;
          originalPrice = currentPrice;
        }
        
        return { currentPrice, originalPrice, discountPercent, isPromo };
      });

      console.log(`  💰 Prix principal: ${mainPrice.currentPrice}€ ${mainPrice.isPromo ? `(-${mainPrice.discountPercent}% promo)` : '(pas de promo)'}`);

      // Vérifier s'il y a un sélecteur de variantes
      // - div.variations-shade-selected → teintes (couleurs)
      // - div.variations-size-selected → contenances (volumes)
      const hasVariantSelector = await page.$('div.variations-shade-selected, div.variations-size-selected, a.open-color-dialog, a.open-selector-dialog');
      
      let variants: ProductVariant[] = [];
      
      if (hasVariantSelector) {
        console.log('  🎨 Sélecteur de variantes détecté, ouverture de la modale...');
        
        // Cliquer pour ouvrir la modale des variantes
        try {
          // Essayer plusieurs méthodes pour ouvrir la modale
          
          // Méthode 1: Clic sur a.open-selector-dialog (modale des contenances)
          let clicked = false;
          const sizeDialogLink = await page.$('div.variations-size-selected a.open-selector-dialog');
          if (sizeDialogLink) {
            console.log('  📦 Clic sur sélecteur de contenance...');
            await sizeDialogLink.scrollIntoViewIfNeeded();
            await this.delay(500);
            await sizeDialogLink.click();
            clicked = true;
          }
          
          // Méthode 2: Clic sur a.open-color-dialog (modale des teintes)
          if (!clicked) {
            const colorDialogLink = await page.$('div.variations-shade-selected a.open-color-dialog');
            if (colorDialogLink) {
              console.log('  🎨 Clic sur sélecteur de teinte...');
              await colorDialogLink.scrollIntoViewIfNeeded();
              await this.delay(500);
              await colorDialogLink.click();
              clicked = true;
            }
          }
          
          // Méthode 3: Clic JavaScript direct si les méthodes précédentes n'ont pas fonctionné
          if (!clicked) {
            console.log('  🔧 Tentative clic JavaScript...');
            const modalOpened = await page.evaluate(() => {
              const selectors = [
                'a.open-selector-dialog',
                'a.open-color-dialog',
                'div.variations-size-selected',
                'div.variations-shade-selected',
              ];
              
              for (const selector of selectors) {
                const el = document.querySelector(selector) as HTMLElement;
                if (el) {
                  el.click();
                  return true;
                }
              }
              return false;
            });
            clicked = modalOpened;
          }
          
          console.log('  ⏳ Attente de la modale...');
          await this.delay(1500);
          
          // Vérifier si les boutons de variantes sont présents
          const variantButtonsCount = await page.evaluate(() => {
            const buttons = document.querySelectorAll('button.variation-button[data-pid]');
            return buttons.length;
          });
          
          console.log(`  🔍 Boutons de variantes trouvés: ${variantButtonsCount}`);
          
          if (variantButtonsCount === 0) {
            throw new Error('Pas de boutons de variantes trouvés après ouverture');
          }
          
          console.log('  ✅ Modale ouverte avec variantes');
          
          // Extraire les variantes depuis la modale
          // Structure: div.variation-button-line > button.variation-button
          // - title="50 ml" pour le volume
          // - data-pid pour le SKU
          // - .variation-title span pour le nom
          // - .product-variant-price-wrapper .price-sales pour le prix
          variants = await page.evaluate(() => {
            const variantButtons = document.querySelectorAll('button.variation-button[data-pid]');
            const variants: any[] = [];
            
            console.log('Nombre de boutons trouvés:', variantButtons.length);
            
            variantButtons.forEach((button) => {
              try {
                // Le title contient le volume (ex: "50 ml" ou "01 Light Glow (10 g)")
                const title = button.getAttribute('title') || '';
                const sku = button.getAttribute('data-pid') || '';
                
                // Aussi chercher dans .variation-title span
                const titleSpan = button.querySelector('.variation-title span');
                const titleFromSpan = titleSpan?.textContent?.trim() || '';
                
                const name = title || titleFromSpan;
                
                // Si pas de nom, ignorer (ex: coffrets)
                if (!name) return;
                
                // Extraire volume du nom (ex: "100 ml" ou "01 Light Glow (10 g)" → "10 g")
                let volumeMatch = name.match(/^(\d+(?:[.,]\d+)?)\s*(ml|g)$/i); // Format simple: "50 ml"
                if (!volumeMatch) {
                  volumeMatch = name.match(/\((\d+(?:[.,]\d+)?)\s*(ml|g)\)/i); // Format avec parenthèses
                }
                const volume = volumeMatch ? `${volumeMatch[1]} ${volumeMatch[2].toLowerCase()}` : name;
                const volumeValue = volumeMatch ? parseFloat(volumeMatch[1].replace(',', '.')) : 0;
                const volumeUnit = volumeMatch ? volumeMatch[2].toLowerCase() : '';
                
                // Chercher le prix dans .product-variant-price-wrapper (le dernier, visible)
                const priceWrappers = button.querySelectorAll('.product-variant-price-wrapper');
                const priceWrapper = priceWrappers[priceWrappers.length - 1]; // Prendre le dernier (celui visible)
                
                if (!priceWrapper) return;
                
                // Prix promo: span.price-sales.prior-price-red
                // Prix normal: span.price-sales.price-sales-standard
                const promoPrice = priceWrapper.querySelector('span.price-sales.prior-price-red');
                const normalPrice = priceWrapper.querySelector('span.price-sales.price-sales-standard');
                
                let currentPrice = 0;
                let originalPrice = 0;
                let discountPercent = 0;
                let isPromo = false;
                
                if (promoPrice) {
                  isPromo = true;
                  const priceText = promoPrice.textContent?.replace(/[^\d,\.]/g, '').replace(',', '.') || '0';
                  currentPrice = parseFloat(priceText) || 0;
                  
                  // Prix barré: span.price-standard
                  const oldPriceEl = priceWrapper.querySelector('span.price-standard');
                  if (oldPriceEl) {
                    const oldPriceText = oldPriceEl.textContent?.replace(/[^\d,\.]/g, '').replace(',', '.') || '0';
                    originalPrice = parseFloat(oldPriceText) || currentPrice;
                  }
                  
                  // Réduction: span.original-price-discount
                  const discountEl = priceWrapper.querySelector('span.original-price-discount');
                  if (discountEl) {
                    const discountText = discountEl.textContent?.replace(/[^\d]/g, '') || '0';
                    discountPercent = parseInt(discountText) || 0;
                  } else if (originalPrice > currentPrice) {
                    discountPercent = Math.round((1 - currentPrice / originalPrice) * 100);
                  }
                } else if (normalPrice) {
                  const priceText = normalPrice.textContent?.replace(/[^\d,\.]/g, '').replace(',', '.') || '0';
                  currentPrice = parseFloat(priceText) || 0;
                  originalPrice = currentPrice;
                }
                
                if (currentPrice > 0) {
                  variants.push({
                    name,
                    volume,
                    volumeValue,
                    volumeUnit,
                    currentPrice,
                    originalPrice,
                    discountPercent,
                    isPromo,
                    sku,
                  });
                }
              } catch (e) {
                // Ignorer cette variante
              }
            });
            
            return variants;
          });
          
          console.log(`  📦 ${variants.length} variantes trouvées dans la modale`);
          
          // Fermer la modale
          try {
            const closeButton = await page.$('.ui-dialog-titlebar-close, .close-button, [aria-label="Close"]');
            if (closeButton) {
              await closeButton.click();
            } else {
              await page.keyboard.press('Escape');
            }
          } catch (e) {
            // Ignorer
          }
          
        } catch (err) {
          console.log(`  ⚠️ Impossible d'ouvrir la modale des variantes`);
        }
      }

      // Si pas de variantes, utiliser le prix principal
      if (variants.length === 0) {
        // Récupérer le volume depuis la page
        // Sélecteur principal: span.variation-title.bidirectional
        const volumeInfo = await page.evaluate(() => {
          // Sélecteur exact Sephora pour la contenance
          const variationTitle = document.querySelector('span.variation-title.bidirectional, .variation-title');
          if (variationTitle) {
            const text = variationTitle.textContent?.trim() || '';
            if (text && /\d+\s*(ml|g)/i.test(text)) {
              return text;
            }
          }
          
          // Fallback: autres sélecteurs
          const variationEls = document.querySelectorAll('.product-variation-name, .variation-selected, .product-size-label');
          for (const el of variationEls) {
            const text = el.textContent?.trim() || '';
            if (text && /\d+\s*(ml|g)/i.test(text)) {
              return text;
            }
          }
          
          // Chercher dans tc_vars
          const tcVars = (window as any).tc_vars;
          if (tcVars?.product_size) {
            return tcVars.product_size;
          }
          
          return '';
        });
        
        // Parser le volume trouvé
        const volumeMatch = volumeInfo.match(/(\d+(?:[.,]\d+)?)\s*(ml|g)/i);
        const volumeName = volumeMatch ? `${volumeMatch[1]} ${volumeMatch[2].toLowerCase()}` : volumeInfo;
        
        if (volumeName) {
          console.log(`  📐 Volume détecté: ${volumeName}`);
        }
        
        variants.push({
          name: volumeName || 'Principal (volume inconnu)',
          volume: volumeMatch ? `${volumeMatch[1]} ${volumeMatch[2].toLowerCase()}` : '',
          volumeValue: volumeMatch ? parseFloat(volumeMatch[1].replace(',', '.')) : 0,
          volumeUnit: volumeMatch ? volumeMatch[2].toLowerCase() : '',
          currentPrice: mainPrice.currentPrice,
          originalPrice: mainPrice.originalPrice,
          discountPercent: mainPrice.discountPercent,
          isPromo: mainPrice.isPromo,
          sku: '',
        });
      }

      return {
        name: productInfo.name,
        brand: productInfo.brand,
        variants,
        mainPrice,
        url: productUrl,
        scrapedAt: new Date(),
      };

    } catch (err) {
      console.error(`  ❌ Erreur scraping: ${err}`);
      return null;
    } finally {
      await page.close();
    }
  }
}

/**
 * Normalise un volume pour la comparaison
 * "30ml" → "30 ml", "30ML" → "30 ml", "30 Ml" → "30 ml"
 */
function normalizeVolume(vol: string): string {
  if (!vol) return '';
  return vol
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/(\d+(?:[.,]\d+)?)\s*(ml|g)/gi, '$1 $2')
    .replace(',', '.')
    .trim();
}

/**
 * Trouve la variante correspondant au volume du deal
 * Compare le nom COMPLET de la variante (incluant teinte + volume)
 */
function findMatchingVariant(variants: ProductVariant[], dealVolume: string | null): { variant: ProductVariant | null; isExactMatch: boolean } {
  if (!dealVolume || variants.length === 0) {
    return { variant: variants[0] || null, isExactMatch: false };
  }

  const dealVolumeLower = dealVolume.toLowerCase().trim();
  const dealVolumeNormalized = normalizeVolume(dealVolume);

  // 1. Chercher un match EXACT sur le nom complet
  for (const variant of variants) {
    const variantNameLower = variant.name.toLowerCase().trim();
    if (variantNameLower === dealVolumeLower) {
      return { variant, isExactMatch: true };
    }
  }

  // 2. Chercher si le nom normalisé correspond
  for (const variant of variants) {
    const variantNameNormalized = normalizeVolume(variant.name);
    if (variantNameNormalized === dealVolumeNormalized) {
      return { variant, isExactMatch: true };
    }
  }

  // 3. Chercher si le nom de la variante CONTIENT le volume du deal
  for (const variant of variants) {
    const variantNameLower = variant.name.toLowerCase().trim();
    if (variantNameLower.includes(dealVolumeLower) || dealVolumeLower.includes(variantNameLower)) {
      return { variant, isExactMatch: true };
    }
  }

  // 4. Extraire le volume numérique et comparer
  const dealVolumeMatch = dealVolume.match(/(\d+(?:[.,]\d+)?)\s*(ml|g)/i);
  if (dealVolumeMatch) {
    const dealVolumeValue = parseFloat(dealVolumeMatch[1].replace(',', '.'));
    const dealVolumeUnit = dealVolumeMatch[2].toLowerCase();

    // Chercher la variante correspondante exactement sur volume
    for (const variant of variants) {
      if (variant.volumeValue === dealVolumeValue && variant.volumeUnit === dealVolumeUnit) {
        // Vérifier aussi que le nom ressemble (pour éviter mauvaise teinte)
        const dealNamePart = dealVolume.replace(/\s*\(?\d+(?:[.,]\d+)?\s*(?:ml|g)\)?\s*/gi, '').toLowerCase().trim();
        const variantNamePart = variant.name.replace(/\s*\(?\d+(?:[.,]\d+)?\s*(?:ml|g)\)?\s*/gi, '').toLowerCase().trim();
        
        if (!dealNamePart || !variantNamePart || dealNamePart === variantNamePart) {
          return { variant, isExactMatch: true };
        }
      }
    }

    // Match uniquement sur volume numérique (cas simple comme "30ml" vs "30 ml")
    for (const variant of variants) {
      if (variant.volumeValue === dealVolumeValue && variant.volumeUnit === dealVolumeUnit) {
        return { variant, isExactMatch: true };
      }
    }
  }

  // 5. Pas de match trouvé
  return { variant: null, isExactMatch: false };
}

/**
 * Valide un deal et retourne le résultat
 */
async function validateDeal(
  deal: any,
  scrapedInfo: ScrapedProductInfo | null
): Promise<ValidationResult> {
  const result: ValidationResult = {
    dealId: deal.id,
    productName: deal.product?.name || deal.title,
    dealVolume: deal.volume || 'N/A',
    status: 'ERROR',
    message: '',
    variants: [],
  };

  if (!scrapedInfo) {
    result.status = 'NOT_FOUND';
    result.message = 'Page produit non accessible ou produit retiré';
    return result;
  }

  result.variants = scrapedInfo.variants;

  if (scrapedInfo.variants.length === 0) {
    result.status = 'ERROR';
    result.message = 'Impossible de récupérer les prix depuis la page';
    return result;
  }

  // Trouver la variante correspondant au volume du deal
  const { variant: matchingVariant, isExactMatch } = findMatchingVariant(scrapedInfo.variants, deal.volume);

  // CAS 1: La variante exacte existe ET est en promo
  if (matchingVariant && isExactMatch && matchingVariant.isPromo) {
    result.matchedVariant = matchingVariant;
    result.oldPrice = deal.dealPrice;
    result.newPrice = matchingVariant.currentPrice;
    result.oldDiscount = deal.discountPercent;
    result.newDiscount = matchingVariant.discountPercent;

    // Vérifier si le prix a changé
    const priceDiff = Math.abs(deal.dealPrice - matchingVariant.currentPrice);
    if (priceDiff > 0.05) {
      result.status = 'PRICE_CHANGED';
      result.message = `Prix changé: ${deal.dealPrice}€ → ${matchingVariant.currentPrice}€ (${matchingVariant.discountPercent}%)`;
      return result;
    }

    // Tout est OK
    result.status = 'VALID';
    result.message = `Prix validé: ${matchingVariant.currentPrice}€ (-${matchingVariant.discountPercent}%)`;
    return result;
  }

  // CAS 2: La variante exacte N'est PAS en promo OU n'existe pas
  // → Chercher une AUTRE variante en promo
  const promoVariants = scrapedInfo.variants.filter(v => v.isPromo);
  
  if (promoVariants.length > 0) {
    // Prendre la variante en promo avec le meilleur % de réduction
    const bestPromoVariant = promoVariants.reduce((best, current) => 
      current.discountPercent > best.discountPercent ? current : best
    );
    
    result.matchedVariant = bestPromoVariant;
    result.oldPrice = deal.dealPrice;
    result.newPrice = bestPromoVariant.currentPrice;
    result.oldDiscount = deal.discountPercent;
    result.newDiscount = bestPromoVariant.discountPercent;
    result.oldVolume = deal.volume;
    result.newVolume = bestPromoVariant.name;
    
    result.status = 'VOLUME_CHANGED';
    result.message = `Promo trouvée sur ${bestPromoVariant.name} au lieu de ${deal.volume}: ${bestPromoVariant.currentPrice}€ (-${bestPromoVariant.discountPercent}%)`;
    return result;
  }

  // CAS 3: Aucune variante n'est en promo → Deal expiré
  result.status = 'EXPIRED';
  result.message = `Aucune promo disponible pour ce produit`;
  return result;
}

/**
 * Met à jour le deal en base selon le résultat de validation
 */
async function applyValidationResult(result: ValidationResult): Promise<void> {
  const deal = await prisma.deal.findUnique({ 
    where: { id: result.dealId },
    include: { product: { include: { brandRef: true } } }
  });
  if (!deal) return;

  switch (result.status) {
    case 'EXPIRED':
      // Marquer le deal comme expiré (aucune promo nulle part)
      await prisma.deal.update({
        where: { id: result.dealId },
        data: {
          status: 'EXPIRED',
          updatedAt: new Date(),
        },
      });
      console.log(`    ⚡ Deal #${result.dealId} marqué expiré (aucune promo disponible)`);
      break;

    case 'VOLUME_CHANGED':
      // La promo existe sur une autre contenance → mettre à jour le deal
      const newVariant = result.matchedVariant;
      if (newVariant) {
        const priceInfo = calculatePricePerUnit(newVariant.currentPrice, newVariant.name);
        const brandName = deal.product?.brandRef?.name || deal.product?.brand || '';

        await prisma.deal.update({
          where: { id: result.dealId },
          data: {
            status: 'ACTIVE',
            volume: newVariant.name,
            dealPrice: newVariant.currentPrice,
            originalPrice: newVariant.originalPrice,
            discountPercent: newVariant.discountPercent,
            discountAmount: newVariant.originalPrice - newVariant.currentPrice,
            pricePerUnit: priceInfo?.pricePerUnit || deal.pricePerUnit,
            description: `${newVariant.discountPercent}% de réduction !`,
            title: `${brandName} -${newVariant.discountPercent}% : ${deal.product?.name?.substring(0, 100) || ''}`,
            updatedAt: new Date(),
            lastSeenAt: new Date(),
          },
        });

        // Ajouter à l'historique des prix (sans variantId car c'est un SKU externe)
        await prisma.priceHistory.create({
          data: {
            productId: deal.productId,
            price: newVariant.currentPrice,
            volumeValue: newVariant.volumeValue,
            volumeUnit: newVariant.volumeUnit,
            volumeRaw: newVariant.name,
            date: new Date(),
          },
        });

        console.log(`    🔄 Deal #${result.dealId} mis à jour: ${result.oldVolume} → ${newVariant.name} (${newVariant.currentPrice}€ -${newVariant.discountPercent}%)`);
      }
      break;

    case 'PRICE_CHANGED':
      // Même contenance mais prix différent
      const matchingVariant = result.matchedVariant;
      if (matchingVariant) {
        const priceInfo = calculatePricePerUnit(matchingVariant.currentPrice, deal.volume);
        const brandName = deal.product?.brandRef?.name || deal.product?.brand || '';

        await prisma.deal.update({
          where: { id: result.dealId },
          data: {
            status: 'ACTIVE',
            dealPrice: matchingVariant.currentPrice,
            originalPrice: matchingVariant.originalPrice,
            discountPercent: matchingVariant.discountPercent,
            discountAmount: matchingVariant.originalPrice - matchingVariant.currentPrice,
            pricePerUnit: priceInfo?.pricePerUnit || deal.pricePerUnit,
            description: `${matchingVariant.discountPercent}% de réduction !`,
            title: `${brandName} -${matchingVariant.discountPercent}% : ${deal.product?.name?.substring(0, 100) || ''}`,
            updatedAt: new Date(),
            lastSeenAt: new Date(),
          },
        });

        // Ajouter à l'historique des prix (sans variantId car c'est un SKU externe)
        await prisma.priceHistory.create({
          data: {
            productId: deal.productId,
            price: matchingVariant.currentPrice,
            volumeValue: matchingVariant.volumeValue,
            volumeUnit: matchingVariant.volumeUnit,
            volumeRaw: matchingVariant.name,
            date: new Date(),
          },
        });

        console.log(`    💰 Deal #${result.dealId} prix mis à jour: ${deal.dealPrice}€ → ${matchingVariant.currentPrice}€`);
      }
      break;

    case 'VALID':
      // Valider le deal → passer en ACTIVE (important pour les PENDING)
      await prisma.deal.update({
        where: { id: result.dealId },
        data: {
          status: 'ACTIVE',
          lastSeenAt: new Date(),
        },
      });

      // Ajouter à l'historique des prix pour garder une trace
      if (result.matchedVariant) {
        await prisma.priceHistory.create({
          data: {
            productId: deal.productId,
            price: result.matchedVariant.currentPrice,
            volumeValue: result.matchedVariant.volumeValue,
            volumeUnit: result.matchedVariant.volumeUnit,
            volumeRaw: result.matchedVariant.name,
            date: new Date(),
          },
        });
      }

      console.log(`    ✅ Deal #${result.dealId} validé → ACTIVE`);
      break;

    case 'NOT_FOUND':
    case 'ERROR':
      console.log(`    ⚠️ Deal #${result.dealId}: ${result.message}`);
      break;
  }
}

// ============================================
// MAIN
// ============================================

async function main() {
  console.log('========================================');
  console.log('   VALIDATE DEALS SEPHORA - Cloud Job  ');
  console.log('========================================\n');
  
  // En mode cloud, toujours headless et sans limit
  const headless = true;

  // Récupérer le merchant Sephora
  const merchant = await prisma.merchant.findFirst({ where: { slug: 'sephora' } });
  if (!merchant) {
    console.log('❌ Merchant Sephora non trouvé');
    return;
  }

  // Récupérer TOUS les deals PENDING et ACTIVE Sephora
  const deals = await prisma.deal.findMany({
    where: {
      product: { merchantId: merchant.id },
      status: { in: ['PENDING', 'ACTIVE'] },
    },
    include: { product: { include: { merchant: true, brandRef: true } } },
    orderBy: { updatedAt: 'desc' },
  });

  console.log(`📋 ${deals.length} deals à valider\n`);

  const scraper = new SephoraProductScraper(headless);
  await scraper.init();

  const results: ValidationResult[] = [];
  const stats = { valid: 0, priceChanged: 0, volumeChanged: 0, expired: 0, notFound: 0, error: 0, activated: 0 };

  for (const deal of deals) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`🏷️ Deal #${deal.id}: ${deal.title?.substring(0, 50)}...`);
    console.log(`   🔗 http://localhost:3000/deals/${deal.id}`);
    console.log(`   📦 Volume: ${deal.volume || 'N/A'}`);
    console.log(`   💵 Prix original: ${deal.originalPrice}€`);
    console.log(`   💰 Prix promo: ${deal.dealPrice}€`);
    console.log(`   📉 Réduction: -${deal.discountPercent}% (${deal.discountAmount}€ d'économie)`);

    const productUrl = deal.product?.productUrl;
    if (!productUrl) {
      console.log('   ❌ Pas d\'URL produit');
      stats.error++;
      continue;
    }

    // Scraper la page produit
    const scrapedInfo = await scraper.scrapeProductVariants(productUrl);
    
    if (scrapedInfo && scrapedInfo.variants.length > 0) {
      // Dédupliquer les variantes (parfois elles apparaissent 2 fois)
      const uniqueVariants = scrapedInfo.variants.filter((v, i, arr) => 
        arr.findIndex(x => x.name === v.name && x.currentPrice === v.currentPrice) === i
      );
      
      console.log(`\n   📦 Variantes trouvées sur Sephora:`);
      const { variant: matchingVariantForDisplay, isExactMatch } = findMatchingVariant(uniqueVariants, deal.volume);
      for (const v of uniqueVariants) {
        const isMatch = matchingVariantForDisplay && v.name === matchingVariantForDisplay.name;
        const matchTag = isMatch ? (isExactMatch ? ' ← DEAL ACTUEL' : '') : '';
        const promoIcon = v.isPromo ? '🏷️' : '  ';
        console.log(`      ${promoIcon} ${v.name}: ${v.originalPrice}€ → ${v.currentPrice}€ ${v.isPromo ? `(-${v.discountPercent}%)` : '(pas de promo)'}${matchTag}`);
      }
      
      // Afficher la comparaison
      const promoVariants = uniqueVariants.filter(v => v.isPromo);
      if (matchingVariantForDisplay && isExactMatch && matchingVariantForDisplay.isPromo) {
        console.log(`\n   🔄 COMPARAISON (${deal.volume}):`);
        console.log(`      En base:   ${deal.originalPrice}€ → ${deal.dealPrice}€ (-${deal.discountPercent}%)`);
        console.log(`      Sephora:   ${matchingVariantForDisplay.originalPrice}€ → ${matchingVariantForDisplay.currentPrice}€ (-${matchingVariantForDisplay.discountPercent}%)`);
        
        if (Math.abs(deal.dealPrice - matchingVariantForDisplay.currentPrice) > 0.05) {
          console.log(`      💰 PRIX CHANGÉ`);
        } else {
          console.log(`      ✅ VALIDÉ`);
        }
      } else if (promoVariants.length > 0) {
        // La variante du deal n'est pas en promo mais d'autres le sont
        const bestPromo = promoVariants.reduce((best, curr) => 
          curr.discountPercent > best.discountPercent ? curr : best
        );
        console.log(`\n   🔄 CHANGEMENT DE VOLUME:`);
        console.log(`      ${deal.volume} n'est plus en promo`);
        console.log(`      → Promo disponible sur: ${bestPromo.name} à ${bestPromo.currentPrice}€ (-${bestPromo.discountPercent}%)`);
      } else {
        console.log(`\n   ⚡ AUCUNE PROMO: Toutes les variantes sont au prix normal`);
      }
    }

    // Valider le deal
    // Dédupliquer les variantes avant validation
    if (scrapedInfo) {
      scrapedInfo.variants = scrapedInfo.variants.filter((v, i, arr) => 
        arr.findIndex(x => x.name === v.name && x.currentPrice === v.currentPrice) === i
      );
    }
    const validationResult = await validateDeal(deal, scrapedInfo);
    results.push(validationResult);

    // Appliquer les changements
    await applyValidationResult(validationResult);

    // Mettre à jour les stats
    switch (validationResult.status) {
      case 'VALID': stats.valid++; break;
      case 'PRICE_CHANGED': stats.priceChanged++; break;
      case 'VOLUME_CHANGED': stats.volumeChanged++; break;
      case 'EXPIRED': stats.expired++; break;
      case 'NOT_FOUND': stats.notFound++; break;
      case 'ERROR': stats.error++; break;
    }
    // Compter les deals activés (PENDING → ACTIVE)
    if (deal.status === 'PENDING' && ['VALID', 'PRICE_CHANGED', 'VOLUME_CHANGED'].includes(validationResult.status)) {
      stats.activated++;
    }

    // Délai entre les requêtes
    await new Promise(r => setTimeout(r, 1000));
  }

  await scraper.close();
  await prisma.$disconnect();

  // Résumé
  console.log('\n' + '═'.repeat(60));
  console.log('📊 RÉSUMÉ');
  console.log('═'.repeat(60));
  console.log(`✅ Validés:           ${stats.valid}`);
  console.log(`💰 Prix changés:      ${stats.priceChanged}`);
  console.log(`🔄 Volume changé:     ${stats.volumeChanged}`);
  console.log(`⚡ Expirés:           ${stats.expired}`);
  console.log(`❓ Non trouvés:       ${stats.notFound}`);
  console.log(`❌ Erreurs:           ${stats.error}`);
  console.log(`🚀 Activés (PENDING→ACTIVE): ${stats.activated}`);
  console.log(`\nTotal: ${deals.length} deals traités`);
}

main().catch(console.error);
