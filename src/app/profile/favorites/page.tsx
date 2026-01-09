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
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#7b0a0a]" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <Heart className="w-16 h-16 text-neutral-600 mx-auto mb-4" />
          <p className="text-neutral-400 mb-4">Connecte-toi pour voir tes favoris</p>
          <Link
            href="/auth/login?redirect=/profile/favorites"
            className="px-6 py-3 bg-[#7b0a0a] hover:bg-[#9b1a1a] text-white font-medium rounded-xl transition-colors"
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
      <div className="mb-8">
        <Link
          href="/profile"
          className="inline-flex items-center gap-2 text-neutral-400 hover:text-white transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour au profil
        </Link>
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#7b0a0a]/20 rounded-xl">
            <Heart className="w-6 h-6 text-[#7b0a0a]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Mes favoris</h1>
            <p className="text-neutral-400">{favorites.length} deal{favorites.length > 1 ? 's' : ''} sauvegardé{favorites.length > 1 ? 's' : ''}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      {favorites.length === 0 ? (
        <div className="text-center py-16 bg-[#1a1a1a] border border-white/10 rounded-2xl">
          <Heart className="w-16 h-16 text-neutral-600 mx-auto mb-4" />
          <h2 className="text-xl font-medium text-white mb-2">Aucun favori</h2>
          <p className="text-neutral-400 mb-6">
            Tu n&apos;as pas encore ajouté de deals en favoris.<br />
            Clique sur le ❤️ sur un deal pour le sauvegarder !
          </p>
          <Link
            href="/deals"
            className="inline-block px-6 py-3 bg-[#7b0a0a] hover:bg-[#9b1a1a] text-white font-medium rounded-xl transition-colors"
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
