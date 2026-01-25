'use client';

import Image from 'next/image';
import { useState } from 'react';

interface DealImageProps {
  imageUrl: string | null;
  productName: string;
  discountPercent: number;
}

export default function DealImage({ imageUrl, productName, discountPercent }: DealImageProps) {
  const [imageError, setImageError] = useState(false);

  return (
    <div className="relative">
      {/* Badges - Sharp & Technical */}
      <div className="absolute top-0 left-0 z-20">
        {discountPercent > 0 && (
          <span className="inline-block px-4 py-2 bg-[#9b1515] text-white text-sm font-bold tracking-widest uppercase shadow-xl">
            -{discountPercent}%
          </span>
        )}
      </div>
      
      <div className="relative aspect-[4/5] w-full bg-[#0f0f0f] border border-white/5 group overflow-hidden">
        {imageUrl && !imageError ? (
          <Image
            src={imageUrl}
            alt={productName}
            fill
            className="object-contain p-8 group-hover:scale-105 transition-transform duration-700 ease-out"
            priority
            unoptimized
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-neutral-600 italic">
              {imageError ? 'Image indisponible' : 'No Imagery'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
