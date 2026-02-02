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
          '/deals?*',  // Bloquer les filtres (doublons avec /categories/)
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
          '/deals?*',  // Bloquer les filtres (utiliser /categories/ à la place)
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
