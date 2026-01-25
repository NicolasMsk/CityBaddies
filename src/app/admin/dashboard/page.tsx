'use client';

import { useAuth } from '@/components/auth';
import { useState, useEffect } from 'react';
import { 
  Crown, 
  Users, 
  Tag, 
  TrendingUp,
  Loader2,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  MessageSquare,
  Heart,
  Mail,
  Package,
  Flame,
  Clock,
  ShoppingBag,
  Percent,
  Euro,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

interface DashboardData {
  overview: {
    totalDeals: number;
    activeDeals: number;
    expiredDeals: number;
    hotDeals: number;
    totalUsers: number;
    totalVotes: number;
    totalComments: number;
    totalFavorites: number;
    totalNewsletterSubscribers: number;
    confirmedNewsletterSubscribers: number;
    totalProducts: number;
    totalBrands: number;
    totalCategories: number;
    totalSavings: number;
    averageDiscount: number;
  };
  growth: {
    deals: { today: number; week: number; month: number };
    users: { today: number; week: number; month: number };
    newsletter: { today: number; week: number; month: number };
  };
  topDeals: Array<{
    id: string;
    title: string;
    dealPrice: number;
    originalPrice: number;
    votes: number;
    isHot: boolean;
    createdAt: string;
    product: {
      name: string;
      imageUrl: string;
      merchant: { name: string };
      category: { name: string };
    };
  }>;
  topFavorites: Array<{
    id: string;
    title: string;
    dealPrice: number;
    originalPrice: number;
    votes: number;
    favoritesCount: number;
    product: {
      name: string;
      imageUrl: string;
      merchant: { name: string };
    };
  }>;
  categoryStats: Array<{ name: string; slug: string; productsCount: number }>;
  merchantStats: Array<{ name: string; slug: string; productsCount: number }>;
  recentNewsletterSignups: Array<{
    email: string;
    source: string;
    subscribedAt: string;
    isConfirmed: boolean;
  }>;
  recentUsers: Array<{
    id: string;
    email: string;
    displayName: string;
    username: string;
    avatarUrl: string;
    createdAt: string;
  }>;
}

function StatCard({ 
  icon: Icon, 
  label, 
  value, 
  subValue, 
  trend, 
  color = 'red' 
}: { 
  icon: React.ElementType; 
  label: string; 
  value: string | number; 
  subValue?: string;
  trend?: { value: number; label: string };
  color?: 'red' | 'green' | 'blue' | 'purple' | 'orange' | 'pink';
}) {
  const colorStyles = {
    red: 'text-[#7b0a0a] bg-[#7b0a0a]/10',
    green: 'text-emerald-500 bg-emerald-500/10',
    blue: 'text-blue-500 bg-blue-500/10',
    purple: 'text-violet-500 bg-violet-500/10',
    orange: 'text-amber-500 bg-amber-500/10',
    pink: 'text-pink-500 bg-pink-500/10',
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 hover:border-zinc-700 transition-all duration-300 group shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-lg ${colorStyles[color]} transition-transform group-hover:scale-110 duration-300`}>
          <Icon className="w-6 h-6" />
        </div>
        {trend && (
          <div className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${
            trend.value >= 0 
              ? 'text-emerald-400 border-emerald-950/50 bg-emerald-950/20' 
              : 'text-rose-400 border-rose-950/50 bg-rose-950/20'
          }`}>
            {trend.value >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingUp className="w-3 h-3 rotate-180" />}
            <span>{Math.abs(trend.value)}</span>
            <span className="opacity-70 hidden sm:inline">{trend.label}</span>
          </div>
        )}
      </div>
      <div>
        <div className="text-3xl font-bold text-white tracking-tight mb-1">{value}</div>
        <div className="text-sm font-medium text-zinc-400">{label}</div>
        {subValue && (
          <div className="mt-3 pt-3 border-t border-zinc-800/50 text-xs text-zinc-500 flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${colorStyles[color].split(' ')[1]}`} />
            {subValue}
          </div>
        )}
      </div>
    </div>
  );
}

