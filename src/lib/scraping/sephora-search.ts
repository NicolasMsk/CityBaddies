/**
 * SEPHORA-SEARCH.TS — V3 SIMPLIFIÉE (même pattern que Nocibé)
 *
 * Navigation directe vers https://www.sephora.fr/recherche/?q=...
 * → Extraction DOM des résultats (data-tcproduct JSON)
 * → Sélection GPT du meilleur match
 * → Extraction des variantes via la modale colorguide de la fiche produit
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
const BASE_URL = 'https://www.sephora.fr';
const SEARCH_URL = `${BASE_URL}/recherche/?q=`;

// ── Types ────────────────────────────────────────────────────────────

interface SephoraProduct {
  brand: string;
  name: string;
  fullTitle: string;
  nature: string;       // edp, edt, body milk, etc.
  price: number;
  originalPrice: number;
  volume: string;
  url: string;
  inStock: boolean;
  pid: string;
}

interface ProductVariant {
  name: string;
  volume: string;
  volumeValue: number;
  volumeUnit: string;
  currentPrice: number;
  originalPrice: number;
  discountPercent: number;
  isPromo: boolean;
  sku: string;
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

  const words = name.split(' ').filter(w => w.length > 1 || /\d/.test(w));
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
  if (!targetVolume) return variants[0];

  const m = targetVolume.match(/(\d+(?:[.,]\d+)?)/);
  if (!m) return variants[0];
  const target = parseFloat(m[1].replace(',', '.'));

  return variants.reduce((best, v) =>
    Math.abs(v.volumeValue - target) < Math.abs(best.volumeValue - target) ? v : best
  );
}

/** Accepter cookies Sephora */
async function dismissPopups(page: Page): Promise<void> {
  // Didomi / OneTrust cookie popup
  for (const sel of [
    '#didomi-notice-agree-button',
    '#onetrust-accept-btn-handler',
    'button:has-text("Tout accepter")',
    'button:has-text("Accepter")',
    '[aria-label="Fermer"]',
  ]) {
    await page.locator(sel).first().click({ force: true, timeout: 400 }).catch(() => {});
  }
  await page.waitForTimeout(200);
}

// ── Étape 1 : Recherche par URL ──────────────────────────────────────

async function searchByUrl(page: Page, query: string): Promise<SephoraProduct[]> {
  const url = `${SEARCH_URL}${encodeURIComponent(query)}`;
  console.log(`  🔍 ${url}`);

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  // Attendre que la grille de résultats se charge
  await page.waitForSelector('.product-tile[data-tcproduct], #search-result-items', { timeout: 12000 }).catch(() => {});
  await page.waitForTimeout(800);
  await dismissPopups(page);

  const products = await page.$$eval('.product-tile[data-tcproduct]', (tiles) => {
    return tiles.slice(0, 12).map(tile => {
      // Parser le JSON de data-tcproduct
      const tcRaw = tile.getAttribute('data-tcproduct') || '{}';
      let tc: any = {};
      try { tc = JSON.parse(tcRaw); } catch { return null; }

      const pid = tc.product_pid || tile.getAttribute('data-itemid') || '';
      const brand = (tc.product_brand || '').toUpperCase();
      const pidName = tc.product_pid_name || '';
      const nature = tc.product_nature || '';
      const price = parseFloat(tc.product_price_ati) || 0;
      const originalPrice = parseFloat(tc.product_old_price_ati) || price;
      const inStock = tc.product_instock === 'y';

      // URL : prendre le href du <a> (casse correcte) plutôt que data-tcproduct (tout en minuscule → 404)
      const linkEl = tile.querySelector('a.product-tile-link[href]');
      let productUrl = linkEl?.getAttribute('href') || tc.product_url_page || '';
      // S'assurer que l'URL est absolue
      if (productUrl && !productUrl.startsWith('http')) {
        productUrl = 'https://www.sephora.fr' + (productUrl.startsWith('/') ? '' : '/') + productUrl;
      }

      // Extraire le nom depuis les spans .summarize-description
      const titleLines = tile.querySelectorAll('.summarize-description.title-line');
      const nameParts: string[] = [];
      titleLines.forEach(el => {
        const text = el.textContent?.trim();
        if (text) nameParts.push(text);
      });
      const fullTitle = nameParts.join(' - ') || pidName;
      const name = nameParts[0] || pidName;

      // Volume: depuis .product-variation-name ou unit-price
      let volume = '';
      const variationName = tile.querySelector('.product-variation-name');
      if (variationName) {
        const vText = variationName.textContent?.trim() || '';
        const vm = vText.match(/(\d+(?:[.,]\d+)?)\s*(ml|g|l)/i);
        if (vm) volume = `${vm[1]} ${vm[2].toLowerCase()}`;
      }
      if (!volume) {
        const unitPrice = tile.querySelector('.unit-price .price');
        if (unitPrice) {
          const uText = unitPrice.textContent?.trim() || '';
          const um = uText.match(/(\d+)(ml|g|l)/i);
          if (um) volume = `${um[1]} ${um[2].toLowerCase()}`;
        }
      }

      return { brand, name, fullTitle, nature, price, originalPrice, volume, url: productUrl, inStock, pid };
    }).filter(Boolean);
  }) as SephoraProduct[];

  console.log(`  📦 ${products.length} résultat(s)`);
  products.forEach((p, i) => {
    const promo = p.originalPrice > p.price ? ` (ancien: ${p.originalPrice}€)` : '';
    const stock = p.inStock ? '' : ' [RUPTURE]';
    console.log(`     ${i + 1}. ${p.brand} ${p.fullTitle} | ${p.volume || '?'} | ${p.price}€${promo}${stock}`);
  });
  return products;
}

