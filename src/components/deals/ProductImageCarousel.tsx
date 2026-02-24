'use client';

import Image from 'next/image';
import { useState } from 'react';
import { ChevronLeft, ChevronRight, ImageOff } from 'lucide-react';

interface ProductImageItem {
  url: string;
  alt?: string | null;
  type?: string;
}

interface ProductImageCarouselProps {
  images: ProductImageItem[];
  productName: string;
  brandName: string;
}

export default function ProductImageCarousel({ images: rawImages, productName, brandName }: ProductImageCarouselProps) {
  const images = rawImages.slice(0, 5);
  const [activeIndex, setActiveIndex] = useState(0);
  const [failedImages, setFailedImages] = useState<Set<number>>(new Set());

  // Filtrer les images qui ont échoué
  const validImages = images.filter((_, idx) => !failedImages.has(idx));
  // Mapper l'index actif vers l'index réel
  const safeIndex = Math.min(activeIndex, validImages.length - 1);

  const handleImageError = (originalIndex: number) => {
    setFailedImages(prev => {
      const next = new Set(prev);
      next.add(originalIndex);
      return next;
    });
    // Reculer l'index si nécessaire
    if (activeIndex >= validImages.length - 1) {
      setActiveIndex(Math.max(0, activeIndex - 1));
    }
  };

  if (validImages.length === 0) {
    return (
      <div className="relative aspect-[4/5] bg-[#050505] border border-white/5 flex flex-col items-center justify-center gap-3">
        <ImageOff className="h-8 w-8 text-neutral-700" />
        <span className="text-xs uppercase tracking-[0.3em] text-neutral-600">Image Indisponible</span>
      </div>
    );
  }

  const hasMultiple = validImages.length > 1;
  const currentImage = validImages[safeIndex];
  // Trouver l'index original pour le tracking d'erreurs
  const originalIndices = images.map((_, i) => i).filter(i => !failedImages.has(i));

  return (
    <div className="flex flex-col gap-4">
      {/* Image principale */}
      <div className="group relative aspect-[4/5] bg-transparent flex items-center justify-center">
        <Image
          key={currentImage.url}
          src={currentImage.url}
          alt={currentImage.alt || `${brandName} ${productName}`}
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          quality={90}
          className="object-contain"
          priority={safeIndex === 0}
          onError={() => handleImageError(originalIndices[safeIndex])}
        />

        {/* Flèches de navigation */}
        {hasMultiple && (
          <>
            <button
              onClick={() => setActiveIndex(i => i === 0 ? validImages.length - 1 : i - 1)}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/60 border border-white/10 text-white/70 hover:text-white hover:bg-black/80 transition-all opacity-0 group-hover:opacity-100 z-10"
              aria-label="Image précédente"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setActiveIndex(i => i === validImages.length - 1 ? 0 : i + 1)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/60 border border-white/10 text-white/70 hover:text-white hover:bg-black/80 transition-all opacity-0 group-hover:opacity-100 z-10"
              aria-label="Image suivante"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        )}

        {/* Compteur d'images */}
        {hasMultiple && (
          <div className="absolute bottom-3 right-3 px-2.5 py-1 bg-black/70 border border-white/10 text-[10px] font-medium tracking-wider text-white/70 z-10">
            {safeIndex + 1} / {validImages.length}
          </div>
        )}
      </div>

      {/* Miniatures */}
      {hasMultiple && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {validImages.map((img, idx) => (
            <button
              key={idx}
              onClick={() => setActiveIndex(idx)}
              className={`relative flex-shrink-0 w-16 h-16 border transition-all ${
                idx === safeIndex
                  ? 'border-[#d4a855] opacity-100'
                  : 'border-white/10 opacity-50 hover:opacity-80 hover:border-white/30'
              }`}
              aria-label={`Voir image ${idx + 1}`}
            >
              <Image
                src={img.url}
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
