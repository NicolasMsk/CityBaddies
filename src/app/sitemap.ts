import { MetadataRoute } from 'next';
import prisma from '@/lib/prisma';
import { getAllPromoPages } from '@/lib/promo-queries';

// Force dynamic rendering
export const dynamic = 'force-dynamic';
export const revalidate = 3600; // Revalidate every hour

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://citybaddies.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Pages statiques
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${BASE_URL}/deals`,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/guides`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/categories`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/about`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/contact`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/legal`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];

  // Récupérer les catégories actives (avec des deals actifs)
  const categories = await prisma.category.findMany({
    where: {
      products: {
        some: {
          deals: {
            some: {
              status: 'ACTIVE',
            },
          },
        },
      },
    },
    select: {
      slug: true,
      updatedAt: true,
    },
  });

  // Pages catégories classiques /categories/slug
  const categoryPages: MetadataRoute.Sitemap = categories.map((category) => ({
    url: `${BASE_URL}/categories/${category.slug}`,
    lastModified: category.updatedAt || new Date(),
    changeFrequency: 'daily',
    priority: 0.7,
  }));

  // --- SEO Landing Pages : /deals?category=slug (indexables) ---
  const dealsCategoryPages: MetadataRoute.Sitemap = categories.map((category) => ({
    url: `${BASE_URL}/deals?category=${category.slug}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.8,
  }));

  // --- SEO Landing Pages Premium : /deals?category=slug&brand=X ---
  // Top marques par catégorie (minimum 3 deals actifs)
  const brandCategoryData = await prisma.deal.findMany({
    where: { status: 'ACTIVE' },
    select: {
      product: {
        select: {
          brand: true,
          category: { select: { slug: true } },
        },
      },
    },
  });

  const brandCategoryCounts: Record<string, number> = {};
  for (const d of brandCategoryData) {
    if (d.product.brand && d.product.category?.slug) {
      const key = `${d.product.category.slug}|${d.product.brand}`;
      brandCategoryCounts[key] = (brandCategoryCounts[key] || 0) + 1;
    }
  }

  // Garder les combos avec 3+ deals, top 50
  const dealsBrandPages: MetadataRoute.Sitemap = Object.entries(brandCategoryCounts)
    .filter(([, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50)
    .map(([key]) => {
      const [categorySlug, brand] = key.split('|');
      return {
        url: `${BASE_URL}/deals?category=${categorySlug}&brand=${encodeURIComponent(brand)}`,
        lastModified: new Date(),
        changeFrequency: 'daily' as const,
        priority: 0.7,
      };
    });

  // Récupérer les deals actifs (haute priorité)
  const activeDeals = await prisma.deal.findMany({
    where: {
      status: 'ACTIVE',
    },
    select: {
      id: true,
      updatedAt: true,
      score: true,
    },
    orderBy: [
      { score: 'desc' },
      { createdAt: 'desc' },
    ],
    take: 500,
  });

  // Récupérer les deals expirés (priorité basse, mais on les garde pour le SEO)
  const expiredDeals = await prisma.deal.findMany({
    where: {
      status: 'EXPIRED',
    },
    select: {
      id: true,
      updatedAt: true,
      score: true,
    },
    orderBy: [
      { score: 'desc' },
      { updatedAt: 'desc' },
    ],
    take: 1000,
  });

  const dealPages: MetadataRoute.Sitemap = [
    ...activeDeals.map((deal) => ({
      url: `${BASE_URL}/deals/${deal.id}`,
      lastModified: deal.updatedAt || new Date(),
      changeFrequency: 'daily' as const,
      priority: deal.score && deal.score > 50 ? 0.8 : 0.6,
    })),
    ...expiredDeals.map((deal) => ({
      url: `${BASE_URL}/deals/${deal.id}`,
      lastModified: deal.updatedAt || new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.3,
    })),
  ];

  // Récupérer les guides d'achat publiés
  const guides = await prisma.buyingGuide.findMany({
    where: { status: 'PUBLISHED' },
    select: {
      slug: true,
      publishedAt: true,
      updatedAt: true,
    },
    orderBy: { publishedAt: 'desc' },
    take: 100,
  });

  const guidePages: MetadataRoute.Sitemap = guides.map((guide) => ({
    url: `${BASE_URL}/guides/${guide.slug}`,
    lastModified: guide.updatedAt || guide.publishedAt || new Date(),
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  // Récupérer les pages codes promo
  const promoPages = await getAllPromoPages();

  const promoCodePages: MetadataRoute.Sitemap = [
    {
      url: `${BASE_URL}/codes-promo`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    ...promoPages.map((page) => ({
      url: `${BASE_URL}/codes-promo/${page.canonicalSlug}`,
      lastModified: page.updatedAt || new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.85,
    })),
  ];

  return [
    ...staticPages,
    ...categoryPages,
    ...dealsCategoryPages,   // /deals?category=parfums (indexable landing pages)
    ...dealsBrandPages,       // /deals?category=parfums&brand=Guerlain (premium)
    ...dealPages,
    ...guidePages,
    ...promoCodePages,        // /codes-promo + /codes-promo/sephora, nocibe, etc.
  ];
}