// ── Étape 2 : Sélection GPT ─────────────────────────────────────────

async function selectBestMatch(
  products: SephoraProduct[],
  dealInfo: { brand: string; name: string; volume?: string; category?: string }
): Promise<{ index: number; confidence: number; reason: string } | null> {
  if (!products.length) return null;

  const list = products.map((p, i) =>
    `${i + 1}. [${p.fullTitle}] Marque:${p.brand} | Nature:${p.nature} | ${p.volume || '?'} | ${p.price}€ | ${p.inStock ? 'en stock' : 'RUPTURE'}`
  ).join('\n');

  const prompt = `Tu es un expert produits de beauté. Trouve le produit EXACT parmi les résultats Sephora.

Produit recherché :
- Marque: ${dealInfo.brand}
- Nom complet: ${dealInfo.name}
- Volume: ${dealInfo.volume || '?'}
- Catégorie: ${dealInfo.category || '?'}

Résultats Sephora :
${list}

Règles STRICTES :
1. Marque identique obligatoire
2. GAMME identique ("J'adore" ≠ "J'adore L'Or" ≠ "J'adore Parfum d'eau")
3. CATÉGORIE identique : "Eau de parfum" ≠ "Eau de toilette", "Le Parfum" = "Eau de parfum"
4. Ignorer les déodorants, savons, laits corps, gels douche, crèmes si on cherche un parfum
5. INTENSE ≠ classique
6. Préfère les résultats en stock
7. Utilise le [fullTitle] entre crochets — c'est la description la plus fiable

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
    console.log(`  ✅ GPT: #${result.index} "${sel.brand} ${sel.name}" (${result.confidence}%)`);
    return result;
  } catch (e) {
    console.error(`  ❌ GPT erreur:`, e instanceof Error ? e.message : e);
    return null;
  }
}

// ── Étape 3 : Extraction prix fiche produit (modale colorguide) ──────

