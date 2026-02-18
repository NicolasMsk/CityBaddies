/**
 * =============================================================================
 * VALIDATE-DEALS-NOTINO.TS - Validation des deals Notino
 * =============================================================================
 * 
 * Ce script vérifie que les prix des deals Notino correspondent à la réalité.
 * Pour chaque deal, il:
 * 1. Ouvre la page produit sur Notino (Playwright, anti-Cloudflare)
 * 2. Extrait le prix actuel, le prix code promo, les variantes de volume
 * 3. Compare avec le deal en base
 * 4. Actions possibles:
 *    - Si plus de promo → deal status = EXPIRED
 *    - Si prix différent → update le prix + recalcul description
 *    - Si prix identique → deal validé ✓
 *    - Si variante changée → update volume + prix
 * 
 * Usage: npx tsx src/scripts/validate-deals-notino.ts [--limit N] [--deal-id ID] [--headless]
 * =============================================================================
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient() as any;

// ============================================
// UTILITY: calculatePricePerUnit (inline)
// ============================================

function calculatePricePerUnit(price: number, volumeStr: string | null | undefined): { pricePerUnit: number; volumeValue: number; volumeUnit: string } | null {
  if (!volumeStr) return null;
  const match = volumeStr.match(/([\d]+(?:[,.][\d]+)?)\s*(ml|g|l|cl|oz|kg)\b/i);
  if (!match) return null;
  let value = parseFloat(match[1].replace(',', '.'));
  let unit = match[2].toLowerCase();
  // Convertir en ml ou g
  if (unit === 'l') { value *= 1000; unit = 'ml'; }
  if (unit === 'cl') { value *= 10; unit = 'ml'; }
  if (unit === 'kg') { value *= 1000; unit = 'g'; }
  if (unit === 'oz') { value *= 29.5735; unit = 'ml'; }
  if (value <= 0) return null;
  return { pricePerUnit: Math.round((price / value) * 100) / 100, volumeValue: value, volumeUnit: unit };
}

// ============================================
// TYPES
// ============================================

interface ProductVariant {
  name: string;            // "150 ml", "100 ml", "18 g"
  volume: string;          // idem
  volumeValue: number;     // 150
  volumeUnit: string;      // "ml"
  currentPrice: number;    // Prix actuel (ou prix avec code promo)
  originalPrice: number;   // Prix barré
  discountPercent: number;
  isPromo: boolean;
  isSelected: boolean;
  url: string;
}

interface ScrapedProductInfo {
  brand: string;
  name: string;
  fullTitle: string;
  currentPrice: number;
  priceWithCode: number | null;
  promoCode: string | null;
  originalPrice: number;
  discountPercent: number;
  isPromo: boolean;
  volume: string | null;
  variants: ProductVariant[];
  inStock: boolean;
  url: string;
  scrapedAt: Date;
}

interface ValidationResult {
  dealId: string;
  productName: string;
  dealVolume: string | null;
  status: 'VALID' | 'PRICE_CHANGED' | 'VOLUME_CHANGED' | 'EXPIRED' | 'PENDING' | 'NOT_FOUND' | 'ERROR';
  message: string;
  oldPrice?: number;
  newPrice?: number;
  oldDiscount?: number;
  newDiscount?: number;
  oldVolume?: string | null;
  newVolume?: string | null;
  matchedVariant?: ProductVariant;
  promoCode?: string | null;
}

// ============================================
// CLASSE NotinoProductScraper
// ============================================

class NotinoProductScraper {
  private browser: Browser | null = null;
  private headless: boolean;

  constructor(headless: boolean = false) {
    this.headless = headless;
  }

  async init(): Promise<void> {
    this.browser = await chromium.launch({
      headless: this.headless,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
      ],
    });
    console.log(`🌐 Navigateur lancé (${this.headless ? 'headless' : 'visible'})`);
  }

  async close(): Promise<void> {
    if (this.browser) await this.browser.close();
    this.browser = null;
  }

  /**
   * Scrape une page produit Notino et retourne toutes les variantes avec prix
   */
  async scrapeProductVariants(url: string): Promise<ScrapedProductInfo | null> {
    if (!this.browser) return null;

    // Nouveau contexte par produit (anti-Cloudflare, comme le scraper principal)
    const context = await this.browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      locale: 'fr-FR',
      viewport: { width: 1920, height: 1080 },
    });
    const page = await context.newPage();

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForSelector('h1[data-testid="pd-header-title"]', { timeout: 25000 });

      // Fermer le popup cookies Usercentrics
      await new Promise(r => setTimeout(r, 2000));
      await page.evaluate(() => {
        if (typeof (window as any).UC_UI !== 'undefined') {
          (window as any).UC_UI.acceptAllConsents();
          (window as any).UC_UI.closeCMP();
        }
        const aside = document.querySelector('#usercentrics-cmp-ui');
        if (aside) aside.remove();
      }).catch(() => {});

      await new Promise(r => setTimeout(r, 1500));

      // ===== EXTRACTION VIA page.evaluate() =====
      const data = await page.evaluate(() => {
        const result: any = {
          brand: '',
          name: '',
          description: '',
          currentPrice: 0,
          priceWithCode: null,
          promoCode: null,
          originalPrice: 0,
          discountPercent: 0,
          isPromo: false,
          volume: null,
          inStock: false,
          variants: [],
        };

        // ===== TITRE =====
        const titleEl = document.querySelector('h1[data-testid="pd-header-title"]');
        if (titleEl) {
          const brandLink = titleEl.querySelector('a');
          result.brand = brandLink?.textContent?.trim() || '';

          const nameSpans = titleEl.querySelectorAll('span');
          for (const span of nameSpans) {
            const text = span.textContent?.trim() || '';
            if (text && !span.querySelector('a') && !span.closest('a')) {
              if (!result.name) result.name = text;
              else if (!result.description) result.description = text;
            }
          }
        }

        // ===== PRIX PRINCIPAL (dans #pdSelectedVariant) =====
        const selectedVariantArea = document.querySelector('#pdSelectedVariant');
        if (selectedVariantArea) {
          const mainPriceWrapper = selectedVariantArea.querySelector('[data-testid="pd-price-wrapper"]');
          if (mainPriceWrapper) {
            const priceSpan = mainPriceWrapper.querySelector('span[content]');
            if (priceSpan) {
              const val = parseFloat(priceSpan.getAttribute('content')?.replace(',', '.') || '0');
              result.currentPrice = val;
              result.originalPrice = val;
            }
          }

          // Volume de la variante sélectionnée (ex: "90 ml" dans un <span>)
          const spans = selectedVariantArea.querySelectorAll('span');
          for (const span of spans) {
            const text = span.textContent?.trim() || '';
            if (/^\d+(?:[,.]\d+)?\s*(ml|g|l|cl|oz|kg)$/i.test(text)) {
              result.volume = text;
              break;
            }
          }
        }

        // Fallback prix si pas trouvé dans #pdSelectedVariant
        if (!result.currentPrice) {
          const priceWrapper = document.querySelector('[data-testid="pd-price-wrapper"]');
          if (priceWrapper) {
            const priceSpan = priceWrapper.querySelector('span[content]');
            if (priceSpan) {
              const val = parseFloat(priceSpan.getAttribute('content')?.replace(',', '.') || '0');
              result.currentPrice = val;
              result.originalPrice = val;
            }
          }
        }

        // ===== PRODUCT SPECIFICATIONS (stock, code promo, prix/unité) =====
        const specsEl = document.querySelector('[data-testid="product-specifications"]');
        if (specsEl) {
          const specsText = specsEl.textContent || '';
          // Stock: "En stock" dans les specs
          if (/en stock/i.test(specsText)) {
            result.inStock = true;
          }
          // Code promo: "Code : XXXX"
          const specsCodeMatch = specsText.match(/Code\s*:\s*(\w+)/i);
          if (specsCodeMatch) {
            result.promoCode = specsCodeMatch[1];
          }
        }

        // ===== PRIX AVEC CODE PROMO =====
        const pageText = document.body.innerText;
        // Fallback: "avec le code XXX"
        if (!result.promoCode) {
          const codeMatch = pageText.match(/avec le code\s+(\w+)/i);
          if (codeMatch) result.promoCode = codeMatch[1];
        }

        const allPriceWrappers = document.querySelectorAll('[data-testid="pd-price-wrapper"]');
        if (allPriceWrappers.length > 1) {
          for (const container of allPriceWrappers) {
            const parentText = container.parentElement?.textContent || '';
            if (parentText.includes('avec le code') || parentText.includes('Code :')) {
              const codePriceSpan = container.querySelector('span[content]');
              if (codePriceSpan) {
                result.priceWithCode = parseFloat(codePriceSpan.getAttribute('content')?.replace(',', '.') || '0');
              }
            }
          }
        }

        if (result.promoCode && !result.priceWithCode) {
          const codePriceMatch = pageText.match(/([\d]+[,.][\d]+)\s*€\s*avec le code/i);
          if (codePriceMatch) {
            result.priceWithCode = parseFloat(codePriceMatch[1].replace(',', '.'));
          }
        }

        // ===== PRIX BARRÉ =====
        const allSpans = document.querySelectorAll('span');
        for (const span of allSpans) {
          const style = window.getComputedStyle(span);
          if (style.textDecoration.includes('line-through')) {
            const text = span.textContent?.trim() || '';
            const barredMatch = text.match(/([\d]+[,.][\d]+)/);
            if (barredMatch) {
              const barredPrice = parseFloat(barredMatch[1].replace(',', '.'));
              if (barredPrice > result.currentPrice) {
                result.originalPrice = barredPrice;
              }
            }
          }
        }

        // Pourcentage de réduction
        const discountMatch = pageText.match(/(-\s*\d+)\s*%/);
        if (discountMatch) {
          result.discountPercent = Math.abs(parseInt(discountMatch[1].replace(/\s/g, '')));
          result.isPromo = true;
        }
        if (!result.discountPercent && result.originalPrice > result.currentPrice) {
          result.discountPercent = Math.round((1 - result.currentPrice / result.originalPrice) * 100);
          result.isPromo = true;
        }

        // ===== VOLUME (fallback si pas trouvé dans #pdSelectedVariant) =====
        if (!result.volume) {
          // Chercher dans la variante sélectionnée du sélecteur de variantes
          const selectedLink = document.querySelector('a.pd-variant-selected .pd-variant-label');
          if (selectedLink) {
            result.volume = selectedLink.textContent?.trim() || null;
          }
        }
        if (!result.volume) {
          const headerArea = document.querySelector('[data-testid="pd-header-title"]')?.parentElement?.parentElement;
          if (headerArea) {
            const spans = headerArea.querySelectorAll('span');
            for (const span of spans) {
              const text = span.textContent?.trim() || '';
              if (/^\d+(?:[,.]\d+)?\s*(ml|g|l|cl|oz|kg)$/i.test(text)) {
                result.volume = text;
                break;
              }
            }
          }
        }

        // ===== VARIANTES DE VOLUME =====
        // Les variantes sont des <a data-testid="pd-variant-XXXXX"> à l'intérieur de <li>
        const variantLinks = document.querySelectorAll('a[data-testid^="pd-variant-"]');
        for (const link of variantLinks) {
          // Ignorer les variantes couleur
          const isColorPicker = link.closest('[data-testid="pd-variants-color-picker"]');
          if (isColorPicker) continue;

          const labelEl = link.querySelector('.pd-variant-label');
          const variantName = labelEl?.textContent?.trim() || '';
          if (!/\d+(?:[,.]\d+)?\s*(ml|g|l|cl|oz|kg)/i.test(variantName)) continue;

          // Prix de la variante (dans le sélecteur de variantes)
          let variantPrice = 0;
          const vpw = link.querySelector('[data-testid="pd-price-wrapper"]');
          if (vpw) {
            const pSpan = vpw.querySelector('span[content]');
            if (pSpan) variantPrice = parseFloat(pSpan.getAttribute('content')?.replace(',', '.') || '0');
          }

          // URL de la variante
          const variantHref = link.getAttribute('href') || '';
          const variantUrl = variantHref ? `https://www.notino.fr${variantHref}` : '';

          // La variante sélectionnée a la classe "pd-variant-selected" sur le <a>
          const isSelected = link.classList.contains('pd-variant-selected');

          result.variants.push({
            name: variantName,
            currentPrice: variantPrice,
            originalPrice: variantPrice,
            discountPercent: 0,
            isPromo: false,
            isSelected,
            url: variantUrl,
          });
        }

        // ===== STOCK =====
        // Déjà détecté via product-specifications ci-dessus, sinon fallback
        if (!result.inStock) {
          const addToCart = document.querySelector('[data-testid="pd-add-to-cart"]');
          result.inStock = addToCart !== null;
        }
        if (!result.inStock) {
          const stockEl = document.querySelector('[class*="stock"]');
          if (stockEl) {
            const stockText = stockEl.textContent?.trim().toLowerCase() || '';
            result.inStock = stockText.includes('en stock') || stockText.includes('disponible');
          }
        }

        return result;
      });

      // Construire l'objet de résultat
      const variants: ProductVariant[] = data.variants.map((v: any) => {
        const parsed = this.parseVolume(v.name);
        return {
          name: v.name,
          volume: v.name,
          volumeValue: parsed?.value || 0,
          volumeUnit: parsed?.unit || '',
          currentPrice: v.currentPrice,
          originalPrice: v.originalPrice,
          discountPercent: v.discountPercent,
          isPromo: v.isPromo,
          isSelected: v.isSelected,
          url: v.url,
        };
      });

      // Si pas de variantes détectées dans la liste, créer une variante principale
      if (variants.length === 0 && data.currentPrice > 0) {
        const parsed = this.parseVolume(data.volume || '');
        variants.push({
          name: data.volume || 'Standard',
          volume: data.volume || 'Standard',
          volumeValue: parsed?.value || 0,
          volumeUnit: parsed?.unit || '',
          currentPrice: data.priceWithCode || data.currentPrice,
          originalPrice: data.originalPrice,
          discountPercent: data.discountPercent,
          isPromo: data.isPromo,
          isSelected: true,
          url,
        });
      }

      // Pour les variantes, enrichir avec les infos promo de la page principale
      // (la page affiche les infos de la variante sélectionnée)
      for (const v of variants) {
        if (v.isSelected) {
          v.currentPrice = data.priceWithCode || data.currentPrice;
          v.originalPrice = data.originalPrice;
          v.discountPercent = data.discountPercent;
          v.isPromo = data.isPromo;
        }
      }

      const fullTitle = [data.brand, data.name, data.description].filter(Boolean).join(' ');

      return {
        brand: data.brand,
        name: data.name,
        fullTitle,
        currentPrice: data.currentPrice,
        priceWithCode: data.priceWithCode,
        promoCode: data.promoCode,
        originalPrice: data.originalPrice,
        discountPercent: data.discountPercent,
        isPromo: data.isPromo,
        volume: data.volume,
        variants,
        inStock: data.inStock,
        url,
        scrapedAt: new Date(),
      };

    } catch (err) {
      console.error(`   ❌ Erreur scraping: ${err instanceof Error ? err.message : err}`);
      return null;
    } finally {
      await page.close();
      await context.close();
    }
  }

  private parseVolume(text: string): { value: number; unit: string } | null {
    if (!text) return null;
    const match = text.match(/([\d]+(?:[,.][\d]+)?)\s*(ml|g|l|cl|oz|kg)\b/i);
    if (match) {
      return {
        value: parseFloat(match[1].replace(',', '.')),
        unit: match[2].toLowerCase(),
      };
    }
    return null;
  }
}

