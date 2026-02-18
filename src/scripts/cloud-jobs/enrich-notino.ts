/**
 * Cloud Run Job - Enrichissement Notino
 * Exécuté quotidiennement pour enrichir les deals avec GPT
 * 
 * - Récupère les deals Notino actifs sans whyGoodDeal
 * - Scrape les infos produit (description, ingrédients, propriétés, variantes)
 * - Réécrit en style City Baddies via GPT
 * - Met à jour Product et Deal dans la DB
 * 
 * Note: Les prix ne sont PAS modifiés ici, c'est VALIDATE qui gère ça.
 * Note: Nouveau contexte par produit pour éviter le blocage Cloudflare.
 */

import { chromium, Browser } from 'playwright';
import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';

const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Configuration
const DELAY_BETWEEN_DEALS = 2000;

// ============================================================================
// TYPES
// ============================================================================

interface ScrapedData {
  brand: string;
  name: string;
  fullTitle: string;
  description: string;
  ingredients: string;
  properties: Record<string, string>;
  variants: string[];  // Tailles uniquement: "150 ml", "100 ml", etc.
}

interface RewrittenContent {
  seoDescription: string;
  ingredients: string;
  application: string;
  whyGoodDeal: string;
  availableSizes: string;
}

interface PriceInfo {
  dealPrice: number;
  originalPrice: number;
  discountPercent: number;
  discountAmount: number;
}

// ============================================================================
// HELPERS
// ============================================================================

function parseVolume(volumeStr: string): { value: number | null; unit: string | null } {
  if (!volumeStr) return { value: null, unit: null };
  const match = volumeStr.match(/(\d+(?:[,\.]\d+)?)\s*(ml|g|l|kg|cl)/i);
  if (match) {
    const value = parseFloat(match[1].replace(',', '.'));
    const unit = match[2].toLowerCase();
    return { value: isNaN(value) ? null : value, unit };
  }
  return { value: null, unit: null };
}

// ============================================================================
// SCRAPING NOTINO
// ============================================================================

