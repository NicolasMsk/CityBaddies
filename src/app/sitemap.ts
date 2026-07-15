import { MetadataRoute } from 'next';
import prisma from '@/lib/prisma';
import { getAllPromoPages } from '@/lib/promo-queries';

// Force dynamic rendering
export const dynamic = 'force-dynamic';
export const revalidate = 3600; // Revalidate every hour

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://citybaddies.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Date du dernier relevé de prix réel : c'est LA vraie date de modification des
  // pages dynamiques (home, /produits). Un new Date() à chaque render simule une
  // fraîcheur permanente et dilue le signal lastmod auprès de Google.
  const lastTracked = await prisma.deal.findFirst({
    where: { status: 'ACTIVE', type: 'tracked' },
    orderBy: { updatedAt: 'desc' },
    select: { updatedAt: true },
  });
  const dataDate = lastTracked?.updatedAt ?? new Date();
  // Pages éditoriales quasi-statiques : ne pas prétendre qu'elles changent tous les jours.
  const editorialDate = new Date('2026-07-15');

  // Pages statiques
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: dataDate,
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${BASE_URL}/produits`,
      lastModified: dataDate,
      changeFrequency: 'hourly',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/guides`,
      lastModified: editorialDate,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/categories`,
      lastModified: editorialDate,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/methodologie`,
      lastModified: editorialDate,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    // Pages contenu data-driven : chiffres recalculés à chaque relevé
    {
      url: `${BASE_URL}/sephora-vs-nocibe-vs-marionnaud`,
      lastModified: dataDate,
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/parfums-moins-de-50-euros`,
      lastModified: dataDate,
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/about`,
      lastModified: editorialDate,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/contact`,
      lastModified: editorialDate,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/legal`,
      lastModified: editorialDate,
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

  // --- SEO Landing Pages : /produits?category=slug (indexables) ---
  const dealsCategoryPages: MetadataRoute.Sitemap = categories.map((category) => ({
    url: `${BASE_URL}/produits?category=${category.slug}`,
    lastModified: dataDate,
    changeFrequency: 'daily' as const,
    priority: 0.8,
  }));

  // --- Pages marques : /marques + /marques/[slug] ---
  // Remplacent les anciennes URLs à query-string /produits?category=…&brand=…
  // (URL propre, contenu éditorial + prix temps réel, canonical dédié).
  const activeBrands = await prisma.brand.findMany({
    where: {
      products: { some: { deals: { some: { status: 'ACTIVE', type: 'tracked' } } } },
    },
    select: { slug: true, updatedAt: true },
    orderBy: { name: 'asc' },
  });

  const brandPages: MetadataRoute.Sitemap = [
    {
      url: `${BASE_URL}/marques`,
      lastModified: dataDate,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    },
    ...activeBrands.map((b) => ({
      url: `${BASE_URL}/marques/${b.slug}`,
      lastModified: dataDate,
      changeFrequency: 'daily' as const,
      priority: 0.7,
    })),
  ];

  // Récupérer les produits avec des deals actifs (pages produit)
  const activeProducts = await prisma.product.findMany({
    where: {
      deals: { some: { status: 'ACTIVE' } },
    },
    select: {
      slug: true,
      updatedAt: true,
      deals: {
        where: { status: 'ACTIVE' },
        select: { score: true },
        orderBy: { score: 'desc' },
        take: 1,
      },
    },
    take: 500,
  });

  const productPages: MetadataRoute.Sitemap = activeProducts.map((product) => ({
    url: `${BASE_URL}/produits/${product.slug}`,
    lastModified: product.updatedAt || new Date(),
    changeFrequency: 'daily' as const,
    priority: product.deals[0]?.score && product.deals[0].score > 50 ? 0.8 : 0.6,
  }));

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
      lastModified: editorialDate,
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
    ...dealsCategoryPages,   // /produits?category=parfums (indexable landing pages)
    ...brandPages,            // /marques + /marques/chanel, dior, etc.
    ...productPages,
    ...guidePages,
    ...promoCodePages,        // /codes-promo + /codes-promo/sephora, nocibe, etc.
  ];
}