// ============================================
// MATCHING DE VARIANTES
// ============================================

/**
 * Normalise un volume pour la comparaison
 * "150 ml" → "150ml", "150ML" → "150ml", "0.15l" → "150ml"
 */
function normalizeVolume(volumeStr: string | null | undefined): string {
  if (!volumeStr) return '';
  let s = volumeStr.toLowerCase().replace(/\s+/g, '').replace(',', '.');
  // Conversions
  const match = s.match(/([\d.]+)(ml|g|l|cl|oz|kg)/);
  if (!match) return s;
  let val = parseFloat(match[1]);
  let unit = match[2];
  if (unit === 'l') { val *= 1000; unit = 'ml'; }
  if (unit === 'cl') { val *= 10; unit = 'ml'; }
  if (unit === 'kg') { val *= 1000; unit = 'g'; }
  return `${val}${unit}`;
}

/**
 * Cherche la variante qui correspond au volume du deal
 * Retourne la variante + si c'est un match exact
 */
function findMatchingVariant(
  variants: ProductVariant[],
  dealVolume: string | null | undefined
): { variant: ProductVariant | null; isExactMatch: boolean } {
  if (variants.length === 0) return { variant: null, isExactMatch: false };
  if (variants.length === 1) return { variant: variants[0], isExactMatch: true };
  if (!dealVolume) return { variant: variants[0], isExactMatch: false };

  const normalizedDeal = normalizeVolume(dealVolume);

  // Étape 1: Match exact normalisé
  for (const v of variants) {
    if (normalizeVolume(v.name) === normalizedDeal) {
      return { variant: v, isExactMatch: true };
    }
  }

  // Étape 2: Match par valeur numérique + unité
  const dealMatch = normalizedDeal.match(/([\d.]+)(ml|g)/);
  if (dealMatch) {
    const dealVal = parseFloat(dealMatch[1]);
    const dealUnit = dealMatch[2];
    for (const v of variants) {
      if (v.volumeValue === dealVal && v.volumeUnit === dealUnit) {
        return { variant: v, isExactMatch: true };
      }
    }
  }

  // Étape 3: Match par contenu (le nom de la variante contient le volume du deal)
  for (const v of variants) {
    const normV = normalizeVolume(v.name);
    if (normV.includes(normalizedDeal) || normalizedDeal.includes(normV)) {
      return { variant: v, isExactMatch: true };
    }
  }

  // Étape 4: Pas de match — retourner la première variante
  return { variant: variants[0], isExactMatch: false };
}

