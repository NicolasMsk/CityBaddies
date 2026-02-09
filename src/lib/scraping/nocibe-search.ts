/**
 * NOCIBE-SEARCH.TS — V3 SIMPLIFIÉE
 * 
 * Navigation directe vers https://www.nocibe.fr/fr/search?q=...
 * → Extraction DOM des résultats
 * → Sélection GPT du meilleur match
 * → Extraction des variantes sur la fiche produit
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

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const BASE_URL = 'https://www.nocibe.fr';
const SEARCH_URL = `${BASE_URL}/fr/search?q=`;

// ── Types ────────────────────────────────────────────────────────────

interface NocibeProduct {
  brand: string;
  productLine: string;
  variantName: string;
  category: string;
  fullTitle: string;
  price: number;
  volume: string;
  url: string;
}

interface ProductVariant {
  volume: string;
  volumeValue: number;
  currentPrice: number;
  promoPrice: number | null;
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

/** Accepter cookies Didomi + popups */
async function dismissPopups(page: Page): Promise<void> {
  // JS direct sur Didomi
  await page.evaluate(() => {
    try { (window as any).Didomi?.setUserAgreeToAll(); } catch {}
    document.querySelectorAll('button').forEach(b => {
      const t = (b.textContent || '').toLowerCase();
      if (t.includes('accepter') || t.includes('agree')) b.click();
    });
  }).catch(() => {});
  // Boutons classiques
  for (const sel of ['#didomi-notice-agree-button', 'button:has-text("Tout accepter")', '[aria-label="Fermer"]']) {
    await page.locator(sel).first().click({ force: true, timeout: 800 }).catch(() => {});
  }
  await page.waitForTimeout(500);
}

// ── Étape 1 : Recherche par URL ──────────────────────────────────────

