'use client';

import Image, { ImageProps } from 'next/image';
import { useState, useCallback } from 'react';

/**
 * Les images CDN marchands (Sephora, Nocibé, Marionnaud, Notino...)
 * sont chargées directement par le navigateur (unoptimized).
 *
 * Pourquoi ?
 * - Le proxy Next.js Image (/_next/image?url=...) fait un fetch serveur
 *   qui se fait rejeter par certains CDN (Nocibé → 400, hotlink protection)
 * - En mode unoptimized, le navigateur charge l'image directement
 *   → pas de proxy serveur → pas de rejet
 * - referrerPolicy="no-referrer" empêche l'envoi du Referer header
 *   → bypass la protection hotlink des CDN marchands
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
 * - Images externes : unoptimized + no-referrer (bypass proxy + hotlink)
 * - Fallback : URL HD → URL originale → null (le parent gère l'absence)
 * - Retourne null si tout échoue — pas d'icône cassée
 */
export default function SafeImage({
  src,
  fallbackSrc,
  categorySlug: _categorySlug,
  onAllFailed,
  alt,
  className,
  ...props
}: SafeImageProps) {
  // Chaîne de fallback : juste l'URL originale si différente de la HD
  const buildFallbackChain = useCallback(() => {
    const chain: string[] = [];
    if (fallbackSrc && fallbackSrc !== src) {
      chain.push(fallbackSrc);
    }
    return chain;
  }, [src, fallbackSrc]);

  const [fallbackChain] = useState(buildFallbackChain);
  const [fallbackIndex, setFallbackIndex] = useState(-1); // -1 = primary src
  const [allFailed, setAllFailed] = useState(false);

  const currentSrc = fallbackIndex === -1 ? src : fallbackChain[fallbackIndex];

  const handleError = useCallback(() => {
    const nextIndex = fallbackIndex + 1;
    if (nextIndex < fallbackChain.length) {
      setFallbackIndex(nextIndex);
    } else {
      setAllFailed(true);
      onAllFailed?.();
    }
  }, [fallbackIndex, fallbackChain, onAllFailed]);

  // Si tout a échoué → ne rien afficher (le parent gère l'état vide)
  if (allFailed || !currentSrc) {
    return null;
  }

  // Images CDN externes : bypass le proxy Next.js + hotlink protection
  const external = isExternalUrl(currentSrc);

  return (
    <Image
      {...props}
      key={currentSrc}
      src={currentSrc}
      alt={alt}
      className={className}
      unoptimized={external || !!props.unoptimized}
      referrerPolicy={external ? 'no-referrer' : undefined}
      onError={handleError}
    />
  );
}