async function extractVariants(page: Page, productUrl: string): Promise<{ variants: ProductVariant[]; name: string; inStock: boolean }> {
  console.log(`  📄 Fiche: ${productUrl}`);

  await page.goto(productUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(1200);

  // Nom du produit
  const name = await page.evaluate(() => {
    const titleEl = document.querySelector('h1.product-name span, .product-name .summarize-description');
    return titleEl?.textContent?.trim() || '';
  });

  // Stock
  const outOfStock = await page.evaluate(() => {
    const el = document.querySelector('.not-available-message, .product-not-available');
    return el ? true : false;
  });

  // Vérifier s'il y a un sélecteur de variantes (contenances)
  const hasVariantSelector = await page.$('div.variations-size-selected, div.variations-shade-selected, a.open-selector-dialog, a.open-color-dialog');

  let variants: ProductVariant[] = [];

  if (hasVariantSelector) {
    console.log('  🎨 Sélecteur de variantes détecté, ouverture de la modale...');

    try {
      // Méthode 1: Clic sur sélecteur de contenance
      let clicked = false;
      const sizeDialogLink = await page.$('div.variations-size-selected a.open-selector-dialog');
      if (sizeDialogLink) {
        await sizeDialogLink.scrollIntoViewIfNeeded();
        await page.waitForTimeout(200);
        await sizeDialogLink.click();
        clicked = true;
      }

      // Méthode 2: Clic sur sélecteur de teinte
      if (!clicked) {
        const colorDialogLink = await page.$('div.variations-shade-selected a.open-color-dialog');
        if (colorDialogLink) {
          await colorDialogLink.scrollIntoViewIfNeeded();
          await page.waitForTimeout(200);
          await colorDialogLink.click();
          clicked = true;
        }
      }

      // Méthode 3: Clic JS direct
      if (!clicked) {
        await page.evaluate(() => {
          const selectors = ['a.open-selector-dialog', 'a.open-color-dialog', 'div.variations-size-selected', 'div.variations-shade-selected'];
          for (const s of selectors) {
            const el = document.querySelector(s) as HTMLElement;
            if (el) { el.click(); return; }
          }
        });
      }

      await page.waitForTimeout(700);

      // Extraire les variantes depuis la modale
      variants = await page.evaluate(() => {
        // Helper: extraire proprement un prix depuis du texte (ex: "32,00 €" → 32)
        const extractPrice = (text: string | null | undefined): number => {
          if (!text) return 0;
          const m = text.match(/(\d+)[,\.](\d{2})/);
          if (m) return parseFloat(`${m[1]}.${m[2]}`);
          const m2 = text.match(/(\d+)/);
          return m2 ? parseInt(m2[1]) : 0;
        };

        const variantButtons = document.querySelectorAll('button.variation-button[data-pid]');
        const result: any[] = [];
        const seen = new Set<string>(); // déduplication par volume

        variantButtons.forEach((button) => {
          try {
            const title = button.getAttribute('title') || '';
            const sku = button.getAttribute('data-pid') || '';
            const titleSpan = button.querySelector('.variation-title span');
            const titleFromSpan = titleSpan?.textContent?.trim() || '';
            const bname = title || titleFromSpan;

            if (!bname) return;
            // Ignorer les recharges/rechargeables
            if (/recharg/i.test(bname)) return;

            // Extraire volume
            let volumeMatch = bname.match(/^(\d+(?:[.,]\d+)?)\s*(ml|g)$/i);
            if (!volumeMatch) {
              volumeMatch = bname.match(/\((\d+(?:[.,]\d+)?)\s*(ml|g)\)/i);
            }
            const volume = volumeMatch ? `${volumeMatch[1]} ${volumeMatch[2].toLowerCase()}` : bname;
            const volumeValue = volumeMatch ? parseFloat(volumeMatch[1].replace(',', '.')) : 0;
            const volumeUnit = volumeMatch ? volumeMatch[2].toLowerCase() : '';

            // Déduplication : une seule entrée par volume
            const dedupeKey = volume.toLowerCase();
            if (seen.has(dedupeKey)) return;
            seen.add(dedupeKey);

            // Prix: chercher dans .product-variant-price-wrapper (le dernier visible)
            const priceWrappers = button.querySelectorAll('.product-variant-price-wrapper');
            const priceWrapper = priceWrappers[priceWrappers.length - 1];
            if (!priceWrapper) return;

            const promoPrice = priceWrapper.querySelector('span.price-sales.prior-price-red');
            const normalPrice = priceWrapper.querySelector('span.price-sales.price-sales-standard');

            let currentPrice = 0;
            let originalPrice = 0;
            let discountPercent = 0;
            let isPromo = false;

            if (promoPrice) {
              isPromo = true;
              currentPrice = extractPrice(promoPrice.textContent);

              const oldPriceEl = priceWrapper.querySelector('span.price-standard');
              if (oldPriceEl) {
                originalPrice = extractPrice(oldPriceEl.textContent) || currentPrice;
              }

              const discountEl = priceWrapper.querySelector('span.original-price-discount');
              if (discountEl) {
                const discountText = discountEl.textContent?.replace(/[^\d]/g, '') || '0';
                discountPercent = parseInt(discountText) || 0;
              } else if (originalPrice > currentPrice) {
                discountPercent = Math.round((1 - currentPrice / originalPrice) * 100);
              }
            } else if (normalPrice) {
              currentPrice = extractPrice(normalPrice.textContent);
              originalPrice = currentPrice;
            }

            // Fallback: prix min/sales sur le tile
            if (!currentPrice) {
              const minPrice = priceWrapper.querySelector('.product-min-price, .product-sales-price');
              if (minPrice) {
                currentPrice = extractPrice(minPrice.textContent);
                originalPrice = currentPrice;
              }
            }

            if (currentPrice > 0) {
              result.push({ name: bname, volume, volumeValue, volumeUnit, currentPrice, originalPrice, discountPercent, isPromo, sku });
            }
          } catch { /* skip */ }
        });

        return result;
      });

      console.log(`  📦 ${variants.length} variantes trouvées dans la modale`);
      variants.forEach(v => {
        const promo = v.isPromo ? ` (original: ${v.originalPrice}€, -${v.discountPercent}%)` : '';
        console.log(`     • ${v.volume} → ${v.currentPrice}€${promo}`);
      });

      // Fermer la modale (avec timeout strict pour ne pas bloquer)
      try {
        await Promise.race([
          (async () => {
            const closeButton = await page.$('.ui-dialog-titlebar-close, .close-button, [aria-label="Close"]');
            if (closeButton) await closeButton.click();
            else await page.keyboard.press('Escape');
          })(),
          new Promise(resolve => setTimeout(resolve, 2000)),
        ]);
      } catch { /* ignore */ }

    } catch (err) {
      console.log(`  ⚠️ Impossible d'ouvrir la modale des variantes:`, err instanceof Error ? err.message : err);
    }
  }

  // Si pas de variantes dans la modale, fallback sur le prix principal
  if (variants.length === 0) {
    console.log('  📐 Pas de modale, extraction prix principal...');

    const mainData = await page.evaluate(() => {
      // Helper: extraire proprement un prix depuis du texte
      const extractPrice = (text: string | null | undefined): number => {
        if (!text) return 0;
        const m = text.match(/(\d+)[,\.](\d{2})/);
        if (m) return parseFloat(`${m[1]}.${m[2]}`);
        const m2 = text.match(/(\d+)/);
        return m2 ? parseInt(m2[1]) : 0;
      };

      // Prix promo (soldes/promotions Sephora)
      let currentPrice = 0;
      let originalPrice = 0;
      let isPromo = false;

      // Prix promo rouge
      const promoEl = document.querySelector('.product-price .price-sales.prior-price-red, .product-pricing .price-sales.prior-price-red');
      if (promoEl) {
        currentPrice = extractPrice(promoEl.textContent);
        isPromo = true;

        const oldEl = document.querySelector('.product-price .price-standard, .product-pricing .price-standard');
        if (oldEl) {
          originalPrice = extractPrice(oldEl.textContent) || currentPrice;
        }
      }

      // Prix normal
      if (!currentPrice) {
        const normalEl = document.querySelector('.product-price .price-sales-standard, .product-pricing .price-sales-standard');
        if (normalEl) {
          currentPrice = extractPrice(normalEl.textContent);
          originalPrice = currentPrice;
        }
      }

      // Fallback: "À partir de"
      if (!currentPrice) {
        const minEl = document.querySelector('.product-min-price, .product-sales-price');
        if (minEl) {
          currentPrice = extractPrice(minEl.textContent);
          originalPrice = currentPrice;
        }
      }

      // Volume depuis la page
      let volume = '';
      const variationTitle = document.querySelector('span.variation-title.bidirectional, .variation-title');
      if (variationTitle) {
        const text = variationTitle.textContent?.trim() || '';
        if (/\d+\s*(ml|g)/i.test(text)) volume = text;
      }
      if (!volume) {
        const variationEls = document.querySelectorAll('.product-variation-name, .variation-selected, .product-size-label');
        for (const el of variationEls) {
          const text = el.textContent?.trim() || '';
          if (/\d+\s*(ml|g)/i.test(text)) { volume = text; break; }
        }
      }

      return { currentPrice, originalPrice, isPromo, volume };
    });

    if (mainData.currentPrice > 0) {
      const vm = mainData.volume.match(/(\d+(?:[.,]\d+)?)\s*(ml|g)/i);
      variants.push({
        name: mainData.volume || 'unique',
        volume: vm ? `${vm[1]} ${vm[2].toLowerCase()}` : mainData.volume,
        volumeValue: vm ? parseFloat(vm[1].replace(',', '.')) : 0,
        volumeUnit: vm ? vm[2].toLowerCase() : '',
        currentPrice: mainData.currentPrice,
        originalPrice: mainData.originalPrice || mainData.currentPrice,
        discountPercent: mainData.isPromo && mainData.originalPrice > mainData.currentPrice
          ? Math.round((1 - mainData.currentPrice / mainData.originalPrice) * 100)
          : 0,
        isPromo: mainData.isPromo,
        sku: '',
      });
      const promo = mainData.isPromo ? ` (original: ${mainData.originalPrice}€)` : '';
      console.log(`  🏷️  Mono-taille: ${mainData.volume || '?'} → ${mainData.currentPrice}€${promo}`);
    }
  }

  return { variants, name, inStock: !outOfStock };
}

// ── NOUVELLE FONCTION : Extraction directe depuis URL (sans search/GPT) ──

export async function extractSephoraPriceFromUrl(
  productUrl: string,
  targetVolume?: string
): Promise<CompetitorPriceResult> {
  console.log(`\n  ${'═'.repeat(55)}`);
  console.log(`  🔗 SEPHORA — Extraction directe depuis URL`);
  console.log(`  ${productUrl}`);
  console.log(`  ${'═'.repeat(55)}`);

  const t0 = Date.now();
  const browser = await getBrowser();
  const page = await createStealthPage(browser);

  // Polyfill esbuild __name
  await page.addInitScript('window.__name = function(fn) { return fn; }');

  try {
    await simulateHumanBehavior(page);

    const { variants, name: productName, inStock } = await extractVariants(page, productUrl);

    const bestVariant = variants.length > 0 ? findBestVariant(variants, targetVolume) : null;
    if (!bestVariant || bestVariant.currentPrice <= 0) {
      return { found: false, site: 'sephora', productUrl, error: 'Prix invalide', matchMethod: 'direct_url' };
    }

    const dur = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`\n  ✅ ${bestVariant.currentPrice}€ (${bestVariant.volume}) — ${dur}s`);

    return {
      found: true,
      site: 'sephora',
      productUrl,
      productName,
      currentPrice: bestVariant.currentPrice,
      originalPrice: bestVariant.originalPrice > bestVariant.currentPrice ? bestVariant.originalPrice : undefined,
      volume: bestVariant.volume,
      inStock,
      matchConfidence: 100, // Direct URL = 100%
      matchMethod: 'direct_url',
    };

  } catch (error) {
    console.error(`  ❌ Erreur:`, error instanceof Error ? error.message : error);
    return { found: false, site: 'sephora', productUrl, error: error instanceof Error ? error.message : 'Erreur', matchMethod: 'direct_url' };
  } finally {
    await closePage(page);
  }
}

