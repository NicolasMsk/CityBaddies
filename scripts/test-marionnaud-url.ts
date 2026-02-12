import 'dotenv/config';
import {
  getBrowser,
  createStealthPage,
  closePage,
  closeBrowser,
  simulateHumanBehavior,
} from '../src/lib/scraping/search-utils';
import { Page } from 'playwright';

const url = process.argv[2] || 'https://www.marionnaud.fr/homme/parfum-homme/eau-de-parfum/la-nuit-de-lhomme-le-parfum-eau-de-parfum-yves-saint-laurent/p/BP_100167369?varSel=100167377';

// ── Helpers ──────────────────────────────────────────────────────────

function parsePrice(text: string): number {
  const clean = (text || '').replace(/\u00a0/g, ' ');
  const m = clean.match(/(\d+[,.]\d{2})/);
  return m ? parseFloat(m[1].replace(',', '.')) : 0;
}

/** Extraire le base URL sans varSel */
function getBaseUrl(u: string): string {
  return u.replace(/[?&]varSel=\d+/, '');
}

/** Construire l'URL avec un varSel donné */
function buildVariantUrl(baseUrl: string, varSel: string): string {
  return `${baseUrl}?varSel=${varSel}`;
}

async function readPriceBlock(page: Page) {
  return page.evaluate(() => {
    const container = document.querySelector('e2core-price.product-add-to-cart__price-depiction') ||
                      document.querySelector('.product-add-to-cart__price-container');
    if (!container) return { currentPrice: '', originalPrice: '', isDiscounted: false, perUnit: '' };

    const defaultVal = container.querySelector('.price__default-value');
    const currentPrice = defaultVal?.textContent?.trim() || '';

    const wasSelectors = ['.price__was', '.price__previous-value', '.price__strike-through', '.price__standard-value', '.price__old'];
    let originalPrice = '';
    for (const sel of wasSelectors) {
      const el = container.querySelector(sel);
      if (el) { originalPrice = el.textContent?.trim() || ''; break; }
    }

    const isDiscounted = container.classList?.contains('price--discounted') ||
                         container.closest('e2core-price')?.classList?.contains('price--discounted') || false;

    const perUnit = container.querySelector('.price-per-unit__value')?.textContent?.trim() || '';

    return { currentPrice, originalPrice, isDiscounted, perUnit };
  });
}

async function readSelectedVolume(page: Page): Promise<string> {
  return page.$eval('.product-carousel-variant__selected-option', (el: Element) => el.textContent?.trim() || '')
    .catch(() => '');
}

async function readArticleNumber(page: Page): Promise<string> {
  return page.$eval('.product-add-to-cart__article-number', (el: Element) => el.textContent?.trim() || '')
    .catch(() => '');
}

async function dismissPopups(page: Page) {
  const cookieBtn = page.locator('#onetrust-accept-btn-handler');
  if (await cookieBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await cookieBtn.click();
    await page.waitForTimeout(500);
    console.log('  🍪 Cookie popup fermé');
  }
  for (const sel of ['.modal__close', '.popup-close', '[aria-label="Close"]', '.overlay__close']) {
    const btn = page.locator(sel).first();
    if (await btn.isVisible({ timeout: 300 }).catch(() => false)) {
      await btn.click().catch(() => {});
      await page.waitForTimeout(300);
    }
  }
}

