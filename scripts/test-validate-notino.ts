/**
 * =============================================================================
 * TEST-VALIDATE-NOTINO.TS - Test extraction page produit Notino (sans DB)
 * =============================================================================
 * 
 * Test sur UNE page produit Notino pour valider les sélecteurs :
 *   - Titre (marque + nom + description)
 *   - Prix simple (sans code promo)
 *   - Prix avec code promo (code + prix réduit)
 *   - Prix barré (original) + % réduction
 *   - Volume/contenance dans la page
 *   - Variantes de volume (150ml, 100ml, etc.) avec leurs prix
 *   - Stock
 *   - Labels (Promo, FreeDelivery, etc.)
 * 
 * Usage: npx tsx scripts/test-validate-notino.ts [URL]
 * 
 * Exemples:
 *   npx tsx scripts/test-validate-notino.ts
 *   npx tsx scripts/test-validate-notino.ts https://www.notino.fr/versace/bright-crystal-eau-de-toilette-pour-femme/
 * =============================================================================
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';

// ============================================================================
// TYPES
// ============================================================================

interface NotinoVariant {
  name: string;            // Ex: "150 ml", "100 ml", "18 g"
  volumeValue: number;     // Ex: 150, 100, 18
  volumeUnit: string;      // Ex: "ml", "g"
  currentPrice: number;    // Prix actuel (ou prix avec code si disponible)
  originalPrice: number;   // Prix barré (ou currentPrice si pas de promo)
  discountPercent: number; // % de réduction
  isPromo: boolean;        // true si en promo
  isSelected: boolean;     // true si c'est la variante actuellement affichée
  url: string;             // URL de la variante (chaque variante a sa propre page)
}

interface NotinoProductInfo {
  brand: string;
  name: string;
  description: string;
  fullTitle: string;
  currentPrice: number;          // Prix affiché principal
  priceWithCode: number | null;  // Prix avec code promo (si dispo)
  promoCode: string | null;      // Code promo (ex: "love", "DNS00793")
  originalPrice: number;         // Prix barré (si promo)
  discountPercent: number;       // % de réduction
  isPromo: boolean;
  volume: string | null;         // Volume principal affiché
  variants: NotinoVariant[];     // Toutes les variantes de volume
  inStock: boolean;
  labels: string[];              // Labels (Promo, FreeDelivery, etc.)
  url: string;
  scrapedAt: Date;
}

// ============================================================================
// HELPERS
// ============================================================================

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parseVolume(text: string): { value: number; unit: string } | null {
  const match = text.match(/([\d]+(?:[,.][\d]+)?)\s*(ml|g|l|cl|oz|kg)\b/i);
  if (match) {
    return {
      value: parseFloat(match[1].replace(',', '.')),
      unit: match[2].toLowerCase(),
    };
  }
  return null;
}

// ============================================================================
// SCRAPE UNE PAGE PRODUIT NOTINO
// ============================================================================

async function scrapeNotinoProductPage(page: Page, url: string): Promise<NotinoProductInfo | null> {
  try {
    console.log(`\n🔗 Navigation vers: ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Attendre le titre produit
    await page.waitForSelector('h1[data-testid="pd-header-title"]', { timeout: 15000 });
    console.log('   ✅ Page chargée');

    // Fermer le popup cookies Usercentrics
    await delay(2000);
    await page.evaluate(() => {
      if (typeof (window as any).UC_UI !== 'undefined') {
        (window as any).UC_UI.acceptAllConsents();
        (window as any).UC_UI.closeCMP();
      }
      const aside = document.querySelector('#usercentrics-cmp-ui');
      if (aside) aside.remove();
    }).catch(() => {});
    console.log('   🍪 Cookies gérés');

    // Attendre un peu que tout se charge
    await delay(1500);

    // ============================================================
    // EXTRACTION COMPLÈTE VIA page.evaluate()
    // ============================================================
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
        labels: [],
        variants: [],
      };

      // ========== TITRE ==========
      const titleEl = document.querySelector('h1[data-testid="pd-header-title"]');
      if (titleEl) {
        // Marque : lien dans le titre (classe bjrv267 ou premier <a>)
        const brandLink = titleEl.querySelector('a');
        result.brand = brandLink?.textContent?.trim() || '';

        // Nom produit : span avec classe s1vwrfio ou second span
        const nameSpans = titleEl.querySelectorAll('span');
        for (const span of nameSpans) {
          const text = span.textContent?.trim() || '';
          // Exclure le brand (qui est dans un <a> à l'intérieur d'un span)
          if (text && !span.querySelector('a') && !span.closest('a')) {
            if (!result.name) {
              result.name = text;
            } else if (!result.description) {
              result.description = text;
            }
          }
        }
      }

      // ========== PRIX PRINCIPAL (dans #pdSelectedVariant) ==========
      const selectedVariantArea = document.querySelector('#pdSelectedVariant');
      if (selectedVariantArea) {
        const mainPriceWrapper = selectedVariantArea.querySelector('[data-testid="pd-price-wrapper"]');
        if (mainPriceWrapper) {
          const priceSpan = mainPriceWrapper.querySelector('span[content]');
          if (priceSpan) {
            const priceVal = parseFloat(priceSpan.getAttribute('content')?.replace(',', '.') || '0');
            result.currentPrice = priceVal;
            result.originalPrice = priceVal;
          }
        }
        // Volume de la variante sélectionnée (ex: "90 ml")
        const spans = selectedVariantArea.querySelectorAll('span');
        for (const span of spans) {
          const text = span.textContent?.trim() || '';
          if (/^\d+(?:[,.]\d+)?\s*(ml|g|l|cl|oz|kg)$/i.test(text)) {
            result.volume = text;
            break;
          }
        }
      }
      // Fallback prix
      if (!result.currentPrice) {
        const priceWrapper = document.querySelector('[data-testid="pd-price-wrapper"]');
        if (priceWrapper) {
          const priceSpan = priceWrapper.querySelector('span[content]');
          if (priceSpan) {
            const priceVal = parseFloat(priceSpan.getAttribute('content')?.replace(',', '.') || '0');
            result.currentPrice = priceVal;
            result.originalPrice = priceVal;
          }
        }
      }

      // ========== PRODUCT SPECIFICATIONS (stock, code promo, prix/unité) ==========
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

      // ========== PRIX AVEC CODE PROMO ==========
      const pageText = document.body.innerText;
      // Fallback: "avec le code XXX"
      if (!result.promoCode) {
        const codeMatch = pageText.match(/avec le code\s+(\w+)/i);
        if (codeMatch) {
          result.promoCode = codeMatch[1];
        }
      }

      // Prix avec code : chercher un pd-price-wrapper lié au code
      const codepriceContainers = document.querySelectorAll('[data-testid="pd-price-wrapper"]');
      if (codepriceContainers.length > 1) {
        for (const container of codepriceContainers) {
          const parentText = container.parentElement?.textContent || '';
          if (parentText.includes('avec le code') || parentText.includes('Code :')) {
            const codePriceSpan = container.querySelector('span[content]');
            if (codePriceSpan) {
              result.priceWithCode = parseFloat(codePriceSpan.getAttribute('content')?.replace(',', '.') || '0');
            }
          }
        }
      }

      // Fallback prix code dans le texte brut
      if (result.promoCode && !result.priceWithCode) {
        const codePriceMatch = pageText.match(/([\d]+[,.][\d]+)\s*€\s*avec le code/i);
        if (codePriceMatch) {
          result.priceWithCode = parseFloat(codePriceMatch[1].replace(',', '.'));
        }
      }

      // ========== PRIX BARRÉ (ORIGINAL) ==========
      // Chercher "Prix actuel" ou le prix barré
      const allSpans = document.querySelectorAll('span');
      for (const span of allSpans) {
        const text = span.textContent?.trim() || '';
        // Prix barré : souvent dans un span avec text-decoration: line-through
        const style = window.getComputedStyle(span);
        if (style.textDecoration.includes('line-through')) {
          const barredMatch = text.match(/([\d]+[,.][\d]+)/);
          if (barredMatch) {
            const barredPrice = parseFloat(barredMatch[1].replace(',', '.'));
            if (barredPrice > result.currentPrice) {
              result.originalPrice = barredPrice;
            }
          }
        }
      }

      // Chercher le % de réduction dans le texte
      const discountMatch = pageText.match(/(-\s*\d+)\s*%/);
      if (discountMatch) {
        result.discountPercent = Math.abs(parseInt(discountMatch[1].replace(/\s/g, '')));
        result.isPromo = true;
      }

      // Si pas de % mais prix barré > prix courant → calculer
      if (!result.discountPercent && result.originalPrice > result.currentPrice) {
        result.discountPercent = Math.round((1 - result.currentPrice / result.originalPrice) * 100);
        result.isPromo = true;
      }

      // ========== VOLUME (fallback si pas trouvé dans #pdSelectedVariant) ==========
      if (!result.volume) {
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

      // ========== VARIANTES DE VOLUME ==========
      // Les variantes sont des <a data-testid="pd-variant-XXXXX"> dans des <li>
      const variantLinks = document.querySelectorAll('a[data-testid^="pd-variant-"]');
      for (const link of variantLinks) {
        // Ignorer les variantes couleur
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

      // ========== STOCK ==========
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

      // ========== LABELS ==========
      const defaultLabels = document.querySelectorAll('[data-testid="default-product-label"]');
      for (const label of defaultLabels) {
        const text = label.textContent?.trim();
        if (text) result.labels.push(text);
      }
      const cornerLabels = document.querySelectorAll('[data-testid="corner-product-label"]');
      for (const label of cornerLabels) {
        const text = label.textContent?.trim();
        if (text) result.labels.push(text);
      }

      return result;
    });

    // Parser les volumes des variantes
    const variants: NotinoVariant[] = data.variants.map((v: any) => {
      const parsed = parseVolume(v.name);
      return {
        name: v.name,
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

    // Parser le volume principal
    const mainVolume = data.volume;
    const fullTitle = [data.brand, data.name, data.description].filter(Boolean).join(' ');

    return {
      brand: data.brand,
      name: data.name,
      description: data.description,
      fullTitle,
      currentPrice: data.currentPrice,
      priceWithCode: data.priceWithCode,
      promoCode: data.promoCode,
      originalPrice: data.originalPrice,
      discountPercent: data.discountPercent,
      isPromo: data.isPromo,
      volume: mainVolume,
      variants,
      inStock: data.inStock,
      labels: data.labels,
      url,
      scrapedAt: new Date(),
    };

  } catch (err) {
    console.error(`   ❌ Erreur scraping: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  // URLs de test (variété de cas)
  const testUrls = process.argv.slice(2).length > 0
    ? process.argv.slice(2)
    : [
        // Prix simple (sans code promo)
        'https://www.notino.fr/versace/bright-crystal-eau-de-toilette-pour-femme/',
        // Prix avec code promo (si dispo) — on teste différents types
        'https://www.notino.fr/thierry-mugler/alien-eau-de-parfum-pour-femme/',
        // Produit avec variantes de volume
        'https://www.notino.fr/hugo-boss/boss-bottled-eau-de-toilette-pour-homme/',
      ];

  console.log('🧪 TEST VALIDATION NOTINO - Extraction page produit');
  console.log('═'.repeat(60));
  console.log(`📋 ${testUrls.length} page(s) à tester\n`);

  const browser = await chromium.launch({
    headless: false,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ],
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    locale: 'fr-FR',
    viewport: { width: 1920, height: 1080 },
  });

  const page = await context.newPage();

  for (const url of testUrls) {
    console.log('\n' + '═'.repeat(60));
    const info = await scrapeNotinoProductPage(page, url);

    if (!info) {
      console.log('   ❌ Échec extraction');
      continue;
    }

    // ============ AFFICHAGE RÉSULTAT ============
    console.log(`\n   📦 PRODUIT:`);
    console.log(`      Marque:      ${info.brand || '???'}`);
    console.log(`      Nom:         ${info.name || '???'}`);
    console.log(`      Description: ${info.description || '—'}`);
    console.log(`      Titre:       ${info.fullTitle}`);
    console.log(`      Volume:      ${info.volume || 'N/A'}`);
    console.log(`      En stock:    ${info.inStock ? '✅ Oui' : '❌ Non'}`);
    console.log(`      Labels:      ${info.labels.length > 0 ? info.labels.join(', ') : '—'}`);

    console.log(`\n   💰 PRIX:`);
    console.log(`      Prix actuel:     ${info.currentPrice} €`);
    if (info.priceWithCode) {
      console.log(`      Prix avec code:  ${info.priceWithCode} € (code: ${info.promoCode})`);
    }
    if (info.isPromo) {
      console.log(`      Prix original:   ${info.originalPrice} € (barré)`);
      console.log(`      Réduction:       -${info.discountPercent}%`);
    } else {
      console.log(`      Pas de promo détectée`);
    }

    if (info.variants.length > 0) {
      console.log(`\n   📦 VARIANTES DE VOLUME (${info.variants.length}):`);
      for (const v of info.variants) {
        const selected = v.isSelected ? ' ← SÉLECTIONNÉ' : '';
        console.log(`      ${v.name}: ${v.currentPrice} €${selected} — ${v.url || 'pas d\'URL'}`);
      }
    } else {
      console.log(`\n   📦 Pas de variantes de volume`);
    }

    console.log('');

    // Délai entre les pages
    await delay(3000);
  }

  await page.close();
  await context.close();
  await browser.close();

  console.log('\n' + '═'.repeat(60));
  console.log('✅ Test terminé');
}

main().catch(console.error);
