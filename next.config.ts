import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Output standalone pour Docker
  output: 'standalone',
  
  // Redirection www vers domaine principal
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [
          {
            type: 'host',
            value: 'www.citybaddies.com',
          },
        ],
        destination: 'https://citybaddies.com/:path*',
        permanent: true, // 301 redirect pour SEO
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },

  // En-têtes de sécurité (défense en profondeur). On s'en tient aux en-têtes
  // sûrs — PAS de CSP stricte ici : le site charge JSON-LD inline, Google
  // Fonts, GA, Supabase et des images de domaines variés ; une CSP mal réglée
  // casserait la prod. (CSP à ajouter plus tard en Report-Only d'abord.)
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' }, // anti-clickjacking
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        ],
      },
    ];
  },
};

export default nextConfig;
