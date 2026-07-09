/**
 * Validation et normalisation des produits scrapés — logique pure, sans DB.
 */
import { ScrapedProduct } from './types';
import { parseVolume } from '../utils/volume';

export const MIN_DISCOUNT_PERCENT = 15;
export const MIN_PRICE_EUR = 1;
export const MAX_DISCOUNT_PERCENT = 90; // au-delà: donnée aberrante, pas un vrai deal

/**
 * Corrige les incohérences de prix courantes des scrapers:
 * - originalPrice manquant (== currentPrice) alors qu'un % de réduction est affiché
 * - % de réduction manquant alors que les deux prix existent
 */
export function normalizePrices(p: ScrapedProduct): ScrapedProduct {
  let { currentPrice, originalPrice, discountPercent } = p;

  if (originalPrice === currentPrice && discountPercent > 0) {
    originalPrice = Math.round((currentPrice / (1 - discountPercent / 100)) * 100) / 100;
  }
  if (discountPercent === 0 && originalPrice > currentPrice && currentPrice > 0) {
    discountPercent = Math.round((1 - currentPrice / originalPrice) * 100);
  }

  return { ...p, originalPrice, discountPercent };
}

/** Un produit scrapé est un deal importable ? (appeler normalizePrices AVANT) */
export function isValidDeal(p: ScrapedProduct, minDiscount: number = MIN_DISCOUNT_PERCENT): boolean {
  if (!p.name || !p.brand || !p.productUrl) return false;
  if (!p.volume || !parseVolume(p.volume)) return false;
  if (p.currentPrice <= MIN_PRICE_EUR) return false;
  if (p.originalPrice <= p.currentPrice) return false;
  if (p.discountPercent < minDiscount) return false;
  if (p.discountPercent >= MAX_DISCOUNT_PERCENT) return false;
  return true;
}

/**
 * Slug produit stable "marque-nom" — clé de matching des produits entre enseignes.
 * Retire le préfixe marque du nom s'il y est déjà pour éviter "dior-dior-...".
 */
export function productSlug(brand: string, name: string): string {
  const clean = (s: string) =>
    s.toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

  const brandSlug = clean(brand);
  let nameSlug = clean(name);
  if (brandSlug && nameSlug.startsWith(brandSlug + '-')) {
    nameSlug = nameSlug.slice(brandSlug.length + 1);
  }
  return `${brandSlug}-${nameSlug}`.substring(0, 80).replace(/-$/, '');
}
