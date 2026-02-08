import { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://citybaddies.com';

// ────────────────────────────────────────────────────────────
// Stratégie SEO :
//   robots.txt = crawling-friendly, on laisse Google explorer
//   La vraie police se fait côté page avec :
//     - meta robots noindex sur les combinaisons complexes
//     - canonical propre pointant vers l'URL indexable
// ────────────────────────────────────────────────────────────
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          // Zones privées / techniques
          '/api/',
          '/admin/',
          '/auth/',
          '/profile/',
          '/private/',

          // Params toxiques via wildcard — on bloque le crawl inutile
          '/deals?*search=*',
          '/deals?*sortBy=*',
          '/deals?*sortOrder=*',
          '/deals?*minPrice=*',
          '/deals?*maxPrice=*',
          '/deals?*hot=*',
          '/deals?*page=*',
          '/deals?*subcategory=*',
          '/deals?*subsubcategory=*',
          '/deals?*tag=*',
          '/deals?*merchant=*',
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
