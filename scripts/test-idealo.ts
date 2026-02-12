/**
 * =============================================================================
 * TEST-IDEALO.TS - Test de scraping sur idealo.fr avec Playwright stealth
 * =============================================================================
 * Usage: npx tsx scripts/test-idealo.ts
 */

import { chromium, Browser, Page } from 'playwright';

const TARGET_URL = 'https://www.idealo.fr/prix/200512391/jean-paul-gaultier-le-male-eau-de-parfum-intense-200ml.html';

// ============================================================================
// STEALTH PAGE (copié de search-utils.ts, adapté pour headless: false)
// ============================================================================

async function createStealthPage(browser: Browser): Promise<Page> {
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    geolocation: { latitude: 48.8566, longitude: 2.3522 },
    permissions: ['geolocation'],
    extraHTTPHeaders: {
      'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'Sec-Ch-Ua': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
    }
  });

  const page = await context.newPage();

  // Scripts anti-détection
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    // @ts-ignore
    window.navigator.chrome = { runtime: {} };
    Object.defineProperty(navigator, 'plugins', {
      get: () => [
        { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
        { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
        { name: 'Native Client', filename: 'internal-nacl-plugin' },
      ],
    });
    Object.defineProperty(navigator, 'languages', { get: () => ['fr-FR', 'fr', 'en-US', 'en'] });
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });

    const originalQuery = window.navigator.permissions.query;
    // @ts-ignore
    window.navigator.permissions.query = (parameters: any) => (
      parameters.name === 'notifications'
        ? Promise.resolve({ state: Notification.permission })
        : originalQuery(parameters)
    );

    delete (window as any).__playwright;
    delete (window as any).__pw_manual;
    delete (window as any).__PW_inspect;

    Object.defineProperty(screen, 'width', { get: () => 1920 });
    Object.defineProperty(screen, 'height', { get: () => 1080 });
    Object.defineProperty(screen, 'availWidth', { get: () => 1920 });
    Object.defineProperty(screen, 'availHeight', { get: () => 1040 });
    Object.defineProperty(screen, 'colorDepth', { get: () => 24 });
    Object.defineProperty(screen, 'pixelDepth', { get: () => 24 });

    const getParameter = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function (parameter: number) {
      if (parameter === 37445) return 'Intel Inc.';
      if (parameter === 37446) return 'Intel Iris OpenGL Engine';
      return getParameter.call(this, parameter);
    };
  });

  return page;
}

// ============================================================================
// COOKIE CONSENT
// ============================================================================

async function handleCookieConsent(page: Page): Promise<void> {
  const selectors = [
    '#onetrust-accept-btn-handler',
    '[id*="accept"]',
    'button[class*="accept"]',
    '[data-testid*="accept"]',
    'button:has-text("Tout accepter")',
    'button:has-text("Accepter")',
    'button:has-text("Accept")',
    'button:has-text("Agree")',
    'button:has-text("OK")',
  ];

  for (const selector of selectors) {
    try {
      const btn = page.locator(selector).first();
      if (await btn.isVisible({ timeout: 1000 })) {
        await btn.click();
        console.log(`  ✅ Cookie consent cliqué: ${selector}`);
        await page.waitForTimeout(1000);
        return;
      }
    } catch { /* next */ }
  }
  console.log('  ℹ️  Pas de bannière cookie détectée');
}

// ============================================================================
// HUMAN-LIKE DELAYS
// ============================================================================

function randomDelay(min = 500, max = 2000): number {
  return Math.floor(Math.random() * (max - min) + min);
}

async function humanScroll(page: Page): Promise<void> {
  const scrolls = Math.floor(Math.random() * 3) + 2;
  for (let i = 0; i < scrolls; i++) {
    await page.mouse.wheel(0, Math.floor(Math.random() * 400) + 200);
    await page.waitForTimeout(randomDelay(300, 800));
  }
}

// ============================================================================
// EXTRACTION DES DONNÉES IDEALO
// ============================================================================

