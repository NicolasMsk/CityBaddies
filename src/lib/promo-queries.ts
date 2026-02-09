/**
 * =============================================================================
 * PRISMA QUERIES — Codes promo & Pages marchands
 * =============================================================================
 *
 * Toutes les requêtes pour les pages /codes-promo/*
 *   import { getPromoPage, getAllPromoPages, ... } from '@/lib/promo-queries';
 *
 * =============================================================================
 */

import prisma from '@/lib/prisma';

// ══════════════════════════════════════════════════════════════════════
// Utils
// ══════════════════════════════════════════════════════════════════════

/** Supprime les tags HTML pour l'aperçu texte */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

// ══════════════════════════════════════════════════════════════════════
// Types — réexportés pour les composants
// ══════════════════════════════════════════════════════════════════════

export type MerchantPromoPage = NonNullable<Awaited<ReturnType<typeof getPromoPage>>>;
export type PromoCodeItem = Awaited<ReturnType<typeof getActivePromoCodes>>[number];

// ══════════════════════════════════════════════════════════════════════
// Helpers — Pages codes promo
// ══════════════════════════════════════════════════════════════════════

/** Page riche /codes-promo/{slug} (ex: /codes-promo/sephora) */
export async function getPromoPage(merchantSlug: string) {
  try {
    return await prisma.merchantPromoPage.findUnique({
      where: { canonicalSlug: merchantSlug },
      include: { merchant: true },
    });
  } catch {
    return null;
  }
}

/** Toutes les pages promo (pour /codes-promo index + sitemap) */
export async function getAllPromoPages() {
  try {
    const pages = await prisma.merchantPromoPage.findMany({
      orderBy: { canonicalSlug: 'asc' },
      include: {
        merchant: {
          include: {
            _count: {
              select: {
                promoCodes: { where: { status: 'ACTIVE', code: { not: '' } } },
              },
            },
          },
        },
      },
    });
    return pages;
  } catch {
    return [];
  }
}

// ══════════════════════════════════════════════════════════════════════
// Helpers — Codes promo
// ══════════════════════════════════════════════════════════════════════

/** Codes promo actifs d'un marchand */
export async function getActivePromoCodes(merchantId: string) {
  try {
    return await prisma.promoCode.findMany({
      where: {
        merchantId,
        status: 'ACTIVE',
      },
      orderBy: [
        { isVerified: 'desc' },
        { isFeatured: 'desc' },
        { votes: 'desc' },
        { discountValue: 'desc' },
      ],
    });
  } catch {
    return [];
  }
}

/** Tous les codes promo featured (pour homepage widget) */
export async function getFeaturedPromoCodes(limit = 6) {
  try {
    return await prisma.promoCode.findMany({
      where: {
        status: 'ACTIVE',
        isFeatured: true,
      },
      orderBy: [
        { votes: 'desc' },
        { discountValue: 'desc' },
      ],
      take: limit,
    });
  } catch {
    return [];
  }
}

/** Code promo par slug (page détail) */
export async function getPromoCodeBySlug(slug: string) {
  try {
    return await prisma.promoCode.findUnique({
      where: { slug },
    });
  } catch {
    return null;
  }
}

/** Codes promo d'un marchand par son slug canonical */
export async function getPromoCodesByMerchantSlug(merchantSlug: string) {
  try {
    const page = await getPromoPage(merchantSlug);
    if (!page) return [];
    return await getActivePromoCodes(page.merchantId);
  } catch {
    return [];
  }
}
