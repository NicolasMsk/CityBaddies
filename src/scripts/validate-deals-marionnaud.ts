/**
 * Script de validation des deals Marionnaud
 * 
 * Ce script vérifie que les prix des deals correspondent à la réalité sur Marionnaud.
 * Pour chaque deal, il:
 * 1. Scrape la page produit pour récupérer le prix et les infos promo
 * 2. Compare avec le deal en base
 * 3. Actions possibles:
 *    - Si plus de promo → deal status = EXPIRED
 *    - Si prix différent → update le prix + recalcul description
 *    - Si prix identique → deal validé ✓
 * 
 * Usage: npx tsx src/scripts/validate-deals-marionnaud.ts [--limit N] [--deal-id ID] [--headless]
 */

import { chromium, Browser, Page } from 'playwright';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient() as any;

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

// Type pour les données scrapées
interface ScrapedProductInfo {
  brand: string;
  range: string;
  name: string;
  fullTitle: string;
  currentPrice: number;
  originalPrice: number;
  discountPercent: number;
  pricePerUnit: string | null;
  variant: string | null;
  promoBadge: string | null;
  promoDuration: string | null;
  hasPromo: boolean;
  articleNumber: string | null;
  url: string;
  scrapedAt: Date;
}

// Résultat de la validation
interface ValidationResult {
  dealId: string;
  productName: string;
  dealVolume: string;
  status: 'VALID' | 'PRICE_CHANGED' | 'EXPIRED' | 'NOT_FOUND' | 'ERROR';
  oldPrice?: number;
  newPrice?: number;
  oldDiscount?: number;
  newDiscount?: number;
  message: string;
  scrapedInfo?: ScrapedProductInfo;
}

class MarionnaudProductScraper {
  private browser: Browser | null = null;
  private context: any = null;
  private headless: boolean;

  constructor(headless: boolean = true) {
    this.headless = headless;
  }