async function searchByUrl(page: Page, query: string): Promise<NocibeProduct[]> {
  const url = `${SEARCH_URL}${encodeURIComponent(query)}`;
  console.log(`  🔍 ${url}`);

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('[data-testid="product-tile"]', { timeout: 12000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await dismissPopups(page);

  const products = await page.$$eval('[data-testid="product-tile"]', (tiles) => {
    return tiles.slice(0, 12).map(tile => {
      const url = tile.querySelector('a[data-testid="main-link"]')?.getAttribute('href') || '';
      const fullTitle = tile.querySelector('div[role="img"]')?.getAttribute('title') || '';
      const info = tile.querySelector('[data-testid="product-tile-info"]');
      const brand = info?.querySelector('.top-brand')?.textContent?.trim() || '';
      const details = info?.querySelector('.product-info__details');
      const productLine = details?.querySelector('.brand-line')?.textContent?.trim() || '';
      const variantName = details?.querySelector('.name')?.textContent?.trim() || '';
      const category = details?.querySelector('.category')?.textContent?.trim() || '';

      // Prix : essayer current, puis discount, puis aria-label générique
      let price = 0;
      const currentLabel = (tile.querySelector('[data-testid="price-type-current"]')?.getAttribute('aria-label') || '').replace(/\u00a0/g, ' ');
      const currentMatch = currentLabel.match(/(\d+[,.]\d{2})/);
      if (currentMatch) price = parseFloat(currentMatch[1].replace(',', '.'));
      if (!price) {
        const discountLabel = (tile.querySelector('[data-testid="price-type-discount-color"]')?.getAttribute('aria-label') || '').replace(/\u00a0/g, ' ');
        const discountMatch = discountLabel.match(/(\d+[,.]\d{2})/);
        if (discountMatch) price = parseFloat(discountMatch[1].replace(',', '.'));
      }
      if (!price) {
        const priceEls = tile.querySelectorAll('[aria-label]');
        for (const el of priceEls) {
          const lbl = (el.getAttribute('aria-label') || '').replace(/\u00a0/g, ' ');
          const m = lbl.match(/(?:Actuellement|Prix)\s*(\d+[,.]\d{2})/);
          if (m) { price = parseFloat(m[1].replace(',', '.')); break; }
        }
      }

      const baseText = (tile.querySelector('[data-testid="price-base-unit"]')?.textContent || '').replace(/\u00a0/g, ' ');
      const volMatch = baseText.match(/^(\d+)\s*(ml|g|l)/i);
      const volume = volMatch ? `${volMatch[1]} ${volMatch[2]}` : '';

      return { brand, productLine, variantName, category, fullTitle, price, volume, url };
    });
  });

  console.log(`  📦 ${products.length} résultat(s)`);
  products.forEach((p, i) => {
    const label = p.fullTitle || [p.brand, p.productLine, p.variantName, p.category].filter(Boolean).join(' - ');
    console.log(`     ${i + 1}. ${label} | ${p.volume} | ${p.price}€`);
  });
  return products;
}

// ── Étape 2 : Sélection GPT ─────────────────────────────────────────

async function selectBestMatch(
  products: NocibeProduct[],
  dealInfo: { brand: string; name: string; volume?: string; category?: string }
): Promise<{ index: number; confidence: number; reason: string } | null> {
  if (!products.length) return null;

  const list = products.map((p, i) =>
    `${i + 1}. [${p.fullTitle}] Marque:${p.brand} | Gamme:${p.productLine} | Variante:${p.variantName} | Catégorie:${p.category} | ${p.volume} | ${p.price}€`
  ).join('\n');

  const prompt = `Tu es un expert produits de beauté. Trouve le produit EXACT parmi les résultats Nocibé.

Produit recherché :
- Marque: ${dealInfo.brand}
- Nom complet: ${dealInfo.name}
- Volume: ${dealInfo.volume || '?'}
- Catégorie: ${dealInfo.category || '?'}

Résultats Nocibé :
${list}

Règles STRICTES :
1. Marque identique obligatoire
2. GAMME identique ("La Nuit De L'Homme" ≠ "Y" ≠ "L'Homme")
3. CATÉGORIE identique : "Eau de parfum" ≠ "Eau de toilette", "Le Parfum" = "Eau de parfum"
4. INTENSE ≠ classique
5. Prix à 0€ = OK (sera récupéré sur la fiche)
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
    console.log(`  ✅ GPT: #${result.index} "${[sel.brand, sel.productLine].join(' ')}" (${result.confidence}%)`);
    return result;
  } catch (e) {
    console.error(`  ❌ GPT erreur:`, e instanceof Error ? e.message : e);
    return null;
  }
}

// ── Étape 3 : Extraction prix fiche produit ──────────────────────────

async function extractVariants(page: Page, productUrl: string): Promise<{ variants: ProductVariant[]; name: string; inStock: boolean }> {
  const fullUrl = productUrl.startsWith('http') ? productUrl : `${BASE_URL}${productUrl}`;
  console.log(`  📄 Fiche: ${fullUrl}`);

  await page.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);
  await dismissPopups(page);

  const name = await page.locator('div[role="img"]').first().getAttribute('title').catch(() => '') || '';
  const outOfStock = await page.locator('[data-testid="out-of-stock"], .out-of-stock').first().isVisible({ timeout: 1000 }).catch(() => false);
  const radioCount = await page.locator('[data-testid="RadioButton"]').count();

  if (radioCount > 0) {
    console.log(`  🏷️  ${radioCount} variante(s)`);
    const variants = await page.$$eval('[data-testid="RadioButton"]', (btns) => {
      return btns.map(btn => {
        const volText = (btn.querySelector('.product-detail__variant-name')?.textContent || '').trim();
        // Prix courant
        let currentPrice = 0;
        const currentLabel = (btn.querySelector('[data-testid="price-type-current"]')?.getAttribute('aria-label') || '').replace(/\u00a0/g, ' ');
        const cm = currentLabel.match(/(\d+[,.]\d{2})/);
        if (cm) currentPrice = parseFloat(cm[1].replace(',', '.'));
        // Prix discount (soldes)
        let promoPrice: number | null = null;
        const discountLabel = (btn.querySelector('[data-testid="price-type-discount-color"]')?.getAttribute('aria-label') || '').replace(/\u00a0/g, ' ');
        const dm = discountLabel.match(/(\d+[,.]\d{2})/);
        if (dm) {
          promoPrice = parseFloat(dm[1].replace(',', '.'));
          if (!currentPrice) currentPrice = promoPrice;
        }
        // Prix avec code promo (variant-product-price)
        if (!promoPrice) {
          const vpText = (btn.querySelector('[data-testid="variant-product-price"]')?.textContent || '').replace(/\u00a0/g, ' ');
          const vp = vpText.match(/(\d+[,.]\d{2})/);
          if (vp) {
            const vpPrice = parseFloat(vp[1].replace(',', '.'));
            if (currentPrice && vpPrice < currentPrice) {
              promoPrice = vpPrice;
            } else if (!currentPrice) {
              currentPrice = vpPrice;
            }
          }
        }
        // Fallback aria-label générique
        if (!currentPrice) {
          const allLabels = btn.querySelectorAll('[aria-label]');
          for (const el of allLabels) {
            const lbl = (el.getAttribute('aria-label') || '').replace(/\u00a0/g, ' ');
            const m = lbl.match(/(\d+[,.]\d{2})\s*\u20ac?/);
            if (m) { currentPrice = parseFloat(m[1].replace(',', '.')); break; }
          }
        }
        const vm = volText.match(/(\d+(?:[.,]\d+)?)/);
        const isSelected = btn.querySelector('input[data-testid="radio-input"]')?.getAttribute('aria-checked') === 'true';

        return {
          volume: volText,
          volumeValue: vm ? parseFloat(vm[1].replace(',', '.')) : 0,
          currentPrice,
          promoPrice,
          isSelected,
        };
      });
    });

    variants.forEach(v => {
      const tag = v.isSelected ? ' ←' : '';
      const realPrice = v.promoPrice || v.currentPrice;
      const detail = v.promoPrice ? ` (base: ${v.currentPrice}€ → promo: ${v.promoPrice}€)` : '';
      console.log(`     • ${v.volume} → ${realPrice}€${detail}${tag}`);
    });

    return { variants, name, inStock: !outOfStock };
  }

  // Mono-taille
  let currentPrice = 0;
  const priceLabel = (await page.locator('[data-testid="price-type-current"]').first().getAttribute('aria-label').catch(() => '') || '').replace(/\u00a0/g, ' ');
  const cm = priceLabel.match(/(\d+[,.]\d{2})/);
  if (cm) currentPrice = parseFloat(cm[1].replace(',', '.'));

  // Prix promo avec code
  let promoPrice: number | null = null;
  const vpText = (await page.locator('[data-testid="variant-product-price"]').first().textContent().catch(() => '') || '').replace(/\u00a0/g, ' ');
  const vpMatch = vpText.match(/(\d+[,.]\d{2})/);
  if (vpMatch) promoPrice = parseFloat(vpMatch[1].replace(',', '.'));

  // Discount (soldes)
  if (!promoPrice) {
    const discLabel = (await page.locator('[data-testid="price-type-discount-color"]').first().getAttribute('aria-label').catch(() => '') || '').replace(/\u00a0/g, ' ');
    const dm = discLabel.match(/(\d+[,.]\d{2})/);
    if (dm) promoPrice = parseFloat(dm[1].replace(',', '.'));
  }

  const baseText = (await page.locator('[data-testid="price-base-unit"]').first().textContent().catch(() => '') || '').replace(/\u00a0/g, ' ');
  const vm = baseText.match(/^(\d+)\s*(ml|g|l)/i);

  const variant: ProductVariant = {
    volume: vm ? `${vm[1]} ${vm[2]}` : '',
    volumeValue: vm ? parseFloat(vm[1]) : 0,
    currentPrice,
    promoPrice,
    isSelected: true,
  };
  const realPrice = promoPrice || currentPrice;
  const detail = promoPrice ? ` (base: ${currentPrice}€ → promo: ${promoPrice}€)` : '';
  console.log(`  🏷️  Mono-taille: ${variant.volume || '?'} → ${realPrice}€${detail}`);

  return { variants: [variant], name, inStock: !outOfStock };
}