// ============================================
// VALIDATION D'UN DEAL
// ============================================

async function validateDeal(deal: any, scrapedInfo: ScrapedProductInfo | null): Promise<ValidationResult> {
  const result: ValidationResult = {
    dealId: deal.id,
    productName: deal.title || deal.product?.name || '',
    dealVolume: deal.volume,
    status: 'ERROR',
    message: '',
  };

  // Pas d'info scrapée → erreur ou page non trouvée
  if (!scrapedInfo) {
    result.status = 'NOT_FOUND';
    result.message = 'Impossible de scraper la page produit';
    return result;
  }

  // Produit plus en stock → mettre en PENDING (retenter plus tard)
  if (!scrapedInfo.inStock) {
    result.status = 'PENDING' as any;
    result.message = 'Produit plus en stock (retente au prochain run)';
    return result;
  }

  // Pas de prix trouvé → expirer
  if (scrapedInfo.currentPrice <= 0) {
    result.status = 'EXPIRED';
    result.message = 'Aucun prix trouvé sur la page';
    return result;
  }

  const variants = scrapedInfo.variants;

  // Pas de variantes → pas de prix trouvé
  if (variants.length === 0) {
    result.status = 'NOT_FOUND';
    result.message = 'Aucune variante/prix trouvé sur la page';
    return result;
  }

  // Trouver la variante qui correspond au deal
  const { variant: matchingVariant, isExactMatch } = findMatchingVariant(variants, deal.volume);

  if (!matchingVariant) {
    result.status = 'NOT_FOUND';
    result.message = 'Aucune variante correspondante trouvée';
    return result;
  }

  // CAS 1: La variante exacte est trouvée et en promo
  if (isExactMatch && (matchingVariant.isPromo || matchingVariant.currentPrice > 0)) {
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
      result.promoCode = scrapedInfo.promoCode;
      return result;
    }

    // Tout est OK
    result.status = 'VALID';
    result.message = `Prix validé: ${matchingVariant.currentPrice}€ (-${matchingVariant.discountPercent}%)`;
    result.promoCode = scrapedInfo.promoCode;
    return result;
  }

  // CAS 2: La variante exacte n'est PAS en promo OU n'existe pas
  // → Chercher une AUTRE variante en promo
  const promoVariants = variants.filter(v => v.isPromo);

  if (promoVariants.length > 0) {
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

  // CAS 3: Le produit est dispo mais sans promo identifiable
  // → On vérifie juste que le prix n'a pas changé
  if (matchingVariant.currentPrice > 0) {
    result.matchedVariant = matchingVariant;
    result.oldPrice = deal.dealPrice;
    result.newPrice = matchingVariant.currentPrice;

    const priceDiff = Math.abs(deal.dealPrice - matchingVariant.currentPrice);
    if (priceDiff > 0.05) {
      result.status = 'PRICE_CHANGED';
      result.message = `Prix changé (sans promo visible): ${deal.dealPrice}€ → ${matchingVariant.currentPrice}€`;
      return result;
    }

    result.status = 'VALID';
    result.message = `Prix validé: ${matchingVariant.currentPrice}€ (promo toujours active sur Notino)`;
    return result;
  }

  // CAS 4: Aucune promo du tout
  result.status = 'EXPIRED';
  result.message = 'Aucune promo disponible pour ce produit';
  return result;
}

