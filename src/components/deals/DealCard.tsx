'use client';

import Link from 'next/link';
import { Heart, ExternalLink, Star, Share2, Check, ThumbsUp, ThumbsDown, Loader2, Tag, ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { Deal } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/components/auth';
import DealTags, { ScoreBadge } from './DealTags';
import ScoreGauge from './ScoreGauge';
import { getHighQualityImageUrl, isValidImageUrl } from '@/lib/utils/image';
import SafeImage from '@/components/ui/SafeImage';

/**
 * Lien marchand enrichi des paramètres de mesure lus par /api/redirect, qui émet
 * l'événement GA4 `select_merchant`. Le marchand est redéduit côté serveur
 * depuis le domaine cible ; on ne transmet donc que ce qu'il ne peut pas savoir.
 */
function buildMerchantHref(deal: Deal): string {
  const params = new URLSearchParams({ url: deal.productUrl || '' });
  if (deal.product?.brand) params.set('b', deal.product.brand);
  if (deal.product?.slug) params.set('p', deal.product.slug);
  if (deal.dealPrice) params.set('pr', String(deal.dealPrice));
  return `/api/redirect?${params.toString()}`;
}

// Map des merchants vers leurs logos
const getMerchantLogo = (slug: string): string | null => {
  const logoMap: Record<string, string> = {
    'nocibe': '/images/nocibe_logo.png',
    'sephora': '/images/sephora_logo.png',
    'marionnaud': '/images/logo_marrionaud.png',
    'my-origines': '/images/my-origines_logo.svg',
    'notino': '/images/notino_logo.png',
  };
  return logoMap[slug] || null;
};

// Calcule le prix pour 100ml/100g ou par unité selon le format
function formatPricePerUnit(pricePerUnit: number | null | undefined, volumeUnit: string | null | undefined, volumeValue: number | null | undefined): string | null {
  if (!pricePerUnit || !volumeUnit) return null;
  
  const unit = volumeUnit.toLowerCase();
  const isSmallFormat = volumeValue && volumeValue < 20; // Moins de 20ml/g = petit format
  
  // Pour les petits formats (ex: rouge à lèvres 4g), afficher le prix/unité
  if (isSmallFormat) {
    const priceFormatted = pricePerUnit < 10 
      ? pricePerUnit.toFixed(2).replace(/\.?0+$/, '')
      : pricePerUnit.toFixed(0);
    const unitLabel = unit === 'ml' ? 'ml' : 'g';
    return `${priceFormatted.replace('.', ',')}€/${unitLabel}`;
  }
  
  // Pour les formats normaux, prix/100ml ou /100g
  const pricePer100 = pricePerUnit * 100;
  const unitLabel = unit === 'ml' ? '100ml' : '100g';
  
  // Format intelligent: éviter les prix absurdes
  if (pricePer100 > 500) {
    // Prix trop élevé pour 100ml/g, afficher par unité
    const priceFormatted = pricePerUnit.toFixed(2).replace(/\.?0+$/, '');
    return `${priceFormatted.replace('.', ',')}€/${unit === 'ml' ? 'ml' : 'g'}`;
  }
  
  let formatted: string;
  if (pricePer100 % 1 === 0) {
    formatted = pricePer100.toFixed(0);
  } else {
    formatted = pricePer100.toFixed(2).replace(/\.?0+$/, '');
    if (formatted.includes('.') && formatted.split('.')[1].length === 1) {
      formatted = pricePer100.toFixed(2);
    }
  }
  return `${formatted.replace('.', ',')}€/${unitLabel}`;
}

// Capitalise le premier mot d'une chaîne
function capitalizeFirstWord(text: string): string {
  if (!text) return text;
  const words = text.split(' ');
  if (words.length === 0) return text;
  words[0] = words[0].charAt(0).toUpperCase() + words[0].slice(1);
  return words.join(' ');
}

interface DealCardProps {
  deal: Deal;
  featured?: boolean;
}

export default function DealCard({ deal, featured = false }: DealCardProps) {
  const { user } = useAuth();
  const [isFavorite, setIsFavorite] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [votes, setVotes] = useState(deal.votes);
  const [userVote, setUserVote] = useState<number | null>(null);
  const [isVoting, setIsVoting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [timeAgo, setTimeAgo] = useState<string>('');
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [failedImages, setFailedImages] = useState<Set<number>>(new Set());

  // Type commun pour les images avec fallback
  type ImageEntry = { url: string | null; originalUrl: string; alt: string | undefined };

  // Construire la liste des images (HD + originale pour fallback)
  const productImages: ImageEntry[] = deal.product.images && deal.product.images.length > 0
    ? deal.product.images
        .sort((a, b) => a.position - b.position)
        .map(img => ({
          url: getHighQualityImageUrl(img.url),
          originalUrl: img.url,
          alt: img.alt,
        }))
        .filter(img => isValidImageUrl(img.url) || isValidImageUrl(img.originalUrl))
    : [];

  // Fallback: si pas d'images produit, utiliser l'image du deal
  const dealImgUrl = getHighQualityImageUrl(deal.imageUrl);
  const rawImages: ImageEntry[] = (productImages.length > 0
    ? productImages
    : isValidImageUrl(dealImgUrl) || isValidImageUrl(deal.imageUrl)
      ? [{ url: dealImgUrl || deal.imageUrl || null, originalUrl: deal.imageUrl || '', alt: deal.product.name } as ImageEntry]
      : []
  ).slice(0, 5);

  // Filtrer les images totalement cassées (toutes tentatives épuisées)
  const allImages = rawImages.filter((_, idx) => !failedImages.has(idx));
  const hasMultipleImages = allImages.length > 1;
  const safeActiveIndex = Math.min(activeImageIndex, Math.max(0, allImages.length - 1));

  // Slug de catégorie pour fallback image locale
  const categorySlug = deal.product.category?.slug || null;

  const handleImageFailed = useCallback((originalIndex: number) => {
    setFailedImages(prev => {
      const next = new Set(prev);
      next.add(originalIndex);
      return next;
    });
  }, []);

  // Calculer timeAgo côté client uniquement pour éviter l'erreur d'hydratation
  useEffect(() => {
    setTimeAgo(formatDistanceToNow(new Date(deal.createdAt), {
      addSuffix: false,
      locale: fr,
    }));
  }, [deal.createdAt]);

  // Charger le vote et favori de l'utilisateur
  useEffect(() => {
    if (!user) return;

    const loadUserData = async () => {
      try {
        const voteRes = await fetch(`/api/votes?dealId=${deal.id}`);
        if (voteRes.ok) {
          const data = await voteRes.json();
          setUserVote(data.userVote);
        }

        const favRes = await fetch('/api/favorites');
        if (favRes.ok) {
          const favorites = await favRes.json();
          setIsFavorite(favorites.some((d: Deal) => d.id === deal.id));
        }
      } catch (error) {
        console.error('Error loading user data:', error);
      }
    };

    loadUserData();
  }, [user, deal.id]);

  const handleShare = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const shareUrl = `${window.location.origin}/produits/${deal.product.slug}`;
    
    try {
      await navigator.clipboard.writeText(shareUrl);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = shareUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  }, [deal.id]);

  const handleVote = async (e: React.MouseEvent, value: 1 | -1) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      window.location.href = `/auth/login?redirect=${encodeURIComponent(window.location.pathname)}`;
      return;
    }

    if (isVoting) return;
    setIsVoting(true);

    try {
      const res = await fetch('/api/votes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId: deal.id, value }),
      });

      if (res.ok) {
        const data = await res.json();
        setVotes(data.votes);
        setUserVote(data.userVote);
      }
    } catch (error) {
      console.error('Error voting:', error);
    } finally {
      setIsVoting(false);
    }
  };

  const handleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      window.location.href = `/auth/login?redirect=${encodeURIComponent(window.location.pathname)}`;
      return;
    }

    if (isSaving) return;
    setIsSaving(true);

    try {
      const res = await fetch('/api/favorites', {
        method: isFavorite ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId: deal.id }),
      });

      if (res.ok) {
        setIsFavorite(!isFavorite);
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={`group relative bg-[#0a0a0a] border border-white/10 hover:border-[#d4a855] transition-colors duration-300 h-full ${featured ? 'lg:flex' : 'flex flex-col'}`}>
      {/* Image Container - Carousel multi-images (masqué si aucune image) */}
      {allImages.length > 0 && (
      <div className={`relative ${featured ? 'lg:w-[40%] flex-shrink-0 h-full' : 'h-[160px] sm:h-[200px] md:h-[260px] flex-shrink-0'} overflow-hidden bg-[#050505]`}>
          <SafeImage
            src={allImages[safeActiveIndex]?.url || allImages[safeActiveIndex]?.originalUrl || ''}
            fallbackSrc={allImages[safeActiveIndex]?.originalUrl}
            categorySlug={categorySlug}
            alt={allImages[safeActiveIndex]?.alt || `${deal.product.brand || ''} ${deal.product.name} - Promo ${deal.discountPercent}% ${deal.product.category?.name || 'Beauté'}`.trim()}
            fill
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 400px"
            quality={85}
            className="object-contain group-hover:scale-105 transition-transform duration-700 ease-out"
            onAllFailed={() => handleImageFailed(rawImages.indexOf(allImages[safeActiveIndex]))}
          />
        
        {/* Overlay gradient - Subtle */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />

        {/* Image Navigation Arrows */}
        {hasMultipleImages && (
          <>
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setActiveImageIndex(i => i === 0 ? allImages.length - 1 : i - 1); }}
              className="absolute left-1.5 top-1/2 -translate-y-1/2 p-1 bg-black/70 border border-white/10 text-white/70 hover:text-white hover:bg-black/90 transition-all opacity-0 group-hover:opacity-100 z-10"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setActiveImageIndex(i => i === allImages.length - 1 ? 0 : i + 1); }}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 bg-black/70 border border-white/10 text-white/70 hover:text-white hover:bg-black/90 transition-all opacity-0 group-hover:opacity-100 z-10"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </>
        )}

        {/* Image Dots Indicator */}
        {hasMultipleImages && (
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex gap-1 z-10">
            {allImages.map((_, idx) => (
              <button
                key={idx}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setActiveImageIndex(idx); }}
                className={`w-1.5 h-1.5 rounded-full transition-all ${idx === safeActiveIndex ? 'bg-[#d4a855] w-3' : 'bg-white/30 hover:bg-white/60'}`}
              />
            ))}
          </div>
        )}
        
        {/* Top Actions - Minimal */}
        <div className="absolute top-0 right-0 p-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <button 
            onClick={handleShare}
            className={`p-2 border border-white/20 backdrop-blur-md transition-all ${
              isCopied 
                ? 'bg-emerald-900/50 text-emerald-400 border-emerald-500/50' 
                : 'bg-black/80 text-white/70 hover:bg-white hover:text-black hover:border-white'
            }`}
            title={isCopied ? 'Copié' : 'Partager'}
          >
            {isCopied ? <Check className="h-3 w-3" /> : <Share2 className="h-3 w-3" />}
          </button>
          <button 
            onClick={handleFavorite}
            disabled={isSaving}
            className={`p-2 border border-white/20 backdrop-blur-md transition-all ${
              isFavorite 
                ? 'bg-[#9b1515] text-white border-[#9b1515]' 
                : 'bg-black/80 text-white/70 hover:bg-[#9b1515] hover:text-white hover:border-[#9b1515]'
            }`}
          >
            {isSaving ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Heart className={`h-3 w-3 ${isFavorite ? 'fill-current' : ''}`} />
            )}
          </button>
        </div>

        {/* Discount Badge - Sharp (only if discount exists) */}
        {deal.discountPercent > 0 && (
          <div className="absolute top-0 left-0 bg-[#9b1515] text-white text-[10px] font-bold px-3 py-1.5 uppercase tracking-widest">
            -{deal.discountPercent}%
          </div>
        )}

        {/* Voting - Bottom Right Overlay */}
        <div className="absolute bottom-0 right-0 p-3">
          <div className="flex items-center gap-1 bg-black/90 border border-white/10 px-2 py-1">
            <button
              onClick={(e) => handleVote(e, 1)}
              disabled={isVoting}
              className={`p-1 transition-colors ${
                userVote === 1 ? 'text-emerald-400' : 'text-neutral-500 hover:text-white'
              }`}
            >
              <ThumbsUp className={`h-3 w-3 ${userVote === 1 ? 'fill-current' : ''}`} />
            </button>
            <span className={`text-[10px] font-mono mx-1 ${
              votes > 0 ? 'text-emerald-400' : votes < 0 ? 'text-[#9b1515]' : 'text-neutral-500'
            }`}>
              {votes > 0 ? `+${votes}` : votes}
            </span>
          </div>
        </div>
      </div>
      )}

      {/* Content */}
      <div className={`p-3 sm:p-4 md:p-5 flex flex-col flex-1 border-t border-white/5 ${featured ? 'lg:justify-center' : ''}`}>
        
        {/* Brand & Meta */}
        <div className="flex items-center justify-between mb-1.5 sm:mb-2 md:mb-3">
          <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.15em] sm:tracking-[0.2em] text-[#d4a855] truncate">
            {deal.product.brand || deal.merchant.name}
          </span>
          {deal.isHot && (
            <span className="hidden sm:flex items-center gap-1 text-[10px] uppercase tracking-widest text-[#9b1515] font-bold animate-pulse">
              <Star className="h-3 w-3 fill-current" />
              Tendance
            </span>
          )}
        </div>

        {/* Title */}
        <Link href={`/produits/${deal.product.slug}`} className="group/title">
          <h3 className="font-light text-xs sm:text-sm text-white mb-1.5 sm:mb-2 md:mb-3 leading-snug sm:leading-relaxed group-hover/title:text-[#d4a855] transition-colors line-clamp-2 min-h-[2rem] sm:min-h-[2.5rem]">
            {capitalizeFirstWord(deal.refinedTitle || deal.product.name)}
          </h3>
        </Link>

        {/* Tags */}
        {deal.tags && (
          <div className="mb-2 sm:mb-3 md:mb-4 fade-in">
            <DealTags tags={deal.tags} score={deal.score} compact />
          </div>
        )}

        {/* Score City Baddies */}
        {/* NB: pas de `deal.score && ...` — en JSX, `0 && x` rend "0" à l'écran */}
        {(deal.score ?? 0) >= 1 && (
          <div className="mt-auto">
            <ScoreGauge score={deal.score!} variant="compact" />
          </div>
        )}

        {/* Price Section */}
        <div className={`${!deal.score || deal.score < 40 ? 'mt-auto ' : ''}pt-2 sm:pt-3 md:pt-4 border-t border-dashed border-white/10`}>

          <div className="flex items-end justify-between mb-1.5 sm:mb-2">
            <div className="flex flex-col">
              {/* Marchand */}
              <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider sm:tracking-widest text-neutral-500 mb-0.5 sm:mb-1 truncate">
                {deal.merchant.name}
              </span>
              {deal.discountPercent > 0 && (
                <span className="text-[10px] text-neutral-500 uppercase tracking-wide line-through decoration-[#9b1515]/50">
                  {deal.originalPrice.toFixed(2).replace('.', ',')} €
                </span>
              )}
              <span className="text-base sm:text-lg md:text-xl font-light text-white tracking-tight leading-none">
                {deal.dealPrice.toFixed(2).replace('.', ',')} <span className="text-[10px] sm:text-xs md:text-sm align-top">€</span>
              </span>
            </div>
            
            <a
              href={buildMerchantHref(deal)}
              target="_blank"
              rel="nofollow sponsored noopener"
              className="flex items-center gap-1 sm:gap-2 bg-white text-black px-2 py-1.5 sm:px-3 sm:py-2 md:px-4 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider sm:tracking-widest hover:bg-[#d4a855] hover:text-white transition-colors"
            >
              Voir le prix
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          {/* Volume & Prix unitaire */}
          {(deal.volume || (deal.pricePerUnit && deal.volumeUnit)) && (
            <div className="flex items-center gap-2 text-[10px] text-neutral-600 uppercase tracking-wide mb-2">
              {deal.volume && <span>{deal.volume}</span>}
              {deal.pricePerUnit && deal.volumeUnit && (
                <>
                  {deal.volume && <span className="bg-neutral-800 w-px h-3" />}
                  <span>{formatPricePerUnit(deal.pricePerUnit, deal.volumeUnit, deal.volumeValue)}</span>
                </>
              )}
            </div>
          )}

          {/* Promo Code */}
          {deal.promoCode && (
            <div className="flex items-center gap-1.5 sm:gap-2 bg-[#d4a855]/10 border border-[#d4a855]/20 px-2 py-1 sm:px-3 sm:py-1.5">
              <Tag className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-[#d4a855] flex-shrink-0" />
              <span className="hidden sm:inline text-[10px] text-neutral-400 uppercase tracking-wide">Code :</span>
              <span className="text-[10px] sm:text-xs font-bold text-[#d4a855] tracking-wider font-mono truncate">{deal.promoCode}</span>
            </div>
          )}

          {/* Price Conditions */}
          {deal.priceConditions && (
            <div className="flex items-start gap-1.5 mt-2 text-[10px] text-amber-500/80 leading-snug">
              <Info className="h-3 w-3 flex-shrink-0 mt-0.5" />
              <span>{deal.priceConditions}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
