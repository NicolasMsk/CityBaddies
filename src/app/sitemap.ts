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

  // Récupérer les catégories actives
  const categories = await prisma.category.findMany({
    where: {
      products: {
        some: {
          deals: {
            some: {
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
    url: `${BASE_URL}/categories?category=${category.slug}`,
    lastModified: category.updatedAt || new Date(),
    changeFrequency: 'daily',
    priority: 0.7,
  }));

  // Récupérer les deals actifs (limiter aux plus récents/populaires)
  const deals = await prisma.deal.findMany({
    where: {
      isExpired: false,
      discountPercent: { gte: 15 },
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

  return [...staticPages, ...categoryPages, ...dealPages];
}