  async init() {
    console.log(`🌐 Lancement du navigateur (headless: ${this.headless})...`);
    this.browser = await chromium.launch({
      headless: this.headless,
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

    // Créer un context avec options anti-bot
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
      // @ts-ignore
      window.chrome = { runtime: {} };
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['fr-FR', 'fr', 'en-US', 'en'] });
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
   * Ferme les popups de cookies OneTrust
   */
  private async closeCookiePopup(page: Page) {
    try {
      await this.delay(1000);
      const cookieButton = await page.waitForSelector('#onetrust-accept-btn-handler', { timeout: 5000 });
      if (cookieButton) {
        console.log('  🍪 Fermeture popup cookies...');
        await cookieButton.click();
        await this.delay(1000);
      }
    } catch {
      // Pas de popup cookies
    }
  }

  /**
   * Parse un prix français (ex: "14,90 €" -> 14.90)
   */
  private parsePrice(priceStr: string): number {
    if (!priceStr) return 0;
    const cleaned = priceStr.replace(/[^\d,\.]/g, '').replace(',', '.');
    return parseFloat(cleaned) || 0;
  }

  /**
   * Scrape une page produit Marionnaud
   */
  async scrapeProduct(productUrl: string): Promise<ScrapedProductInfo | null> {
    if (!this.context) {
      console.error('  ❌ Navigateur non initialisé');
      return null;
    }

    const page = await this.context.newPage();

    try {
      console.log(`  📄 Chargement: ${productUrl}`);
      
      // Délai aléatoire avant navigation (1-3s)
      await this.delay(1000 + Math.random() * 2000);
      
      await page.goto(productUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      
      // Attendre que la page se charge
      await this.delay(3000);
      
      // Gérer les cookies
      await this.closeCookiePopup(page);
      
      // Attendre le contenu principal
      await page.waitForSelector('.product-details-title__text', { timeout: 10000 }).catch(() => null);
      
      // Extraire toutes les données
      const data = await page.evaluate(() => {
        // Titre complet (marque + gamme + nom)
        const brand = document.querySelector('e2-product-details-brand-link .product-details-brand-link__text-link span')?.textContent?.trim() || '';
        const range = document.querySelector('.product-details-range-name')?.textContent?.trim() || '';
        const name = document.querySelector('.product-details-title__text')?.textContent?.trim() || '';
        
        // Prix
        const currentPrice = document.querySelector('.price__default-value')?.textContent?.trim() || '';
        const originalPrice = document.querySelector('.price__was')?.textContent?.trim() || null;
        const pricePerUnit = document.querySelector('.price-per-unit__value')?.textContent?.trim() || null;
        
        // Variante (taille sélectionnée)
        const variant = document.querySelector('.product-carousel-variant__selected-option')?.textContent?.trim() || null;
        
        // Promo
        const promoBadge = document.querySelector('.promotion-badge')?.textContent?.trim() || null;
        const promoDuration = document.querySelector('e2-promotion-duration span')?.textContent?.trim() || null;
        
        // Numéro d'article
        const articleNumber = document.querySelector('.product-details-article-number')?.textContent?.replace("Numéro d'article", '')?.trim() || null;
        
        // Vérifier si le produit est en promo (a un originalPrice ou un promoBadge)
        const hasPromo = !!(originalPrice || promoBadge);
        
        return {
          brand,
          range,
          name,
          fullTitle: `${brand} ${range} ${name}`.replace(/\s+/g, ' ').trim(),
          currentPrice,
          originalPrice,
          pricePerUnit,
          variant,
          promoBadge,
          promoDuration,
          articleNumber,
          hasPromo,
        };
      });
      
      const currentPrice = this.parsePrice(data.currentPrice);
      const originalPrice = data.originalPrice ? this.parsePrice(data.originalPrice) : currentPrice;
      const discountPercent = originalPrice > 0 && currentPrice < originalPrice 
        ? Math.round((1 - currentPrice / originalPrice) * 100) 
        : 0;
      
      await page.close();
      
      return {
        brand: data.brand,
        range: data.range,
        name: data.name,
        fullTitle: data.fullTitle,
        currentPrice,
        originalPrice,
        discountPercent,
        pricePerUnit: data.pricePerUnit,
        variant: data.variant,
        promoBadge: data.promoBadge,
        promoDuration: data.promoDuration,
        hasPromo: data.hasPromo,
        articleNumber: data.articleNumber,
        url: productUrl,
        scrapedAt: new Date(),
      };
      
    } catch (error) {
      console.error(`  ❌ Erreur scraping: ${error}`);
      await page.close();
      return null;
    }
  }
}

/**
 * Valide un deal contre les données scrapées
 */
function validateDeal(deal: any, scrapedInfo: ScrapedProductInfo | null): ValidationResult {
  const baseResult: ValidationResult = {
    dealId: deal.id,
    productName: deal.title || '',
    dealVolume: deal.volume || '',
    status: 'ERROR',
    message: '',
    scrapedInfo: scrapedInfo || undefined,
  };

  if (!scrapedInfo) {
    return { ...baseResult, status: 'NOT_FOUND', message: 'Produit non trouvé ou erreur de scraping' };
  }

  // Vérifier si le produit est toujours en promo
  if (!scrapedInfo.hasPromo) {
    return {
      ...baseResult,
      status: 'EXPIRED',
      message: 'Plus de promo disponible',
    };
  }

  // Comparer les prix
  const priceDiff = Math.abs(deal.dealPrice - scrapedInfo.currentPrice);
  
  if (priceDiff > 0.05) {
    // Prix a changé
    return {
      ...baseResult,
      status: 'PRICE_CHANGED',
      oldPrice: deal.dealPrice,
      newPrice: scrapedInfo.currentPrice,
      oldDiscount: deal.discountPercent,
      newDiscount: scrapedInfo.discountPercent,
      message: `Prix changé: ${deal.dealPrice}€ → ${scrapedInfo.currentPrice}€`,
    };
  } else {
    // Prix identique, deal validé
    return {
      ...baseResult,
      status: 'VALID',
      message: 'Prix vérifié ✓',
    };
  }
}

/**
 * Applique le résultat de la validation dans la base de données
 */
async function applyValidationResult(result: ValidationResult, deal: any) {
  switch (result.status) {
    case 'EXPIRED':
      await prisma.deal.update({
        where: { id: result.dealId },
        data: {
          status: 'EXPIRED',
          updatedAt: new Date(),
        },
      });
      console.log(`    ⚡ Deal #${result.dealId} marqué expiré (plus de promo)`);
      break;

    case 'PRICE_CHANGED':
      const scrapedInfo = result.scrapedInfo;
      if (scrapedInfo) {
        const priceInfo = calculatePricePerUnit(scrapedInfo.currentPrice, scrapedInfo.variant || deal.volume);
        const brandName = deal.product?.brandRef?.name || deal.product?.brand || scrapedInfo.brand || '';

        await prisma.deal.update({
          where: { id: result.dealId },
          data: {
            dealPrice: scrapedInfo.currentPrice,
            originalPrice: scrapedInfo.originalPrice,
            discountPercent: scrapedInfo.discountPercent,
            discountAmount: scrapedInfo.originalPrice - scrapedInfo.currentPrice,
            pricePerUnit: priceInfo?.pricePerUnit || deal.pricePerUnit,
            description: `${scrapedInfo.discountPercent}% de réduction !`,
            title: `${brandName} -${scrapedInfo.discountPercent}% : ${deal.product?.name?.substring(0, 100) || ''}`,
            status: 'ACTIVE',
            updatedAt: new Date(),
            lastSeenAt: new Date(),
          },
        });

        // Enregistrer dans l'historique des prix
        if (priceInfo) {
          await prisma.priceHistory.create({
            data: {
              productId: deal.productId,
              price: scrapedInfo.currentPrice,
              volumeValue: priceInfo.volumeValue,
              volumeUnit: priceInfo.volumeUnit,
              volumeRaw: scrapedInfo.variant || deal.volume,
              date: new Date(),
            },
          });
        }

        console.log(`    💰 Deal #${result.dealId} prix mis à jour: ${deal.dealPrice}€ → ${scrapedInfo.currentPrice}€`);
      }
      break;

    case 'VALID':
      await prisma.deal.update({
        where: { id: result.dealId },
        data: {
          status: 'ACTIVE',
          lastSeenAt: new Date(),
        },
      });

      // Enregistrer dans l'historique
      const info = result.scrapedInfo;
      if (info) {
        const priceInfo = calculatePricePerUnit(info.currentPrice, info.variant || deal.volume);
        if (priceInfo) {
          await prisma.priceHistory.create({
            data: {
              productId: deal.productId,
              price: info.currentPrice,
              volumeValue: priceInfo.volumeValue,
              volumeUnit: priceInfo.volumeUnit,
              volumeRaw: info.variant || deal.volume,
              date: new Date(),
            },
          });
        }
      }

      console.log(`    ✅ Deal #${result.dealId} validé`);
      break;

    case 'NOT_FOUND':
      // Produit non trouvé (404) → marquer comme expiré par précaution
      await prisma.deal.update({
        where: { id: result.dealId },
        data: {
          status: 'EXPIRED',
          updatedAt: new Date(),
        },
      });
      console.log(`    ❓ Deal #${result.dealId} marqué expiré (produit non trouvé)`);
      break;

    case 'ERROR':
      console.log(`    ❌ Deal #${result.dealId}: ${result.message}`);
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
  let headless = true;

  // Parser les arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1]);
    }
    if (args[i] === '--deal-id' && args[i + 1]) {
      specificDealId = args[i + 1];
    }
    if (args[i] === '--no-headless' || args[i] === '--visible') {
      headless = false;
    }
  }

  console.log('🔍 Validation des deals Marionnaud');
  console.log('==================================');
  console.log(`Mode: Playwright (headless: ${headless})`);
  console.log('');

  // Récupérer le merchant Marionnaud
  const merchant = await prisma.merchant.findFirst({ where: { slug: 'marionnaud' } });
  if (!merchant) {
    console.log('❌ Merchant Marionnaud non trouvé');
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
        status: { not: 'EXPIRED' },  // PENDING et ACTIVE
      },
      include: { product: { include: { merchant: true, brandRef: true } } },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });
  }

  console.log(`📋 ${deals.length} deals à valider\n`);

  if (deals.length === 0) {
    console.log('Aucun deal à valider.');
    return;
  }

  // Initialiser le scraper
  const scraper = new MarionnaudProductScraper(headless);
  await scraper.init();

  const stats = { valid: 0, priceChanged: 0, expired: 0, notFound: 0, error: 0 };

  try {
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
      const scrapedInfo = await scraper.scrapeProduct(productUrl);
      
      if (scrapedInfo) {
        console.log(`\n   📊 Données scrapées:`);
        console.log(`      🏷️ ${scrapedInfo.fullTitle}`);
        console.log(`      💵 Prix: ${scrapedInfo.currentPrice}€${scrapedInfo.hasPromo ? ` (${scrapedInfo.originalPrice}€ barré)` : ''}`);
        console.log(`      📉 Réduction: ${scrapedInfo.hasPromo ? `-${scrapedInfo.discountPercent}%` : 'Aucune'}`);
        console.log(`      📦 Variante: ${scrapedInfo.variant || 'N/A'}`);
        if (scrapedInfo.promoBadge) {
          console.log(`      🎫 Badge promo: ${scrapedInfo.promoBadge}`);
        }
      }

      // Valider le deal
      const validationResult = validateDeal(deal, scrapedInfo);

      // Appliquer les changements
      await applyValidationResult(validationResult, deal);

      // Mettre à jour les stats
      switch (validationResult.status) {
        case 'VALID': stats.valid++; break;
        case 'PRICE_CHANGED': stats.priceChanged++; break;
        case 'EXPIRED': stats.expired++; break;
        case 'NOT_FOUND': stats.notFound++; break;
        case 'ERROR': stats.error++; break;
      }

      // Délai entre les requêtes
      await new Promise(r => setTimeout(r, 1500));
    }
  } finally {
    await scraper.close();
    await prisma.$disconnect();
  }

  // Résumé
  console.log('\n' + '═'.repeat(60));
  console.log('📊 RÉSUMÉ');
  console.log('═'.repeat(60));
  console.log(`✅ Validés:           ${stats.valid}`);
  console.log(`💰 Prix changés:      ${stats.priceChanged}`);
  console.log(`⚡ Expirés:           ${stats.expired}`);
  console.log(`❓ Non trouvés:       ${stats.notFound}`);
  console.log(`❌ Erreurs:           ${stats.error}`);
  console.log(`\nTotal: ${deals.length} deals traités`);
}

main().catch(console.error);
