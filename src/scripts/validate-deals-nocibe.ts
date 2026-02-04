/**
 * Script de validation des deals Nocibe
 * 
 * Ce script vérifie que les prix des deals correspondent à la réalité sur Nocibe.
 * Utilise un simple fetch HTML (pas besoin de Playwright car les données sont dans le HTML).
 * 
 * Usage: npx tsx src/scripts/validate-deals-nocibe.ts [--limit N] [--deal-id ID]
 */

import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';

const prisma = new PrismaClient() as any;

// Fonction locale pour éviter les imports relatifs
function calculatePricePerUnit(price: number, volumeStr: string | null | undefined): { pricePerUnit: number; volumeValue: number; volumeUnit: string } | null {
  if (!volumeStr) return null;
  const normalized = volumeStr.toLowerCase().trim();
  const match = normalized.match(/(\d+(?:[.,]\d+)?)\s*(ml|l|cl|g|gr|gramme|grammes|kg|oz|fl\.?\s*oz)/i);
  if (!match) return null;
  let value = parseFloat(match[1].replace(',', '.'));
  let unit = match[2].toLowerCase();
  switch (unit) {
    case 'l': value *= 1000; unit = 'ml'; break;
    case 'cl': value *= 10; unit = 'ml'; break;
    case 'kg': value *= 1000; unit = 'g'; break;
    case 'gr': case 'gramme': case 'grammes': unit = 'g'; break;
    case 'oz': case 'fl oz': case 'fl. oz': value *= 29.57; unit = 'ml'; break;
  }
  if (value <= 0) return null;
  return { pricePerUnit: price / value, volumeValue: Math.round(value * 100) / 100, volumeUnit: unit };
}

// Type pour une variante de produit
interface ProductVariant {
  name: string;            // "30 ml"
  volume: string;          // "30 ml"
  volumeValue: number;     // 30
  volumeUnit: string;      // "ml"
  currentPrice: number;    // Prix actuel (promo ou normal)
  originalPrice: number;   // Prix barré (si promo)
  discountPercent: number; // % de réduction
  isPromo: boolean;        // true si en promo directe (prix barré)
  promoCode?: string;      // Code promo si applicable
  priceWithCode?: number;  // Prix après code promo
}

// Résultat du scraping d'une page produit
interface ScrapedProductInfo {
  variants: ProductVariant[];
  url: string;
  scrapedAt: Date;
}

// Résultat de la validation
interface ValidationResult {
  dealId: string;
  productName: string;
  dealVolume: string;
  status: 'VALID' | 'PRICE_CHANGED' | 'VOLUME_CHANGED' | 'EXPIRED' | 'NOT_FOUND' | 'ERROR';
  oldPrice?: number;
  newPrice?: number;
  oldDiscount?: number;
  newDiscount?: number;
  oldVolume?: string;
  newVolume?: string;
  message: string;
  variants: ProductVariant[];
  matchedVariant?: ProductVariant;
}

/**
 * Parse un prix français (ex: "14,90 €" -> 14.90)
 */
