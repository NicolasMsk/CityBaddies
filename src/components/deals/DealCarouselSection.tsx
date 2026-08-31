'use client';

import { useEffect, useRef, useState } from 'react';

function CarouselSkeleton() {
  return (
    <div className="flex gap-4 overflow-hidden">
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className="flex-shrink-0 w-full sm:w-1/2 md:w-1/3 lg:w-1/4 px-2"
        >
          <div className="bg-white/5 border border-white/10 h-[560px] animate-pulse" />
        </div>
      ))}
    </div>
  );
}

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
  status: 'PENDING' | 'ACTIVE' | 'EXPIRED';
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [DealCarousel, setDealCarousel] = useState<typeof import('./DealCarousel').default | null>(null);

  useEffect(() => {
    let active = true;
    let observer: IntersectionObserver | undefined;

    const loadCarousel = () => {
      void import('./DealCarousel').then(module => {
        if (active) setDealCarousel(() => module.default);
      });
    };

    if (!('IntersectionObserver' in window)) {
      loadCarousel();
    } else if (containerRef.current) {
      observer = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          observer?.disconnect();
          loadCarousel();
        }
      }, { rootMargin: '500px 0px' });
      observer.observe(containerRef.current);
    }

    return () => {
      active = false;
      observer?.disconnect();
    };
  }, []);

  return (
    <div ref={containerRef}>
      {DealCarousel ? (
        <DealCarousel
          deals={deals}
          autoPlay={true}
          autoPlayInterval={autoPlayInterval}
          showControls={true}
        />
      ) : (
        <CarouselSkeleton />
      )}
    </div>
  );
}