// ============================================
// APPLICATION DES RÉSULTATS EN DB
// ============================================

async function applyValidationResult(result: ValidationResult): Promise<void> {
  const deal = await prisma.deal.findUnique({
    where: { id: result.dealId },
    include: { product: { include: { brandRef: true } } },
  });
  if (!deal) return;

  switch (result.status) {
    case 'EXPIRED':
      await prisma.deal.update({
        where: { id: result.dealId },
        data: {
          status: 'EXPIRED',
          updatedAt: new Date(),
        },
      });
      console.log(`    ⚡ Deal #${result.dealId} marqué expiré (${result.message})`);
      break;

    case 'VOLUME_CHANGED': {
      const newVariant = result.matchedVariant;
      if (newVariant) {
        const priceInfo = calculatePricePerUnit(newVariant.currentPrice, newVariant.name);
        const brandName = deal.product?.brandRef?.name || deal.product?.brand || '';

        await prisma.deal.update({
          where: { id: result.dealId },
          data: {
            volume: newVariant.name,
            dealPrice: newVariant.currentPrice,
            originalPrice: newVariant.originalPrice,
            discountPercent: newVariant.discountPercent,
            discountAmount: newVariant.originalPrice - newVariant.currentPrice,
            pricePerUnit: priceInfo?.pricePerUnit || deal.pricePerUnit,
            description: `${newVariant.discountPercent}% de réduction !`,
            title: `${brandName} -${newVariant.discountPercent}% : ${deal.product?.name?.substring(0, 100) || ''}`,
            status: 'ACTIVE',
            updatedAt: new Date(),
            lastSeenAt: new Date(),
          },
        });

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
    }

    case 'PRICE_CHANGED': {
      const matchingVariant = result.matchedVariant;
      if (matchingVariant) {
        const priceInfo = calculatePricePerUnit(matchingVariant.currentPrice, deal.volume);
        const brandName = deal.product?.brandRef?.name || deal.product?.brand || '';

        await prisma.deal.update({
          where: { id: result.dealId },
          data: {
            dealPrice: matchingVariant.currentPrice,
            originalPrice: matchingVariant.originalPrice,
            discountPercent: matchingVariant.discountPercent,
            discountAmount: matchingVariant.originalPrice - matchingVariant.currentPrice,
            pricePerUnit: priceInfo?.pricePerUnit || deal.pricePerUnit,
            description: `${matchingVariant.discountPercent}% de réduction !`,
            title: `${brandName} -${matchingVariant.discountPercent}% : ${deal.product?.name?.substring(0, 100) || ''}`,
            status: 'ACTIVE',
            updatedAt: new Date(),
            lastSeenAt: new Date(),
            ...(result.promoCode ? { promoCode: result.promoCode } : {}),
          },
        });

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
    }

    case 'VALID':
      await prisma.deal.update({
        where: { id: result.dealId },
        data: {
          status: 'ACTIVE',
          lastSeenAt: new Date(),
          ...(result.promoCode ? { promoCode: result.promoCode } : {}),
        },
      });

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

      console.log(`    ✅ Deal #${result.dealId} validé`);
      break;

    case 'PENDING':
      await prisma.deal.update({
        where: { id: result.dealId },
        data: {
          status: 'PENDING',
          updatedAt: new Date(),
        },
      });
      console.log(`    ⏳ Deal #${result.dealId} mis en PENDING (${result.message})`);
      break;

    case 'NOT_FOUND':
    case 'ERROR':
      await prisma.deal.delete({
        where: { id: result.dealId },
      });
      console.log(`    🗑️ Deal #${result.dealId} supprimé (${result.message})`);
      break;
  }
}

// ============================================
// MAIN
// ============================================

async function main() {
  const args = process.argv.slice(2);
  let limit = 10;
  let specificDealId: string | null = null;
  let headless = false;

  // Parser les arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1]);
    }
    if (args[i] === '--deal-id' && args[i + 1]) {
      specificDealId = args[i + 1];
    }
    if (args[i] === '--headless') {
      headless = true;
    }
  }

  console.log('🔍 Validation des deals Notino');
  console.log('================================');
  console.log(`Mode: ${headless ? 'headless' : 'visible (tu peux voir le navigateur)'}`);
  console.log('');

  // Récupérer le merchant Notino
  const merchant = await prisma.merchant.findFirst({ where: { slug: 'notino' } });
  if (!merchant) {
    console.log('❌ Merchant Notino non trouvé');
    return;
  }

  // Récupérer les deals à valider
  let deals;
  if (specificDealId) {
    deals = await prisma.deal.findMany({
      where: { id: specificDealId },
      include: { product: { include: { merchant: true, brandRef: true } } },
    });
  } else {
    deals = await prisma.deal.findMany({
      where: {
        product: { merchantId: merchant.id },
        status: { not: 'EXPIRED' },
      },
      include: { product: { include: { merchant: true, brandRef: true } } },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });
  }

  console.log(`📋 ${deals.length} deals à valider\n`);

  const scraper = new NotinoProductScraper(headless);
  await scraper.init();

  const results: ValidationResult[] = [];
  const stats = { valid: 0, priceChanged: 0, volumeChanged: 0, expired: 0, notFound: 0, error: 0 };

  for (const deal of deals) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`🏷️ Deal #${deal.id}: ${deal.title?.substring(0, 50)}...`);
    console.log(`   🔗 http://localhost:3000/deals/${deal.id}`);
    console.log(`   📦 Volume: ${deal.volume || 'N/A'}`);
    console.log(`   💵 Prix original: ${deal.originalPrice}€`);
    console.log(`   💰 Prix promo: ${deal.dealPrice}€`);
    console.log(`   📉 Réduction: -${deal.discountPercent}% (${deal.discountAmount}€ d'économie)`);
    if (deal.promoCode) {
      console.log(`   🎟️ Code promo: ${deal.promoCode}`);
    }

    const productUrl = deal.product?.productUrl;
    if (!productUrl) {
      console.log('   ❌ Pas d\'URL produit');
      stats.error++;
      continue;
    }

    // Scraper la page produit
    const scrapedInfo = await scraper.scrapeProductVariants(productUrl);

    if (scrapedInfo && scrapedInfo.variants.length > 0) {
      // Dédupliquer les variantes
      const uniqueVariants = scrapedInfo.variants.filter((v, i, arr) =>
        arr.findIndex(x => x.name === v.name && x.currentPrice === v.currentPrice) === i
      );

      console.log(`\n   📦 Variantes trouvées sur Notino:`);
      const { variant: matchingVariantForDisplay, isExactMatch } = findMatchingVariant(uniqueVariants, deal.volume);
      for (const v of uniqueVariants) {
        const isMatch = matchingVariantForDisplay && v.name === matchingVariantForDisplay.name;
        const matchTag = isMatch ? (isExactMatch ? ' ← DEAL ACTUEL' : '') : '';
        const promoIcon = v.isPromo ? '🏷️' : '  ';
        console.log(`      ${promoIcon} ${v.name}: ${v.originalPrice}€ → ${v.currentPrice}€ ${v.isPromo ? `(-${v.discountPercent}%)` : '(pas de promo visible)'}${matchTag}`);
      }

      // Afficher la comparaison
      if (matchingVariantForDisplay && isExactMatch) {
        console.log(`\n   🔄 COMPARAISON (${deal.volume}):`);
        console.log(`      En base:   ${deal.originalPrice}€ → ${deal.dealPrice}€ (-${deal.discountPercent}%)`);
        console.log(`      Notino:    ${matchingVariantForDisplay.originalPrice}€ → ${matchingVariantForDisplay.currentPrice}€ (-${matchingVariantForDisplay.discountPercent}%)`);

        if (Math.abs(deal.dealPrice - matchingVariantForDisplay.currentPrice) > 0.05) {
          console.log(`      💰 PRIX CHANGÉ`);
        } else {
          console.log(`      ✅ VALIDÉ`);
        }
      } else {
        const promoVariants = uniqueVariants.filter(v => v.isPromo);
        if (promoVariants.length > 0) {
          const bestPromo = promoVariants.reduce((best, curr) =>
            curr.discountPercent > best.discountPercent ? curr : best
          );
          console.log(`\n   🔄 CHANGEMENT DE VOLUME:`);
          console.log(`      ${deal.volume} n'est plus en promo`);
          console.log(`      → Promo disponible sur: ${bestPromo.name} à ${bestPromo.currentPrice}€ (-${bestPromo.discountPercent}%)`);
        } else {
          console.log(`\n   ⚡ Pas de promo clairement identifiable`);
        }
      }
    }

    // Valider le deal
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

    // Délai entre les requêtes (anti-bot)
    await new Promise(r => setTimeout(r, 2000));
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
  console.log(`\nTotal: ${deals.length} deals traités`);
}

main().catch(console.error);
