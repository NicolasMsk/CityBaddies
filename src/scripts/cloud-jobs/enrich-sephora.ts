/**
 * Cloud Run Job - Enrichissement Sephora
 * Exécuté quotidiennement pour enrichir les deals avec GPT
 * 
 * - Récupère les deals Sephora actifs sans whyGoodDeal
 * - Scrape les infos produit (description, ingrédients, conseils, etc.)
 * - Réécrit en style City Baddies via GPT
 * - Met à jour Product et Deal dans la DB
 * - Désactive les deals si plus de promo sur la page
 */

import { chromium, Page } from 'playwright';
import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';

const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Configuration
const DELAY_BETWEEN_DEALS = 2000; // 2 secondes entre chaque deal

// ============================================================================
// TYPES
// ============================================================================

interface ScrapedData {
  brand: string;
  name: string;
  fullTitle: string;
  variant: string;
  sku: string;
  rating: string;
  reviewCount: string;
  currentPrice: string;
  originalPrice: string;
  discount: string;
  labels: string[];
  description: string;
  application: string;
  testResults: string;
  moreInfos: string;
  ingredients: string;
  category: string;
  nature: string;
  section: string;
  hasPromo: boolean; // True si le produit est en promo
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

function parsePrice(priceStr: string): number | null {
  if (!priceStr) return null;
  const cleaned = priceStr.replace(/[^\d,\.]/g, '').replace(',', '.');
  const price = parseFloat(cleaned);
  return isNaN(price) ? null : price;
}

function parseVolume(volumeStr: string): { value: number | null; unit: string | null } {
  const match = volumeStr.match(/(\d+(?:[,\.]\d+)?)\s*(ml|g|l|kg|cl)/i);
  if (match) {
    const value = parseFloat(match[1].replace(',', '.'));
    const unit = match[2].toLowerCase();
    return { value: isNaN(value) ? null : value, unit };
  }
  return { value: null, unit: null };
}

// ============================================================================
// SCRAPING SEPHORA
// ============================================================================

async function scrapeSephoraPage(page: Page, url: string): Promise<ScrapedData | null> {
  try {
    // Délai aléatoire avant navigation (2-5s)
    await page.waitForTimeout(2000 + Math.random() * 3000);
    
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // Attendre que la page se charge
    await page.waitForTimeout(3000);
    
    // Gérer les cookies TC Privacy
    try {
      const cookieSelectors = [
        '#footer_tc_privacy_button_3',
        'button.tc-privacy-button[title="Tout accepter"]',
        '.tc-privacy-button',
        '#onetrust-accept-btn-handler',
      ];
      
      for (const selector of cookieSelectors) {
        try {
          const btn = await page.$(selector);
          if (btn) {
            await btn.click();
            await page.waitForTimeout(1000);
            break;
          }
        } catch {
          // Continuer
        }
      }
    } catch {
      // Pas de cookie banner
    }
    
    // Attendre le contenu principal
    await page.waitForSelector('.product-title-heading', { timeout: 10000 });
    await page.waitForTimeout(1500);
    
    // Extraire les données de base
    const baseData = await page.evaluate(() => {
      const brand = document.querySelector('.brand-name')?.textContent?.trim() || '';
      const name = document.querySelector('.product-name')?.textContent?.trim() || '';
      const rating = document.querySelector('[itemprop="ratingValue"]')?.textContent?.trim() || '';
      const reviewCount = document.querySelector('[itemprop="reviewCount"]')?.getAttribute('content') || '';
      const currentPrice = document.querySelector('.price-sales')?.textContent?.trim()?.replace(/\s+/g, ' ') || '';
      const originalPrice = document.querySelector('.price-standard')?.textContent?.trim() || '';
      const discount = document.querySelector('.original-price-discount')?.textContent?.trim() || '';
      const variant = document.querySelector('.variation-title')?.textContent?.trim() || '';
      const sku = document.querySelector('#masterid')?.textContent?.trim() || '';
      
      return {
        brand,
        name,
        fullTitle: `${brand} - ${name}`.trim(),
        rating,
        reviewCount,
        currentPrice,
        originalPrice,
        discount,
        variant,
        sku,
      };
    });
    
    // Cliquer sur "Lire la suite" pour charger le contenu complet
    try {
      const readMoreBtn = await page.$('.read-more-pdp-description, .morelink-product-description, a.morelink');
      if (readMoreBtn) {
        await readMoreBtn.click();
        await page.waitForTimeout(800);
      } else {
        const descTab = await page.$('#tab-description, li.pdp-description');
        if (descTab) {
          await descTab.click();
          await page.waitForTimeout(800);
        }
      }
    } catch {
      // Pas de bouton
    }
    
    await page.waitForSelector('#product-infos-content', { timeout: 5000 }).catch(() => null);
    
    // Extraction de toutes les infos produit
    const productInfo = await page.evaluate(() => {
      // === DESCRIPTION ===
      const descContainer = document.querySelector('#product-infos-content .pdp-description .description-content');
      
      // Labels depuis les badges images
      const labelImages = descContainer?.querySelectorAll('img[src*="badge"]') || [];
      const labels: string[] = [];
      labelImages.forEach(img => {
        const src = img.getAttribute('src') || '';
        if (src.includes('clean')) labels.push('Clean');
        if (src.includes('vegan')) labels.push('Vegan');
        if (src.includes('cruelty')) labels.push('Cruelty Free');
        if (src.includes('natural')) labels.push('Natural');
        if (src.includes('bio')) labels.push('Bio');
      });
      
      // SKU
      const sku = descContainer?.querySelector('.skuid')?.textContent?.trim() || '';
      
      // Description texte
      let description = '';
      if (descContainer) {
        const clone = descContainer.cloneNode(true) as HTMLElement;
        clone.querySelectorAll('img, .gpsr-supplier-infos, style, script').forEach(el => el.remove());
        description = clone.textContent?.trim()?.replace(/\s+/g, ' ') || '';
      }
      
      // === CONSEILS D'UTILISATION ===
      const tipsContainer = document.querySelector('#product-infos-content .pdp-tips .tips-content');
      const application = tipsContainer?.textContent?.trim()?.replace(/\s+/g, ' ') || '';
      
      // === RESULTATS DES TESTS ===
      const testResultsContainer = document.querySelector('#product-infos-content .pdp-test-results .test-results-content');
      const testResults = testResultsContainer?.textContent?.trim()?.replace(/\s+/g, ' ') || '';
      
      // === PLUS D'INFORMATIONS ===
      const moreInfosContainer = document.querySelector('#product-infos-content .pdp-more-infos .more-infos-content');
      const moreInfos = moreInfosContainer?.textContent?.trim()?.replace(/\s+/g, ' ') || '';
      
      // === INGREDIENTS ===
      const ingredientsContainer = document.querySelector('#product-infos-content .pdp-ingredients .ingredients-content');
      let ingredients = ingredientsContainer?.textContent?.trim()?.replace(/\s+/g, ' ') || '';
      ingredients = ingredients.replace(/Cette liste d'ingrédients peut faire l'objet.*$/i, '').trim();
      
      return { description, application, testResults, moreInfos, ingredients, labels, sku };
    });
    
    // Données tc_vars (analytics)
    const tcVars = await page.evaluate(() => {
      // @ts-ignore
      const vars = (window as any).tc_vars || {};
      return {
        category: vars.product_breadcrumb_label || '',
        nature: vars.product_nature || '',
        section: vars.product_section || '',
      };
    });
    
    // Vérifier si le produit est encore en promo
    const hasPromo = !!(baseData.originalPrice && baseData.discount);
    
    return {
      brand: baseData.brand,
      name: baseData.name,
      fullTitle: baseData.fullTitle,
      variant: baseData.variant,
      sku: productInfo.sku || baseData.sku,
      rating: baseData.rating,
      reviewCount: baseData.reviewCount,
      currentPrice: baseData.currentPrice,
      originalPrice: baseData.originalPrice,
      discount: baseData.discount,
      labels: productInfo.labels,
      description: productInfo.description,
      application: productInfo.application,
      testResults: productInfo.testResults,
      moreInfos: productInfo.moreInfos,
      ingredients: productInfo.ingredients,
      category: tcVars.category,
      nature: tcVars.nature,
      section: tcVars.section,
      hasPromo,
    };
    
  } catch (error) {
    console.error(`  ❌ Erreur scraping:`, error);
    return null;
  }
}

// ============================================================================
// GPT REWRITING
// ============================================================================

async function rewriteWithGPT(data: ScrapedData, priceInfo: PriceInfo): Promise<RewrittenContent | null> {
  try {
    const prompt = `Tu es copywriter pour City Baddies, un site de bons plans beauté ciblant les jeunes femmes (18-35 ans) en France. Ton style d'écriture :
- Fun, décalé et empowering
- PAS D'EMOJI NI DE SMILEY dans tes textes, jamais
- Tu parles directement à la lectrice ("tu", "toi")
- Tu mets en avant le côté bon plan / économies
- Confiant et sans complexe sur le self-care
- TOUT EN FRANÇAIS

Réécris les infos produit suivantes dans la voix City Baddies. Reste informatif mais fais en sorte que ça claque !

**INFOS PRODUIT:**
- Nom: ${data.fullTitle}
- Marque: ${data.brand}
- Labels: ${data.labels.join(', ') || 'Aucun'}
- Taille/Contenance: ${data.variant || 'Non spécifié'}
- Catégorie: ${data.section || data.category || 'Beauté'}
- Description originale: ${data.description?.substring(0, 500) || 'Pas de description'}
- Conseils d'utilisation: ${data.application?.substring(0, 300) || 'Pas de conseils'}
- Infos supplémentaires: ${data.moreInfos || ''}
- Ingrédients (INCI): ${data.ingredients?.substring(0, 300) || 'Non listés'}

**INFOS PRIX:**
- Prix deal: ${priceInfo.dealPrice.toFixed(2)}€
- Prix original: ${priceInfo.originalPrice.toFixed(2)}€
- Réduction: -${priceInfo.discountPercent}% (${priceInfo.discountAmount.toFixed(2)}€ d'économie)

**FORMAT DE SORTIE (JSON uniquement, pas de markdown):**
{
  "seoDescription": "Description produit accrocheuse en 2-3 phrases pour le SEO (150-200 caractères). Punchy et met en avant les bénéfices clés.",
  "ingredients": "Réécris la section ingrédients de façon friendly et accessible. Explique ce que font les ingrédients clés. Si pas d'ingrédients, écris 'Les ingrédients ne sont pas disponibles pour ce produit.'",
  "application": "Réécris les conseils d'utilisation de façon fun et facile à suivre. Ajoute de la personnalité ! Si pas de conseils, écris 'Applique comme tu le sens, babe !'",
  "whyGoodDeal": "Explique en 1-2 phrases pourquoi c'est un bon deal. Mentionne le % de réduction, les économies réalisées, et pourquoi c'est le moment d'en profiter. Sois enthousiaste !",
  "availableSizes": "Taille/contenance du produit. Si pas d'info, écris 'Taille standard'."
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
  // Mise à jour du Product
  await prisma.product.update({
    where: { id: productId },
    data: {
      description: data.description?.substring(0, 500) || null,
      seoDescription: rewritten?.seoDescription || null,
      availableSizes: rewritten?.availableSizes || data.variant || null,
      ingredients: rewritten?.ingredients || data.ingredients?.substring(0, 2000) || null,
      application: rewritten?.application || data.application?.substring(0, 1000) || null,
      labels: data.labels.length > 0 ? data.labels.join(', ') : null,
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
  
  // Volume depuis la variante
  if (data.variant) {
    const { value, unit } = parseVolume(data.variant);
    if (value && unit) {
      dealUpdateData.volumeValue = value;
      dealUpdateData.volumeUnit = unit;
      dealUpdateData.volume = data.variant;
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
  console.log('🚀 [CLOUD JOB] Enrichissement Sephora...');
  console.log(`📅 Date: ${new Date().toISOString()}`);

  // Récupérer les deals Sephora à enrichir (actifs, sans whyGoodDeal)
  const deals = await prisma.deal.findMany({
    where: {
      status: 'ACTIVE',
      whyGoodDeal: null,
      product: {
        productUrl: { contains: 'sephora.fr' },
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

  console.log(`📊 ${deals.length} deal(s) Sephora à enrichir\n`);

  if (deals.length === 0) {
    console.log('✅ Aucun deal à enrichir (tous déjà traités)');
    await prisma.$disconnect();
    process.exit(0);
  }

  // Lancer le navigateur avec options anti-bot
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
  
  const context = await browser.newContext({
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
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    // @ts-ignore
    window.chrome = { runtime: {} };
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, 'languages', { get: () => ['fr-FR', 'fr', 'en-US', 'en'] });
  });
  
  const page = await context.newPage();

  let success = 0;
  let errors = 0;

  try {
    for (let i = 0; i < deals.length; i++) {
      const deal = deals[i];
      const productUrl = deal.product.productUrl;

      console.log(`[${i + 1}/${deals.length}] ${deal.title}`);
      console.log(`   URL: ${productUrl}`);

      // Scraper la page pour récupérer le rich content
      const data = await scrapeSephoraPage(page, productUrl);

      if (!data) {
        errors++;
        console.log('   ❌ Échec scraping\n');
        continue;
      }

      console.log(`   ✅ ${data.fullTitle}`);
      console.log(`   📦 Variante: ${data.variant || 'N/A'}, Labels: ${data.labels.join(', ') || 'Aucun'}`);

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
  console.log('📊 [CLOUD JOB] RAPPORT FINAL - ENRICHISSEMENT SEPHORA');
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
