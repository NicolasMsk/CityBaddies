import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'media.sephora.eu',
      },
      {
        protocol: 'https',
        hostname: '**.sephora.fr',
      },
      {
        protocol: 'https',
        hostname: 'media.nocibe.fr',
      },
      {
        protocol: 'https',
        hostname: '**.nocibe.fr',
      },
      {
        protocol: 'https',
        hostname: '**.marionnaud.fr',
      },
      {
        protocol: 'https',
        hostname: '**.amazon.fr',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: '**.googleusercontent.com',
      },
    ],
  },
};

export default nextConfig;
