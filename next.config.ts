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
};

export default nextConfig;
