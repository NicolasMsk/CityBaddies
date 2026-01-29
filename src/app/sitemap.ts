import { MetadataRoute } from 'next';
import prisma from '@/lib/prisma';

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
              isActive: true,
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

  const categoryPages: MetadataRoute.Sitemap = categories.map((category) => ({
    url: `${BASE_URL}/categories/${category.slug}`,
    lastModified: category.updatedAt || new Date(),
    changeFrequency: 'daily',
    priority: 0.7,
  }));

  // Pages de deals filtrées par catégorie (pour éviter le "canonical mismatch")
  const dealCategoryPages: MetadataRoute.Sitemap = categories.map((category) => ({
    url: `${BASE_URL}/deals?category=${category.slug}`,
    lastModified: new Date(),
    changeFrequency: 'daily',
    priority: 0.6,
  }));

  // Récupérer les sous-catégories avec des deals actifs
  const subcategories = await prisma.product.groupBy({
    by: ['subcategory', 'categoryId'],
    where: {
      subcategory: { not: null },
      deals: {
        some: {
          isActive: true,
        },
      },
    },
  });

  // Mapper les categoryIds aux slugs
  const categoryMap = new Map(categories.map(c => [c.slug, c.slug]));
  const allCats = await prisma.category.findMany({ select: { id: true, slug: true } });
  const catIdToSlug = new Map(allCats.map(c => [c.id, c.slug]));

  const subcategoryPages: MetadataRoute.Sitemap = subcategories
    .filter(sub => sub.subcategory && catIdToSlug.get(sub.categoryId))
    .map((sub) => ({
      url: `${BASE_URL}/deals?category=${catIdToSlug.get(sub.categoryId)}&subcategory=${sub.subcategory}`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.5,
    }));

  // Récupérer les deals actifs (limiter aux plus récents/populaires)
  const deals = await prisma.deal.findMany({
    where: {
      isActive: true,
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
    take: 500, // Limiter pour performance
  });

  const dealPages: MetadataRoute.Sitemap = deals.map((deal) => ({
    url: `${BASE_URL}/deals/${deal.id}`,
    lastModified: deal.updatedAt || new Date(),
    changeFrequency: 'daily',
    priority: deal.score && deal.score > 50 ? 0.8 : 0.6,
  }));

  return [...staticPages, ...categoryPages, ...dealCategoryPages, ...subcategoryPages, ...dealPages];
}