// ── NOUVELLE FONCTION : Extraction directe depuis URL (sans search/GPT) ──

export async function extractNocibePriceFromUrl(
  productUrl: string,
  targetVolume?: string
): Promise<CompetitorPriceResult> {
  console.log(`\n  ${'═'.repeat(55)}`);
  console.log(`  🔗 NOCIBÉ — Extraction directe depuis URL`);
  console.log(`  ${productUrl}`);
  console.log(`  ${'═'.repeat(55)}`);

  const t0 = Date.now();
  const browser = await getBrowser();
  const page = await createStealthPage(browser);

  try {
    await simulateHumanBehavior(page);

    const { variants, name: productName, inStock } = await extractVariants(page, productUrl);

    const bestVariant = variants.length > 0 ? findBestVariant(variants, targetVolume) : null;
    const finalPrice = bestVariant?.promoPrice || bestVariant?.currentPrice || 0;
    const originalPrice = bestVariant?.promoPrice && bestVariant.currentPrice ? bestVariant.currentPrice : undefined;
    const finalVolume = bestVariant?.volume || '';

    if (!finalPrice) {
      return { found: false, site: 'nocibe', productUrl, error: 'Prix invalide', matchMethod: 'direct_url' };
    }

    const dur = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`\n  ✅ ${finalPrice}€ (${finalVolume}) — ${dur}s`);

    return {
      found: true,
      site: 'nocibe',
      productUrl,
      productName,
      currentPrice: finalPrice,
      originalPrice,
      volume: finalVolume,
      inStock,
      matchConfidence: 100, // Direct URL = 100%
      matchMethod: 'direct_url',
    };

  } catch (error) {
    console.error(`  ❌ Erreur:`, error instanceof Error ? error.message : error);
    return { found: false, site: 'nocibe', productUrl, error: error instanceof Error ? error.message : 'Erreur', matchMethod: 'direct_url' };
  } finally {
    await closePage(page);
  }
}

