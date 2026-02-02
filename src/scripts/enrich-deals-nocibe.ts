/**
 * Script d'enrichissement des deals Nocibé
 * 
 * Ce script visite chaque page produit des deals actifs Nocibé pour :
 * 1. Vérifier et corriger les données (nom, prix, volume, etc.)
 * 2. Générer le rich content manquant (seoDescription, whyGoodDeal, etc.)
 * 
 * Utilise Playwright car certaines infos nécessitent JavaScript
 */

import { chromium, Browser, Page } from 'playwright';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ============================================================================
// SÉLECTEURS CSS NOCIBÉ
// ============================================================================
const SELECTORS = {
  // Nom du produit
  brandNameSeo: 'span.brand-name__seo-only',      // Ex: "Kérastase Shampooing"
  brandLine: 'a.brand-line',                       // Ex: "Résistance"
  productName: 'span.header-name',                 // Ex: "Bain Force Architecte"
  
  // Variantes / Contenances
  variantsContainer: 'div.size-variants-radio div.radio-group',
  variantItem: 'div[data-testid="RadioButton"]',
  variantSelected: 'div.product-detail__variant--selected',
  variantName: 'div.product-detail__variant-name',           // Ex: "250 ml", "RECHARGE - 500 ml"
  variantPrice: 'span[data-testid="price-type-discount-color"]',  // Prix actuel
  variantOriginalPrice: 'span[data-testid="price-type-strikethrough"]', // Prix barré
  variantPricePerUnit: 'div[data-testid="price-base-unit"] span',  // Ex: "8,80 € / 100 ml"
  
  // Boutons pour ouvrir les modales
  btnDescription: 'button[data-testid="details"]',
  btnApplication: 'button[data-testid="application"]',
  btnIngredients: 'button[data-testid="ingredients"]',
  
  // Modale
  modalClose: 'button[data-testid="modal-header-close"]',
  modalDialog: 'div[data-testid="modal-dialog"]',
  
  // Contenu des modales
  descriptionContent: 'div[data-testid="product-details-description"]',
  applicationContent: 'div[data-testid="application-panel-other-info"]',
  ingredientsContent: 'div[data-testid="ingredients-panel-other-info"]',
  
  // Labels produit (sans silicone, sans paraben, etc.)
  productLabels: 'li.product-label span.product-label__name',
  
  // Classifications (Réf, Parfum, Texture, etc.)
  classifications: 'div[data-testid="product-detail-info__classifications"]',
  classificationItem: 'div.cfcd995f412f160c58cf',
};

// ============================================================================
// TYPES
// ============================================================================

interface VariantData {
  name: string;           // Ex: "250 ml", "RECHARGE - 500 ml"
  volumeValue: number | null;    // Ex: 250, 500
  volumeUnit: string | null;     // Ex: "ml", "g"
  price: number | null;          // Prix actuel
  originalPrice: number | null;  // Prix barré (si promo)
  pricePerUnit: number | null;   // Prix au 100ml/100g
  isSelected: boolean;           // Est-ce la variante actuellement sélectionnée
}

interface ProductDetails {
  description: string | null;      // Description longue du produit
  application: string | null;      // Conseils d'utilisation
  ingredients: string | null;      // Liste INCI des ingrédients
  labels: string[];                // Labels (sans silicone, sans paraben, etc.)
  classifications: Record<string, string>;  // Réf, Parfum, Texture, Type de cheveux, etc.
}

interface ScrapedProductData {
  // Nom
  brandNameSeo: string | null;
  brandLine: string | null;
  productName: string | null;
  fullName: string | null;
  
  // Variantes / Contenances
  variants: VariantData[];
  selectedVariant: VariantData | null;
  availableSizes: string[];  // Liste des tailles pour Product.availableSizes
  
  // Détails produit (depuis les modales)
  details: ProductDetails;
}

