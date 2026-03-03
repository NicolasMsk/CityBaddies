'use client';

import { useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import SafeImage from '@/components/ui/SafeImage';

interface ProductImageItem {
  url: string;
  originalUrl?: string; // URL avant transformation HD — pour fallback
  alt?: string | null;
  type?: string;
}

interface ProductImageCarouselProps {
  images: ProductImageItem[];
  productName: string;
  brandName: string;
  categorySlug?: string | null;
}

export default function ProductImageCarousel({
  images: rawImages,
  productName,
  brandName,
  categorySlug,
}: ProductImageCarouselProps) {
  const images = rawImages.slice(0, 5);
  const [activeIndex, setActiveIndex] = useState(0);
  const [failedImages, setFailedImages] = useState<Set<number>>(new Set());

  // Filtrer les images totalement cassées (SafeImage a épuisé tous ses fallbacks)
  const validImages = images.filter((_, idx) => !failedImages.has(idx));
  const safeIndex = Math.min(activeIndex, Math.max(0, validImages.length - 1));

  const handleImageFullyFailed = useCallback((originalIndex: number) => {
    setFailedImages(prev => {
      const next = new Set(prev);
      next.add(originalIndex);
      return next;
    });
    setActiveIndex(prev => Math.max(0, prev - 1));
  }, []);

  // Trouver les indices originaux des images encore valides
  const originalIndices = images.map((_, i) => i).filter(i => !failedImages.has(i));

  // Si aucune image valide, afficher le fallback catégorie
  // Aucune image valide → ne rien afficher du tout
  if (validImages.length === 0) {
    return null;
  }

  const hasMultiple = validImages.length > 1;
  const currentImage = validImages[safeIndex];

  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      {/* Image principale */}
      <div className="group relative aspect-square sm:aspect-[4/5] bg-transparent flex items-center justify-center">
        <SafeImage
          key={`main-${currentImage.url}-${safeIndex}`}
          src={currentImage.url}
          fallbackSrc={currentImage.originalUrl}
          categorySlug={categorySlug}
          alt={currentImage.alt || `${brandName} ${productName}`}
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          quality={90}
          className="object-contain"
          priority={safeIndex === 0}
          onAllFailed={() => handleImageFullyFailed(originalIndices[safeIndex])}
        />

        {/* Flèches de navigation - toujours visibles sur mobile */}
        {hasMultiple && (
          <>
            <button
              onClick={() => setActiveIndex(i => i === 0 ? validImages.length - 1 : i - 1)}
              className="absolute left-1.5 sm:left-2 top-1/2 -translate-y-1/2 p-1.5 sm:p-2 bg-black/60 border border-white/10 text-white/70 hover:text-white hover:bg-black/80 transition-all sm:opacity-0 sm:group-hover:opacity-100 z-10"
              aria-label="Image précédente"
            >
              <ChevronLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </button>
            <button
              onClick={() => setActiveIndex(i => i === validImages.length - 1 ? 0 : i + 1)}
              className="absolute right-1.5 sm:right-2 top-1/2 -translate-y-1/2 p-1.5 sm:p-2 bg-black/60 border border-white/10 text-white/70 hover:text-white hover:bg-black/80 transition-all sm:opacity-0 sm:group-hover:opacity-100 z-10"
              aria-label="Image suivante"
            >
              <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </button>
          </>
        )}

        {/* Compteur d'images */}
        {hasMultiple && (
          <div className="absolute bottom-2 right-2 sm:bottom-3 sm:right-3 px-2 py-0.5 sm:px-2.5 sm:py-1 bg-black/70 border border-white/10 text-[9px] sm:text-[10px] font-medium tracking-wider text-white/70 z-10">
            {safeIndex + 1} / {validImages.length}
          </div>
        )}
      </div>

      {/* Miniatures */}
      {hasMultiple && (
        <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {validImages.map((img, idx) => (
            <button
              key={idx}
              onClick={() => setActiveIndex(idx)}
              className={`relative flex-shrink-0 w-12 h-12 sm:w-16 sm:h-16 border transition-all ${
                idx === safeIndex
                  ? 'border-[#d4a855] opacity-100'
                  : 'border-white/10 opacity-50 hover:opacity-80 hover:border-white/30'
              }`}
              aria-label={`Voir image ${idx + 1}`}
            >
              <SafeImage
                src={img.url}
                fallbackSrc={img.originalUrl}
                categorySlug={categorySlug}
                alt={img.alt || `${brandName} ${productName} - ${idx + 1}`}
                fill
                sizes="64px"
                quality={60}
                className="object-contain p-0.5"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