async function scrapeNotinoPage(browser: Browser, url: string): Promise<ScrapedData | null> {
  // Nouveau contexte par produit (anti-Cloudflare)
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    locale: 'fr-FR',
    viewport: { width: 1920, height: 1080 },
  });
  const page = await context.newPage();

  try {
    // Délai aléatoire avant navigation (2-5s)
    await page.waitForTimeout(2000 + Math.random() * 3000);

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

    // ===== TITRE (brand + name + subtitle) =====
    const titleData = await page.evaluate(() => {
      const titleEl = document.querySelector('h1[data-testid="pd-header-title"]');
      if (!titleEl) return { brand: '', name: '', subtitle: '' };

      const brandLink = titleEl.querySelector('a');
      const brand = brandLink?.textContent?.trim() || '';

      let name = '';
      let subtitle = '';
      const topSpans = titleEl.querySelectorAll(':scope > span');
      for (const topSpan of topSpans) {
        const innerSpans = topSpan.querySelectorAll('span');
        for (const span of innerSpans) {
          const text = span.textContent?.trim() || '';
          if (text && !span.querySelector('a') && !span.closest('a')) {
            if (!name) name = text;
          }
        }
        if (topSpan.classList.length > 0 && !topSpan.querySelector('a') && topSpan.querySelectorAll('span').length === 0) {
          subtitle = topSpan.textContent?.trim() || '';
        }
      }

      return { brand, name, subtitle };
    });

    const fullTitle = [titleData.brand, titleData.name, titleData.subtitle]
      .filter(Boolean)
      .join(' ')
      .trim();

    // ===== VARIANTES (tailles via .pd-variant-label) =====
    const variants: string[] = await page.evaluate(() => {
      const labels = document.querySelectorAll('.pd-variant-label');
      const results: string[] = [];
      for (const label of labels) {
        const text = label.textContent?.replace(/\u00a0/g, ' ')?.trim() || '';
        if (text && !results.includes(text)) {
          results.push(text);
        }
      }
      return results;
    });

    // Si aucune variante, chercher le volume dans #pdSelectedVariant
    if (variants.length === 0) {
      const singleVolume = await page.evaluate(() => {
        const selectedArea = document.querySelector('#pdSelectedVariant');
        if (!selectedArea) return null;
        const spans = selectedArea.querySelectorAll('span');
        for (const span of spans) {
          const text = span.textContent?.trim() || '';
          if (/^\d+(?:[,.]\d+)?\s*(ml|g|l|cl|oz|kg)$/i.test(text)) {
            return text;
          }
        }
        return null;
      });
      if (singleVolume) variants.push(singleVolume);
    }

    // ===== SCROLL vers les onglets =====
    await page.evaluate(() => {
      const tabAnchor = document.querySelector('#tabAnchor');
      if (tabAnchor) {
        tabAnchor.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
    await page.waitForTimeout(1500);

    // ===== DESCRIPTION (onglet Description) =====
    try {
      const descriptionTab = await page.$('h2[aria-controls="description-tab"]');
      if (descriptionTab) {
        const isExpanded = await descriptionTab.getAttribute('aria-expanded');
        if (isExpanded !== 'true') {
          await descriptionTab.click();
          await page.waitForTimeout(1000);
        }
      }
    } catch {
      // Pas grave
    }

    const description = await page.evaluate(() => {
      const descWrapper = document.querySelector('#pd-description-text[data-testid="pd-description-text"]');
      if (!descWrapper) return '';

      const clone = descWrapper.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('style, script, img').forEach(el => el.remove());

      let text = clone.innerHTML || '';
      text = text
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<\/li>/gi, '\n')
        .replace(/<li>/gi, '- ')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/\n\s*\n/g, '\n')
        .replace(/[ \t]+/g, ' ')
        .trim();

      return text;
    });

    // ===== PROPRIÉTÉS (tableau: Effet → blanchissant) =====
    const properties = await page.evaluate(() => {
      const props: Record<string, string> = {};
      const tables = document.querySelectorAll('#pd-description-wrapper table');
      for (const table of tables) {
        const rows = table.querySelectorAll('tr');
        for (const row of rows) {
          const cells = row.querySelectorAll('td');
          if (cells.length >= 2) {
            const key = cells[0].textContent?.trim() || '';
            const value = cells[1].textContent?.trim() || '';
            if (key && value) props[key] = value;
          }
        }
      }
      return props;
    });

    // ===== INGRÉDIENTS (onglet Composition) =====
    try {
      await page.evaluate(() => {
        const tabs = document.querySelectorAll('h2[aria-controls]');
        for (const tab of tabs) {
          if (tab.getAttribute('aria-controls') === 'composition-tab') {
            tab.scrollIntoView({ behavior: 'smooth', block: 'center' });
            break;
          }
        }
      });
      await page.waitForTimeout(800);

      const compositionTab = await page.$('h2[aria-controls="composition-tab"]');
      if (compositionTab) {
        const isExpanded = await compositionTab.getAttribute('aria-expanded');
        if (isExpanded !== 'true') {
          await compositionTab.click({ force: true });
          await page.waitForTimeout(1500);
        }
      }
    } catch {
      // Pas grave
    }

    const ingredients = await page.evaluate(() => {
      const compositionWrapper = document.querySelector('#pd-composition-wrapper[data-testid="pd-composition-wrapper"]');
      if (!compositionWrapper) return '';

      const ingredientsList = compositionWrapper.querySelector('.ttmat1a');
      if (!ingredientsList) return '';

      const paragraphs = ingredientsList.querySelectorAll('p');
      let inciList = '';
      for (const p of paragraphs) {
        const text = p.textContent?.trim() || '';
        if (text.toLowerCase().includes('fabricant est responsable')) continue;
        if (text.length === 0) continue;
        if (inciList) inciList += ' ';
        inciList += text;
      }

      return inciList.replace(/\s+/g, ' ').trim();
    });

    return {
      brand: titleData.brand,
      name: titleData.name,
      fullTitle,
      description,
      ingredients,
      properties,
      variants,
    };

  } catch (error) {
    console.error(`  ❌ Erreur scraping:`, error);
    return null;
  } finally {
    await context.close();
  }
}