// ── Fonction principale ──────────────────────────────────────────────

export async function searchNocibePrice(
  searchQuery: string,
  targetVolume?: string,
  dealInfo?: { brand: string; name: string; category?: string }
): Promise<CompetitorPriceResult> {
  console.log(`\n  ${'═'.repeat(55)}`);
  console.log(`  🔎 NOCIBÉ — "${searchQuery}" (${targetVolume || '?'})`);
  console.log(`  ${'═'.repeat(55)}`);

  const t0 = Date.now();
  const browser = await getBrowser();
  const page = await createStealthPage(browser);

  try {
    await simulateHumanBehavior(page);

    const brand = dealInfo?.brand || '';
    const name = dealInfo?.name || searchQuery;
    const queries = prepareQueries(brand, name);

    // Étape 1 : Rechercher via URL directe
    let products: NocibeProduct[] = [];
    for (const q of queries) {
      products = await searchByUrl(page, q);
      if (products.length > 0) break;
      console.log(`  ⚠️  0 résultat, query suivante...`);
    }

    if (!products.length) {
      return { found: false, site: 'nocibe', error: 'Aucun résultat', matchMethod: 'url_search' };
    }

    // Étape 2 : Sélection GPT
    console.log(`\n  ━━ SÉLECTION GPT ━━`);
    const match = await selectBestMatch(products, { brand, name, volume: targetVolume, category: dealInfo?.category });
    if (!match) {
      return { found: false, site: 'nocibe', error: 'Aucun match GPT', matchMethod: 'url_search' };
    }

    const selected = products[match.index - 1];

    // Étape 3 : Extraction prix sur la fiche
    console.log(`\n  ━━ EXTRACTION PRIX ━━`);
    const { variants, name: productName, inStock } = await extractVariants(page, selected.url);

    const bestVariant = variants.length > 0 ? findBestVariant(variants, targetVolume) : null;
    // Prix final = promo (code promo / soldes) > prix courant > prix search
    const finalPrice = bestVariant?.promoPrice || bestVariant?.currentPrice || selected.price;
    const originalPrice = bestVariant?.promoPrice && bestVariant.currentPrice ? bestVariant.currentPrice : undefined;
    const finalVolume = bestVariant?.volume || selected.volume;

    if (!finalPrice) {
      return { found: false, site: 'nocibe', productUrl: `${BASE_URL}${selected.url}`, error: 'Prix invalide', matchMethod: 'url_search' };
    }

    const dur = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`\n  ✅ ${finalPrice}€ (${finalVolume}) — ${match.confidence}% — ${dur}s`);

    return {
      found: true,
      site: 'nocibe',
      productUrl: `${BASE_URL}${selected.url}`,
      productName: productName || selected.fullTitle,
      currentPrice: finalPrice,
      originalPrice,
      volume: finalVolume,
      inStock,
      matchConfidence: match.confidence,
      matchMethod: 'url_search',
      rawLLMResponse: match.reason,
    };

  } catch (error) {
    console.error(`  ❌ Erreur:`, error instanceof Error ? error.message : error);
    return { found: false, site: 'nocibe', error: error instanceof Error ? error.message : 'Erreur', matchMethod: 'url_search' };
  } finally {
    await closePage(page);
  }
}

// ── CLI ──────────────────────────────────────────────────────────────

if (require.main === module) {
  (async () => {
    const query = process.argv[2] || 'Lancôme Génifique Sérum';
    const volume = process.argv[3] || '50ml';
    const brand = process.argv[4] || query.split(' ')[0];
    console.log(`\n🧪 TEST: "${query}" (${volume})\n`);
    const result = await searchNocibePrice(query, volume, { brand, name: query });
    console.log(`\n📊 Résultat:`, JSON.stringify(result, null, 2));
    const { closeBrowser } = await import('./search-utils');
    await closeBrowser();
  })();
}
