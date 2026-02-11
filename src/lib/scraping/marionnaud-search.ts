/**
 * MARIONNAUD-SEARCH.TS — V4 HYBRIDE
 *
 * Étape 1 : fetch HTTP + cheerio pour /search/{query} (pas de JS = pas de détection bot)
 * Étape 2 : Sélection GPT du meilleur match
 * Étape 3 : Playwright uniquement sur la fiche produit (variantes dynamiques)
 */

import 'dotenv/config';
import {
  CompetitorPriceResult,
  getBrowser,
  createStealthPage,
  closePage,
  simulateHumanBehavior,
} from './search-utils';
import OpenAI from 'openai';
import { Page } from 'playwright';
import * as cheerio from 'cheerio';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const BASE_URL = 'https://www.marionnaud.fr';
const SEARCH_URL = `${BASE_URL}/search/`;

// Headers HTTP réalistes pour les requêtes fetch
const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  'Sec-Ch-Ua': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
};

// ── Types ────────────────────────────────────────────────────────────

interface MarionnaudProduct {
  brand: string;
  range: string;
  name: string;
  fullTitle: string;
  price: number;
  url: string;
  size: string;
}

interface ProductVariant {
  volume: string;
  volumeValue: number;
  currentPrice: number;
  originalPrice: number;
  isSelected: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────

function prepareQueries(brand: string, productName: string): string[] {
  let name = productName
    .replace(/^-?\d+%\s*:?\s*/i, '')
    .replace(/\(?\d+(?:[.,]\d+)?\s*(ml|g|oz|l|kg)\)?/gi, '')
    .replace(/[-–—]/g, ' ')
    .replace(/["""«»()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Dédupliquer la marque
  if (brand) {
    const esc = brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    name = name.replace(new RegExp(`${esc}\\s+${esc}`, 'gi'), brand);
    const words = brand.split(' ');
    if (words.length > 1) {
      name = name.replace(new RegExp(`${esc}\\s+${words.at(-1)}\\b`, 'gi'), brand);
    }
  }

  if (brand && !name.toLowerCase().includes(brand.toLowerCase())) {
    name = `${brand} ${name}`;
  }

  const words = name.split(' ').filter(w => w.length > 1);
  // Query 1 : nom complet (max 12 mots)
  const queries = [words.slice(0, 12).join(' ')];

  // Query 2 : marque + gamme (5 mots)
  if (words.length > 5) queries.push(words.slice(0, 5).join(' '));

  // Query 3 : marque seule (3 mots)
  if (words.length > 3) queries.push(words.slice(0, 3).join(' '));

  return [...new Set(queries)];
}

function findBestVariant(variants: ProductVariant[], targetVolume?: string): ProductVariant | null {
  if (!variants.length) return null;
  if (variants.length === 1) return variants[0];
  if (!targetVolume) return variants.find(v => v.isSelected) || variants[0];

  const m = targetVolume.match(/(\d+(?:[.,]\d+)?)/);
  if (!m) return variants.find(v => v.isSelected) || variants[0];
  const target = parseFloat(m[1].replace(',', '.'));

  return variants.reduce((best, v) =>
    Math.abs(v.volumeValue - target) < Math.abs(best.volumeValue - target) ? v : best
  );
}

/** Accepter cookies Marionnaud (Didomi / OneTrust) — Playwright uniquement */
async function dismissPopups(page: Page): Promise<void> {
  await page.evaluate(() => {
    try { (window as any).Didomi?.setUserAgreeToAll(); } catch {}
    document.querySelectorAll('button').forEach(b => {
      const t = (b.textContent || '').toLowerCase();
      if (t.includes('tout accepter') || t.includes('accepter') || t.includes('agree')) b.click();
    });
  }).catch(() => {});
  for (const sel of [
    '#didomi-notice-agree-button',
    '#onetrust-accept-btn-handler',
    'button:has-text("Tout accepter")',
    'button:has-text("Accepter")',
    '[aria-label="Fermer"]',
  ]) {
    await page.locator(sel).first().click({ force: true, timeout: 800 }).catch(() => {});
  }
  await page.waitForTimeout(500);
}

// ══════════════════════════════════════════════════════════════════════
// Étape 1 : RECHERCHE par fetch + cheerio (SANS Playwright)
// ══════════════════════════════════════════════════════════════════════

async function searchByFetch(query: string): Promise<MarionnaudProduct[]> {
  const url = `${SEARCH_URL}${encodeURIComponent(query)}`;
  console.log(`  🔍 [fetch] ${url}`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, { headers: FETCH_HEADERS, signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      console.log(`  ⚠️ HTTP ${response.status}`);
      return [];
    }

    const html = await response.text();
    console.log(`  📥 ${(html.length / 1024).toFixed(0)} Ko reçus`);

    return parseSearchHtml(html);
  } catch (err) {
    clearTimeout(timeout);
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`  ⚠️ fetch échoué: ${msg}`);
    return [];
  }
}

/** Parse le HTML de recherche Marionnaud (utilisé par fetch ET Playwright) */
function parseSearchHtml(html: string): MarionnaudProduct[] {
  const $ = cheerio.load(html);
  const items = $('e2-flex.product-grid__product-item');

  if (!items.length) {
    console.log(`  ⚠️ Aucun product-grid__product-item trouvé dans le HTML`);
    return [];
  }

  const products: MarionnaudProduct[] = [];

  items.slice(0, 10).each((_i, el) => {
    const tile = $(el).find('.product-list-item').first();
    const root = tile.length ? tile : $(el);

    const link = root.find('a.product-list-item__link').attr('href')
      || root.find('a.product-list-item__details-wrapper').attr('href')
      || '';
    if (!link) return;

    const brand = root.find('.product-list-item__brand').text().trim();
    const range = root.find('.product-list-item__range').text().trim();

    const sizeText = root.find('.product-list-item__size').text().trim();
    let name = root.find('.product-list-item__name').text().trim();
    if (sizeText && name.includes(sizeText)) {
      name = name.replace(sizeText, '').replace(/\s*-\s*$/, '').trim();
    }

    const fullTitle = [brand, range, name].filter(Boolean).join(' - ');
    const size = (sizeText || '').replace(/^-\s*/, '').trim();

    let price = 0;
    const priceText = root.find('span.price__default-value').first().text().trim();
    const m = priceText.replace(/\u00a0/g, ' ').match(/(\d+[,.]\d{2})/);
    if (m) price = parseFloat(m[1].replace(',', '.'));

    products.push({ brand, range, name, fullTitle, price, url: link, size });
  });

  console.log(`  📦 ${products.length} résultat(s)`);
  products.forEach((p, i) => {
    console.log(`     ${i + 1}. ${p.fullTitle} ${p.size ? `(${p.size})` : ''} | ${p.price}€`);
  });

  return products;
}



// ══════════════════════════════════════════════════════════════════════
// Étape 2 : Sélection GPT
// ══════════════════════════════════════════════════════════════════════

async function selectBestMatch(
  products: MarionnaudProduct[],
  dealInfo: { brand: string; name: string; volume?: string; category?: string }
): Promise<{ index: number; confidence: number; reason: string } | null> {
  if (!products.length) return null;

  const list = products.map((p, i) =>
    `${i + 1}. [${p.fullTitle}] Marque:${p.brand} | Gamme:${p.range} | Nom:${p.name} | ${p.price}€`
  ).join('\n');

  const prompt = `Tu es un expert produits de beauté. Trouve le produit EXACT parmi les résultats Marionnaud.

Produit recherché :
- Marque: ${dealInfo.brand}
- Nom complet: ${dealInfo.name}
- Volume: ${dealInfo.volume || '?'}
- Catégorie: ${dealInfo.category || '?'}

Résultats Marionnaud :
${list}

Règles STRICTES :
1. Marque identique obligatoire
2. GAMME identique ("J'adore" ≠ "J'adore L'Or" ≠ "J'adore Parfum d'eau")
3. CATÉGORIE identique : "Eau de parfum" ≠ "Eau de toilette", "Le Parfum" = "Eau de parfum"
4. Ignorer les déodorants, savons, laits corps, gels douche, crèmes si on cherche un parfum
5. INTENSE ≠ classique
6. Utilise le [fullTitle] entre crochets — c'est la description la plus fiable
7. Préfère le résultat #1 si son fullTitle correspond exactement

JSON uniquement: {"index": <1-${products.length} ou -1>, "confidence": <0-100>, "reason": "..."}`;

  try {
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
    const resp = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 150,
      temperature: 0.1,
    });

    const json = resp.choices[0]?.message?.content?.match(/\{[\s\S]*\}/);
    if (!json) return null;

    const result = JSON.parse(json[0]);
    if (result.index < 1 || result.confidence < 40) {
      console.log(`  ❌ GPT: pas de match (${result.confidence}%) — ${result.reason}`);
      return null;
    }

    const sel = products[result.index - 1];
    console.log(`  ✅ GPT: #${result.index} "${sel.fullTitle}" (${result.confidence}%)`);
    return result;
  } catch (e) {
    console.error(`  ❌ GPT erreur:`, e instanceof Error ? e.message : e);
    return null;
  }
}

// ══════════════════════════════════════════════════════════════════════
// Étape 3 : Extraction prix fiche produit (PLAYWRIGHT — seul endroit)
// ══════════════════════════════════════════════════════════════════════

async function extractVariants(page: Page, productUrl: string): Promise<{ variants: ProductVariant[]; name: string; inStock: boolean }> {
  const fullUrl = productUrl.startsWith('http') ? productUrl : `${BASE_URL}${productUrl}`;
  console.log(`  📄 Fiche: ${fullUrl}`);

  await page.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);
  await dismissPopups(page);

  // Nom du produit
  const name = await page.$eval('h1.product-details-title__text', el => el.textContent?.trim() || '').catch(() => '');

  // Stock
  const outOfStock = await page.locator('.out-of-stock, .product-not-available, .not-available').first().isVisible({ timeout: 1000 }).catch(() => false);

  // Nombre de variantes dans le carousel contenance
  const variantCount = await page.$$eval('.product-carousel-variant__item', items => items.length);
  console.log(`  🏷️  ${variantCount || 1} variante(s)`);

  // Helper : lire le prix affiché actuellement
  const readCurrentPrice = async (): Promise<{ currentPrice: number; originalPrice: number }> => {
    return page.evaluate(() => {
      // @ts-ignore — polyfill __name pour esbuild/tsx
      window.__name = window.__name || function(fn: any) { return fn; };

      let currentPrice = 0;
      let originalPrice = 0;

      const priceContainer = document.querySelector('e2core-price.product-add-to-cart__price-depiction') ||
                             document.querySelector('.product-add-to-cart__price-container');
      const defaultValue = priceContainer?.querySelector('.price__default-value') ||
                           document.querySelector('.product-add-to-cart__price-depiction .price__default-value');
      if (defaultValue) {
        const text = (defaultValue.textContent || '').replace(/\u00a0/g, ' ');
        const m = text.match(/(\d+[,.]\d{2})/);
        if (m) currentPrice = parseFloat(m[1].replace(',', '.'));
      }

      if (!currentPrice) {
        const allPrices = document.querySelectorAll('span.price__default-value');
        for (const el of allPrices) {
          const text = (el.textContent || '').replace(/\u00a0/g, ' ');
          const m = text.match(/(\d+[,.]\d{2})/);
          if (m) { currentPrice = parseFloat(m[1].replace(',', '.')); break; }
        }
      }

      const strikeSelectors = [
        '.price__previous-value',
        '.price__strike-through',
        '.price__standard-value',
        '.price__was',
        '.price__old',
      ];
      for (const sel of strikeSelectors) {
        const el = priceContainer?.querySelector(sel) || document.querySelector(`.product-add-to-cart__price-depiction ${sel}`);
        if (el) {
          const text = (el.textContent || '').replace(/\u00a0/g, ' ');
          const m = text.match(/(\d+[,.]\d{2})/);
          if (m) { originalPrice = parseFloat(m[1].replace(',', '.')); break; }
        }
      }

      if (!originalPrice) originalPrice = currentPrice;
      return { currentPrice, originalPrice };
    });
  };

  const readCurrentVolume = async (): Promise<string> => {
    return page.$eval('.product-carousel-variant__selected-option', el => el.textContent?.trim() || '')
      .catch(() => '');
  };

  if (variantCount <= 1) {
    const { currentPrice, originalPrice } = await readCurrentPrice();
    const volume = await readCurrentVolume();

    const vm = volume.match(/(\d+(?:[.,]\d+)?)/);
    const variant: ProductVariant = {
      volume,
      volumeValue: vm ? parseFloat(vm[1].replace(',', '.')) : 0,
      currentPrice,
      originalPrice,
      isSelected: true,
    };
    const promo = originalPrice > currentPrice ? ` (original: ${originalPrice}€)` : '';
    console.log(`  🏷️  Mono-taille: ${volume || '?'} → ${currentPrice}€${promo}`);

    return { variants: [variant], name, inStock: !outOfStock };
  }

  // ── Multi-tailles : navigation par URL (les clics ne fonctionnent pas sur le carousel Angular) ──
  const variants: ProductVariant[] = [];

  // Lire les données de la variante actuellement affichée
  const currentArticle = await page.$eval('.product-add-to-cart__article-number', el => el.textContent?.trim() || '').catch(() => '');
  const { currentPrice: firstPrice, originalPrice: firstOriginal } = await readCurrentPrice();
  const firstVolume = await readCurrentVolume();

  if (firstPrice > 0 && firstVolume) {
    const vm = firstVolume.match(/(\d+(?:[.,]\d+)?)/);
    variants.push({
      volume: firstVolume,
      volumeValue: vm ? parseFloat(vm[1].replace(',', '.')) : 0,
      currentPrice: firstPrice,
      originalPrice: firstOriginal,
      isSelected: true,
    });
    const promo = firstOriginal > firstPrice ? ` (original: ${firstOriginal}€)` : '';
    console.log(`     • ${firstVolume} → ${firstPrice}€${promo} ←`);
  }

  // Trouver les autres codes article (varSel) dans le HTML de la page
  const pageContent = await page.content();
  const varSelCodes: string[] = [];
  const varSelRegex = /varSel=(\d+)/g;
  let match;
  while ((match = varSelRegex.exec(pageContent)) !== null) {
    if (!varSelCodes.includes(match[1])) varSelCodes.push(match[1]);
  }

  // Filtrer : ne garder que les codes qu'on n'a pas encore visités
  const visitedCodes = new Set<string>([currentArticle]);
  // Aussi extraire le varSel de l'URL initiale
  const initialVarSel = fullUrl.match(/varSel=(\d+)/)?.[1];
  if (initialVarSel) visitedCodes.add(initialVarSel);

  // L'URL de base sans varSel
  const baseUrl = fullUrl.replace(/[?&]varSel=\d+/, '');

  // Naviguer vers les varSel non visités
  const unvisitedCodes = varSelCodes.filter(code => !visitedCodes.has(code));

  // Si on a un varSel dans l'URL, essayer aussi sans varSel (variante par défaut)
  if (initialVarSel && baseUrl !== fullUrl && unvisitedCodes.length === 0) {
    // On n'a trouvé aucun autre varSel dans la page — naviguer sans varSel
    console.log(`  🔄 Navigation vers URL par défaut (sans varSel)...`);
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    await dismissPopups(page);

    const defaultArticle = await page.$eval('.product-add-to-cart__article-number', el => el.textContent?.trim() || '').catch(() => '');
    if (defaultArticle && defaultArticle !== currentArticle) {
      const { currentPrice, originalPrice } = await readCurrentPrice();
      const volume = await readCurrentVolume();
      if (currentPrice > 0) {
        const vm = volume.match(/(\d+(?:[.,]\d+)?)/);
        variants.push({
          volume, volumeValue: vm ? parseFloat(vm[1].replace(',', '.')) : 0,
          currentPrice, originalPrice, isSelected: false,
        });
        const promo = originalPrice > currentPrice ? ` (original: ${originalPrice}€)` : '';
        console.log(`     • ${volume} → ${currentPrice}€${promo}`);
      }
      visitedCodes.add(defaultArticle);
    }

    // Re-scanner le HTML pour d'éventuels nouveaux varSel
    const newContent = await page.content();
    const newRegex = /varSel=(\d+)/g;
    while ((match = newRegex.exec(newContent)) !== null) {
      if (!varSelCodes.includes(match[1])) varSelCodes.push(match[1]);
    }
  }

  // Explorer les varSel restants par navigation
  const remainingCodes = varSelCodes.filter(code => !visitedCodes.has(code));
  for (const varSel of remainingCodes) {
    const varUrl = `${baseUrl}?varSel=${varSel}`;
    console.log(`  🔄 Navigation → varSel=${varSel}`);
    await page.goto(varUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);
    await dismissPopups(page);

    const { currentPrice, originalPrice } = await readCurrentPrice();
    const volume = await readCurrentVolume();

    if (currentPrice > 0) {
      const vm = volume.match(/(\d+(?:[.,]\d+)?)/);
      variants.push({
        volume, volumeValue: vm ? parseFloat(vm[1].replace(',', '.')) : 0,
        currentPrice, originalPrice, isSelected: false,
      });
      const promo = originalPrice > currentPrice ? ` (original: ${originalPrice}€)` : '';
      console.log(`     • ${volume} → ${currentPrice}€${promo}`);
    }
    visitedCodes.add(varSel);
  }

  return { variants, name, inStock: !outOfStock };
}

// ══════════════════════════════════════════════════════════════════════
// EXTRACTION DIRECTE depuis URL (sans search/GPT)
// ══════════════════════════════════════════════════════════════════════

export async function extractMarionnaudPriceFromUrl(
  productUrl: string,
  targetVolume?: string
): Promise<CompetitorPriceResult> {
  console.log(`\n  ${'═'.repeat(55)}`);
  console.log(`  🔗 MARIONNAUD — Extraction directe depuis URL`);
  console.log(`  ${productUrl}`);
  console.log(`  ${'═'.repeat(55)}`);

  const t0 = Date.now();
  const browser = await getBrowser();
  const page = await createStealthPage(browser);

  await page.addInitScript('window.__name = function(fn) { return fn; }');

  try {
    await simulateHumanBehavior(page);
    const { variants, name: productName, inStock } = await extractVariants(page, productUrl);

    const bestVariant = variants.length > 0 ? findBestVariant(variants, targetVolume) : null;
    const finalPrice = bestVariant?.currentPrice || 0;
    const originalPrice = bestVariant?.originalPrice && bestVariant.originalPrice > finalPrice
      ? bestVariant.originalPrice : undefined;
    const finalVolume = bestVariant?.volume || '';

    if (!finalPrice) {
      return { found: false, site: 'marionnaud', productUrl, error: 'Prix invalide', matchMethod: 'direct_url' };
    }

    const dur = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`\n  ✅ ${finalPrice}€ (${finalVolume}) — ${dur}s`);

    return {
      found: true, site: 'marionnaud', productUrl, productName,
      currentPrice: finalPrice, originalPrice, volume: finalVolume,
      inStock, matchConfidence: 100, matchMethod: 'direct_url',
    };
  } catch (error) {
    console.error(`  ❌ Erreur:`, error instanceof Error ? error.message : error);
    return { found: false, site: 'marionnaud', productUrl, error: error instanceof Error ? error.message : 'Erreur', matchMethod: 'direct_url' };
  } finally {
    await closePage(page);
  }
}

// ══════════════════════════════════════════════════════════════════════
// FONCTION PRINCIPALE — Recherche fetch + GPT + Playwright fiche
// ══════════════════════════════════════════════════════════════════════

export async function searchMarionnaudPrice(
  searchQuery: string,
  targetVolume?: string,
  dealInfo?: { brand: string; name: string; category?: string }
): Promise<CompetitorPriceResult> {
  console.log(`\n  ${'═'.repeat(55)}`);
  console.log(`  🔎 MARIONNAUD — "${searchQuery}" (${targetVolume || '?'})`);
  console.log(`  ${'═'.repeat(55)}`);

  const t0 = Date.now();

  const browser = await getBrowser();
  const page = await createStealthPage(browser);
  await page.addInitScript('window.__name = function(fn) { return fn; }');

  try {
    await simulateHumanBehavior(page);

    const brand = dealInfo?.brand || '';
    const name = dealInfo?.name || searchQuery;
    const queries = prepareQueries(brand, name);
    const searchMethod = 'fetch_search';

    // ── Étape 1 : Recherche par fetch + cheerio ──
    let products: MarionnaudProduct[] = [];
    for (const q of queries) {
      products = await searchByFetch(q);
      if (products.length > 0) break;
      console.log(`  ⚠️  0 résultat, query suivante...`);
    }

    if (!products.length) {
      return { found: false, site: 'marionnaud', error: 'Aucun résultat', matchMethod: searchMethod };
    }

    // ── Étape 2 : Sélection GPT ──
    console.log(`\n  ━━ SÉLECTION GPT ━━`);
    const match = await selectBestMatch(products, { brand, name, volume: targetVolume, category: dealInfo?.category });
    if (!match) {
      return { found: false, site: 'marionnaud', error: 'Aucun match GPT', matchMethod: searchMethod };
    }

    const selected = products[match.index - 1];

    // ── Étape 3 : Extraction prix sur la fiche (Playwright — même page réutilisée) ──
    console.log(`\n  ━━ EXTRACTION PRIX (Playwright) ━━`);
    const { variants, name: productName, inStock } = await extractVariants(page, selected.url);

    const bestVariant = variants.length > 0 ? findBestVariant(variants, targetVolume) : null;
    const finalPrice = bestVariant?.currentPrice || selected.price;
    const finalOriginalPrice = bestVariant?.originalPrice || finalPrice;
    const finalVolume = bestVariant?.volume || '';

    if (!finalPrice) {
      return { found: false, site: 'marionnaud', productUrl: `${BASE_URL}${selected.url}`, error: 'Prix invalide', matchMethod: searchMethod };
    }

    const dur = ((Date.now() - t0) / 1000).toFixed(1);
    const promoInfo = finalOriginalPrice > finalPrice ? ` (original: ${finalOriginalPrice}€)` : '';
    console.log(`\n  ✅ ${finalPrice}€${promoInfo} (${finalVolume}) — ${match.confidence}% — ${dur}s`);

    return {
      found: true, site: 'marionnaud',
      productUrl: `${BASE_URL}${selected.url}`,
      productName: productName || selected.fullTitle,
      currentPrice: finalPrice,
      originalPrice: finalOriginalPrice > finalPrice ? finalOriginalPrice : undefined,
      volume: finalVolume, inStock,
      matchConfidence: match.confidence,
      matchMethod: searchMethod,
      rawLLMResponse: match.reason,
    };

  } catch (error) {
    console.error(`  ❌ Erreur:`, error instanceof Error ? error.message : error);
    return { found: false, site: 'marionnaud', error: error instanceof Error ? error.message : 'Erreur', matchMethod: 'fetch_search' };
  } finally {
    await closePage(page);
  }
}

// ══════════════════════════════════════════════════════════════════════
// CLI
// ══════════════════════════════════════════════════════════════════════

if (require.main === module) {
  (async () => {
    if (process.argv.includes('--db')) {
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient() as any;

      const deals = await prisma.deal.findMany({
        where: {
          status: 'ACTIVE',
          product: { merchant: { slug: { not: 'marionnaud' } } },
        },
        include: {
          product: { include: { merchant: true, brandRef: true } },
        },
        orderBy: { score: 'desc' },
        take: 5,
      });

      console.log(`\n🧪 TEST DB: ${deals.length} deals (hors Marionnaud)\n`);
      const stats = { found: 0, notFound: 0 };

      for (let i = 0; i < deals.length; i++) {
        const deal = deals[i];
        const brand = deal.product.brandRef?.name || deal.product.brand || '';
        const productName = deal.refinedTitle || deal.title;
        const volume = deal.volume || '';
        const category = deal.product.type || '';

        console.log(`\n${'─'.repeat(70)}`);
        console.log(`  [${i + 1}/${deals.length}] ${brand} — ${productName}`);
        console.log(`  🏪 ${deal.product.merchant?.name} | 💰 ${deal.dealPrice}€ | 📏 ${volume || '?'}`);

        const searchQuery = `${brand} ${productName}`.replace(/\s+/g, ' ').trim();
        const result = await searchMarionnaudPrice(searchQuery, volume || undefined, { brand, name: productName, category });

        if (result.found && result.currentPrice) {
          const diff = deal.dealPrice - result.currentPrice;
          if (diff < 0) {
            console.log(`  🏆 ${Math.abs(diff).toFixed(2)}€ moins cher chez ${deal.product.merchant?.name}`);
          } else if (diff > 0) {
            console.log(`  ⚠️ ${diff.toFixed(2)}€ plus cher chez ${deal.product.merchant?.name}`);
          } else {
            console.log(`  ➡️ Prix identique`);
          }
          stats.found++;
        } else {
          console.log(`  ❌ Non trouvé: ${result.error}`);
          stats.notFound++;
        }
      }

      console.log(`\n${'═'.repeat(70)}`);
      console.log(`  📊 RÉSULTATS: ${stats.found} trouvé(s), ${stats.notFound} non trouvé(s)`);
      console.log(`${'═'.repeat(70)}`);

      const { closeBrowser } = await import('./search-utils');
      await closeBrowser();
      await prisma.$disconnect();
    } else {
      const query = process.argv[2] || "Lancôme Tonique Confort";
      const volume = process.argv[3] || '400ml';
      const brand = process.argv[4] || query.split(' ')[0];
      console.log(`\n🧪 TEST: "${query}" (${volume})\n`);
      const result = await searchMarionnaudPrice(query, volume, { brand, name: query });
      console.log(`\n📊 Résultat:`, JSON.stringify(result, null, 2));
      const { closeBrowser } = await import('./search-utils');
      await closeBrowser();
    }
  })();
}
