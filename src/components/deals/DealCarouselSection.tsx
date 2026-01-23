'use client';

import dynamic from 'next/dynamic';

// Import dynamique pour éviter les erreurs SSR
const DealCarousel = dynamic(() => import('./DealCarousel'), {
  ssr: false,
  loading: () => (
    <div className="flex gap-4 overflow-hidden">
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className="flex-shrink-0 w-full sm:w-1/2 md:w-1/3 lg:w-1/4 px-2"
        >
          <div className="bg-white/5 border border-white/10 h-[380px] animate-pulse" />
        </div>
      ))}
    </div>
  ),
});

interface Deal {
  id: string;
  title: string;
  refinedTitle?: string | null;
  url: string;
  originalPrice: number;
  discountedPrice: number;
  discountPercent: number;
  imageUrl?: string | null;
  score: number;
  votes: number;
  isExpired: boolean;
  brandTier?: number | null;
  createdAt: Date;
  product: {
    id: string;
    name: string;
    brand?: string | null;
    category?: { name: string; slug: string } | null;
    merchant?: { name: string; slug: string; logoUrl?: string | null } | null;
  };
}

interface DealCarouselSectionProps {
  deals: Deal[];
  autoPlayInterval?: number;
}

export default function DealCarouselSection({ deals, autoPlayInterval = 4000 }: DealCarouselSectionProps) {
  return (
    <DealCarousel
      deals={deals}
      autoPlay={true}
      autoPlayInterval={autoPlayInterval}
      showControls={true}
    />
  );
}