function GrowthCard({ 
  title, 
  today, 
  week, 
  month,
  icon: Icon,
}: { 
  title: string; 
  today: number; 
  week: number; 
  month: number;
  icon: React.ElementType;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 hover:border-zinc-700 transition-all shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-zinc-800 rounded-lg">
          <Icon className="w-5 h-5 text-white" />
        </div>
        <h3 className="font-semibold text-white">{title}</h3>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center group">
          <div className="text-2xl font-bold text-white mb-1 group-hover:text-[#7b0a0a] transition-colors">{today}</div>
          <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider">24h</div>
        </div>
        <div className="text-center group border-l border-zinc-800">
          <div className="text-2xl font-bold text-white mb-1 group-hover:text-[#7b0a0a] transition-colors">{week}</div>
          <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider">7j</div>
        </div>
        <div className="text-center group border-l border-zinc-800">
          <div className="text-2xl font-bold text-white mb-1 group-hover:text-[#7b0a0a] transition-colors">{month}</div>
          <div className="text-xs font-medium text-zinc-500 uppercase tracking-wider">30j</div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user, dbUser, loading: authLoading } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/admin/dashboard');
        if (res.ok) {
          const dashboardData = await res.json();
          setData(dashboardData);
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
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

  if (!data) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <p className="text-neutral-400">Erreur lors du chargement des données</p>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto px-6 py-10 space-y-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight mb-2">Tableau de bord</h1>
          <p className="text-zinc-400">Vue d&apos;ensemble de l&apos;activité et des performances.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-zinc-400 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            <span suppressHydrationWarning>{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
          </div>
          <Link
            href="/admin"
            className="flex items-center gap-2 px-5 py-2.5 bg-white text-black hover:bg-zinc-200 font-medium rounded-lg transition-colors shadow-lg shadow-white/5"
          >
            <Crown className="w-4 h-4" />
            Administration
          </Link>
        </div>
      </div>

      {/* Key Metrics - Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          icon={Tag}
          label="Deals Actifs"
          value={data.overview.activeDeals}
          subValue={`${data.overview.expiredDeals} expirés`}
          trend={{ value: data.growth.deals.today, label: "ce jour" }}
          color="red"
        />
        <StatCard
          icon={Users}
          label="Utilisateurs Total"
          value={data.overview.totalUsers}
          trend={{ value: data.growth.users.today, label: "nouveaux" }}
          color="blue"
        />
        <StatCard
          icon={Euro}
          label="Économies Générées"
          value={`${Math.round(data.overview.totalSavings).toLocaleString('fr-FR')} €`}
          subValue="Sur deals actifs"
          color="green"
        />
        <StatCard
          icon={Mail}
          label="Abonnés Newsletter"
          value={data.overview.confirmedNewsletterSubscribers}
          subValue={`${data.overview.totalNewsletterSubscribers - data.overview.confirmedNewsletterSubscribers} en attente`}
          trend={{ value: data.growth.newsletter.today, label: "ce jour" }}
          color="purple"
        />
      </div>

      {/* Secondary Metrics - Row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          icon={Flame}
          label="Deals Populaires (HOT)"
          value={data.overview.hotDeals}
          subValue="Haute température"
          color="orange"
        />
        <StatCard
          icon={Percent}
          label="Réduction Moyenne"
          value={`-${data.overview.averageDiscount.toFixed(1)}%`}
          subValue="Sur l'ensemble du catalogue"
          color="red"
        />
        <StatCard
          icon={Heart}
          label="Favoris Utilisateurs"
          value={data.overview.totalFavorites}
          subValue="Deals sauvegardés"
          color="pink"
        />
      </div>

      {/* Growth Analysis */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-[#7b0a0a]" />
          Analyse de la croissance
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <GrowthCard
            title="Nouveaux Deals"
            icon={Tag}
            today={data.growth.deals.today}
            week={data.growth.deals.week}
            month={data.growth.deals.month}
          />
          <GrowthCard
            title="Inscriptions"
            icon={Users}
            today={data.growth.users.today}
            week={data.growth.users.week}
            month={data.growth.users.month}
          />
          <GrowthCard
            title="Newsletter"
            icon={Mail}
            today={data.growth.newsletter.today}
            week={data.growth.newsletter.week}
            month={data.growth.newsletter.month}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Top Deals List */}
        <div className="xl:col-span-2 space-y-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 h-[500px] flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <Crown className="w-5 h-5 text-amber-500" />
                Top 10 Deals
              </h3>
              <div className="flex gap-2">
                <div className="text-xs font-medium px-2 py-1 rounded bg-zinc-800 text-zinc-400">Par votes</div>
              </div>
            </div>
            
            <div className="overflow-y-auto pr-2 space-y-1 [scrollbar-width:thin] [scrollbar-color:theme(colors.zinc.700)_transparent] flex-1">
              {data.topDeals.map((deal, index) => (
                <Link
                  key={deal.id}
                  href={`/deals/${deal.id}`}
                  className="group flex items-center gap-4 p-3 rounded-lg hover:bg-zinc-800/50 transition-colors border border-transparent hover:border-zinc-800"
                >
                  <div className="flex-shrink-0 w-8 text-center font-bold text-zinc-600 font-mono">
                    #{index + 1}
                  </div>
                  
                  <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-zinc-800 flex-shrink-0 border border-zinc-700">
                    {deal.product.imageUrl ? (
                      <Image
                        src={deal.product.imageUrl}
                        alt={deal.product.name}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-5 h-5 text-zinc-600" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-white truncate group-hover:text-[#7b0a0a] transition-colors">
                      {deal.title}
                    </h4>
                    <div className="flex items-center gap-2 text-xs text-zinc-500 mt-0.5">
                      <span className="text-zinc-300">{deal.product.merchant.name}</span>
                      <span>•</span>
                      <span>{deal.product.category.name}</span>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                     <div className="flex items-center justify-end gap-1.5 text-emerald-400 font-bold">
                        <TrendingUp className="w-3 h-3" />
                        {deal.votes}
                     </div>
                     <div className="text-xs text-zinc-500 mt-0.5">
                        {deal.isHot && <span className="text-orange-500 flex items-center justify-end gap-1"><Flame className="w-3 h-3" /> Hot</span>}
                     </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Categories Distribution */}
        <div className="space-y-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 h-[500px] flex flex-col">
          <h3 className="font-semibold text-white mb-6 flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-purple-500" />
            Top Catégories
          </h3>
          <div className="flex-1 overflow-y-auto pr-2 space-y-5 [scrollbar-width:thin] [scrollbar-color:theme(colors.zinc.700)_transparent]">
            {data.categoryStats.slice(0, 10).map((cat) => {
              const maxCount = Math.max(...data.categoryStats.map(c => c.productsCount));
              const percentage = (cat.productsCount / maxCount) * 100;
              return (
                <div key={cat.slug} className="group">
                  <div className="flex justify-between items-center mb-2 text-sm">
                     <span className="text-zinc-300 font-medium truncate pr-4">{cat.name}</span>
                     <span className="text-zinc-500 font-mono">{cat.productsCount}</span>
                  </div>
                  <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-purple-500 rounded-full transition-all duration-500 ease-out group-hover:bg-purple-400"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Recent Activity: Users */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
             <h3 className="font-semibold text-white flex items-center gap-2">
               <Users className="w-5 h-5 text-blue-500" />
               Derniers Inscrits
             </h3>
             <Link href="/admin/users" className="text-xs text-blue-400 hover:text-blue-300">Voir tout</Link>
          </div>
          <div className="space-y-4">
            {data.recentUsers.map((user) => (
              <div key={user.id} className="flex items-center gap-4 p-3 rounded-lg bg-zinc-800/30 border border-zinc-800/50">
                {user.avatarUrl ? (
                  <Image
                    src={user.avatarUrl}
                    alt={user.displayName || user.email}
                    width={40}
                    height={40}
                    className="rounded-full border border-zinc-700"
                  />
                ) : (
                  <div className="w-10 h-10 bg-gradient-to-br from-[#7b0a0a] to-zinc-800 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-inner">
                    {(user.displayName || user.email).charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {user.displayName || user.username || 'Utilisateur'}
                  </p>
                  <p className="text-xs text-zinc-500 truncate">{user.email}</p>
                </div>
                <div className="text-xs text-zinc-500 whitespace-nowrap bg-zinc-900 px-2 py-1 rounded">
                   {new Date(user.createdAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Newsletter Activity */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
             <h3 className="font-semibold text-white flex items-center gap-2">
               <Mail className="w-5 h-5 text-green-500" />
               Activité Newsletter
             </h3>
             <span className="text-xs text-zinc-500">Derniers abonnés</span>
          </div>
          <div className="space-y-4">
            {data.recentNewsletterSignups.map((signup, index) => (
              <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/30 border border-zinc-800/50">
                <div className="flex items-center gap-3 overflow-hidden">
                   <div className="p-2 rounded-full bg-zinc-900 text-zinc-500">
                      <Mail className="w-4 h-4" />
                   </div>
                   <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate max-w-[200px]">{signup.email}</p>
                      <p className="text-xs text-zinc-500 capitalize">{signup.source}</p>
                   </div>
                </div>
                <div className={`text-xs px-2.5 py-1 rounded-full font-medium ${signup.isConfirmed ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                   {signup.isConfirmed ? 'Confirmé' : 'En attente'}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
