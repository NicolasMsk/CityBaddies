/**
 * Script d'enrichissement des deals Nocibé
 * 
 * Usage:
 *   npx tsx src/scripts/enrich-nocibe.ts              # Traite tous les deals Nocibé actifs
 *   npx tsx src/scripts/enrich-nocibe.ts --test       # Test sur 1 deal de la DB
 *   npx tsx src/scripts/enrich-nocibe.ts --limit 5    # Traite max 5 deals
 */

import { chromium, Browser, Page } from 'playwright';
import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';

const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ============================================================================
// TYPES
// ============================================================================

interface VariantData {
  name: string;
  price: string;
  originalPrice: string | null;
  pricePerUnit: string;
  isSelected: boolean;
}

interface ScrapedData {
  titre: string;
  variantes: VariantData[];
  labels: string[];
  classifications: Record<string, string>;
  description: string;
  application: string;
  ingredients: string;
  hasPromo: boolean; // True si le produit est en promo
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
  const cleaned = volumeStr.replace(/^[A-Z\s\-]+\s*-\s*/i, '').trim();
  const match = cleaned.match(/(\d+(?:[,\.]\d+)?)\s*(ml|g|l|kg|cl)/i);
  if (match) {
    const value = parseFloat(match[1].replace(',', '.'));
    const unit = match[2].toLowerCase();
    return { value: isNaN(value) ? null : value, unit };
  }
  return { value: null, unit: null };
}

// ============================================================================
// SCRAPING FUNCTION
// ============================================================================

async function scrapeNocibePage(page: Page, url: string): Promise<ScrapedData | null> {
  try {
    // 1. Navigation
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // 2. Fermer le cookie
    try {
      await page.waitForSelector('button[data-testid="uc-accept-all-button"]', { timeout: 5000 });
      await page.click('button[data-testid="uc-accept-all-button"]');
      await page.waitForTimeout(1000);
    } catch {
      // Pas de cookie banner
    }
    
    // 3. Attendre le contenu
    await page.waitForSelector('.product-cockpit__variant', { timeout: 5000 }).catch(() => null);
    
    // 4. Extraire titre + variantes
    const baseData = await page.evaluate(() => {
      // Titre
      const brand = document.querySelector('span.brand-name__seo-only')?.textContent?.trim() || '';
      const line = document.querySelector('a.brand-line')?.textContent?.trim() || '';
      const name = document.querySelector('span.header-name')?.textContent?.trim() || '';
      const titre = `${brand.split(' ')[0]} ${line} ${name}`.trim();
      
      // Variantes
      const variantes: Array<{
        name: string;
        price: string;
        originalPrice: string | null;
        pricePerUnit: string;
        isSelected: boolean;
      }> = [];
      
      // Cas 1: Plusieurs variantes avec RadioButton
      document.querySelectorAll('div[data-testid="RadioButton"]').forEach((el) => {
        const varName = el.querySelector('.product-detail__variant-name')?.textContent?.trim() || '';
        const price = el.querySelector('[data-testid="price-type-discount-color"]')?.textContent?.trim() || '';
        const originalPrice = el.querySelector('[data-testid="price-type-strikethrough"]')?.textContent?.trim() || null;
        const pricePerUnit = el.querySelector('[data-testid="price-base-unit"] span')?.textContent?.trim() || '';
        const isSelected = el.querySelector('input[aria-checked="true"]') !== null;
        
        variantes.push({ name: varName, price, originalPrice, pricePerUnit, isSelected });
      });
      
      // Cas 2: Variante unique (pas de RadioButton)
      if (variantes.length === 0) {
        const uniqueVariant = document.querySelector('.product-detail__variant-unique, .product-detail__variant--size-display');
        if (uniqueVariant) {
          const varName = uniqueVariant.querySelector('.product-detail__variant-name')?.textContent?.trim() || '';
          const price = uniqueVariant.querySelector('[data-testid="price-type-discount-color"]')?.textContent?.trim() || '';
          const originalPrice = uniqueVariant.querySelector('[data-testid="price-type-strikethrough"]')?.textContent?.trim() || null;
          const pricePerUnit = uniqueVariant.querySelector('[data-testid="price-base-unit"] span')?.textContent?.trim() || '';
          
          if (varName) {
            variantes.push({ name: varName, price, originalPrice, pricePerUnit, isSelected: true });
          }
        }
      }
      
      return { titre, variantes };
    });
    
    // 5. Modale Description (labels + classifications + description)
    await page.click('button[data-testid="details"]');
    await page.waitForSelector('[data-testid="modal-dialog"]', { timeout: 3000 });
    // Attendre que le contenu de la modale soit chargé
    await page.waitForSelector('.product-labels', { timeout: 3000 }).catch(() => null);
    await page.waitForTimeout(500);
    
    const descriptionData = await page.evaluate(() => {
      // Labels (dédupliqués) - chercher dans toute la modale
      const labelsSet = new Set<string>();
      document.querySelectorAll('.product-label .product-label__name').forEach((el) => {
        const text = el.textContent?.trim();
        if (text) labelsSet.add(text);
      });
      // Fallback: chercher aussi avec aria-label sur les li
      document.querySelectorAll('li.product-label[aria-label]').forEach((el) => {
        const label = el.getAttribute('aria-label');
        if (label) labelsSet.add(label);
      });
      
      // Classifications
      const classifications: Record<string, string> = {};
      document.querySelectorAll('[data-testid="product-detail-info__classifications"] > div').forEach((el) => {
        const spans = el.querySelectorAll('span');
        if (spans.length >= 2) {
          classifications[spans[0].textContent?.trim() || ''] = spans[1].textContent?.trim() || '';
        }
      });
      
      // Description
      const description = document.querySelector('[data-testid="product-details-description"]')?.textContent?.trim() || '';
      
      return { labels: Array.from(labelsSet), classifications, description };
    });
    
    await page.click('button[data-testid="modal-header-close"]');
    await page.waitForTimeout(300);
    
    // 6. Modale Application
    await page.click('button[data-testid="application"]');
    await page.waitForSelector('[data-testid="modal-dialog"]', { timeout: 3000 });
    await page.waitForTimeout(300);
    
    const application = await page.evaluate(() => {
      return document.querySelector('[data-testid="application-panel-other-info"]')?.textContent?.trim() || '';
    });
    
    await page.click('button[data-testid="modal-header-close"]');
    await page.waitForTimeout(300);
    
    // 7. Modale Ingrédients
    await page.click('button[data-testid="ingredients"]');
    await page.waitForSelector('[data-testid="modal-dialog"]', { timeout: 3000 });
    await page.waitForTimeout(300);
    
    const ingredients = await page.evaluate(() => {
      return document.querySelector('[data-testid="ingredients-panel-other-info"]')?.textContent?.trim() || '';
    });
    
    await page.click('button[data-testid="modal-header-close"]');
    await page.waitForTimeout(300);
    
    // Vérifier si au moins une variante est en promo (a un originalPrice)
    const hasPromo = baseData.variantes.some(v => v.originalPrice !== null);
    
    return {
      titre: baseData.titre,
      variantes: baseData.variantes,
      labels: descriptionData.labels,
      classifications: descriptionData.classifications,
      description: descriptionData.description,
      application,
      ingredients,
      hasPromo,
    };
    
  } catch (error) {
    console.error(`  ❌ Erreur scraping:`, error);
    return null;
  }
}