// ── Fonction principale ──────────────────────────────────────────────

export async function searchSephoraPrice(
  searchQuery: string,
  targetVolume?: string,
  dealInfo?: { brand: string; name: string; category?: string }
): Promise<CompetitorPriceResult> {
  console.log(`\n  ${'═'.repeat(55)}`);
  console.log(`  🔎 SEPHORA — "${searchQuery}" (${targetVolume || '?'})`);
  console.log(`  ${'═'.repeat(55)}`);

  const t0 = Date.now();
  const browser = await getBrowser();
  const page = await createStealthPage(browser);

  // Polyfill esbuild __name (tsx injecte __name() dans les fonctions nommées,
  // mais il n'existe pas dans le contexte navigateur de page.evaluate)
  await page.addInitScript('window.__name = function(fn) { return fn; }');

  try {
    const brand = dealInfo?.brand || '';
    const name = dealInfo?.name || searchQuery;
    const queries = prepareQueries(brand, name);

    // Étape 1 : Rechercher via URL directe
    let products: SephoraProduct[] = [];
    for (const q of queries) {
      products = await searchByUrl(page, q);
      if (products.length > 0) break;
      console.log(`  ⚠️  0 résultat, query suivante...`);
    }

    if (!products.length) {
      return { found: false, site: 'sephora', error: 'Aucun résultat', matchMethod: 'url_search' };
    }

    // Étape 2 : Sélection GPT
    console.log(`\n  ━━ SÉLECTION GPT ━━`);
    const match = await selectBestMatch(products, { brand, name, volume: targetVolume, category: dealInfo?.category });
    if (!match) {
      return { found: false, site: 'sephora', error: 'Aucun match GPT', matchMethod: 'url_search' };
    }

    const selected = products[match.index - 1];

    // Étape 3 : Extraction prix sur la fiche
    console.log(`\n  ━━ EXTRACTION PRIX ━━`);
    const { variants, name: productName, inStock } = await extractVariants(page, selected.url);

    const bestVariant = variants.length > 0 ? findBestVariant(variants, targetVolume) : null;
    // Prix final = prix modale > prix de la grille
    const finalPrice = bestVariant?.currentPrice || selected.price;
    const finalOriginalPrice = bestVariant?.originalPrice || selected.originalPrice;
    const finalVolume = bestVariant?.volume || selected.volume;

    if (!finalPrice) {
      return { found: false, site: 'sephora', productUrl: selected.url, error: 'Prix invalide', matchMethod: 'url_search' };
    }

    const dur = ((Date.now() - t0) / 1000).toFixed(1);
    const promoInfo = finalOriginalPrice > finalPrice ? ` (original: ${finalOriginalPrice}€)` : '';
    console.log(`\n  ✅ ${finalPrice}€${promoInfo} (${finalVolume}) — ${match.confidence}% — ${dur}s`);

    return {
      found: true,
      site: 'sephora',
      productUrl: selected.url,
      productName: productName || selected.fullTitle,
      currentPrice: finalPrice,
      originalPrice: finalOriginalPrice > finalPrice ? finalOriginalPrice : undefined,
      volume: finalVolume,
      inStock: inStock && selected.inStock,
      matchConfidence: match.confidence,
      matchMethod: 'url_search',
      rawLLMResponse: match.reason,
    };

  } catch (error) {
    console.error(`  ❌ Erreur:`, error instanceof Error ? error.message : error);
    return { found: false, site: 'sephora', error: error instanceof Error ? error.message : 'Erreur', matchMethod: 'url_search' };
  } finally {
    await closePage(page);
  }
}

// ── CLI ──────────────────────────────────────────────────────────────

if (require.main === module) {
  (async () => {
    const query = process.argv[2] || "Dior J'adore Eau de Parfum";
    const volume = process.argv[3] || '100ml';
    const brand = process.argv[4] || query.split(' ')[0];
    console.log(`\n🧪 TEST: "${query}" (${volume})\n`);
    const result = await searchSephoraPrice(query, volume, { brand, name: query });
    console.log(`\n📊 Résultat:`, JSON.stringify(result, null, 2));
    const { closeBrowser } = await import('./search-utils');
    await closeBrowser();
    process.exit(0);
  })();
}