/** Charger une page et lire toutes les infos de la variante affichée */
async function loadAndReadVariant(page: Page, variantUrl: string) {
  await page.goto(variantUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);
  await dismissPopups(page);

  const title = await page.$eval('h1.product-details-title__text', (el: Element) => el.textContent?.trim() || '').catch(() => '?');
  const volume = await readSelectedVolume(page);
  const articleNumber = await readArticleNumber(page);
  const priceBlock = await readPriceBlock(page);

  // Nombre de variantes + noms
  const volumeNames = await page.$$eval(
    '.product-carousel-variant__item .product-carousel-variant__size-name',
    (els: Element[]) => els.map(el => el.textContent?.trim() || '')
  ).catch(() => [] as string[]);

  // Essayer de trouver tous les article numbers dans la page source
  const pageContent = await page.content();
  
  // Chercher les codes article dans le HTML (souvent dans des attributs data ou scripts)
  const articleCodes: string[] = [];
  const codeRegex = /(?:varSel|articleNumber|variantCode|sku)[=:"']\s*(\d{6,12})/gi;
  let match;
  while ((match = codeRegex.exec(pageContent)) !== null) {
    if (!articleCodes.includes(match[1])) articleCodes.push(match[1]);
  }

  // Aussi chercher dans les liens href contenant varSel
  const varSelRegex = /varSel=(\d+)/g;
  while ((match = varSelRegex.exec(pageContent)) !== null) {
    if (!articleCodes.includes(match[1])) articleCodes.push(match[1]);
  }

  return {
    title,
    volume,
    articleNumber,
    currentPrice: priceBlock.currentPrice,
    originalPrice: priceBlock.originalPrice,
    isDiscounted: priceBlock.isDiscounted,
    perUnit: priceBlock.perUnit,
    volumeNames,
    articleCodesInPage: articleCodes,
  };
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  console.log('🧪 TEST MARIONNAUD — Extraction par NAVIGATION (pas de clic)');
  console.log(`📌 URL: ${url}\n`);

  const baseUrl = getBaseUrl(url);
  const originalVarSel = url.match(/varSel=(\d+)/)?.[1] || '';

  console.log(`  Base URL: ${baseUrl}`);
  console.log(`  VarSel original: ${originalVarSel || '(aucun)'}\n`);

  const browser = await getBrowser();
  const page = await createStealthPage(browser);
  await page.addInitScript('window.__name = function(fn) { return fn; }');

  try {
    await simulateHumanBehavior(page);

    // ═══════ ÉTAPE 1 : Charger avec le varSel original ═══════
    console.log('  ═══ ÉTAPE 1: Charger URL initiale ═══');
    const initial = await loadAndReadVariant(page, url);
    console.log(`  📦 Produit: ${initial.title}`);
    console.log(`  🏷️  Volume sélectionné: ${initial.volume}`);
    console.log(`  📋 Article: ${initial.articleNumber}`);
    console.log(`  💰 Prix: ${initial.currentPrice}${initial.originalPrice ? ` (barré: ${initial.originalPrice})` : ''}`);
    console.log(`  📐 Prix/unité: ${initial.perUnit || '—'}`);
    console.log(`  🔴 Promo: ${initial.isDiscounted ? 'OUI' : 'NON'}`);
    console.log(`  📊 Volumes dans le carousel: ${initial.volumeNames.join(' | ') || '(aucun)'}`);
    console.log(`  🔑 Codes article trouvés dans la page: ${initial.articleCodesInPage.join(', ') || '(aucun)'}\n`);

    // Collecter les varSel connus
    const knownVarSels = new Map<string, { volume: string; price: string; originalPrice: string; isDiscounted: boolean; perUnit: string }>();
    knownVarSels.set(initial.articleNumber || originalVarSel, {
      volume: initial.volume,
      price: initial.currentPrice,
      originalPrice: initial.originalPrice,
      isDiscounted: initial.isDiscounted,
      perUnit: initial.perUnit,
    });

    // ═══════ ÉTAPE 2 : Charger sans varSel (variante par défaut) ═══════
    if (originalVarSel && baseUrl !== url) {
      console.log('  ═══ ÉTAPE 2: Charger URL sans varSel (défaut) ═══');
      const defaultVariant = await loadAndReadVariant(page, baseUrl);
      console.log(`  🏷️  Volume sélectionné: ${defaultVariant.volume}`);
      console.log(`  📋 Article: ${defaultVariant.articleNumber}`);
      console.log(`  💰 Prix: ${defaultVariant.currentPrice}${defaultVariant.originalPrice ? ` (barré: ${defaultVariant.originalPrice})` : ''}`);
      console.log(`  📐 Prix/unité: ${defaultVariant.perUnit || '—'}`);
      console.log(`  🔴 Promo: ${defaultVariant.isDiscounted ? 'OUI' : 'NON'}`);
      console.log(`  🔑 Codes article trouvés: ${defaultVariant.articleCodesInPage.join(', ') || '(aucun)'}\n`);

      if (defaultVariant.articleNumber && !knownVarSels.has(defaultVariant.articleNumber)) {
        knownVarSels.set(defaultVariant.articleNumber, {
          volume: defaultVariant.volume,
          price: defaultVariant.currentPrice,
          originalPrice: defaultVariant.originalPrice,
          isDiscounted: defaultVariant.isDiscounted,
          perUnit: defaultVariant.perUnit,
        });
      }

      // Fusionner les codes article trouvés dans les 2 pages
      for (const code of defaultVariant.articleCodesInPage) {
        if (!initial.articleCodesInPage.includes(code)) initial.articleCodesInPage.push(code);
      }
    }

    // ═══════ ÉTAPE 3 : Naviguer vers les varSel encore inconnus ═══════
    const unknownVarSels = initial.articleCodesInPage.filter(code => !knownVarSels.has(code));
    if (unknownVarSels.length > 0) {
      console.log(`  ═══ ÉTAPE 3: Explorer ${unknownVarSels.length} varSel(s) inconnu(s) ═══`);
      for (const varSel of unknownVarSels) {
        const varUrl = buildVariantUrl(baseUrl, varSel);
        console.log(`\n  → Navigation: ${varUrl}`);
        const variant = await loadAndReadVariant(page, varUrl);
        console.log(`     Volume: ${variant.volume} | Prix: ${variant.currentPrice}${variant.originalPrice ? ` (barré: ${variant.originalPrice})` : ''} | Promo: ${variant.isDiscounted ? 'OUI' : 'NON'}`);

        if (variant.articleNumber && !knownVarSels.has(variant.articleNumber)) {
          knownVarSels.set(variant.articleNumber, {
            volume: variant.volume,
            price: variant.currentPrice,
            originalPrice: variant.originalPrice,
            isDiscounted: variant.isDiscounted,
            perUnit: variant.perUnit,
          });
        }
      }
    }

    // ═══════ RÉSUMÉ ═══════
    console.log('\n' + '═'.repeat(60));
    console.log('📊 RÉSUMÉ DES VARIANTES');
    console.log('═'.repeat(60));
    console.log(`Produit: ${initial.title}\n`);

    const results: any[] = [];
    for (const [varSel, data] of knownVarSels) {
      const cp = parsePrice(data.price);
      const op = parsePrice(data.originalPrice);
      const promo = op > cp ? ` (barré: ${op}€ → -${Math.round((1 - cp / op) * 100)}%)` : '';
      const disc = data.isDiscounted ? ' 🔴 PROMO' : '';
      console.log(`  ${data.volume.padEnd(10)} [${varSel}] → ${cp}€${promo}${disc}`);
      if (data.perUnit) console.log(`${''.padEnd(16)}   prix/unité: ${data.perUnit}`);

      results.push({
        varSel,
        volume: data.volume,
        currentPrice: cp,
        originalPrice: op || undefined,
        isDiscounted: data.isDiscounted,
        perUnit: data.perUnit,
      });
    }

    console.log('\n' + '═'.repeat(60));
    console.log('📦 RÉSULTAT JSON');
    console.log('═'.repeat(60));
    console.log(JSON.stringify(results, null, 2));

  } catch (err) {
    console.error('❌ Erreur:', err);
  } finally {
    await closePage(page);
    await closeBrowser();
    process.exit(0);
  }
}

main().catch(err => {
  console.error('❌ Erreur fatale:', err);
  process.exit(1);
});
