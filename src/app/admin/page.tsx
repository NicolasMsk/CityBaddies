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
  MessageSquare,
  Plus,
  Search,
  Settings,
  Clock
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

function AdminStatCard({
  label,
  value,
  icon: Icon,
  color = 'zinc'
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  color?: 'zinc' | 'blue' | 'green' | 'red' | 'purple' | 'orange';
}) {
  const styles = {
    zinc: 'bg-zinc-900 border-zinc-800 text-zinc-400 group-hover:border-zinc-700',
    blue: 'bg-blue-950/20 border-blue-900/30 text-blue-400 group-hover:border-blue-800/50',
    green: 'bg-emerald-950/20 border-emerald-900/30 text-emerald-400 group-hover:border-emerald-800/50',
    red: 'bg-rose-950/20 border-rose-900/30 text-rose-400 group-hover:border-rose-800/50',
    purple: 'bg-violet-950/20 border-violet-900/30 text-violet-400 group-hover:border-violet-800/50',
    orange: 'bg-amber-950/20 border-amber-900/30 text-amber-400 group-hover:border-amber-800/50',
  };

  return (
    <div className={`p-5 rounded-xl border transition-all duration-300 group ${styles[color].split(' ')[1]} ${styles[color].split(' ').slice(0, 2).join(' ')}`}>
      <div className="flex items-center justify-between mb-4">
        <div className={`p-2 rounded-lg ${styles[color].split(' ')[0]}`}>
           <Icon className={`w-5 h-5 ${styles[color].match(/text-\w+-\d+/)?.[0] || 'text-zinc-400'}`} />
        </div>
        {color === 'orange' && (
          <div className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[10px] font-bold text-amber-500 uppercase tracking-wide">
            Action requise
          </div>
        )}
      </div>
      <div>
        <div className="text-3xl font-bold text-white tracking-tight">{value}</div>
        <div className="text-sm font-medium text-zinc-500 mt-1">{label}</div>
      </div>
    </div>
  );
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
        <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (!user || !dbUser?.isAdmin) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <div className="text-center max-w-md w-full bg-zinc-900 border border-zinc-800 p-8 rounded-2xl">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Accès restreint</h2>
          <p className="text-zinc-400 mb-8">Cette zone est réservée aux administrateurs. Veuillez contacter le support si vous pensez qu&apos;il s&apos;agit d&apos;une erreur.</p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black hover:bg-zinc-200 font-medium rounded-xl transition-colors w-full justify-center"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour au site
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto px-6 py-10 space-y-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight mb-2">Administration</h1>
          <p className="text-zinc-400">Centre de contrôle et gestion du contenu.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-400 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            <span suppressHydrationWarning>{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
          </div>
          <Link
            href="/admin/dashboard"
            className="flex items-center gap-2 px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-lg transition-colors border border-zinc-700"
          >
            <BarChart3 className="w-4 h-4" />
            Statistiques détaillées
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <AdminStatCard label="Deals Total" value={stats.totalDeals} icon={Tag} color="blue" />
          <AdminStatCard label="Utilisateurs" value={stats.totalUsers} icon={Users} color="zinc" />
          <AdminStatCard label="Votes" value={stats.totalVotes} icon={TrendingUp} color="purple" />
          <AdminStatCard label="Commentaires" value={stats.totalComments} icon={MessageSquare} color="zinc" />
          <AdminStatCard label="En attente" value={stats.pendingDeals} icon={Eye} color="orange" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Main Content - Recent Deals */}
        <div className="lg:col-span-3 space-y-6">
           <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">Deals Récents</h2>
              <div className="flex gap-2">
                 <button className="p-2 text-zinc-400 hover:text-white transition-colors bg-zinc-900 hover:bg-zinc-800 rounded-lg border border-zinc-800">
                    <Search className="w-4 h-4" />
                 </button>
                 <button className="p-2 text-zinc-400 hover:text-white transition-colors bg-zinc-900 hover:bg-zinc-800 rounded-lg border border-zinc-800">
                    <Settings className="w-4 h-4" />
                 </button>
              </div>
           </div>

           <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-sm">
             <div className="overflow-x-auto">
               <table className="w-full text-sm">
                 <thead>
                   <tr className="bg-zinc-950/50 border-b border-zinc-800 text-zinc-400 text-xs uppercase tracking-wider font-medium text-left">
                     <th className="px-6 py-4">Deal</th>
                     <th className="px-6 py-4">Prix</th>
                     <th className="px-6 py-4">Auteur</th>
                     <th className="px-6 py-4 text-center">Score</th>
                     <th className="px-6 py-4 text-center">État</th>
                     <th className="px-6 py-4 text-right">Actions</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-zinc-800">
                   {recentDeals.map((deal) => (
                     <tr key={deal.id} className="group hover:bg-zinc-800/30 transition-colors">
                       <td className="px-6 py-4">
                         <div className="flex items-center gap-4">
                           <div className="relative w-10 h-10 rounded-lg bg-zinc-800 border border-zinc-700 overflow-hidden flex-shrink-0">
                             {deal.product?.imageUrl ? (
                               <Image
                                 src={deal.product.imageUrl}
                                 alt={deal.title}
                                 fill
                                 className="object-cover"
                               />
                             ) : (
                               <div className="w-full h-full flex items-center justify-center">
                                 <Tag className="w-4 h-4 text-zinc-600" />
                               </div>
                             )}
                           </div>
                           <div className="min-w-0 max-w-[200px]">
                             <div className="text-white font-medium truncate mb-0.5">{deal.title}</div>
                             <div className="text-xs text-zinc-500 truncate">{deal.product?.category?.name}</div>
                           </div>
                         </div>
                       </td>
                       <td className="px-6 py-4">
                         <div className="font-mono font-medium text-white">{deal.dealPrice} €</div>
                         {deal.originalPrice > deal.dealPrice && (
                           <div className="text-xs text-zinc-500 line-through decoration-zinc-600">{deal.originalPrice} €</div>
                         )}
                       </td>
                       <td className="px-6 py-4">
                         {deal.author ? (
                           <div className="flex items-center gap-2">
                             {deal.author.avatarUrl ? (
                               <Image
                                 src={deal.author.avatarUrl}
                                 alt={deal.author.displayName || ''}
                                 width={24}
                                 height={24}
                                 className="rounded-full bg-zinc-800 border border-zinc-700"
                               />
                             ) : (
                               <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-400 border border-zinc-700">
                                  {deal.author.username?.[0]?.toUpperCase()}
                               </div>
                             )}
                             <span className="text-zinc-300 truncate max-w-[100px]">
                               {deal.author.displayName || deal.author.username}
                             </span>
                           </div>
                         ) : (
                           <span className="text-zinc-500 italic flex items-center gap-1.5">
                              <div className="w-1.5 h-1.5 rounded-full bg-zinc-600"></div> Sytème
                           </span>
                         )}
                       </td>
                       <td className="px-6 py-4 text-center">
                         <div className={`inline-flex items-center gap-1 font-mono font-bold ${deal.votes >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                           {deal.votes > 0 ? '+' : ''}{deal.votes}
                         </div>
                       </td>
                       <td className="px-6 py-4 text-center">
                         <div className="flex justify-center gap-1.5">
                           {deal.isHot && (
                             <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" title="Hot"></span>
                           )}
                           {deal.isExpired ? (
                             <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-zinc-800 text-zinc-500 border border-zinc-700/50">Expiré</span>
                           ) : (
                             <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-emerald-950/30 text-emerald-400 border border-emerald-900/30">Actif</span>
                           )}
                         </div>
                       </td>
                       <td className="px-6 py-4">
                         <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                           <button
                             onClick={() => handleToggleHot(deal.id, deal.isHot)}
                             disabled={actionLoading === deal.id}
                             className={`p-1.5 rounded-md transition-all ${
                               deal.isHot 
                                 ? 'text-orange-400 hover:bg-orange-950/30' 
                                 : 'text-zinc-500 hover:text-orange-400 hover:bg-orange-950/10'
                             }`}
                             title={deal.isHot ? 'Retirer Hot' : 'Marquer Hot'}
                           >
                             <Star className="w-4 h-4" fill={deal.isHot ? "currentColor" : "none"} />
                           </button>
                           <button
                             onClick={() => handleToggleExpired(deal.id, deal.isExpired)}
                             disabled={actionLoading === deal.id}
                             className={`p-1.5 rounded-md transition-all ${
                               deal.isExpired 
                                 ? 'text-zinc-500 hover:text-emerald-400 hover:bg-emerald-950/20' 
                                 : 'text-zinc-500 hover:text-rose-400 hover:bg-rose-950/20'
                             }`}
                             title={deal.isExpired ? 'Réactiver' : 'Marquer expiré'}
                           >
                             {deal.isExpired ? <TrendingUp className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                           </button>
                           <div className="w-px h-4 bg-zinc-800 mx-1"></div>
                           <button
                             onClick={() => handleDelete(deal.id)}
                             disabled={actionLoading === deal.id}
                             className="p-1.5 rounded-md text-zinc-500 hover:text-red-400 hover:bg-red-950/20 transition-all"
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
               {recentDeals.length === 0 && (
                  <div className="p-12 flex flex-col items-center justify-center text-zinc-500">
                     <Tag className="w-12 h-12 mb-4 opacity-20" />
                     <p>Aucun deal récent à afficher</p>
                  </div>
               )}
             </div>
           </div>
        </div>

        {/* Sidebar - Quick Actions */}
        <div className="space-y-6">
           <h2 className="text-xl font-semibold text-white">Actions Rapides</h2>
           <div className="grid gap-3">
              <Link
                href="/admin/deals/new"
                className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-white to-zinc-200 text-black hover:shadow-lg hover:to-white transition-all group"
              >
                <div className="bg-black/5 p-2 rounded-lg">
                   <Plus className="w-5 h-5 text-black" />
                </div>
                <div>
                   <div className="font-bold">Nouveau Deal</div>
                   <div className="text-xs text-zinc-600">Ajouter manuellement</div>
                </div>
              </Link>
              
              <Link
                href="/admin/scrape"
                className="flex items-center gap-4 p-4 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/50 transition-all group"
              >
                <div className="bg-zinc-800 p-2 rounded-lg group-hover:bg-zinc-700 transition-colors">
                   <BarChart3 className="w-5 h-5 text-zinc-300" />
                </div>
                <div>
                   <div className="font-bold text-white">Scraper</div>
                   <div className="text-xs text-zinc-500">Lancer l&apos;importation</div>
                </div>
              </Link>
              
              <Link
                href="/categories"
                className="flex items-center gap-4 p-4 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/50 transition-all group"
              >
                <div className="bg-zinc-800 p-2 rounded-lg group-hover:bg-zinc-700 transition-colors">
                   <Tag className="w-5 h-5 text-zinc-300" />
                </div>
                <div>
                   <div className="font-bold text-white">Catégories</div>
                   <div className="text-xs text-zinc-500">Gérer la taxonomie</div>
                </div>
              </Link>
           </div>

           <div className="p-5 rounded-xl bg-zinc-900 border border-zinc-800 mt-8">
              <h3 className="text-sm font-semibold text-white mb-4">État du système</h3>
              <div className="space-y-3">
                 <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-400">Base de données</span>
                    <span className="flex items-center gap-1.5 text-emerald-400">
                       <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Connecté
                    </span>
                 </div>
                 <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-400">Scraper</span>
                    <span className="flex items-center gap-1.5 text-zinc-500">
                       <span className="w-1.5 h-1.5 rounded-full bg-zinc-600"></span> En veille
                    </span>
                 </div>
                 <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-400">Version</span>
                    <span className="text-zinc-500 font-mono text-xs">v1.2.0</span>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