function parsePrice(priceStr: string): number {
  if (!priceStr) return 0;
  const cleaned = priceStr.replace(/[^\d,\.]/g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
}

/**
 * Parse un volume (ex: "30 ml" -> { value: 30, unit: "ml" })
 */
function parseVolume(volumeStr: string): { value: number; unit: string } | null {
  const match = volumeStr.match(/(\d+(?:[.,]\d+)?)\s*(ml|g|l|kg|cl)/i);
  if (match) {
    const value = parseFloat(match[1].replace(',', '.'));
    const unit = match[2].toLowerCase();
    return { value, unit };
  }
  return null;
}

/**
 * Normalise le volume pour la comparaison (enlève les espaces, uniformise)
 */
function normalizeVolume(volume: string): string {
  return volume.toLowerCase().replace(/\s+/g, '').trim();
}

/**
 * Scrape une page produit Nocibe pour récupérer toutes les variantes
 */
async function scrapeNocibeProduct(productUrl: string): Promise<ScrapedProductInfo | null> {
  try {
    console.log(`  📄 Chargement: ${productUrl}`);
    
    const response = await fetch(productUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    });

    if (!response.ok) {
      console.log(`  ❌ Erreur HTTP: ${response.status}`);
      return null;
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    
    const variants: ProductVariant[] = [];

    // Cas 1: Plusieurs variantes (radio buttons) ou variante unique
    // Différents types: size-display, color-display, style-display
    const variantDivs = $('div.product-detail__variant--size-display, div.product-detail__variant--color-display, div.product-detail__variant--style-display');
    
    if (variantDivs.length > 0) {
      variantDivs.each((_, el) => {
        const $variant = $(el);
        
        // Récupérer le volume
        const volumeName = $variant.find('.product-detail__variant-name').first().text().trim();
        if (!volumeName) return;
        
        const volumeInfo = parseVolume(volumeName);
        
        // Récupérer les prix
        // Prix barré (original) - promo directe
        const strikethroughPrice = $variant.find('[data-testid="price-type-strikethrough"]').text().trim();
        // Prix promo - promo directe
        const discountPrice = $variant.find('[data-testid="price-type-discount-color"]').text().trim();
        // Prix normal (sans promo)
        const currentPriceEl = $variant.find('[data-testid="price-type-current"]').text().trim();
        
        // Prix avec code promo
        const priceWithCodeEl = $variant.find('[data-testid="variant-product-price"]').text().trim();
        const promoCodeEl = $variant.find('.dacc09ebcc0caa6da034').text().trim();
        
        let currentPrice = 0;
        let originalPrice = 0;
        let isPromo = false;
        
        if (strikethroughPrice && discountPrice) {
          // Promo directe (prix barré)
          originalPrice = parsePrice(strikethroughPrice);
          currentPrice = parsePrice(discountPrice);
          isPromo = true;
        } else if (currentPriceEl) {
          // Pas de promo directe
          currentPrice = parsePrice(currentPriceEl);
          originalPrice = currentPrice;
          isPromo = false;
        }
        
        const discountPercent = originalPrice > 0 && isPromo 
          ? Math.round((1 - currentPrice / originalPrice) * 100) 
          : 0;
        
        const variant: ProductVariant = {
          name: volumeName,
          volume: volumeName,
          volumeValue: volumeInfo?.value || 0,
          volumeUnit: volumeInfo?.unit || 'ml',
          currentPrice,
          originalPrice,
          discountPercent,
          isPromo,
        };
        
        // Ajouter info code promo si présent
        if (priceWithCodeEl && promoCodeEl) {
          variant.promoCode = promoCodeEl;
          variant.priceWithCode = parsePrice(priceWithCodeEl);
        }
        
        variants.push(variant);
      });
    }
    
    // Dédupliquer les variantes
    const uniqueVariants = variants.filter((v, i, arr) => 
      arr.findIndex(x => normalizeVolume(x.name) === normalizeVolume(v.name)) === i
    );
    
    console.log(`  📦 ${uniqueVariants.length} variantes trouvées`);
    
    return {
      variants: uniqueVariants,
      url: productUrl,
      scrapedAt: new Date(),
    };
    
  } catch (error) {
    console.log(`  ❌ Erreur scraping: ${error}`);
    return null;
  }
}

/**
 * Trouve la variante correspondant au deal
 */
function findMatchingVariant(
  variants: ProductVariant[], 
  dealVolume: string
): { variant: ProductVariant | null; isExactMatch: boolean } {
  if (!dealVolume || variants.length === 0) {
    return { variant: null, isExactMatch: false };
  }
  
  const normalizedDealVolume = normalizeVolume(dealVolume);
  
  // Chercher une correspondance exacte
  const exactMatch = variants.find(v => normalizeVolume(v.name) === normalizedDealVolume);
  if (exactMatch) {
    return { variant: exactMatch, isExactMatch: true };
  }
  
  // Essayer de parser et comparer les valeurs numériques
  const dealVolumeInfo = parseVolume(dealVolume);
  if (dealVolumeInfo) {
    const numericMatch = variants.find(v => {
      const variantInfo = parseVolume(v.name);
      return variantInfo && 
             variantInfo.value === dealVolumeInfo.value && 
             variantInfo.unit === dealVolumeInfo.unit;
    });
    if (numericMatch) {
      return { variant: numericMatch, isExactMatch: true };
    }
  }
  
  return { variant: null, isExactMatch: false };
}

/**
 * Valide un deal contre les données scrapées
 */
async function validateDeal(deal: any, scrapedInfo: ScrapedProductInfo | null): Promise<ValidationResult> {
  const baseResult: ValidationResult = {
    dealId: deal.id,
    productName: deal.title || '',
    dealVolume: deal.volume || '',
    status: 'ERROR',
    message: '',
    variants: scrapedInfo?.variants || [],
  };

  if (!scrapedInfo || scrapedInfo.variants.length === 0) {
    return { ...baseResult, status: 'NOT_FOUND', message: 'Produit non trouvé ou pas de variantes' };
  }

  const { variant: matchingVariant, isExactMatch } = findMatchingVariant(scrapedInfo.variants, deal.volume);
  
  // Vérifier s'il y a des promos sur d'autres variantes
  const promoVariants = scrapedInfo.variants.filter(v => v.isPromo);
  
  if (matchingVariant && isExactMatch && matchingVariant.isPromo) {
    // La variante du deal est toujours en promo
    const priceDiff = Math.abs(deal.dealPrice - matchingVariant.currentPrice);
    
    if (priceDiff > 0.05) {
      // Prix a changé
      return {
        ...baseResult,
        status: 'PRICE_CHANGED',
        oldPrice: deal.dealPrice,
        newPrice: matchingVariant.currentPrice,
        oldDiscount: deal.discountPercent,
        newDiscount: matchingVariant.discountPercent,
        matchedVariant: matchingVariant,
        message: `Prix changé: ${deal.dealPrice}€ → ${matchingVariant.currentPrice}€`,
      };
    } else {
      // Prix identique, deal validé
      return {
        ...baseResult,
        status: 'VALID',
        matchedVariant: matchingVariant,
        message: 'Prix vérifié ✓',
      };
    }
  } else if (promoVariants.length > 0) {
    // La variante du deal n'est plus en promo, mais d'autres le sont
    // Trouver la meilleure promo
    const bestPromo = promoVariants.reduce((best, curr) => 
      curr.discountPercent > best.discountPercent ? curr : best
    );
    
    return {
      ...baseResult,
      status: 'VOLUME_CHANGED',
      oldVolume: deal.volume,
      newVolume: bestPromo.name,
      oldPrice: deal.dealPrice,
      newPrice: bestPromo.currentPrice,
      oldDiscount: deal.discountPercent,
      newDiscount: bestPromo.discountPercent,
      matchedVariant: bestPromo,
      message: `Volume changé: ${deal.volume} → ${bestPromo.name}`,
    };
  } else {
    // Aucune promo disponible
    return {
      ...baseResult,
      status: 'EXPIRED',
      message: 'Plus aucune promo disponible',
    };
  }
}

/**
 * Applique le résultat de la validation dans la base de données
 */
async function applyValidationResult(result: ValidationResult, deal: any) {
  switch (result.status) {
    case 'EXPIRED':
      await prisma.deal.update({
        where: { id: result.dealId },
        data: {
          isExpired: true,
          updatedAt: new Date(),
        },
      });
      console.log(`    ⚡ Deal #${result.dealId} marqué expiré (aucune promo disponible)`);
      break;

    case 'VOLUME_CHANGED':
      const newVariant = result.matchedVariant;
      if (newVariant) {
        const priceInfo = calculatePricePerUnit(newVariant.currentPrice, newVariant.name);
        const brandName = deal.product?.brandRef?.name || deal.product?.brand || '';

        await prisma.deal.update({
          where: { id: result.dealId },
          data: {
            volume: newVariant.name,
            dealPrice: newVariant.currentPrice,
            originalPrice: newVariant.originalPrice,
            discountPercent: newVariant.discountPercent,
            discountAmount: newVariant.originalPrice - newVariant.currentPrice,
            pricePerUnit: priceInfo?.pricePerUnit || deal.pricePerUnit,
            description: `${newVariant.discountPercent}% de réduction !`,
            title: `${brandName} -${newVariant.discountPercent}% : ${deal.product?.name?.substring(0, 100) || ''}`,
            updatedAt: new Date(),
            lastSeenAt: new Date(),
          },
        });

        await prisma.priceHistory.create({
          data: {
            productId: deal.productId,
            price: newVariant.currentPrice,
            volumeValue: newVariant.volumeValue,
            volumeUnit: newVariant.volumeUnit,
            volumeRaw: newVariant.name,
            date: new Date(),
          },
        });

        console.log(`    🔄 Deal #${result.dealId} mis à jour: ${result.oldVolume} → ${newVariant.name} (${newVariant.currentPrice}€ -${newVariant.discountPercent}%)`);
      }
      break;

    case 'PRICE_CHANGED':
      const matchingVariant = result.matchedVariant;
      if (matchingVariant) {
        const priceInfo = calculatePricePerUnit(matchingVariant.currentPrice, deal.volume);
        const brandName = deal.product?.brandRef?.name || deal.product?.brand || '';

        await prisma.deal.update({
          where: { id: result.dealId },
          data: {
            dealPrice: matchingVariant.currentPrice,
            originalPrice: matchingVariant.originalPrice,
            discountPercent: matchingVariant.discountPercent,
            discountAmount: matchingVariant.originalPrice - matchingVariant.currentPrice,
            pricePerUnit: priceInfo?.pricePerUnit || deal.pricePerUnit,
            description: `${matchingVariant.discountPercent}% de réduction !`,
            title: `${brandName} -${matchingVariant.discountPercent}% : ${deal.product?.name?.substring(0, 100) || ''}`,
            updatedAt: new Date(),
            lastSeenAt: new Date(),
          },
        });

        await prisma.priceHistory.create({
          data: {
            productId: deal.productId,
            price: matchingVariant.currentPrice,
            volumeValue: matchingVariant.volumeValue,
            volumeUnit: matchingVariant.volumeUnit,
            volumeRaw: matchingVariant.name,
            date: new Date(),
          },
        });

        console.log(`    💰 Deal #${result.dealId} prix mis à jour: ${deal.dealPrice}€ → ${matchingVariant.currentPrice}€`);
      }
      break;

    case 'VALID':
      await prisma.deal.update({
        where: { id: result.dealId },
        data: {
          lastSeenAt: new Date(),
        },
      });

      if (result.matchedVariant) {
        await prisma.priceHistory.create({
          data: {
            productId: deal.productId,
            price: result.matchedVariant.currentPrice,
            volumeValue: result.matchedVariant.volumeValue,
            volumeUnit: result.matchedVariant.volumeUnit,
            volumeRaw: result.matchedVariant.name,
            date: new Date(),
          },
        });
      }

      console.log(`    ✅ Deal #${result.dealId} validé`);
      break;

    case 'NOT_FOUND':
      // Produit non trouvé (404) → marquer comme expiré par précaution
      await prisma.deal.update({
        where: { id: result.dealId },
        data: {
          isExpired: true,
          updatedAt: new Date(),
        },
      });
      console.log(`    ❓ Deal #${result.dealId} marqué expiré (produit non trouvé - 404)`);
      break;

    case 'ERROR':
      console.log(`    ❌ Deal #${result.dealId}: ${result.message}`);
      break;
  }
}

// ============================================
// MAIN
// ============================================

async function main() {
  const args = process.argv.slice(2);
  let limit = 10;
  let specificDealId: string | null = null;

  // Parser les arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1]);
    }
    if (args[i] === '--deal-id' && args[i + 1]) {
      specificDealId = args[i + 1];
    }
  }

  console.log('🔍 Validation des deals Nocibe');
  console.log('================================');
  console.log('Mode: fetch HTML (pas besoin de Playwright)');
  console.log('');

  // Récupérer le merchant Nocibe
  const merchant = await prisma.merchant.findFirst({ where: { slug: 'nocibe' } });
  if (!merchant) {
    console.log('❌ Merchant Nocibe non trouvé');
    return;
  }

  // Récupérer les deals à valider
  let deals;
  if (specificDealId) {
    deals = await prisma.deal.findMany({
      where: { id: specificDealId },
      include: { product: { include: { merchant: true, brandRef: true } } },
    });
  } else {
    deals = await prisma.deal.findMany({
      where: {
        product: { merchantId: merchant.id },
        isExpired: false,
        isActive: true,
      },
      include: { product: { include: { merchant: true, brandRef: true } } },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    });
  }

  console.log(`📋 ${deals.length} deals à valider\n`);

  const stats = { valid: 0, priceChanged: 0, volumeChanged: 0, expired: 0, notFound: 0, error: 0 };

  for (const deal of deals) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`🏷️ Deal #${deal.id}: ${deal.title?.substring(0, 50)}...`);
    console.log(`   🔗 http://localhost:3000/deals/${deal.id}`);
    console.log(`   📦 Volume: ${deal.volume || 'N/A'}`);
    console.log(`   💵 Prix original: ${deal.originalPrice}€`);
    console.log(`   💰 Prix promo: ${deal.dealPrice}€`);
    console.log(`   📉 Réduction: -${deal.discountPercent}% (${deal.discountAmount}€ d'économie)`);

    const productUrl = deal.product?.productUrl;
    if (!productUrl) {
      console.log('   ❌ Pas d\'URL produit');
      stats.error++;
      continue;
    }

    // Scraper la page produit
    const scrapedInfo = await scrapeNocibeProduct(productUrl);
    
    if (scrapedInfo && scrapedInfo.variants.length > 0) {
      console.log(`\n   📦 Variantes trouvées sur Nocibe:`);
      const { variant: matchingVariant } = findMatchingVariant(scrapedInfo.variants, deal.volume);
      
      for (const v of scrapedInfo.variants) {
        const isMatch = matchingVariant && normalizeVolume(v.name) === normalizeVolume(matchingVariant.name);
        const matchTag = isMatch ? ' ← DEAL ACTUEL' : '';
        const promoIcon = v.isPromo ? '🏷️' : '  ';
        const promoInfo = v.isPromo ? `(-${v.discountPercent}%)` : '(pas de promo)';
        console.log(`      ${promoIcon} ${v.name}: ${v.originalPrice}€ → ${v.currentPrice}€ ${promoInfo}${matchTag}`);
        
        if (v.promoCode && v.priceWithCode) {
          console.log(`         📎 Code ${v.promoCode}: ${v.priceWithCode}€`);
        }
      }
    }

    // Valider le deal
    const validationResult = await validateDeal(deal, scrapedInfo);

    // Appliquer les changements
    await applyValidationResult(validationResult, deal);

    // Mettre à jour les stats
    switch (validationResult.status) {
      case 'VALID': stats.valid++; break;
      case 'PRICE_CHANGED': stats.priceChanged++; break;
      case 'VOLUME_CHANGED': stats.volumeChanged++; break;
      case 'EXPIRED': stats.expired++; break;
      case 'NOT_FOUND': stats.notFound++; break;
      case 'ERROR': stats.error++; break;
    }

    // Délai entre les requêtes (respecter le rate limit)
    await new Promise(r => setTimeout(r, 500));
  }

  await prisma.$disconnect();

  // Résumé
  console.log('\n' + '═'.repeat(60));
  console.log('📊 RÉSUMÉ');
  console.log('═'.repeat(60));
  console.log(`✅ Validés:           ${stats.valid}`);
  console.log(`💰 Prix changés:      ${stats.priceChanged}`);
  console.log(`🔄 Volume changé:     ${stats.volumeChanged}`);
  console.log(`⚡ Expirés:           ${stats.expired}`);
  console.log(`❓ Non trouvés:       ${stats.notFound}`);
  console.log(`❌ Erreurs:           ${stats.error}`);
  console.log(`\nTotal: ${deals.length} deals traités`);
}

main().catch(console.error);
