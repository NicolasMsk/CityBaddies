/**
 * =============================================================================
 * Cloud Job: Validation des deals Notino
 * =============================================================================
 * 
 * Ce script vérifie que les prix des deals Notino correspondent à la réalité.
 * Conçu pour tourner dans Cloud Run Jobs (headless, Playwright).
 * 
 * Pour chaque deal non-expiré de Notino, il:
 * 1. Ouvre la page produit sur Notino (Playwright anti-Cloudflare)
 * 2. Extrait le prix actuel, prix code promo, variantes de volume
 * 3. Compare avec le deal en base
 * 4. Actions: EXPIRED / PRICE_CHANGED / VOLUME_CHANGED / VALID
 * =============================================================================
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { PrismaClient } from '@prisma/client';

// ============================================
// UTILITY: calculatePricePerUnit (inline pour cloud job)
// ============================================

function calculatePricePerUnit(price: number, volumeStr: string | null | undefined): { pricePerUnit: number; volumeValue: number; volumeUnit: string } | null {
  if (!volumeStr) return null;
  const match = volumeStr.toLowerCase().trim().match(/(\d+(?:[.,]\d+)?)\s*(ml|l|cl|g|gr|gramme|grammes|kg|oz|fl\.?\s*oz)/i);
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

// ============================================
// TYPES
// ============================================

interface ProductVariant {
  name: string;
  volume: string;
  volumeValue: number;
  volumeUnit: string;
  currentPrice: number;
  originalPrice: number;
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

  async init(): Promise<void> {
    this.browser = await chromium.launch({
      headless: true,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process',
      ],
    });
    console.log('🌐 Navigateur lancé (headless - Cloud Run)');
  }

  async close(): Promise<void> {
    if (this.browser) await this.browser.close();
    this.browser = null;
  }

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

      // ===== EXTRACTION =====
      const data = await page.evaluate(() => {
        const result: any = {
          brand: '', name: '', description: '',
          currentPrice: 0, priceWithCode: null, promoCode: null,
          originalPrice: 0, discountPercent: 0, isPromo: false,
          volume: null, inStock: false, variants: [],
        };

        // Titre
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

        // Prix principal (dans #pdSelectedVariant)
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
          // Volume de la variante sélectionnée
          const spans = selectedVariantArea.querySelectorAll('span');
          for (const span of spans) {
            const text = span.textContent?.trim() || '';
            if (/^\d+(?:[,.]\d+)?\s*(ml|g|l|cl|oz|kg)$/i.test(text)) { result.volume = text; break; }
          }
        }
        // Fallback prix
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

        // Product specifications (stock, code promo)
        const specsEl = document.querySelector('[data-testid="product-specifications"]');
        if (specsEl) {
          const specsText = specsEl.textContent || '';
          if (/en stock/i.test(specsText)) result.inStock = true;
          const specsCodeMatch = specsText.match(/Code\s*:\s*(\w+)/i);
          if (specsCodeMatch) result.promoCode = specsCodeMatch[1];
        }

        // Prix avec code promo
        const pageText = document.body.innerText;
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
          if (codePriceMatch) result.priceWithCode = parseFloat(codePriceMatch[1].replace(',', '.'));
        }

        // Prix barré
        const allSpans = document.querySelectorAll('span');
        for (const span of allSpans) {
          const style = window.getComputedStyle(span);
          if (style.textDecoration.includes('line-through')) {
            const text = span.textContent?.trim() || '';
            const barredMatch = text.match(/([\d]+[,.][\d]+)/);
            if (barredMatch) {
              const barredPrice = parseFloat(barredMatch[1].replace(',', '.'));
              if (barredPrice > result.currentPrice) result.originalPrice = barredPrice;
            }
          }
        }

        // % réduction
        const discountMatch = pageText.match(/(-\s*\d+)\s*%/);
        if (discountMatch) {
          result.discountPercent = Math.abs(parseInt(discountMatch[1].replace(/\s/g, '')));
          result.isPromo = true;
        }
        if (!result.discountPercent && result.originalPrice > result.currentPrice) {
          result.discountPercent = Math.round((1 - result.currentPrice / result.originalPrice) * 100);
          result.isPromo = true;
        }

        // Volume (fallback si pas trouvé dans #pdSelectedVariant)
        if (!result.volume) {
          const selectedLink = document.querySelector('a.pd-variant-selected .pd-variant-label');
          if (selectedLink) result.volume = selectedLink.textContent?.trim() || null;
        }
        if (!result.volume) {
          const headerArea = document.querySelector('[data-testid="pd-header-title"]')?.parentElement?.parentElement;
          if (headerArea) {
            const spans = headerArea.querySelectorAll('span');
            for (const span of spans) {
              const text = span.textContent?.trim() || '';
              if (/^\d+(?:[,.]\d+)?\s*(ml|g|l|cl|oz|kg)$/i.test(text)) { result.volume = text; break; }
            }
          }
        }

        // Variantes de volume — <a data-testid="pd-variant-XXXXX"> dans des <li>
        const variantLinks = document.querySelectorAll('a[data-testid^="pd-variant-"]');
        for (const link of variantLinks) {
          const isColorPicker = link.closest('[data-testid="pd-variants-color-picker"]');
          if (isColorPicker) continue;
          const labelEl = link.querySelector('.pd-variant-label');
          const variantName = labelEl?.textContent?.trim() || '';
          if (!/\d+(?:[,.]\d+)?\s*(ml|g|l|cl|oz|kg)/i.test(variantName)) continue;
          let variantPrice = 0;
          const vpw = link.querySelector('[data-testid="pd-price-wrapper"]');
          if (vpw) {
            const pSpan = vpw.querySelector('span[content]');
            if (pSpan) variantPrice = parseFloat(pSpan.getAttribute('content')?.replace(',', '.') || '0');
          }
          const variantHref = link.getAttribute('href') || '';
          const variantUrl = variantHref ? `https://www.notino.fr${variantHref}` : '';
          const isSelected = link.classList.contains('pd-variant-selected');
          result.variants.push({ name: variantName, currentPrice: variantPrice, originalPrice: variantPrice, discountPercent: 0, isPromo: false, isSelected, url: variantUrl });
        }

        // Stock (déjà détecté via product-specifications, sinon fallback)
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

      // Build result
      const variants: ProductVariant[] = data.variants.map((v: any) => {
        const parsed = this.parseVolume(v.name);
        return {
          name: v.name, volume: v.name,
          volumeValue: parsed?.value || 0, volumeUnit: parsed?.unit || '',
          currentPrice: v.currentPrice, originalPrice: v.originalPrice,
          discountPercent: v.discountPercent, isPromo: v.isPromo,
          isSelected: v.isSelected, url: v.url,
        };
      });

      if (variants.length === 0 && data.currentPrice > 0) {
        const parsed = this.parseVolume(data.volume || '');
        variants.push({
          name: data.volume || 'Standard', volume: data.volume || 'Standard',
          volumeValue: parsed?.value || 0, volumeUnit: parsed?.unit || '',
          currentPrice: data.priceWithCode || data.currentPrice, originalPrice: data.originalPrice,
          discountPercent: data.discountPercent, isPromo: data.isPromo,
          isSelected: true, url,
        });
      }

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
        brand: data.brand, name: data.name, fullTitle,
        currentPrice: data.currentPrice, priceWithCode: data.priceWithCode,
        promoCode: data.promoCode, originalPrice: data.originalPrice,
        discountPercent: data.discountPercent, isPromo: data.isPromo,
        volume: data.volume, variants, inStock: data.inStock,
        url, scrapedAt: new Date(),
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
    if (match) return { value: parseFloat(match[1].replace(',', '.')), unit: match[2].toLowerCase() };
    return null;
  }
}

// ============================================
// MATCHING
// ============================================

function normalizeVolume(volumeStr: string | null | undefined): string {
  if (!volumeStr) return '';
  let s = volumeStr.toLowerCase().replace(/\s+/g, '').replace(',', '.');
  const match = s.match(/([\d.]+)(ml|g|l|cl|oz|kg)/);
  if (!match) return s;
  let val = parseFloat(match[1]);
  let unit = match[2];
  if (unit === 'l') { val *= 1000; unit = 'ml'; }
  if (unit === 'cl') { val *= 10; unit = 'ml'; }
  if (unit === 'kg') { val *= 1000; unit = 'g'; }
  return `${val}${unit}`;
}

function findMatchingVariant(
  variants: ProductVariant[],
  dealVolume: string | null | undefined
): { variant: ProductVariant | null; isExactMatch: boolean } {
  if (variants.length === 0) return { variant: null, isExactMatch: false };
  if (variants.length === 1) return { variant: variants[0], isExactMatch: true };
  if (!dealVolume) return { variant: variants[0], isExactMatch: false };

  const normalizedDeal = normalizeVolume(dealVolume);

  for (const v of variants) {
    if (normalizeVolume(v.name) === normalizedDeal) return { variant: v, isExactMatch: true };
  }

  const dealMatch = normalizedDeal.match(/([\d.]+)(ml|g)/);
  if (dealMatch) {
    const dealVal = parseFloat(dealMatch[1]);
    const dealUnit = dealMatch[2];
    for (const v of variants) {
      if (v.volumeValue === dealVal && v.volumeUnit === dealUnit) return { variant: v, isExactMatch: true };
    }
  }

  for (const v of variants) {
    const normV = normalizeVolume(v.name);
    if (normV.includes(normalizedDeal) || normalizedDeal.includes(normV)) return { variant: v, isExactMatch: true };
  }

  return { variant: variants[0], isExactMatch: false };
}

// ============================================
// VALIDATION
// ============================================

async function validateDeal(deal: any, scrapedInfo: ScrapedProductInfo | null): Promise<ValidationResult> {
  const result: ValidationResult = {
    dealId: deal.id,
    productName: deal.title || deal.product?.name || '',
    dealVolume: deal.volume,
    status: 'ERROR',
    message: '',
  };

  if (!scrapedInfo) { result.status = 'NOT_FOUND'; result.message = 'Impossible de scraper la page produit'; return result; }
  if (!scrapedInfo.inStock) { result.status = 'PENDING' as any; result.message = 'Produit plus en stock (retente au prochain run)'; return result; }
  if (scrapedInfo.currentPrice <= 0) { result.status = 'EXPIRED'; result.message = 'Aucun prix trouvé sur la page'; return result; }

  const variants = scrapedInfo.variants;
  if (variants.length === 0) { result.status = 'NOT_FOUND'; result.message = 'Aucune variante/prix trouvé'; return result; }

  const { variant: matchingVariant, isExactMatch } = findMatchingVariant(variants, deal.volume);
  if (!matchingVariant) { result.status = 'NOT_FOUND'; result.message = 'Aucune variante correspondante'; return result; }

  // CAS 1: Variante exacte trouvée
  if (isExactMatch && (matchingVariant.isPromo || matchingVariant.currentPrice > 0)) {
    result.matchedVariant = matchingVariant;
    result.oldPrice = deal.dealPrice;
    result.newPrice = matchingVariant.currentPrice;
    result.oldDiscount = deal.discountPercent;
    result.newDiscount = matchingVariant.discountPercent;

    const priceDiff = Math.abs(deal.dealPrice - matchingVariant.currentPrice);
    if (priceDiff > 0.05) {
      result.status = 'PRICE_CHANGED';
      result.message = `Prix changé: ${deal.dealPrice}€ → ${matchingVariant.currentPrice}€`;
      return result;
    }
    result.status = 'VALID';
    result.message = `Prix validé: ${matchingVariant.currentPrice}€`;
    return result;
  }

  // CAS 2: Autre variante en promo
  const promoVariants = variants.filter(v => v.isPromo);
  if (promoVariants.length > 0) {
    const bestPromo = promoVariants.reduce((best, curr) => curr.discountPercent > best.discountPercent ? curr : best);
    result.matchedVariant = bestPromo;
    result.oldPrice = deal.dealPrice; result.newPrice = bestPromo.currentPrice;
    result.oldDiscount = deal.discountPercent; result.newDiscount = bestPromo.discountPercent;
    result.oldVolume = deal.volume; result.newVolume = bestPromo.name;
    result.status = 'VOLUME_CHANGED';
    result.message = `Promo sur ${bestPromo.name}: ${bestPromo.currentPrice}€ (-${bestPromo.discountPercent}%)`;
    return result;
  }

  // CAS 3: Prix dispo mais sans promo identifiable
  if (matchingVariant.currentPrice > 0) {
    result.matchedVariant = matchingVariant;
    result.oldPrice = deal.dealPrice; result.newPrice = matchingVariant.currentPrice;
    const priceDiff = Math.abs(deal.dealPrice - matchingVariant.currentPrice);
    if (priceDiff > 0.05) {
      result.status = 'PRICE_CHANGED';
      result.message = `Prix changé (sans promo visible): ${deal.dealPrice}€ → ${matchingVariant.currentPrice}€`;
      result.promoCode = scrapedInfo.promoCode;
      return result;
    }
    result.status = 'VALID';
    result.message = `Prix validé: ${matchingVariant.currentPrice}€ (promo toujours active)`;
    result.promoCode = scrapedInfo.promoCode;
    return result;
  }

  result.status = 'EXPIRED';
  result.message = 'Aucune promo disponible';
  return result;
}

// ============================================
// APPLICATION EN DB
// ============================================

async function applyValidationResult(result: ValidationResult): Promise<void> {
  const deal = await prisma.deal.findUnique({
    where: { id: result.dealId },
    include: { product: { include: { brandRef: true } } },
  });
  if (!deal) return;

  switch (result.status) {
    case 'EXPIRED':
      await prisma.deal.update({ where: { id: result.dealId }, data: { status: 'EXPIRED', updatedAt: new Date() } });
      console.log(`    ⚡ Deal ${result.dealId} expiré`);
      break;

    case 'VOLUME_CHANGED': {
      const v = result.matchedVariant;
      if (v) {
        const priceInfo = calculatePricePerUnit(v.currentPrice, v.name);
        const brandName = deal.product?.brandRef?.name || deal.product?.brand || '';
        await prisma.deal.update({
          where: { id: result.dealId },
          data: {
            volume: v.name, dealPrice: v.currentPrice, originalPrice: v.originalPrice,
            discountPercent: v.discountPercent, discountAmount: v.originalPrice - v.currentPrice,
            pricePerUnit: priceInfo?.pricePerUnit || deal.pricePerUnit,
            description: `${v.discountPercent}% de réduction !`,
            title: `${brandName} -${v.discountPercent}% : ${deal.product?.name?.substring(0, 100) || ''}`,
            status: 'ACTIVE', updatedAt: new Date(), lastSeenAt: new Date(),
          },
        });
        await prisma.priceHistory.create({
          data: { productId: deal.productId, price: v.currentPrice, volumeValue: v.volumeValue, volumeUnit: v.volumeUnit, volumeRaw: v.name, date: new Date() },
        });
        console.log(`    🔄 Deal ${result.dealId} volume: ${result.oldVolume} → ${v.name} (${v.currentPrice}€)`);
      }
      break;
    }

    case 'PRICE_CHANGED': {
      const v = result.matchedVariant;
      if (v) {
        const priceInfo = calculatePricePerUnit(v.currentPrice, deal.volume);
        const brandName = deal.product?.brandRef?.name || deal.product?.brand || '';
        await prisma.deal.update({
          where: { id: result.dealId },
          data: {
            dealPrice: v.currentPrice, originalPrice: v.originalPrice,
            discountPercent: v.discountPercent, discountAmount: v.originalPrice - v.currentPrice,
            pricePerUnit: priceInfo?.pricePerUnit || deal.pricePerUnit,
            description: `${v.discountPercent}% de réduction !`,
            title: `${brandName} -${v.discountPercent}% : ${deal.product?.name?.substring(0, 100) || ''}`,
            status: 'ACTIVE', updatedAt: new Date(), lastSeenAt: new Date(),
            ...(result.promoCode ? { promoCode: result.promoCode } : {}),
          },
        });
        await prisma.priceHistory.create({
          data: { productId: deal.productId, price: v.currentPrice, volumeValue: v.volumeValue, volumeUnit: v.volumeUnit, volumeRaw: v.name, date: new Date() },
        });
        console.log(`    💰 Deal ${result.dealId} prix: ${deal.dealPrice}€ → ${v.currentPrice}€`);
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
          data: { productId: deal.productId, price: result.matchedVariant.currentPrice, volumeValue: result.matchedVariant.volumeValue, volumeUnit: result.matchedVariant.volumeUnit, volumeRaw: result.matchedVariant.name, date: new Date() },
        });
      }
      console.log(`    ✅ Deal ${result.dealId} validé`);
      break;

    case 'PENDING':
      await prisma.deal.update({
        where: { id: result.dealId },
        data: { status: 'PENDING', updatedAt: new Date() },
      });
      console.log(`    ⏳ Deal ${result.dealId} mis en PENDING (${result.message})`);
      break;

    case 'NOT_FOUND':
    case 'ERROR':
      await prisma.deal.delete({ where: { id: result.dealId } });
      console.log(`    🗑️ Deal ${result.dealId} supprimé (${result.message})`);
      break;
  }
}

// ============================================
// MAIN (Cloud Job)
// ============================================

async function main() {
  const limit = parseInt(process.env.VALIDATE_LIMIT || '50');

  console.log('🔍 [Cloud Job] Validation des deals Notino');
  console.log('=============================================');
  console.log(`Limite: ${limit} deals`);

  const merchant = await prisma.merchant.findFirst({ where: { slug: 'notino' } });
  if (!merchant) { console.log('❌ Merchant Notino non trouvé'); return; }

  const deals = await prisma.deal.findMany({
    where: {
      product: { merchantId: merchant.id },
      status: { not: 'EXPIRED' },
    },
    include: { product: { include: { merchant: true, brandRef: true } } },
    orderBy: { lastSeenAt: 'asc' }, // Les plus anciens d'abord
    take: limit,
  });

  console.log(`📋 ${deals.length} deals à valider\n`);

  if (deals.length === 0) {
    console.log('✅ Aucun deal à valider');
    await prisma.$disconnect();
    return;
  }

  const scraper = new NotinoProductScraper();
  await scraper.init();

  const stats = { valid: 0, priceChanged: 0, volumeChanged: 0, expired: 0, notFound: 0, error: 0 };

  for (const deal of deals) {
    console.log(`\n${'─'.repeat(50)}`);
    console.log(`🏷️ Deal ${deal.id}: ${deal.title?.substring(0, 60)}`);
    console.log(`   Volume: ${deal.volume || 'N/A'} | Prix: ${deal.dealPrice}€ (-${deal.discountPercent}%)`);

    const productUrl = deal.product?.productUrl;
    if (!productUrl) { console.log('   ❌ Pas d\'URL'); stats.error++; continue; }

    const scrapedInfo = await scraper.scrapeProductVariants(productUrl);

    if (scrapedInfo) {
      scrapedInfo.variants = scrapedInfo.variants.filter((v, i, arr) =>
        arr.findIndex(x => x.name === v.name && x.currentPrice === v.currentPrice) === i
      );
    }

    const validationResult = await validateDeal(deal, scrapedInfo);
    await applyValidationResult(validationResult);

    switch (validationResult.status) {
      case 'VALID': stats.valid++; break;
      case 'PRICE_CHANGED': stats.priceChanged++; break;
      case 'VOLUME_CHANGED': stats.volumeChanged++; break;
      case 'EXPIRED': stats.expired++; break;
      case 'NOT_FOUND': stats.notFound++; break;
      case 'ERROR': stats.error++; break;
    }

    await new Promise(r => setTimeout(r, 2000));
  }

  await scraper.close();
  await prisma.$disconnect();

  console.log('\n' + '═'.repeat(50));
  console.log('📊 RÉSUMÉ');
  console.log('═'.repeat(50));
  console.log(`✅ Validés:       ${stats.valid}`);
  console.log(`💰 Prix changés:  ${stats.priceChanged}`);
  console.log(`🔄 Volume changé: ${stats.volumeChanged}`);
  console.log(`⚡ Expirés:       ${stats.expired}`);
  console.log(`❓ Non trouvés:   ${stats.notFound}`);
  console.log(`❌ Erreurs:       ${stats.error}`);
  console.log(`\nTotal: ${deals.length} deals traités`);
}

main().catch(err => {
  console.error('❌ Erreur fatale:', err);
  process.exit(1);
});
