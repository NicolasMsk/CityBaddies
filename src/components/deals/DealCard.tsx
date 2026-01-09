'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Heart, ExternalLink, Star, Share2, Check, ThumbsUp, ThumbsDown, Loader2 } from 'lucide-react';
import { Deal } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/components/auth';
import DealTags, { ScoreBadge } from './DealTags';

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
    return `${priceFormatted}€/${unitLabel}`;
  }
  
  // Pour les formats normaux, prix/100ml ou /100g
  const pricePer100 = pricePerUnit * 100;
  const unitLabel = unit === 'ml' ? '100ml' : '100g';
  
  // Format intelligent: éviter les prix absurdes
  if (pricePer100 > 500) {
    // Prix trop élevé pour 100ml/g, afficher par unité
    const priceFormatted = pricePerUnit.toFixed(2).replace(/\.?0+$/, '');
    return `${priceFormatted}€/${unit === 'ml' ? 'ml' : 'g'}`;
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
  return `${formatted}€/${unitLabel}`;
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
    
    const shareUrl = `${window.location.origin}/deals/${deal.id}`;
    
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
    <div className={`group card-premium bg-[#1a1a1a] border border-white/5 rounded-2xl overflow-hidden hover:border-[#7b0a0a]/30 transition-all ${featured ? 'lg:flex' : ''}`}>
      {/* Image Container */}
      <div className={`relative ${featured ? 'lg:w-80 lg:flex-shrink-0' : ''}`}>
        <div className={`relative ${featured ? 'h-64 lg:h-full' : 'aspect-square'} overflow-hidden bg-[#0f0f0f]`}>
          {deal.product.imageUrl ? (
            <Image
              src={deal.product.imageUrl}
              alt={deal.product.name}
              fill
              sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 400px"
              quality={90}
              className="object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-[#7b0a0a]/50 to-black flex items-center justify-center">
              <span className="text-4xl">✨</span>
            </div>
          )}
          
          {/* Overlay gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          
          {/* Top Actions */}
          <div className="absolute top-3 right-3 flex gap-2">
            <button 
              onClick={handleShare}
              className={`p-2 rounded-full backdrop-blur-md transition-all ${
                isCopied 
                  ? 'bg-green-500 text-white' 
                  : 'bg-black/60 text-white/70 hover:bg-white/20 hover:text-white'
              }`}
              title={isCopied ? 'Lien copié !' : 'Partager'}
            >
              {isCopied ? (
                <Check className="h-4 w-4" />
              ) : (
                <Share2 className="h-4 w-4" />
              )}
            </button>
            <button 
              onClick={handleFavorite}
              disabled={isSaving}
              className={`p-2 rounded-full backdrop-blur-md transition-all ${
                isFavorite 
                  ? 'bg-[#7b0a0a] text-white' 
                  : 'bg-black/60 text-white/70 hover:bg-[#7b0a0a]/80 hover:text-white'
              }`}
              title={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Heart className={`h-4 w-4 ${isFavorite ? 'fill-current' : ''}`} />
              )}
            </button>
          </div>

          {/* Discount Badge */}
          <div className="absolute bottom-3 left-3">
            <span className="px-3 py-1.5 bg-[#7b0a0a] backdrop-blur-sm rounded-full text-white text-xs font-medium">
              -{deal.discountPercent}%
            </span>
          </div>

          {/* Vote buttons */}
          <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-black/60 backdrop-blur-md rounded-full px-2 py-1">
            <button
              onClick={(e) => handleVote(e, 1)}
              disabled={isVoting}
              className={`p-1 rounded-full transition-colors ${
                userVote === 1 
                  ? 'text-green-400' 
                  : 'text-white/60 hover:text-green-400'
              }`}
            >
              <ThumbsUp className={`h-3.5 w-3.5 ${userVote === 1 ? 'fill-current' : ''}`} />
            </button>
            <span className={`text-xs font-medium min-w-[20px] text-center ${
              votes > 0 ? 'text-green-400' : votes < 0 ? 'text-red-400' : 'text-white/60'
            }`}>
              {votes > 0 ? `+${votes}` : votes}
            </span>
            <button
              onClick={(e) => handleVote(e, -1)}
              disabled={isVoting}
              className={`p-1 rounded-full transition-colors ${
                userVote === -1 
                  ? 'text-red-400' 
                  : 'text-white/60 hover:text-red-400'
              }`}
            >
              <ThumbsDown className={`h-3.5 w-3.5 ${userVote === -1 ? 'fill-current' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className={`p-5 flex flex-col ${featured ? 'lg:flex-1 lg:p-6' : ''}`}>
        {/* Brand & Category */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-white/40">
              {deal.product.brand || deal.product.merchant.name}
            </span>
            {deal.product.category && (
              <>
                <span className="text-white/20">•</span>
                <span className="text-xs text-[#ff6b6b]/70">
                  {deal.product.category.name}
                  {deal.product.subcategory && ` › ${deal.product.subcategory.replace(/-/g, ' ')}`}
                </span>
              </>
            )}
          </div>
          {deal.isHot && (
            <span className="flex items-center gap-1 text-xs text-gold">
              <Star className="h-3 w-3 fill-gold text-gold" />
              Hot
            </span>
          )}
        </div>

        {/* Title */}
        <Link href={`/deals/${deal.id}`}>
          <h3 className="font-medium text-white group-hover:text-[#9b1515] transition-colors line-clamp-2 mb-2 leading-snug">
            {deal.refinedTitle || deal.product.name}
          </h3>
        </Link>

        {/* Tags */}
        {deal.tags && (
          <div className="mb-3">
            <DealTags tags={deal.tags} score={deal.score} compact />
          </div>
        )}

        {/* Price */}
        <div className="flex items-baseline gap-3 mb-2">
          <span className="text-xl font-semibold price-premium">
            {deal.dealPrice.toFixed(2)} €
          </span>
          <span className="text-sm text-white/40 line-through">
            {deal.originalPrice.toFixed(2)} €
          </span>
        </div>
        
        {/* Volume & Prix au 100ml */}
        {deal.volume && (
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs text-white/50 bg-white/5 px-2 py-0.5 rounded-full">
              {deal.volume}
            </span>
            {deal.pricePerUnit && deal.volumeUnit && (
              <span className="text-xs text-white/40">
                ({formatPricePerUnit(deal.pricePerUnit, deal.volumeUnit, deal.volumeValue)})
              </span>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/10">
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/40">
              {deal.product.merchant.name}
            </span>
            <span className="text-white/20">•</span>
            <span className="text-xs text-white/40">
              {timeAgo}
            </span>
          </div>

          <a
            href={`/api/redirect?url=${encodeURIComponent(deal.product.productUrl)}`}
            target="_blank"
            rel="noopener"
            className="flex items-center gap-1.5 px-4 py-2 bg-[#7b0a0a] rounded-full text-white text-xs font-medium hover:bg-[#8b1212] transition-colors"
          >
            Voir
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
