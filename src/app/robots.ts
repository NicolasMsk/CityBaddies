import { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://citybaddies.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/_next/image',  // Autoriser les images optimisées Next.js
        ],
        disallow: [
          '/api/',
          '/admin/',
          '/auth/',
          '/profile/',
          '/_next/static/',  // Bloquer uniquement les assets JS/CSS
          '/private/',
          // Bloquer les filtres (doublons avec /categories/) mais PAS /deals?page=
          '/deals?category=',
          '/deals?merchant=',
          '/deals?brand=',
          '/deals?search=',
          '/deals?sort=',
        ],
      },
      {
        userAgent: 'Googlebot',
        allow: [
          '/',
          '/_next/image',  // Autoriser les images optimisées
        ],
        disallow: [
          '/api/',
          '/admin/',
          '/auth/',
          '/profile/',
          // Bloquer les filtres mais autoriser /deals?page= pour la pagination
          '/deals?category=',
          '/deals?merchant=',
          '/deals?brand=',
          '/deals?search=',
          '/deals?sort='
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
