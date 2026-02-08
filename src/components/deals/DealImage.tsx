'use client';

import Image from 'next/image';
import { useState } from 'react';
import { Clock } from 'lucide-react';

interface DealImageProps {
  imageUrl: string | null;
  productName: string;
  discountPercent: number;
  isExpired?: boolean;
}

export default function DealImage({ imageUrl, productName, discountPercent, isExpired = false }: DealImageProps) {
  const [imageError, setImageError] = useState(false);

  return (
    <div className="relative">
      {/* Badges - Sharp & Technical */}
      <div className="absolute top-0 left-0 z-20">
        {isExpired ? (
          <span className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1a1a1a] text-[#9b1515] text-xs font-black tracking-[0.2em] uppercase border-b-2 border-[#9b1515] shadow-xl">
            <Clock className="h-3.5 w-3.5" />
            EXPIRÉ
          </span>
        ) : (
          discountPercent > 0 && (
            <span className="inline-block px-4 py-2 bg-[#9b1515] text-white text-sm font-bold tracking-widest uppercase shadow-xl">
              -{discountPercent}%
            </span>
          )
        )}
      </div>
      
      <div className={`relative aspect-[4/5] w-full bg-[#0f0f0f] border group overflow-hidden ${isExpired ? 'border-white/[0.03]' : 'border-white/5'}`}>
        {imageUrl && !imageError ? (
          <Image
            src={imageUrl}
            alt={productName}
            fill
            className={`object-contain p-8 transition-transform duration-700 ease-out ${isExpired ? 'grayscale opacity-40' : 'group-hover:scale-105'}`}
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

        {/* Expired Overlay */}
        {isExpired && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none">
            <div className="relative">
              <div className="absolute inset-0 bg-[#9b1515]/10 blur-3xl rounded-full scale-150" />
              <div className="relative border border-[#9b1515]/30 bg-[#0a0a0a]/80 backdrop-blur-sm px-8 py-4 text-center">
                <p className="text-[10px] font-black tracking-[0.4em] uppercase text-[#9b1515] mb-1">Promotion</p>
                <p className="text-2xl md:text-3xl font-thin tracking-wider text-white/70">Terminée</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
