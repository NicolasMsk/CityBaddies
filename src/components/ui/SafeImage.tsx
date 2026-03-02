'use client';

import Image, { ImageProps } from 'next/image';
import { useState, useCallback } from 'react';
import { ImageOff } from 'lucide-react';

/**
 * Map des slugs de catégories vers les images placeholder locales
 */
const CATEGORY_FALLBACKS: Record<string, string> = {
  'parfum': '/images/parfum.png',
  'parfums': '/images/parfum.png',
  'eaux-de-parfum': '/images/parfum.png',
  'eaux-de-toilette': '/images/parfum.png',
  'coffrets-parfum': '/images/parfum.png',
  'maquillage': '/images/maquillage.png',
  'teint': '/images/maquillage.png',
  'levres': '/images/maquillage.png',
  'yeux': '/images/maquillage.png',
  'cheveux': '/images/cheveux.png',
  'shampooing': '/images/cheveux.png',
  'apres-shampooing': '/images/cheveux.png',
  'soins-visage': '/images/soins-visage.png',
  'nettoyants': '/images/soins-visage.png',
  'anti-age': '/images/soins-visage.png',
  'hydratants': '/images/soins-visage.png',
  'soins-corps': '/images/soins-corps.png',
  'corps': '/images/soins-corps.png',
  'solaires': '/images/soins-corps.png',
  'ongles': '/images/ongles.png',
  'vernis': '/images/ongles.png',
  'accessoires': '/images/accessoires.png',
  'bijoux': '/images/bijoux.png',
  'blanchiment-dentaire': '/images/blanchiment-dentaire.png',
};

const DEFAULT_FALLBACK = '/images/logo-white.png';

/**
 * Retourne l'image de fallback correspondant à une catégorie
 */
export function getCategoryFallbackImage(categorySlug?: string | null): string {
  if (!categorySlug) return DEFAULT_FALLBACK;
  const slug = categorySlug.toLowerCase();

  // Match exact
  if (CATEGORY_FALLBACKS[slug]) return CATEGORY_FALLBACKS[slug];

  // Match partiel (le slug contient ou est contenu dans une clé)
  for (const [key, value] of Object.entries(CATEGORY_FALLBACKS)) {
    if (slug.includes(key) || key.includes(slug)) return value;
  }

  return DEFAULT_FALLBACK;
}

interface SafeImageProps extends Omit<ImageProps, 'onError' | 'src'> {
  /** URL principale (généralement HD) */
  src: string;
  /** URL originale (avant transformation HD) — premier fallback */
  fallbackSrc?: string | null;
  /** Slug de la catégorie pour le fallback image locale */
  categorySlug?: string | null;
  /** Callback quand TOUTES les tentatives ont échoué */
  onAllFailed?: () => void;
}

/**
 * Composant Image robuste avec fallback en cascade :
 * 1. Image HD (src)
 * 2. Image originale (fallbackSrc, si différente)
 * 3. Image de catégorie locale (/images/parfum.png, etc.)
 * 4. Logo par défaut
 * 5. Icône ImageOff si tout échoue
 */
export default function SafeImage({
  src,
  fallbackSrc,
  categorySlug,
  onAllFailed,
  alt,
  className,
  ...props
}: SafeImageProps) {
  // Construire la chaîne de fallback
  const buildFallbackChain = useCallback(() => {
    const chain: Array<{ url: string; unoptimized: boolean }> = [];

    // Fallback 1 : URL originale (si différente de la HD)
    if (fallbackSrc && fallbackSrc !== src) {
      chain.push({ url: fallbackSrc, unoptimized: false });
    }

    // Fallback 2 : HD sans optimisation Next.js (bypass le proxy d'images)
    chain.push({ url: src, unoptimized: true });

    // Fallback 3 : URL originale sans optimisation
    if (fallbackSrc && fallbackSrc !== src) {
      chain.push({ url: fallbackSrc, unoptimized: true });
    }

    // Fallback 4 : Image catégorie locale
    const categoryImg = getCategoryFallbackImage(categorySlug);
    chain.push({ url: categoryImg, unoptimized: false });

    // Fallback 5 : Logo par défaut
    if (categoryImg !== DEFAULT_FALLBACK) {
      chain.push({ url: DEFAULT_FALLBACK, unoptimized: false });
    }

    return chain;
  }, [src, fallbackSrc, categorySlug]);

  const [fallbackChain] = useState(buildFallbackChain);
  const [fallbackIndex, setFallbackIndex] = useState(-1); // -1 = using primary src
  const [allFailed, setAllFailed] = useState(false);

  // URL et mode actuels
  const currentSrc = fallbackIndex === -1 ? src : fallbackChain[fallbackIndex]?.url;
  const isUnoptimized = fallbackIndex === -1 ? false : fallbackChain[fallbackIndex]?.unoptimized ?? false;

  const handleError = useCallback(() => {
    const nextIndex = fallbackIndex + 1;
    if (nextIndex < fallbackChain.length) {
      setFallbackIndex(nextIndex);
    } else {
      setAllFailed(true);
      onAllFailed?.();
    }
  }, [fallbackIndex, fallbackChain, onAllFailed]);

  if (allFailed || !currentSrc) {
    return (
      <div className={`w-full h-full flex items-center justify-center bg-[#0a0a0a] ${className || ''}`}>
        <ImageOff className="h-6 w-6 text-neutral-700" />
      </div>
    );
  }

  return (
    <Image
      {...props}
      key={`${currentSrc}-${isUnoptimized}`} // Force remount on src change
      src={currentSrc}
      alt={alt}
      className={className}
      unoptimized={isUnoptimized}
      onError={handleError}
    />
  );
}
