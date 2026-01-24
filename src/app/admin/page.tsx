'use client';

import { useAuth } from '@/components/auth';
import { useState, useEffect } from 'react';
import { 
  Crown, 
  Users, 
  Tag, 
  TrendingUp, 
  Eye,
  Loader2,
  CheckCircle,
  XCircle,
  Trash2,
  Star,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  MessageSquare
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

interface Stats {
  totalDeals: number;
  totalUsers: number;
  totalVotes: number;
  totalComments: number;
  pendingDeals: number;
}

interface Deal {
  id: string;
  title: string;
  dealPrice: number;
  originalPrice: number;
  isHot: boolean;
  isExpired: boolean;
  votes: number;
  createdAt: string;
  author?: {
    id: string;
    displayName: string;
    username: string;
    avatarUrl: string;
  };
  product: {
    name: string;
    imageUrl: string;
    category: {
      name: string;
    };
    merchant: {
      name: string;
    };
  };
}

export default function AdminPage() {
  const { user, dbUser, loading: authLoading } = useAuth();
  
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentDeals, setRecentDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch stats
        const statsRes = await fetch('/api/admin/stats');
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStats(statsData);
        }

        // Fetch recent deals
        const dealsRes = await fetch('/api/deals?limit=10');
        if (dealsRes.ok) {
          const dealsData = await dealsRes.json();
          setRecentDeals(dealsData.deals || []);
        }
      } catch (error) {
        console.error('Error fetching admin data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (dbUser?.isAdmin) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [dbUser]);

  const handleToggleHot = async (dealId: string, isHot: boolean) => {
    setActionLoading(dealId);
    try {
      const res = await fetch(`/api/admin/deals/${dealId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isHot: !isHot }),
      });

      if (res.ok) {
        setRecentDeals(deals => 
          deals.map(d => d.id === dealId ? { ...d, isHot: !isHot } : d)
        );
      }
    } catch (error) {
      console.error('Error toggling hot:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleExpired = async (dealId: string, isExpired: boolean) => {
    setActionLoading(dealId);
    try {
      const res = await fetch(`/api/admin/deals/${dealId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isExpired: !isExpired }),
      });

      if (res.ok) {
        setRecentDeals(deals => 
          deals.map(d => d.id === dealId ? { ...d, isExpired: !isExpired } : d)
        );
      }
    } catch (error) {
      console.error('Error toggling expired:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (dealId: string) => {
    if (!confirm('Supprimer ce deal ?')) return;
    
    setActionLoading(dealId);
    try {
      const res = await fetch(`/api/admin/deals/${dealId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setRecentDeals(deals => deals.filter(d => d.id !== dealId));
      }
    } catch (error) {
      console.error('Error deleting deal:', error);
    } finally {
      setActionLoading(null);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#7b0a0a]" />
      </div>
    );
  }

  if (!user || !dbUser?.isAdmin) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Accès refusé</h2>
          <p className="text-neutral-400 mb-4">Tu n&apos;as pas les droits d&apos;accès à cette page</p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#7b0a0a] hover:bg-[#9b1a1a] text-white font-medium rounded-xl transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#7b0a0a]/20 rounded-xl">
            <Crown className="w-6 h-6 text-[#7b0a0a]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Administration</h1>
            <p className="text-neutral-400">Gestion du site City Baddies</p>
          </div>
        </div>
        <Link
          href="/admin/dashboard"
          className="flex items-center gap-2 px-4 py-2 bg-[#7b0a0a] hover:bg-[#9b1a1a] text-white rounded-xl transition-colors"
        >
          <BarChart3 className="w-4 h-4" />
          Dashboard Stats
        </Link>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <div className="p-4 bg-[#1a1a1a] border border-white/10 rounded-xl">
            <div className="flex items-center gap-3 mb-2">
              <Tag className="w-5 h-5 text-blue-400" />
              <span className="text-neutral-400 text-sm">Deals</span>
            </div>
            <p className="text-2xl font-bold text-white">{stats.totalDeals}</p>
          </div>

          <div className="p-4 bg-[#1a1a1a] border border-white/10 rounded-xl">
            <div className="flex items-center gap-3 mb-2">
              <Users className="w-5 h-5 text-green-400" />
              <span className="text-neutral-400 text-sm">Utilisateurs</span>
            </div>
            <p className="text-2xl font-bold text-white">{stats.totalUsers}</p>
          </div>

          <div className="p-4 bg-[#1a1a1a] border border-white/10 rounded-xl">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="w-5 h-5 text-purple-400" />
              <span className="text-neutral-400 text-sm">Votes</span>
            </div>
            <p className="text-2xl font-bold text-white">{stats.totalVotes}</p>
          </div>

          <div className="p-4 bg-[#1a1a1a] border border-white/10 rounded-xl">
            <div className="flex items-center gap-3 mb-2">
              <MessageSquare className="w-5 h-5 text-yellow-400" />
              <span className="text-neutral-400 text-sm">Commentaires</span>
            </div>
            <p className="text-2xl font-bold text-white">{stats.totalComments}</p>
          </div>

          <div className="p-4 bg-[#1a1a1a] border border-white/10 rounded-xl">
            <div className="flex items-center gap-3 mb-2">
              <Eye className="w-5 h-5 text-orange-400" />
              <span className="text-neutral-400 text-sm">En attente</span>
            </div>
            <p className="text-2xl font-bold text-white">{stats.pendingDeals}</p>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Link
          href="/admin/deals/new"
          className="p-4 bg-[#7b0a0a] hover:bg-[#9b1a1a] rounded-xl transition-colors text-center"
        >
          <Tag className="w-6 h-6 text-white mx-auto mb-2" />
          <span className="text-white font-medium">Ajouter un deal</span>
        </Link>
        
        <Link
          href="/admin/scrape"
          className="p-4 bg-[#1a1a1a] border border-white/10 hover:border-[#7b0a0a]/50 rounded-xl transition-colors text-center"
        >
          <BarChart3 className="w-6 h-6 text-neutral-400 mx-auto mb-2" />
          <span className="text-white font-medium">Scraper des deals</span>
        </Link>
        
        <Link
          href="/categories"
          className="p-4 bg-[#1a1a1a] border border-white/10 hover:border-[#7b0a0a]/50 rounded-xl transition-colors text-center"
        >
          <TrendingUp className="w-6 h-6 text-neutral-400 mx-auto mb-2" />
          <span className="text-white font-medium">Gérer catégories</span>
        </Link>
      </div>

      {/* Recent Deals Table */}
      <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white">Deals récents</h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#0d0d0d]">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-neutral-400">Deal</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-neutral-400">Prix</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-neutral-400">Auteur</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-neutral-400">Votes</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-neutral-400">Status</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-neutral-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {recentDeals.map((deal) => (
                <tr key={deal.id} className="border-t border-white/5 hover:bg-white/5">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {deal.product?.imageUrl && (
                        <Image
                          src={deal.product.imageUrl}
                          alt={deal.title}
                          width={40}
                          height={40}
                          className="rounded-lg object-cover"
                        />
                      )}
                      <div className="min-w-0">
                        <p className="text-white font-medium truncate max-w-[200px]">{deal.title}</p>
                        <p className="text-xs text-neutral-500">{deal.product?.category?.name}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-[#7b0a0a] font-bold">{deal.dealPrice}€</p>
                    {deal.originalPrice > deal.dealPrice && (
                      <p className="text-xs text-neutral-500 line-through">{deal.originalPrice}€</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {deal.author ? (
                      <div className="flex items-center gap-2">
                        {deal.author.avatarUrl ? (
                          <Image
                            src={deal.author.avatarUrl}
                            alt={deal.author.displayName || ''}
                            width={24}
                            height={24}
                            className="rounded-full"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-neutral-700" />
                        )}
                        <span className="text-sm text-neutral-300">
                          {deal.author.displayName || deal.author.username}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-neutral-500">Système</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-medium ${deal.votes >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {deal.votes > 0 ? '+' : ''}{deal.votes}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {deal.isHot && (
                        <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 text-xs rounded-full">
                          🔥 Hot
                        </span>
                      )}
                      {deal.isExpired && (
                        <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full">
                          Expiré
                        </span>
                      )}
                      {!deal.isHot && !deal.isExpired && (
                        <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">
                          Actif
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleToggleHot(deal.id, deal.isHot)}
                        disabled={actionLoading === deal.id}
                        className={`p-2 rounded-lg transition-colors ${
                          deal.isHot 
                            ? 'bg-orange-500/20 text-orange-400' 
                            : 'bg-white/5 text-neutral-400 hover:text-orange-400'
                        }`}
                        title={deal.isHot ? 'Retirer Hot' : 'Marquer Hot'}
                      >
                        <Star className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleToggleExpired(deal.id, deal.isExpired)}
                        disabled={actionLoading === deal.id}
                        className={`p-2 rounded-lg transition-colors ${
                          deal.isExpired 
                            ? 'bg-red-500/20 text-red-400' 
                            : 'bg-white/5 text-neutral-400 hover:text-green-400'
                        }`}
                        title={deal.isExpired ? 'Réactiver' : 'Marquer expiré'}
                      >
                        {deal.isExpired ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => handleDelete(deal.id)}
                        disabled={actionLoading === deal.id}
                        className="p-2 rounded-lg bg-white/5 text-neutral-400 hover:text-red-400 transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {recentDeals.length === 0 && (
          <div className="p-8 text-center text-neutral-500">
            Aucun deal pour le moment
          </div>
        )}
      </div>
    </div>
  );
}