async function extractIdealoData(page: Page) {
  return page.evaluate(() => {
    // Nom du produit
    const titleEl = document.querySelector('h1, [data-testid="productTitle"], .oopStage-title');
    const productName = titleEl?.textContent?.trim() || null;

    // Prix principal (meilleur prix)
    const priceEl = document.querySelector(
      '[data-testid="productPrice"], .oopStage-conditionButton-price, .productOffers-listItemOfferPrice'
    );
    const priceText = priceEl?.textContent?.trim() || null;

    // Extraire tous les prix des marchands
    const offerElements = document.querySelectorAll(
      '.productOffers-listItem, [data-testid*="offer"], .resultList__item'
    );
    const offers: Array<{ merchant: string | null; price: string | null; shipping: string | null }> = [];
    offerElements.forEach(el => {
      const merchantEl = el.querySelector(
        '.productOffers-listItemOfferShopName, [data-testid*="shop"], .shopName, img[alt]'
      );
      const priceOfferEl = el.querySelector(
        '.productOffers-listItemOfferPrice, [data-testid*="price"]'
      );
      const shippingEl = el.querySelector(
        '.productOffers-listItemOfferShipping, [data-testid*="shipping"], [class*="delivery"]'
      );
      offers.push({
        merchant: merchantEl?.textContent?.trim() || merchantEl?.getAttribute('alt') || null,
        price: priceOfferEl?.textContent?.trim() || null,
        shipping: shippingEl?.textContent?.trim() || null,
      });
    });

    // Caractéristiques produit
    const specsEls = document.querySelectorAll(
      '.datasheet-list__element, [data-testid*="spec"], .productDatasheet tr'
    );
    const specs: Record<string, string> = {};
    specsEls.forEach(el => {
      const key = el.querySelector('dt, td:first-child, .datasheet-list__attribute')?.textContent?.trim();
      const val = el.querySelector('dd, td:last-child, .datasheet-list__value')?.textContent?.trim();
      if (key && val) specs[key] = val;
    });

    // Nombre total d'offres
    const offersCountEl = document.querySelector(
      '[data-testid*="offerCount"], .oopStage-numberOfOffers, .productOffers-header'
    );
    const offersCountText = offersCountEl?.textContent?.trim() || null;

    // Note / avis
    const ratingEl = document.querySelector(
      '[data-testid*="rating"], .oopStage-ratingValue, [class*="rating"]'
    );
    const rating = ratingEl?.textContent?.trim() || null;

    return { productName, priceText, offers, specs, offersCountText, rating };
  });
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('🚀 Test scraping idealo.fr');
  console.log(`   URL: ${TARGET_URL}\n`);

  const browser = await chromium.launch({
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--disable-dev-shm-usage',
      '--window-size=1920,1080',
    ],
  });

  let page: Page | null = null;

  try {
    page = await createStealthPage(browser);

    // 1. Navigation
    console.log('📡 Navigation vers idealo.fr...');
    const response = await page.goto(TARGET_URL, { 
      waitUntil: 'domcontentloaded', 
      timeout: 30000 
    });
    console.log(`   Status: ${response?.status()}`);
    console.log(`   URL finale: ${page.url()}\n`);

    // 2. Cookie consent
    console.log('🍪 Gestion des cookies...');
    await handleCookieConsent(page);

    // 3. Attente chargement + scroll humain
    console.log('\n⏳ Attente chargement complet...');
    await page.waitForTimeout(randomDelay(2000, 4000));
    await humanScroll(page);
    await page.waitForTimeout(randomDelay(1000, 2000));

    // 4. Screenshot
    await page.screenshot({ path: 'screenshots/idealo-test.png', fullPage: false });
    console.log('📸 Screenshot: screenshots/idealo-test.png\n');

    // 5. Extraction des données
    console.log('🔍 Extraction des données...');
    const data = await extractIdealoData(page);

    console.log('\n' + '='.repeat(70));
    console.log('📦 RÉSULTATS DU SCRAPING IDEALO');
    console.log('='.repeat(70));

    console.log(`\n🏷️  Produit: ${data.productName || '❌ Non trouvé'}`);
    console.log(`💰 Prix principal: ${data.priceText || '❌ Non trouvé'}`);
    console.log(`⭐ Note: ${data.rating || '❌ Non trouvée'}`);
    console.log(`📊 Nombre d'offres: ${data.offersCountText || '❌ Non trouvé'}`);

    if (data.offers.length > 0) {
      console.log(`\n🏪 OFFRES MARCHANDS (${data.offers.length} trouvées):`);
      console.log('-'.repeat(60));
      data.offers.slice(0, 15).forEach((offer, i) => {
        console.log(`  ${i + 1}. ${offer.merchant || '?'} — ${offer.price || '?'} ${offer.shipping ? `(${offer.shipping})` : ''}`);
      });
    } else {
      console.log('\n❌ Aucune offre marchand trouvée');
    }

    if (Object.keys(data.specs).length > 0) {
      console.log(`\n📋 CARACTÉRISTIQUES:`);
      console.log('-'.repeat(60));
      for (const [key, val] of Object.entries(data.specs)) {
        console.log(`  ${key}: ${val}`);
      }
    }

    // 6. Dump HTML brut si peu de résultats (debug)
    if (!data.productName && data.offers.length === 0) {
      console.log('\n⚠️  Peu de données extraites, dump du HTML pour debug...');
      const bodyText = await page.evaluate(() => document.body?.innerText?.substring(0, 3000) || '');
      console.log('\n--- BODY TEXT (3000 premiers chars) ---');
      console.log(bodyText);
      console.log('--- FIN ---');
    }

    console.log('\n' + '='.repeat(70));
    console.log('✅ Test terminé');
    console.log('='.repeat(70));

    // Laisser le navigateur ouvert 5 secondes pour voir
    await page.waitForTimeout(5000);

  } catch (err) {
    console.error('❌ Erreur:', err);
    if (page) {
      await page.screenshot({ path: 'screenshots/idealo-error.png', fullPage: false }).catch(() => {});
      console.log('📸 Screenshot erreur: screenshots/idealo-error.png');
    }
  } finally {
    await browser.close();
    console.log('\n🔒 Navigateur fermé');
  }
}

main();
