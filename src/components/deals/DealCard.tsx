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

// Map des merchants vers leurs logos
const getMerchantLogo = (slug: string): string | null => {
  const logoMap: Record<string, string> = {
    'nocibe': '/images/nocibe_logo.png',
    'sephora': '/images/sephora_logo.png',
    'marionnaud': '/images/marionnaud_logo.png',
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
    <div className={`group relative bg-[#0a0a0a] border border-white/10 hover:border-[#d4a855] transition-colors duration-300 h-full ${featured ? 'lg:flex' : 'flex flex-col'}`}>
      {/* Image Container - Hauteur fixe pour uniformiser */}
      <div className={`relative ${featured ? 'lg:w-[40%] flex-shrink-0 h-full' : 'h-[220px] flex-shrink-0'} overflow-hidden bg-[#050505]`}>
        {deal.product.imageUrl ? (
          <Image
            src={deal.product.imageUrl}
            alt={`${deal.product.brand || ''} ${deal.product.name} - Promo ${deal.discountPercent}% ${deal.product.category?.name || 'Beauté'}`.trim()}
            fill
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 400px"
            quality={90}
            unoptimized
            className="object-contain group-hover:scale-105 transition-transform duration-700 ease-out"
          />
        ) : (
          <div className="w-full h-full bg-[#0a0a0a] flex items-center justify-center border-b border-white/5">
            <span className="text-xl uppercase tracking-widest text-white/20">Image Indisp.</span>
          </div>
        )}
        
        {/* Overlay gradient - Subtle */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />
        
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

        {/* Discount Badge - Sharp */}
        <div className="absolute top-0 left-0 bg-[#9b1515] text-white text-[10px] font-bold px-3 py-1.5 uppercase tracking-widest">
          -{deal.discountPercent}%
        </div>

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

      {/* Content */}
      <div className={`p-5 flex flex-col flex-1 border-t border-white/5 ${featured ? 'lg:justify-center' : ''}`}>
        
        {/* Brand & Meta */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#d4a855]">
            {deal.product.brand || deal.product.merchant.name}
          </span>
          {deal.isHot && (
            <span className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-[#9b1515] font-bold animate-pulse">
              <Star className="h-3 w-3 fill-current" />
              Tendance
            </span>
          )}
        </div>

        {/* Title */}
        <Link href={`/deals/${deal.id}`} className="group/title">
          <h3 className="font-light text-sm text-white mb-3 leading-relaxed group-hover/title:text-[#d4a855] transition-colors line-clamp-2 min-h-[2.5rem]">
            {capitalizeFirstWord(deal.refinedTitle || deal.product.name)}
          </h3>
        </Link>

        {/* Tags */}
        {deal.tags && (
          <div className="mb-4 fade-in">
            <DealTags tags={deal.tags} score={deal.score} compact />
          </div>
        )}

        {/* Price Section */}
        <div className="mt-auto pt-4 border-t border-dashed border-white/10">
          <div className="flex items-end justify-between mb-1">
            <div className="flex flex-col">
              <span className="text-[10px] text-neutral-500 uppercase tracking-wide line-through decoration-[#9b1515]/50">
                {deal.originalPrice.toFixed(2)} €
              </span>
              <span className="text-xl font-light text-white tracking-tight leading-none">
                {deal.dealPrice.toFixed(2)} <span className="text-sm align-top">€</span>
              </span>
            </div>
            
            <a
              href={`/api/redirect?url=${encodeURIComponent(deal.product.productUrl)}`}
              target="_blank"
              rel="noopener"
              className="flex items-center gap-2 bg-white text-black px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-[#d4a855] hover:text-white transition-colors"
            >
              Voir le Deal
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          
          {/* Unit Price & Info */}
          <div className="flex items-center gap-2 text-[10px] text-neutral-600 uppercase tracking-wide mt-2">
            <span>{deal.product.merchant.name}</span>
            <span>•</span>
            {deal.volume && (
              <span>{deal.volume}</span>
            )}
            {deal.pricePerUnit && deal.volumeUnit && (
              <>
                <span className="bg-neutral-800 w-px h-3" />
                <span>{formatPricePerUnit(deal.pricePerUnit, deal.volumeUnit, deal.volumeValue)}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
