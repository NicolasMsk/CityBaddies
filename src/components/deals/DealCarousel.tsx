'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import DealCard from './DealCard';

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

interface DealCarouselProps {
  deals: Deal[];
  autoPlay?: boolean;
  autoPlayInterval?: number;
  showControls?: boolean;
  className?: string;
}

export default function DealCarousel({
  deals,
  autoPlay = true,
  autoPlayInterval = 4000,
  showControls = true,
  className = '',
}: DealCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isHovering, setIsHovering] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Nombre de cards visibles selon la taille d'écran
  const getVisibleCount = () => {
    if (typeof window === 'undefined') return 4;
    if (window.innerWidth < 640) return 1;
    if (window.innerWidth < 768) return 2;
    if (window.innerWidth < 1024) return 3;
    return 4;
  };

  const [visibleCount, setVisibleCount] = useState(4);

  useEffect(() => {
    const handleResize = () => setVisibleCount(getVisibleCount());
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const maxIndex = Math.max(0, deals.length - visibleCount);

  // Auto-play logic
  useEffect(() => {
    if (isPlaying && !isHovering && deals.length > visibleCount) {
      intervalRef.current = setInterval(() => {
        setCurrentIndex((prev) => (prev >= maxIndex ? 0 : prev + 1));
      }, autoPlayInterval);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isPlaying, isHovering, maxIndex, autoPlayInterval, deals.length, visibleCount]);

  const goToPrev = () => {
    setCurrentIndex((prev) => (prev <= 0 ? maxIndex : prev - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev >= maxIndex ? 0 : prev + 1));
  };

  if (deals.length === 0) return null;

  return (
    <div
      className={`relative group ${className}`}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Carousel Container */}
      <div className="overflow-hidden" ref={containerRef}>
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{
            transform: `translateX(-${currentIndex * (100 / visibleCount)}%)`,
          }}
        >
          {deals.map((deal) => (
            <div
              key={deal.id}
              className="flex-shrink-0 px-2 md:px-3 h-full"
              style={{ width: `${100 / visibleCount}%` }}
            >
              <div className="h-[480px]">
                <DealCard deal={deal as any} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Navigation Arrows - Hidden on mobile, visible on hover */}
      {showControls && deals.length > visibleCount && (
        <>
          <button
            onClick={goToPrev}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 md:-translate-x-4 z-10 
                       w-10 h-10 md:w-12 md:h-12 bg-[#0a0a0a] border border-white/10
                       flex items-center justify-center text-white
                       opacity-0 group-hover:opacity-100 transition-all duration-300
                       hover:bg-white hover:text-black hover:border-white
                       focus:outline-none"
            aria-label="Précédent"
          >
            <ChevronLeft className="h-5 w-5 md:h-6 md:w-6" strokeWidth={1} />
          </button>
          <button
            onClick={goToNext}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 md:translate-x-4 z-10
                       w-10 h-10 md:w-12 md:h-12 bg-[#0a0a0a] border border-white/10
                       flex items-center justify-center text-white
                       opacity-0 group-hover:opacity-100 transition-all duration-300
                       hover:bg-white hover:text-black hover:border-white
                       focus:outline-none"
            aria-label="Suivant"
          >
            <ChevronRight className="h-5 w-5 md:h-6 md:w-6" strokeWidth={1} />
          </button>
        </>
      )}

      {/* Progress Dots & Play/Pause */}
      {showControls && deals.length > visibleCount && (
        <div className="flex items-center justify-center gap-6 mt-8">
          {/* Progress dots */}
          <div className="flex items-center gap-1">
            {Array.from({ length: maxIndex + 1 }).map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`h-[1px] transition-all duration-300 ${
                  idx === currentIndex
                    ? 'w-12 bg-[#d4a855]'
                    : 'w-6 bg-white/20 hover:bg-white/40'
                }`}
                aria-label={`Aller au slide ${idx + 1}`}
              />
            ))}
          </div>

          {/* Play/Pause button */}
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="text-neutral-500 hover:text-white transition-colors"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="h-3 w-3" />
            ) : (
              <Play className="h-3 w-3" />
            )}
          </button>
        </div>
      )}
    </div>
  );
}
