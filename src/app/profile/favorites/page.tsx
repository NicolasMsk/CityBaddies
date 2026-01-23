'use client';

import { useAuth } from '@/components/auth';
import { useState, useEffect } from 'react';
import { Heart, Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import DealCard from '@/components/deals/DealCard';
import { Deal } from '@/types';

export default function FavoritesPage() {
  const { user, loading: authLoading } = useAuth();
  const [favorites, setFavorites] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFavorites = async () => {
      if (!user) return;
      
      try {
        const res = await fetch('/api/favorites');
        if (res.ok) {
          const data = await res.json();
          setFavorites(data);
        }
      } catch (error) {
        console.error('Error fetching favorites:', error);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchFavorites();
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [user, authLoading]);

  if (authLoading || loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-[#0a0a0a]">
        <Loader2 className="w-8 h-8 animate-spin text-[#d4a855]" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-[#0a0a0a]">
        <div className="text-center">
          <Heart className="w-16 h-16 text-[#333] mx-auto mb-6" />
          <p className="text-neutral-400 mb-6 font-mono text-sm uppercase tracking-widest">Connecte-toi pour voir tes favoris</p>
          <Link
            href="/auth/login?redirect=/profile/favorites"
            className="inline-block px-8 py-3 bg-[#d4a855] hover:bg-white text-black font-bold uppercase tracking-widest transition-colors"
            style={{ clipPath: 'polygon(10% 0, 100% 0, 90% 100%, 0% 100%)' }}
          >
            Se connecter
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-12">
        <Link
          href="/profile"
          className="inline-flex items-center gap-2 text-neutral-400 hover:text-[#d4a855] transition-colors mb-6 uppercase tracking-widest text-xs font-bold"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour au profil
        </Link>
        <div className="flex items-center gap-6">
          <div className="p-4 bg-[#0a0a0a] border border-[#d4a855] flex items-center justify-center">
            <Heart className="w-8 h-8 text-[#d4a855]" />
          </div>
          <div>
            <h1 className="text-4xl font-black text-white italic uppercase tracking-tighter">Mes favoris</h1>
            <p className="text-[#d4a855] font-mono text-sm mt-1">{favorites.length} deal{favorites.length > 1 ? 's' : ''} sauvegardé{favorites.length > 1 ? 's' : ''}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      {favorites.length === 0 ? (
        <div className="text-center py-24 bg-[#0a0a0a] border border-dashed border-[#333]">
          <Heart className="w-20 h-20 text-[#1a1a1a] mx-auto mb-6" />
          <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-2 italic">Aucun favori</h2>
          <p className="text-neutral-500 mb-8 font-light max-w-sm mx-auto">
            Tu n&apos;as pas encore ajouté de deals en favoris.<br />
            Clique sur le ❤️ sur un deal pour le sauvegarder !
          </p>
          <Link
            href="/deals"
            className="inline-block px-8 py-3 bg-[#d4a855] hover:bg-white text-black font-bold uppercase tracking-widest transition-colors"
          >
            Découvrir les deals
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {favorites.map((deal) => (
            <DealCard key={deal.id} deal={deal} />
          ))}
        </div>
      )}
    </div>
  );
}
