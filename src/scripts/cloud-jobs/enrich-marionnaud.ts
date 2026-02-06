/**
 * Cloud Run Job - Enrichissement Marionnaud
 * Exécuté quotidiennement pour enrichir les deals avec GPT
 * 
 * - Récupère les deals Marionnaud actifs sans whyGoodDeal
 * - Scrape les infos produit (description, ingrédients, conseils, etc.)
 * - Réécrit en style City Baddies via GPT
 * - Met à jour Product et Deal dans la DB
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
  range: string;
  name: string;
  fullTitle: string;
  currentPrice: string;
  originalPrice: string | null;
  pricePerUnit: string | null;
  variant: string | null;
  promoBadge: string | null;
  promoDuration: string | null;
  description: string;
  usage: string;
  ingredients: string;
  articleNumber: string | null;
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
  if (!volumeStr) return { value: null, unit: null };
  const match = volumeStr.match(/(\d+(?:[,\.]\d+)?)\s*(ml|g|l|kg|cl|ML|G|L|KG|CL)/i);
  if (match) {
    const value = parseFloat(match[1].replace(',', '.'));
    const unit = match[2].toLowerCase();
    return { value: isNaN(value) ? null : value, unit };
  }
  return { value: null, unit: null };
}

// ============================================================================
// SCRAPING MARIONNAUD
// ============================================================================

async function scrapeMarionnaudPage(page: Page, url: string): Promise<ScrapedData | null> {
  try {
    // Délai aléatoire avant navigation (2-5s)
    await page.waitForTimeout(2000 + Math.random() * 3000);
    
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // Attendre que la page se charge
    await page.waitForTimeout(3000);
    
    // Gérer les cookies OneTrust
    try {
      const cookieButton = await page.waitForSelector('#onetrust-accept-btn-handler', { timeout: 5000 });
      if (cookieButton) {
        await cookieButton.click();
        await page.waitForTimeout(1000);
      }
    } catch {
      // Pas de popup cookies
    }
    
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
      
      // Description (premier bloc)
      const descriptionElement = document.querySelector('e2-product-information .product-information__text');
      const description = descriptionElement?.textContent?.trim() || '';
      
      // Conseils d'utilisation
      const usageElement = document.querySelector('e2-product-uses .product-information__text');
      const usage = usageElement?.textContent?.trim() || '';
      
      // Ingrédients
      const ingredientsElement = document.querySelector('e2-product-ingredients .product-information__text');
      const ingredients = ingredientsElement?.textContent?.trim() || '';
      
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
        description,
        usage,
        ingredients,
        articleNumber,
        hasPromo,
      };
    });
    
    return data;
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
- Marque: ${data.brand}
- Gamme: ${data.range || 'Non spécifiée'}
- Nom: ${data.name}
- Titre complet: ${data.fullTitle}
- Taille/Contenance: ${data.variant || 'Non spécifiée'}
- Description originale: ${data.description || 'Pas de description'}
- Conseils d'utilisation: ${data.usage || 'Pas de conseils'}
- Ingrédients (INCI): ${data.ingredients || 'Non listés'}

**INFOS PRIX:**
- Prix deal: ${priceInfo.dealPrice.toFixed(2)}€
- Prix original: ${priceInfo.originalPrice.toFixed(2)}€
- Réduction: -${priceInfo.discountPercent}% (${priceInfo.discountAmount.toFixed(2)}€ d'économie)
- Badge promo: ${data.promoBadge || 'Aucun'}

**FORMAT DE SORTIE (JSON uniquement, pas de markdown):**
{
  "seoDescription": "Description produit accrocheuse en 2-3 phrases pour le SEO (150-200 caractères). Punchy et met en avant les bénéfices clés.",
  "ingredients": "Réécris la section ingrédients de façon friendly et accessible. Explique ce que font les ingrédients clés. Si pas d'ingrédients, écris 'Les ingrédients ne sont pas disponibles pour ce produit.'",
  "application": "Réécris les conseils d'utilisation de façon fun et facile à suivre. Ajoute de la personnalité ! Si pas de conseils, écris 'Applique comme tu le sens, babe !'",
  "whyGoodDeal": "Explique en 1-2 phrases pourquoi c'est un bon deal. Mentionne le % de réduction, les économies réalisées, et pourquoi c'est le moment d'en profiter. Sois enthousiaste !",
  "availableSizes": "La taille/contenance du produit formatée proprement (ex: '50ml', '100g'). Si pas d'info, écris 'Taille standard'."
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
  // Déterminer la taille disponible
  let availableSizes = rewritten?.availableSizes || null;
  if (!availableSizes && data.variant) {
    const { value, unit } = parseVolume(data.variant);
    availableSizes = value && unit ? `${value}${unit}` : data.variant;
  }
  
  // Mise à jour du Product
  await prisma.product.update({
    where: { id: productId },
    data: {
      name: data.fullTitle,
      description: data.description?.substring(0, 500) || null,
      seoDescription: rewritten?.seoDescription || null,
      availableSizes: availableSizes || null,
      ingredients: rewritten?.ingredients || null,
      application: rewritten?.application || null,
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
  
  // Extraire volume/prix depuis la variante
  if (data.variant) {
    const { value, unit } = parseVolume(data.variant);
    if (value && unit) {
      dealUpdateData.volumeValue = value;
      dealUpdateData.volumeUnit = unit;
      dealUpdateData.volume = data.variant;
    }
  }
  
  // NE PAS modifier les prix ! C'est VALIDATE qui gère ça.
  
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
  console.log('🚀 [CLOUD JOB] Enrichissement Marionnaud...');
  console.log(`📅 Date: ${new Date().toISOString()}`);

  // Récupérer les deals Marionnaud à enrichir (actifs, sans whyGoodDeal)
  const deals = await prisma.deal.findMany({
    where: {
      status: 'ACTIVE',
      whyGoodDeal: null,
      product: {
        productUrl: { contains: 'marionnaud.fr' },
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

  console.log(`📊 ${deals.length} deal(s) Marionnaud à enrichir\n`);

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
      const data = await scrapeMarionnaudPage(page, productUrl);

      if (!data) {
        errors++;
        console.log('   ❌ Échec scraping\n');
        continue;
      }

      console.log(`   ✅ ${data.fullTitle}`);
      console.log(`   📦 Variante: ${data.variant || 'N/A'}, Prix: ${data.currentPrice}`);

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
  console.log('📊 [CLOUD JOB] RAPPORT FINAL - ENRICHISSEMENT MARIONNAUD');
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
