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

  // Compter le total de deals pour générer les pages de pagination
  const totalDeals = await prisma.deal.count({
    where: {
      isActive: true,
      isExpired: false,
    },
  });
  
  const DEALS_PER_PAGE = 24;
  const totalPages = Math.ceil(totalDeals / DEALS_PER_PAGE);
  
  // Pages de pagination /deals?page=2, /deals?page=3, etc.
  // (page 1 est déjà dans staticPages comme /deals)
  const paginationPages: MetadataRoute.Sitemap = Array.from(
    { length: Math.min(totalPages - 1, 20) }, // Max 20 pages dans le sitemap
    (_, i) => ({
      url: `${BASE_URL}/deals?page=${i + 2}`,
      lastModified: new Date(),
      changeFrequency: 'hourly' as const,
      priority: 0.7,
    })
  );

  // Récupérer les catégories actives (avec des deals actifs)
  const categories = await prisma.category.findMany({
    where: {
      products: {
        some: {
          deals: {
            some: {
              isActive: true,
              isExpired: false,
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

  // Récupérer les deals actifs (limiter aux plus récents/populaires)
  const deals = await prisma.deal.findMany({
    where: {
      isActive: true,
      isExpired: false,
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

  return [...staticPages, ...paginationPages, ...categoryPages, ...dealPages];
}