// ============================================================================
// GPT REWRITING - CITY BADDIES STYLE
// ============================================================================

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

async function rewriteWithGPT(data: ScrapedData, priceInfo: PriceInfo): Promise<RewrittenContent | null> {
  try {
    // Préparer les infos de variantes/sizes
    const sizesInfo = data.variantes.length > 0 
      ? data.variantes.map(v => `${v.name} (${v.price})`).join(', ')
      : 'Taille unique ou non spécifié';
    
    const prompt = `Tu es copywriter pour City Baddies, un site de bons plans beauté ciblant les jeunes femmes (18-35 ans) en France. Ton style d'écriture :
- Fun, décalé et empowering
- Tu utilises des emojis avec parcimonie mais efficacement
- Tu parles directement à la lectrice ("tu", "toi")
- Tu mets en avant le côté bon plan / économies
- Confiant et sans complexe sur le self-care
- TOUT EN FRANÇAIS

Réécris les infos produit suivantes dans la voix City Baddies. Reste informatif mais fais en sorte que ça claque !

**INFOS PRODUIT:**
- Nom: ${data.titre}
- Labels marque: ${data.labels.join(', ') || 'Aucun'}
- Tailles/Contenances disponibles: ${sizesInfo}
- Description originale: ${data.description || 'Pas de description'}
- Conseils d'utilisation: ${data.application || 'Pas de conseils'}
- Ingrédients (INCI): ${data.ingredients || 'Non listés'}

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

    // Parse JSON (handle potential markdown code blocks)
    const jsonStr = content.replace(/```json\n?|```\n?/g, '').trim();
    const parsed = JSON.parse(jsonStr) as RewrittenContent;
    
    return parsed;
  } catch (error) {
    console.error('  ⚠️ GPT rewriting failed:', error);
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
  // Construire availableSizes: priorité à GPT, sinon fallback sur les variantes scrapées
  let availableSizes = rewritten?.availableSizes || null;
  if (!availableSizes && data.variantes.length > 0) {
    availableSizes = data.variantes
      .map(v => {
        const { value, unit } = parseVolume(v.name);
        return value && unit ? `${value}${unit}` : v.name;
      })
      .filter(s => s) // Filtrer les vides
      .join(', ');
  }
  
  // Trouver la variante sélectionnée
  const selectedVariant = data.variantes.find(v => v.isSelected) || data.variantes[0];
  
  // Mettre à jour le produit avec tous les champs enrichis
  // On utilise les textes réécrits par GPT si disponibles, sinon les originaux
  await prisma.product.update({
    where: { id: productId },
    data: {
      name: data.titre,
      description: data.description?.substring(0, 500) || null,
      seoDescription: rewritten?.seoDescription || null,
      availableSizes: availableSizes || null,
      ingredients: rewritten?.ingredients || null,
      application: rewritten?.application || null,
      labels: data.labels.length > 0 ? data.labels.join(', ') : null,
      classifications: Object.keys(data.classifications).length > 0 ? data.classifications : undefined,
    },
  });
  
  // Mettre à jour le deal
  const dealUpdateData: Record<string, unknown> = {
    refinedTitle: data.titre,
    lastSeenAt: new Date(),
  };
  
  // Ajouter whyGoodDeal si généré par GPT
  if (rewritten?.whyGoodDeal) {
    dealUpdateData.whyGoodDeal = rewritten.whyGoodDeal;
  }
  
  if (selectedVariant) {
    const { value, unit } = parseVolume(selectedVariant.name);
    const dealPrice = parsePrice(selectedVariant.price);
    const originalPrice = parsePrice(selectedVariant.originalPrice || '');
    
    if (value && unit) {
      dealUpdateData.volumeValue = value;
      dealUpdateData.volumeUnit = unit;
      dealUpdateData.volume = selectedVariant.name;
    }
    
    if (dealPrice) {
      dealUpdateData.dealPrice = dealPrice;
      if (value) {
        dealUpdateData.pricePerUnit = dealPrice / value * 100; // Prix pour 100ml/100g
      }
    }
    
    if (originalPrice) {
      dealUpdateData.originalPrice = originalPrice;
      if (dealPrice) {
        dealUpdateData.discountAmount = originalPrice - dealPrice;
        dealUpdateData.discountPercent = Math.round((1 - dealPrice / originalPrice) * 100);
      }
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
  const args = process.argv.slice(2);
  const isTest = args.includes('--test');
  const limitIndex = args.indexOf('--limit');
  const limit = limitIndex >= 0 ? parseInt(args[limitIndex + 1]) : undefined;
  
  console.log('🚀 Enrichissement des deals Nocibé\n');
  
  // Récupérer les deals Nocibé actifs, non expirés, et pas encore enrichis (sans whyGoodDeal)
  const deals = await prisma.deal.findMany({
    where: {
      status: 'ACTIVE',
      whyGoodDeal: null, // Seulement les deals pas encore enrichis par GPT
      product: {
        productUrl: {
          contains: 'nocibe.fr',
        },
      },
    },
    select: {
      id: true,
      sourceUrl: true,
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
          productUrl: true,  // C'est ça l'URL du produit !
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: isTest ? 1 : limit,
  });
  
  console.log(`📊 ${deals.length} deal(s) à traiter (actifs, non expirés, non enrichis)\n`);
  
  if (deals.length === 0) {
    console.log('Aucun deal Nocibé à traiter (tous déjà enrichis ou expirés).');
    await prisma.$disconnect();
    return;
  }
  
  // Lancer le navigateur en mode headless avec options anti-détection
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',
    ],
  });
  
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    extraHTTPHeaders: {
      'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'sec-ch-ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
    },
  });
  
  const page = await context.newPage();
  
  let processed = 0;
  let success = 0;
  let errors = 0;
  
  try {
    for (const deal of deals) {
      processed++;
      const productUrl = deal.product.productUrl;
      
      console.log(`[${processed}/${deals.length}] ${deal.title}`);
      console.log(`   URL: ${productUrl}`);
      
      if (!productUrl || !productUrl.includes('nocibe.fr')) {
        console.log('   ⏭️ Pas d\'URL Nocibé valide, skip\n');
        continue;
      }
      
      // Scraper
      const data = await scrapeNocibePage(page, productUrl);
      
      if (!data) {
        errors++;
        console.log('   ❌ Échec scraping\n');
        continue;
      }
      
      // Vérifier si le deal est encore en promo
      if (!data.hasPromo) {
        console.log('   ⚠️ Plus de promo sur cette page! Désactivation du deal...');
        await prisma.deal.update({
          where: { id: deal.id },
          data: { status: 'EXPIRED' },
        });
        console.log('   ✓ Deal désactivé\n');
        continue;
      }
      
      console.log(`   ✅ ${data.titre}`);
      console.log(`   📦 ${data.variantes.length} variantes, ${data.labels.length} labels`);
      
      // Réécrire avec GPT dans le style City Baddies
      console.log(`   🤖 Réécriture GPT...`);
      const priceInfo: PriceInfo = {
        dealPrice: deal.dealPrice,
        originalPrice: deal.originalPrice,
        discountPercent: deal.discountPercent,
        discountAmount: deal.discountAmount,
      };
      const rewritten = await rewriteWithGPT(data, priceInfo);
      if (rewritten) {
        console.log(`   ✨ Textes City Baddies générés`);
      }
      
      // Mettre à jour la DB
      await updateDealWithScrapedData(deal.id, deal.productId, data, rewritten);
      console.log(`   💾 DB mise à jour\n`);
      
      success++;
      
      // Pause entre les requêtes
      if (processed < deals.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  } finally {
    await context.close();
    await browser.close();
    await prisma.$disconnect();
  }
  
  console.log('='.repeat(60));
  console.log(`✅ Terminé: ${success}/${processed} réussis, ${errors} erreurs`);
}

main().catch(console.error);
