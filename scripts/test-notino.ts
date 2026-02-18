/**
 * =============================================================================
 * TEST-NOTINO.TS - Test scraping Notino (Full Playwright, pas de DB)
 * =============================================================================
 * 
 * Notino = Cloudflare → full Playwright obligatoire.
 * Clique sur "Afficher plus" pour charger tous les produits.
 * 
 * Usage: npx tsx scripts/test-notino.ts
 * =============================================================================
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import * as cheerio from 'cheerio';

// ============================================================================
// CONFIG
// ============================================================================

const URLS = [
  { url: 'https://www.notino.fr/parfums-promotions/', category: 'parfums' },
];

interface NotinoProduct {
  brand: string;
  name: string;
  variant: string;
  currentPrice: number;
  priceWithCode: number | null;
  promoCode: string | null;
  productUrl: string;
  imageUrl: string;
  category: string;
  sku: string;
  rating: number | null;
  reviewCount: number | null;
  labels: string[];
  volume: string | null;
}

// ============================================================================
// HELPERS
// ============================================================================

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function extractVolume(text: string): string | null {
  const match = text.match(/([\d]+(?:[,.][\d]+)?)\s*(ml|g|l|cl|oz)\b/i);
  if (match) {
    const value = match[1].replace(',', '.');
    const unit = match[2].toLowerCase();
    return `${value}${unit}`;
  }
  return null;
}

function parsePrice(text: string): number | null {
  const match = text.replace(/\s/g, '').match(/([\d]+[,.]?[\d]*)/);
  if (match) return parseFloat(match[1].replace(',', '.'));
  return null;
}

// ============================================================================
// EXTRACT PRODUCTS WITH PLAYWRIGHT LOCATORS
// ============================================================================

async function extractProductsFromPage(page: Page, category: string): Promise<NotinoProduct[]> {
  // Un seul appel pour récupérer tout le HTML, puis Cheerio parse instantanément
  const html = await page.content();
  const $ = cheerio.load(html);
  const products: NotinoProduct[] = [];

  $('[data-testid="product-container"]').each((_, container) => {
    try {
      const $c = $(container);

      // SKU
      const sku = $c.attr('data-product') || '';

      // URL
      const href = $c.find('a').first().attr('href') || '';
      const productUrl = href ? `https://www.notino.fr${href}` : '';
      if (!productUrl) return;

      // Image (srcset haute résolution)
      const $img = $c.find('img[loading="lazy"]').first();
      let imageUrl = '';
      const srcset = $img.attr('srcset') || '';
      if (srcset) {
        const sources = srcset.split(',').map(s => s.trim());
        const lastSource = sources[sources.length - 1];
        if (lastSource) imageUrl = lastSource.split(' ')[0];
      }
      if (!imageUrl) imageUrl = $img.attr('src') || '';

      // Brand
      const brand = $c.find('[data-testid="product-tile-brand"]').first().text().trim();

      // Nom produit
      const name = $c.find('[data-testid="product-tile-name"]').first().text().trim();

      // Variant (contient souvent le volume)
      const variant = $c.find('[data-testid="product-tile-variant-name"]').first().text().trim();

      // Labels (Promo, Cadeaux offerts, etc.)
      const labels: string[] = [];
      $c.find('[data-testid="default-product-label"]').each((_, label) => {
        const text = $(label).text().trim();
        if (text) labels.push(text);
      });

      // Prix principal
      const priceText = $c.find('[data-testid="price-component"]').first().text().trim();
      const currentPrice = parsePrice(priceText);
      if (!currentPrice || currentPrice <= 0) return;

      // Prix avec code promo — chercher "X,XX € avec le code XXX"
      let priceWithCode: number | null = null;
      let promoCode: string | null = null;
      const fullText = $c.text();
      const codeMatch = fullText.match(/([\d]+[,.][\d]+)\s*€\s*avec le code\s+(\w+)/i);
      if (codeMatch) {
        priceWithCode = parseFloat(codeMatch[1].replace(',', '.'));
        promoCode = codeMatch[2];
      }

      // Rating
      let rating: number | null = null;
      let reviewCount: number | null = null;
      const ratingWrapper = $c.find('[data-testid="ratings-wrapper"]').first();
      if (ratingWrapper.length > 0) {
        const ratingTexts = ratingWrapper.text();
        const rMatch = ratingTexts.match(/([\d]+[,.][\d]+)/);
        if (rMatch) rating = parseFloat(rMatch[1].replace(',', '.'));
        const rcMatch = ratingTexts.match(/\((\d+)\)/);
        if (rcMatch) reviewCount = parseInt(rcMatch[1]);
      }

      // Volume
      const volume = extractVolume(variant);
      const fullName = [brand, name].filter(Boolean).join(' ');

      products.push({
        brand,
        name: fullName,
        variant,
        currentPrice,
        priceWithCode,
        promoCode,
        productUrl,
        imageUrl,
        category,
        sku,
        rating,
        reviewCount,
        labels,
        volume,
      });
    } catch (err) {
      // skip
    }
  });

  return products;
}

// ============================================================================
// CLICK "AFFICHER PLUS" UNTIL NO MORE
// ============================================================================

async function loadAllProducts(page: Page): Promise<void> {
  let clickCount = 0;
  const MAX_CLICKS = 5; // Max 5 clics pour le test

  while (clickCount < MAX_CLICKS) {
    const showMoreBtn = page.locator('[data-testid="footer-action-button"]');
    const btnCount = await showMoreBtn.count();
    
    if (btnCount === 0) break;

    // Vérifier que le bouton est visible
    const isVisible = await showMoreBtn.first().isVisible().catch(() => false);
    if (!isVisible) break;

    // Scroll vers le bouton puis clic
    await showMoreBtn.first().scrollIntoViewIfNeeded();
    await delay(500);
    await showMoreBtn.first().click();
    clickCount++;

    // Attendre le chargement des nouveaux produits
    await delay(2000);

    // Compter les produits actuels
    const productCount = await page.locator('[data-testid="product-container"]').count();
    console.log(`      ↳ Clic ${clickCount}: ${productCount} produits chargés`);
  }

  if (clickCount > 0) {
    console.log(`   📥 ${clickCount} clics "Afficher plus" effectués`);
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('═'.repeat(70));
  console.log('🧪 TEST SCRAPING NOTINO.FR (Full Playwright)');
  console.log('═'.repeat(70));

  const browser: Browser = await chromium.launch({ headless: false });
  const allProducts: NotinoProduct[] = [];

  try {
    for (let i = 0; i < URLS.length; i++) {
      const { url, category } = URLS[i];
      console.log(`\n${'─'.repeat(70)}`);
      console.log(`📄 Page ${i + 1}/${URLS.length}: ${category}`);
      console.log(`   ${url}`);

      // Nouveau contexte par page (Cloudflare)
      const context: BrowserContext = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        locale: 'fr-FR',
        viewport: { width: 1920, height: 1080 },
      });
      const page: Page = await context.newPage();

      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

        // Attendre les produits
        await page.waitForSelector('[data-testid="product-container"]', { timeout: 25000 });
        console.log(`   ✅ Page chargée`);

        // Fermer le popup cookies Usercentrics (bloque les clics sinon)
        try {
          // Attendre un peu que le popup apparaisse
          await delay(2000);
          // Essayer via le shadow DOM de Usercentrics
          const dismissed = await page.evaluate(() => {
            // Méthode 1: API Usercentrics
            if (typeof (window as any).UC_UI !== 'undefined') {
              (window as any).UC_UI.acceptAllConsents();
              (window as any).UC_UI.closeCMP();
              return true;
            }
            // Méthode 2: supprimer l'overlay directement
            const aside = document.querySelector('#usercentrics-cmp-ui');
            if (aside) { aside.remove(); return true; }
            return false;
          });
          if (dismissed) console.log('   🍪 Popup cookies fermé');
        } catch { /* pas de cookie popup */ }

        // Charger tous les produits via "Afficher plus"
        await loadAllProducts(page);

        // Extraire les produits
        const products = await extractProductsFromPage(page, category);
        console.log(`   ✅ ${products.length} produits extraits`);

        // Dédoublonner
        for (const p of products) {
          if (!allProducts.find(existing => existing.productUrl === p.productUrl)) {
            allProducts.push(p);
          }
        }

        // Afficher les 3 premiers
        products.slice(0, 3).forEach((p, idx) => {
          console.log(`\n   📊 Produit ${idx + 1}:`);
          console.log(`      Marque: ${p.brand}`);
          console.log(`      Nom: ${p.name}`);
          console.log(`      Variant: ${p.variant}`);
          console.log(`      Volume: ${p.volume || '-'}`);
          console.log(`      Prix: ${p.currentPrice}€`);
          if (p.priceWithCode) {
            console.log(`      Prix code "${p.promoCode}": ${p.priceWithCode}€`);
          }
          console.log(`      Labels: ${p.labels.join(', ') || '-'}`);
          console.log(`      Note: ${p.rating || '-'} (${p.reviewCount || 0} avis)`);
          console.log(`      URL: ${p.productUrl}`);
          console.log(`      SKU: ${p.sku}`);
        });

      } catch (err) {
        console.log(`   ❌ Erreur: ${(err as Error).message}`);
      } finally {
        await page.close();
        await context.close();
      }

      // Attente entre pages
      if (i < URLS.length - 1) {
        const waitTime = 3000 + Math.random() * 2000;
        console.log(`\n   ⏳ Attente ${(waitTime / 1000).toFixed(1)}s...`);
        await delay(waitTime);
      }
    }
  } finally {
    await browser.close();
  }

  // ============================================================================
  // RAPPORT
  // ============================================================================
  console.log(`\n${'═'.repeat(70)}`);
  console.log('📊 RAPPORT FINAL');
  console.log('═'.repeat(70));
  console.log(`\n📦 Total produits (dédoublonnés): ${allProducts.length}`);

  if (allProducts.length === 0) {
    console.log('\n❌ Aucun produit récupéré.');
    return;
  }

  const byCategory: Record<string, number> = {};
  for (const p of allProducts) {
    byCategory[p.category] = (byCategory[p.category] || 0) + 1;
  }
  console.log('\nPar catégorie:');
  for (const [cat, count] of Object.entries(byCategory)) {
    console.log(`   ${cat}: ${count}`);
  }

  const prices = allProducts.map(p => p.currentPrice);
  console.log(`\nPrix: min=${Math.min(...prices).toFixed(2)}€ | max=${Math.max(...prices).toFixed(2)}€ | moy=${(prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2)}€`);

  const withCode = allProducts.filter(p => p.promoCode);
  console.log(`Avec code promo: ${withCode.length} (${(withCode.length / allProducts.length * 100).toFixed(0)}%)`);

  const withVolume = allProducts.filter(p => p.volume);
  console.log(`Avec volume: ${withVolume.length} (${(withVolume.length / allProducts.length * 100).toFixed(0)}%)`);

  const withRating = allProducts.filter(p => p.rating);
  console.log(`Avec rating: ${withRating.length} (${(withRating.length / allProducts.length * 100).toFixed(0)}%)`);

  // Top marques
  const byBrand: Record<string, number> = {};
  for (const p of allProducts) {
    byBrand[p.brand] = (byBrand[p.brand] || 0) + 1;
  }
  const topBrands = Object.entries(byBrand).sort((a, b) => b[1] - a[1]).slice(0, 15);
  console.log('\nTop 15 marques:');
  for (const [brand, count] of topBrands) {
    console.log(`   ${brand}: ${count}`);
  }

  // Exemples code promo
  if (withCode.length > 0) {
    console.log('\n🏷️ Exemples produits avec code promo:');
    withCode.slice(0, 5).forEach(p => {
      console.log(`   ${p.name} — ${p.currentPrice}€ → ${p.priceWithCode}€ avec code "${p.promoCode}"`);
    });
  }

  console.log(`\n${'═'.repeat(70)}`);
  console.log('✅ Test terminé !');
  console.log('═'.repeat(70));
}

main().catch(console.error);