interface DealToEnrich {
  id: string;
  sourceUrl: string | null;
  title: string;
  dealPrice: number;
  originalPrice: number;
  volume: string | null;
  volumeValue: number | null;
  volumeUnit: string | null;
  product: {
    id: string;
    name: string;
    brandId: string | null;
    brand: string | null;
    description: string | null;
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Parse un prix depuis une chaîne (ex: "21,99 €" -> 21.99)
 */
function parsePrice(priceStr: string | null): number | null {
  if (!priceStr) return null;
  const cleaned = priceStr.replace(/[^\d,\.]/g, '').replace(',', '.');
  const price = parseFloat(cleaned);
  return isNaN(price) ? null : price;
}

/**
 * Parse un volume depuis une chaîne (ex: "250 ml" -> { value: 250, unit: "ml" })
 */
function parseVolume(volumeStr: string): { value: number | null; unit: string | null } {
  // Nettoyer les prefixes comme "RECHARGE - "
  const cleaned = volumeStr.replace(/^[A-Z\s\-]+\s*-\s*/i, '').trim();
  
  // Match patterns: "250 ml", "100ml", "50 g", etc.
  const match = cleaned.match(/(\d+(?:[,\.]\d+)?)\s*(ml|g|l|kg|cl)/i);
  
  if (match) {
    const value = parseFloat(match[1].replace(',', '.'));
    const unit = match[2].toLowerCase();
    return { value: isNaN(value) ? null : value, unit };
  }
  
  return { value: null, unit: null };
}

/**
 * Ouvre une modale et extrait son contenu - ULTRA RAPIDE
 */
async function openModalAndExtract(
  page: Page, 
  buttonSelector: string, 
  contentSelector: string
): Promise<string | null> {
  try {
    const button = page.locator(buttonSelector).first();
    if (await button.count() === 0) return null;
    
    await button.click();
    
    // Attendre le contenu directement (pas la modale entière)
    const content = await page.locator(contentSelector).first().textContent({ timeout: 2000 }).catch(() => null);
    
    // Fermer sans attendre
    page.locator(SELECTORS.modalClose).first().click().catch(() => null);
    
    return content?.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Extrait labels + classifications + description en une seule ouverture de modale - ULTRA RAPIDE
 */
async function extractLabelsAndClassifications(page: Page): Promise<{
  labels: string[];
  classifications: Record<string, string>;
  description: string | null;
}> {
  const labels: string[] = [];
  const classifications: Record<string, string> = {};
  let description: string | null = null;
  
  try {
    const button = page.locator(SELECTORS.btnDescription).first();
    if (await button.count() === 0) return { labels, classifications, description };
    
    await button.click();
    
    // Extraire tout en parallèle dès que possible
    const [labelTexts, classItems, descText] = await Promise.all([
      page.locator(SELECTORS.productLabels).allTextContents().catch(() => []),
      page.locator(SELECTORS.classificationItem).all().catch(() => []),
      page.locator(SELECTORS.descriptionContent).first().textContent({ timeout: 2000 }).catch(() => null),
    ]);
    
    // Labels (dédupliquer)
    labels.push(...[...new Set(labelTexts.map(l => l.trim()).filter(Boolean))]);
    
    // Classifications (parallélisé)
    const classPromises = classItems.map(async (classEl) => {
      const spans = await classEl.locator('span').allTextContents().catch(() => []);
      return spans.length >= 2 ? [spans[0].trim(), spans[1].trim()] : null;
    });
    const classResults = await Promise.all(classPromises);
    for (const result of classResults) {
      if (result) classifications[result[0]] = result[1];
    }
    
    description = descText?.trim() || null;
    
    // Fermer sans attendre
    page.locator(SELECTORS.modalClose).first().click().catch(() => null);
  } catch {
    // Ignore
  }
  
  return { labels, classifications, description };
}

// ============================================================================
// SCRAPING FUNCTIONS
// ============================================================================
/**
 * Scrape les données d'une page produit Nocibé - VERSION MINIMALE
 * Étape 1: Cookie + Titre + Variantes (prix/contenance)
 */
async function scrapeProductPage(page: Page, url: string): Promise<ScrapedProductData | null> {
  try {
    const startTime = Date.now();
    
    // 1. Aller sur la page
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    
    // 2. Gérer le cookie banner
    const cookieBtn = page.locator('button[data-testid="uc-accept-all-button"]');
    if (await cookieBtn.count() > 0) {
      await cookieBtn.click();
      await page.waitForTimeout(500);
    }
    
    // 3. Attendre le contenu produit
    await page.waitForSelector('[data-testid="product-info"]', { timeout: 10000 });
    
    // 4. TITRE
    const brandNameSeo = await page.locator('span.brand-name__seo-only').first().textContent().catch(() => null);
    const brandLine = await page.locator('a.brand-line').first().textContent().catch(() => null);
    const productName = await page.locator('span.header-name').first().textContent().catch(() => null);
    
    const parts: string[] = [];
    if (brandNameSeo) parts.push(brandNameSeo.trim().split(' ')[0]);
    if (brandLine) parts.push(brandLine.trim());
    if (productName) parts.push(productName.trim());
    const fullName = parts.length ? parts.join(' ') : null;
    console.log(`  ✅ ${fullName}`);
    
    // 5. VARIANTES (prix + contenance)
    const variants: VariantData[] = [];
    let selectedVariant: VariantData | null = null;
    
    const variantElements = await page.locator('div[data-testid="RadioButton"]').all();
    console.log(`  📦 ${variantElements.length} variantes trouvées`);
    
    for (const el of variantElements) {
      const isChecked = await el.locator('input[aria-checked="true"]').count() > 0;
      const name = await el.locator('.product-detail__variant-name').textContent().catch(() => null);
      if (!name) continue;
      
      // Prix depuis aria-label
      const priceLabel = await el.locator('[data-testid="price-discount"] span[aria-label]').getAttribute('aria-label').catch(() => null);
      const origLabel = await el.locator('[data-testid="price-original"] span[aria-label]').getAttribute('aria-label').catch(() => null);
      const unitLabel = await el.locator('[data-testid="price-base-unit"] span[aria-label]').getAttribute('aria-label').catch(() => null);
      
      console.log(`     - ${name.trim()} | prix: ${priceLabel} | orig: ${origLabel} | unit: ${unitLabel}`);
      
      const { value, unit } = parseVolume(name);
      const variant: VariantData = {
        name: name.trim(),
        volumeValue: value,
        volumeUnit: unit,
        price: parsePrice(priceLabel),
        originalPrice: parsePrice(origLabel),
        pricePerUnit: parsePrice(unitLabel),
        isSelected: isChecked,
      };
      variants.push(variant);
      if (isChecked) selectedVariant = variant;
    }
    
    console.log(`  ⏱️ ${Date.now() - startTime}ms`);
    
    const availableSizes = variants.map(v => v.volumeValue && v.volumeUnit ? `${v.volumeValue}${v.volumeUnit}` : v.name).filter(Boolean);
    
    return {
      brandNameSeo: brandNameSeo?.trim() || null,
      brandLine: brandLine?.trim() || null,
      productName: productName?.trim() || null,
      fullName,
      variants,
      selectedVariant,
      availableSizes,
      details: {
        description: null,
        application: null,
        ingredients: null,
        labels: [],
        classifications: {},
      },
    };
  } catch (error) {
    console.error(`  ❌`, error);
    return null;
  }
}

/**
 * Compare et met à jour les données si nécessaire
 */
async function updateDealIfNeeded(deal: DealToEnrich, scrapedData: ScrapedProductData): Promise<boolean> {
  const dealUpdates: Record<string, unknown> = {};
  const productUpdates: Record<string, unknown> = {};
  let hasChanges = false;
  
  // ========== COMPARER LE NOM DU PRODUIT ==========
  if (scrapedData.fullName && scrapedData.fullName !== deal.product.name) {
    console.log(`  📝 Nom différent:`);
    console.log(`     BDD: "${deal.product.name}"`);
    console.log(`     Web: "${scrapedData.fullName}"`);
    productUpdates.name = scrapedData.fullName;
    hasChanges = true;
  }
  
  // ========== COMPARER LES TAILLES DISPONIBLES ==========
  // Note: On met toujours à jour availableSizes si on a des données scrapées
  if (scrapedData.availableSizes.length > 0) {
    const newAvailableSizes = scrapedData.availableSizes.join(',');
    console.log(`  📝 Tailles disponibles: "${newAvailableSizes}"`);
    productUpdates.availableSizes = newAvailableSizes;
    hasChanges = true;
  }
  
  // ========== COMPARER LE PRIX DU DEAL (variante sélectionnée) ==========
  if (scrapedData.selectedVariant) {
    const webPrice = scrapedData.selectedVariant.price;
    const webOriginalPrice = scrapedData.selectedVariant.originalPrice;
    const webVolume = scrapedData.selectedVariant.name;
    const webVolumeValue = scrapedData.selectedVariant.volumeValue;
    const webVolumeUnit = scrapedData.selectedVariant.volumeUnit;
    
    // Comparer le prix actuel
    if (webPrice && Math.abs(webPrice - deal.dealPrice) > 0.01) {
      console.log(`  📝 Prix différent:`);
      console.log(`     BDD: ${deal.dealPrice}€`);
      console.log(`     Web: ${webPrice}€`);
      dealUpdates.dealPrice = webPrice;
      hasChanges = true;
      
      // Recalculer le discount si on a le prix original
      if (webOriginalPrice || deal.originalPrice) {
        const originalPrice = webOriginalPrice || deal.originalPrice;
        const discountAmount = originalPrice - webPrice;
        const discountPercent = Math.round((discountAmount / originalPrice) * 100);
        dealUpdates.discountAmount = discountAmount;
        dealUpdates.discountPercent = discountPercent;
      }
    }
    
    // Comparer le prix original (barré)
    if (webOriginalPrice && Math.abs(webOriginalPrice - deal.originalPrice) > 0.01) {
      console.log(`  📝 Prix original différent:`);
      console.log(`     BDD: ${deal.originalPrice}€`);
      console.log(`     Web: ${webOriginalPrice}€`);
      dealUpdates.originalPrice = webOriginalPrice;
      hasChanges = true;
    }
    
    // Comparer le volume
    if (webVolumeValue && webVolumeUnit) {
      if (deal.volumeValue !== webVolumeValue || deal.volumeUnit !== webVolumeUnit) {
        console.log(`  📝 Volume différent:`);
        console.log(`     BDD: ${deal.volumeValue} ${deal.volumeUnit}`);
        console.log(`     Web: ${webVolumeValue} ${webVolumeUnit}`);
        dealUpdates.volume = webVolume;
        dealUpdates.volumeValue = webVolumeValue;
        dealUpdates.volumeUnit = webVolumeUnit;
        
        // Recalculer le prix par unité
        const priceForCalc = (webPrice || deal.dealPrice);
        if (priceForCalc && webVolumeValue) {
          dealUpdates.pricePerUnit = priceForCalc / webVolumeValue;
        }
        hasChanges = true;
      }
    }
  }
  
  // ========== APPLIQUER LES MISES À JOUR ==========
  if (Object.keys(productUpdates).length > 0) {
    await prisma.product.update({
      where: { id: deal.product.id },
      data: productUpdates,
    });
    console.log(`  💾 Produit mis à jour`);
  }
  
  if (Object.keys(dealUpdates).length > 0) {
    await prisma.deal.update({
      where: { id: deal.id },
      data: dealUpdates,
    });
    console.log(`  💾 Deal mis à jour`);
  }
  
  return hasChanges;
}

// ============================================================================
// MAIN
// ============================================================================

// Mode test : passer une URL en argument pour tester sur un seul produit
const TEST_URL = process.argv[2];

async function main() {
  console.log('🚀 Enrichissement des deals Nocibé\n');
  
  // Mode test : scraper une seule URL (ou 2 pour voir les temps réels)
  if (TEST_URL) {
    console.log(`🧪 MODE TEST - URL: ${TEST_URL}\n`);
    
    const browserStart = Date.now();
    const browser = await chromium.launch({ 
      headless: false,  // Mode visible pour debug
    });
    console.log(`⏱️ Lancement browser: ${Date.now() - browserStart}ms`);
    
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      locale: 'fr-FR',
    });
    const page = await context.newPage();
    
    try {
      const scrapedData = await scrapeProductPage(page, TEST_URL);
      
      if (scrapedData) {
        console.log('\n' + '='.repeat(60));
        console.log('📦 DONNÉES SCRAPÉES:');
        console.log('='.repeat(60));
        console.log(JSON.stringify(scrapedData, null, 2));
      }
    } finally {
      await browser.close();
    }
    
    return;
  }
  
  // Mode normal : traiter tous les deals actifs
  
  // 1. Récupérer tous les deals actifs Nocibé avec sourceUrl
  const deals = await prisma.deal.findMany({
    where: {
      isActive: true,
      sourceUrl: {
        contains: 'nocibe.fr',
        not: null,
      },
    },
    select: {
      id: true,
      sourceUrl: true,
      title: true,
      dealPrice: true,
      originalPrice: true,
      volume: true,
      volumeValue: true,
      volumeUnit: true,
      product: {
        select: {
          id: true,
          name: true,
          brandId: true,
          brand: true,
          description: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  
  console.log(`📊 ${deals.length} deals Nocibé actifs à enrichir\n`);
  
  if (deals.length === 0) {
    console.log('Aucun deal à traiter.');
    return;
  }
  
  // 2. Lancer Playwright
  const browser = await chromium.launch({ 
    headless: true,
  });
  
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  
  const page = await context.newPage();
  
  let processed = 0;
  let updated = 0;
  let errors = 0;
  
  try {
    for (const deal of deals) {
      processed++;
      console.log(`\n[${processed}/${deals.length}] ${deal.title}`);
      
      if (!deal.sourceUrl) {
        console.log('  ⏭️ Pas de sourceUrl, skip');
        continue;
      }
      
      // Scraper la page
      const scrapedData = await scrapeProductPage(page, deal.sourceUrl);
      
      if (!scrapedData) {
        errors++;
        continue;
      }
      
      // Mettre à jour si nécessaire
      const wasUpdated = await updateDealIfNeeded(deal as unknown as DealToEnrich, scrapedData);
      if (wasUpdated) {
        updated++;
      }
      
      // Pause entre les requêtes pour éviter le rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } finally {
    await browser.close();
  }
  
  console.log('\n' + '='.repeat(50));
  console.log(`✅ Terminé!`);
  console.log(`   Traités: ${processed}`);
  console.log(`   Mis à jour: ${updated}`);
  console.log(`   Erreurs: ${errors}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