// ============================================================================
// GPT REWRITING
// ============================================================================

async function rewriteWithGPT(data: ScrapedData, priceInfo: PriceInfo): Promise<RewrittenContent | null> {
  try {
    const sizesInfo = data.variants.length > 0
      ? data.variants.join(', ')
      : 'Taille unique ou non spécifié';

    const propsInfo = Object.entries(data.properties).length > 0
      ? Object.entries(data.properties).map(([k, v]) => `${k}: ${v}`).join(', ')
      : '';

    const prompt = `Tu es copywriter pour City Baddies, un site de bons plans beauté ciblant les jeunes femmes (18-35 ans) en France. Ton style d'écriture :
- Fun, décalé et empowering
- PAS D'EMOJI NI DE SMILEY dans tes textes, jamais
- Tu parles directement à la lectrice ("tu", "toi")
- Tu mets en avant le côté bon plan / économies
- Confiant et sans complexe sur le self-care
- TOUT EN FRANÇAIS

Réécris les infos produit suivantes dans la voix City Baddies. Reste informatif mais fais en sorte que ça claque !

**INFOS PRODUIT:**
- Marque: ${data.brand}
- Nom: ${data.name}
- Titre complet: ${data.fullTitle}
- Tailles/Contenances disponibles: ${sizesInfo}
- Propriétés: ${propsInfo || 'Non spécifiées'}
- Description originale: ${data.description?.substring(0, 600) || 'Pas de description'}
- Ingrédients (INCI): ${data.ingredients?.substring(0, 400) || 'Non listés'}

**INFOS PRIX:**
- Prix deal: ${priceInfo.dealPrice.toFixed(2)}€
- Prix original: ${priceInfo.originalPrice.toFixed(2)}€
- Réduction: -${priceInfo.discountPercent}% (${priceInfo.discountAmount.toFixed(2)}€ d'économie)

**FORMAT DE SORTIE (JSON uniquement, pas de markdown):**
{
  "seoDescription": "Description produit accrocheuse en 2-3 phrases pour le SEO (150-200 caractères). Punchy et met en avant les bénéfices clés.",
  "ingredients": "Réécris la section ingrédients de façon friendly et accessible. Explique ce que font les ingrédients clés. Si pas d'ingrédients, écris 'Les ingrédients ne sont pas disponibles pour ce produit.'",
  "application": "Génère des conseils d'utilisation fun et faciles à suivre basés sur la description du produit. Ajoute de la personnalité ! Si pas assez d'infos, écris 'Applique comme tu le sens, babe !'",
  "whyGoodDeal": "Explique en 1-2 phrases pourquoi c'est un bon deal. Mentionne le % de réduction, les économies réalisées, et pourquoi c'est le moment d'en profiter. Sois enthousiaste !",
  "availableSizes": "Liste les tailles/contenances disponibles formatées proprement (ex: '50ml, 100ml, 200ml'). Si taille unique, écris juste la taille. Si pas d'info, écris 'Taille standard'."
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 1000,
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) return null;

    const jsonStr = content.replace(/```json\n?|```\n?/g, '').trim();
    return JSON.parse(jsonStr) as RewrittenContent;
  } catch (error) {
    console.error('  ⚠️ GPT failed:', error);
    return null;
  }
}

// ============================================================================
// UPDATE DATABASE
// ============================================================================

async function updateDealWithScrapedData(
  dealId: string,
  productId: string,
  data: ScrapedData,
  rewritten: RewrittenContent | null
): Promise<void> {
  // Déterminer availableSizes
  let availableSizes = rewritten?.availableSizes || null;
  if (!availableSizes && data.variants.length > 0) {
    availableSizes = data.variants
      .map(v => {
        const { value, unit } = parseVolume(v);
        return value && unit ? `${value}${unit}` : v;
      })
      .filter(s => s)
      .join(', ');
  }

  // Mise à jour du Product
  await prisma.product.update({
    where: { id: productId },
    data: {
      description: data.description?.substring(0, 500) || null,
      seoDescription: rewritten?.seoDescription || null,
      availableSizes: availableSizes || null,
      ingredients: rewritten?.ingredients || data.ingredients?.substring(0, 2000) || null,
      application: rewritten?.application || null,
      classifications: Object.keys(data.properties).length > 0 ? data.properties : undefined,
    },
  });

  // Mise à jour du Deal
  const dealUpdateData: Record<string, unknown> = {
    refinedTitle: data.fullTitle,
    lastSeenAt: new Date(),
  };

  if (rewritten?.whyGoodDeal) {
    dealUpdateData.whyGoodDeal = rewritten.whyGoodDeal;
  }

  // Compléter le volume SI manquant (ne pas écraser les prix !)
  if (data.variants.length > 0) {
    // Prendre la première variante comme volume par défaut
    const selectedVariant = data.variants[0];
    const { value, unit } = parseVolume(selectedVariant);
    if (value && unit) {
      dealUpdateData.volumeValue = value;
      dealUpdateData.volumeUnit = unit;
      dealUpdateData.volume = selectedVariant;
    }
  }

  await prisma.deal.update({
    where: { id: dealId },
    data: dealUpdateData,
  });
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const startTime = Date.now();
  console.log('🚀 [CLOUD JOB] Enrichissement Notino...');
  console.log(`📅 Date: ${new Date().toISOString()}`);

  // Récupérer les deals Notino à enrichir (actifs, sans whyGoodDeal)
  const deals = await prisma.deal.findMany({
    where: {
      status: 'ACTIVE',
      whyGoodDeal: null,
      product: {
        productUrl: { contains: 'notino.fr' },
      },
    },
    select: {
      id: true,
      title: true,
      productId: true,
      dealPrice: true,
      originalPrice: true,
      discountPercent: true,
      discountAmount: true,
      product: {
        select: {
          id: true,
          name: true,
          productUrl: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  console.log(`📊 ${deals.length} deal(s) Notino à enrichir\n`);

  if (deals.length === 0) {
    console.log('✅ Aucun deal à enrichir (tous déjà traités)');
    await prisma.$disconnect();
    process.exit(0);
  }

  // Lancer le navigateur (un seul browser, mais nouveau contexte par produit)
  const browser = await chromium.launch({
    headless: true,
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

  let success = 0;
  let errors = 0;

  try {
    for (let i = 0; i < deals.length; i++) {
      const deal = deals[i];
      const productUrl = deal.product.productUrl;

      console.log(`[${i + 1}/${deals.length}] ${deal.title}`);
      console.log(`   URL: ${productUrl}`);

      // Scraper la page (nouveau contexte par produit)
      const data = await scrapeNotinoPage(browser, productUrl);

      if (!data) {
        errors++;
        console.log('   ❌ Échec scraping\n');
        continue;
      }

      console.log(`   ✅ ${data.fullTitle}`);
      console.log(`   📦 Variantes: ${data.variants.join(', ') || 'N/A'}`);

      console.log(`   🤖 GPT...`);
      const priceInfo: PriceInfo = {
        dealPrice: deal.dealPrice,
        originalPrice: deal.originalPrice,
        discountPercent: deal.discountPercent,
        discountAmount: deal.discountAmount,
      };
      const rewritten = await rewriteWithGPT(data, priceInfo);

      if (rewritten) {
        console.log(`   ✨ Textes générés`);
      }

      await updateDealWithScrapedData(deal.id, deal.productId, data, rewritten);
      console.log(`   💾 DB mise à jour\n`);

      success++;

      if (i < deals.length - 1) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_DEALS));
      }
    }
  } finally {
    await browser.close();
    await prisma.$disconnect();
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('='.repeat(60));
  console.log('📊 [CLOUD JOB] RAPPORT FINAL - ENRICHISSEMENT NOTINO');
  console.log('='.repeat(60));
  console.log(`⏱️  Durée: ${duration}s`);
  console.log(`✅ Réussis: ${success}`);
  console.log(`❌ Erreurs: ${errors}`);
  console.log('\n✅ [CLOUD JOB] Enrichissement terminé!');

  process.exit(0);
}

main().catch(err => {
  console.error('❌ [CLOUD JOB] Erreur fatale:', err);
  process.exit(1);
});
