'use client';

import Image, { ImageProps } from 'next/image';
import { useState, useCallback, useMemo } from 'react';

/**
 * Les images marchandes passent d'abord par l'optimiseur Next.js afin d'obtenir
 * un srcset réellement dimensionné et un encodage WebP/AVIF. Si un CDN refuse
 * le fetch serveur, le composant retente automatiquement l'URL en direct.
 */
function isExternalUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

interface SafeImageProps extends Omit<ImageProps, 'onError' | 'src'> {
  /** URL principale (généralement HD) */
  src: string;
  /** URL originale (avant transformation HD) — fallback si HD échoue */
  fallbackSrc?: string | null;
  /** @deprecated Plus utilisé, conservé pour compatibilité */
  categorySlug?: string | null;
  /** Callback quand TOUTES les tentatives ont échoué */
  onAllFailed?: () => void;
}

/**
 * Composant Image robuste pour les images CDN marchands.
 *
 * - Images externes : optimisation Next.js, puis repli direct + no-referrer
 * - Fallback : URL HD optimisée/directe → URL originale optimisée/directe → null
 * - Retourne null si tout échoue — pas d'icône cassée
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
  const candidates = useMemo(
    () => [src, ...(fallbackSrc && fallbackSrc !== src ? [fallbackSrc] : [])],
    [src, fallbackSrc]
  );
  const sourceKey = `${src}\u0000${fallbackSrc ?? ''}`;
  const [attempt, setAttempt] = useState({ sourceKey, candidateIndex: 0, bypassOptimizer: false, allFailed: false });
  const currentAttempt = useMemo(() => attempt.sourceKey === sourceKey
    ? attempt
    : { sourceKey, candidateIndex: 0, bypassOptimizer: false, allFailed: false },
  [attempt, sourceKey]);
  const currentSrc = candidates[currentAttempt.candidateIndex];
  void categorySlug;

  const handleError = useCallback(() => {
    const external = isExternalUrl(currentSrc);
    if (external && !currentAttempt.bypassOptimizer && !props.unoptimized) {
      setAttempt({ ...currentAttempt, bypassOptimizer: true });
      return;
    }

    const nextIndex = currentAttempt.candidateIndex + 1;
    if (nextIndex < candidates.length) {
      setAttempt({ sourceKey, candidateIndex: nextIndex, bypassOptimizer: false, allFailed: false });
    } else {
      setAttempt({ ...currentAttempt, allFailed: true });
      onAllFailed?.();
    }
  }, [candidates.length, currentAttempt, currentSrc, onAllFailed, props.unoptimized, sourceKey]);

  // Si tout a échoué → ne rien afficher (le parent gère l'état vide)
  if (currentAttempt.allFailed || !currentSrc) {
    return null;
  }

  const external = isExternalUrl(currentSrc);

  return (
    <Image
      {...props}
      key={`${currentSrc}-${currentAttempt.bypassOptimizer ? 'direct' : 'optimized'}`}
      src={currentSrc}
      alt={alt}
      className={className}
      unoptimized={!!props.unoptimized || (external && currentAttempt.bypassOptimizer)}
      referrerPolicy={external && currentAttempt.bypassOptimizer ? 'no-referrer' : undefined}
      onError={handleError}
    />
  );
}
