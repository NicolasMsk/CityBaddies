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
  const colorClasses = {
    red: 'bg-red-500/10 text-red-400',
    green: 'bg-green-500/10 text-green-400',
    blue: 'bg-blue-500/10 text-blue-400',
    purple: 'bg-purple-500/10 text-purple-400',
    orange: 'bg-orange-500/10 text-orange-400',
    pink: 'bg-pink-500/10 text-pink-400',
  };

  return (
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-5">
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2.5 rounded-xl ${colorClasses[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs ${trend.value >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {trend.value >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            <span>{Math.abs(trend.value)}</span>
            <span className="text-neutral-500">{trend.label}</span>
          </div>
        )}
      </div>
      <div className="text-2xl font-bold text-white mb-1">{value}</div>
      <div className="text-sm text-neutral-400">{label}</div>
      {subValue && <div className="text-xs text-neutral-500 mt-1">{subValue}</div>}
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
    <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-5 h-5 text-[#7b0a0a]" />
        <h3 className="font-semibold text-white">{title}</h3>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center p-3 bg-neutral-800/50 rounded-xl">
          <div className="text-xl font-bold text-white">{today}</div>
          <div className="text-xs text-neutral-400">Aujourd&apos;hui</div>
        </div>
        <div className="text-center p-3 bg-neutral-800/50 rounded-xl">
          <div className="text-xl font-bold text-white">{week}</div>
          <div className="text-xs text-neutral-400">7 jours</div>
        </div>
        <div className="text-center p-3 bg-neutral-800/50 rounded-xl">
          <div className="text-xl font-bold text-white">{month}</div>
          <div className="text-xs text-neutral-400">30 jours</div>
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
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#7b0a0a]/20 rounded-xl">
            <BarChart3 className="w-6 h-6 text-[#7b0a0a]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Dashboard</h1>
            <p className="text-neutral-400">Statistiques en temps réel</p>
          </div>
        </div>
        <Link
          href="/admin"
          className="flex items-center gap-2 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl transition-colors"
        >
          <Crown className="w-4 h-4" />
          Gestion
        </Link>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <StatCard
          icon={Tag}
          label="Deals actifs"
          value={data.overview.activeDeals}
          subValue={`${data.overview.expiredDeals} expirés`}
          trend={{ value: data.growth.deals.today, label: "auj." }}
          color="red"
        />
        <StatCard
          icon={Flame}
          label="Deals HOT"
          value={data.overview.hotDeals}
          color="orange"
        />
        <StatCard
          icon={Users}
          label="Utilisateurs"
          value={data.overview.totalUsers}
          trend={{ value: data.growth.users.today, label: "auj." }}
          color="blue"
        />
        <StatCard
          icon={Mail}
          label="Newsletter"
          value={data.overview.confirmedNewsletterSubscribers}
          subValue={`${data.overview.totalNewsletterSubscribers} total`}
          trend={{ value: data.growth.newsletter.today, label: "auj." }}
          color="green"
        />
        <StatCard
          icon={Heart}
          label="Favoris"
          value={data.overview.totalFavorites}
          color="pink"
        />
        <StatCard
          icon={MessageSquare}
          label="Commentaires"
          value={data.overview.totalComments}
          color="purple"
        />
      </div>

      {/* Financial Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <StatCard
          icon={Euro}
          label="Économies générées"
          value={`${data.overview.totalSavings.toLocaleString('fr-FR')} €`}
          subValue="Total sur deals actifs"
          color="green"
        />
        <StatCard
          icon={Percent}
          label="Réduction moyenne"
          value={`-${data.overview.averageDiscount}%`}
          color="orange"
        />
        <StatCard
          icon={Package}
          label="Produits"
          value={data.overview.totalProducts}
          subValue={`${data.overview.totalBrands} marques • ${data.overview.totalCategories} catégories`}
          color="blue"
        />
      </div>

      {/* Growth Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
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

      {/* Top Deals & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Top Deals */}
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-5">
          <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#7b0a0a]" />
            Top 10 Deals (par votes)
          </h3>
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {data.topDeals.map((deal, index) => (
              <Link
                key={deal.id}
                href={`/deals/${deal.id}`}
                className="flex items-center gap-3 p-3 bg-neutral-800/50 hover:bg-neutral-800 rounded-xl transition-colors"
              >
                <span className="text-lg font-bold text-neutral-500 w-6">#{index + 1}</span>
                {deal.product.imageUrl ? (
                  <Image
                    src={deal.product.imageUrl}
                    alt={deal.product.name}
                    width={40}
                    height={40}
                    className="rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 bg-neutral-700 rounded-lg" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{deal.title}</p>
                  <p className="text-xs text-neutral-400">{deal.product.merchant.name}</p>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 text-green-400">
                    <TrendingUp className="w-3 h-3" />
                    <span className="text-sm font-bold">{deal.votes}</span>
                  </div>
                  {deal.isHot && <Flame className="w-4 h-4 text-orange-500 ml-auto" />}
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Top Favoris */}
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-5">
          <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
            <Heart className="w-5 h-5 text-pink-500" />
            Top 10 Deals (par favoris)
          </h3>
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {data.topFavorites.map((deal, index) => (
              <Link
                key={deal.id}
                href={`/deals/${deal.id}`}
                className="flex items-center gap-3 p-3 bg-neutral-800/50 hover:bg-neutral-800 rounded-xl transition-colors"
              >
                <span className="text-lg font-bold text-neutral-500 w-6">#{index + 1}</span>
                {deal.product.imageUrl ? (
                  <Image
                    src={deal.product.imageUrl}
                    alt={deal.product.name}
                    width={40}
                    height={40}
                    className="rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 bg-neutral-700 rounded-lg" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{deal.title}</p>
                  <p className="text-xs text-neutral-400">{deal.product.merchant.name}</p>
                </div>
                <div className="flex items-center gap-1 text-pink-400">
                  <Heart className="w-3 h-3 fill-current" />
                  <span className="text-sm font-bold">{deal.favoritesCount}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Category & Merchant Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Categories */}
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-5">
          <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-purple-500" />
            Produits par catégorie
          </h3>
          <div className="space-y-2">
            {data.categoryStats.slice(0, 8).map((cat) => {
              const maxCount = Math.max(...data.categoryStats.map(c => c.productsCount));
              const percentage = (cat.productsCount / maxCount) * 100;
              return (
                <div key={cat.slug} className="flex items-center gap-3">
                  <span className="text-sm text-neutral-300 w-32 truncate">{cat.name}</span>
                  <div className="flex-1 h-2 bg-neutral-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-purple-500 rounded-full transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="text-sm text-neutral-400 w-12 text-right">{cat.productsCount}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Merchants */}
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-5">
          <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-blue-500" />
            Produits par marchand
          </h3>
          <div className="space-y-2">
            {data.merchantStats.slice(0, 8).map((merchant) => {
              const maxCount = Math.max(...data.merchantStats.map(m => m.productsCount));
              const percentage = (merchant.productsCount / maxCount) * 100;
              return (
                <div key={merchant.slug} className="flex items-center gap-3">
                  <span className="text-sm text-neutral-300 w-32 truncate">{merchant.name}</span>
                  <div className="flex-1 h-2 bg-neutral-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 rounded-full transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <span className="text-sm text-neutral-400 w-12 text-right">{merchant.productsCount}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Newsletter Signups */}
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-5">
          <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
            <Mail className="w-5 h-5 text-green-500" />
            Dernières inscriptions newsletter
          </h3>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {data.recentNewsletterSignups.map((signup, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-neutral-800/50 rounded-xl">
                <div>
                  <p className="text-sm font-medium text-white">{signup.email}</p>
                  <p className="text-xs text-neutral-400">{signup.source}</p>
                </div>
                <div className="text-right">
                  <div className={`text-xs px-2 py-1 rounded-full ${signup.isConfirmed ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                    {signup.isConfirmed ? 'Confirmé' : 'En attente'}
                  </div>
                  <p className="text-xs text-neutral-500 mt-1">
                    {new Date(signup.subscribedAt).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Users */}
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-5">
          <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-500" />
            Derniers utilisateurs inscrits
          </h3>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {data.recentUsers.map((user) => (
              <div key={user.id} className="flex items-center gap-3 p-3 bg-neutral-800/50 rounded-xl">
                {user.avatarUrl ? (
                  <Image
                    src={user.avatarUrl}
                    alt={user.displayName || user.email}
                    width={36}
                    height={36}
                    className="rounded-full"
                  />
                ) : (
                  <div className="w-9 h-9 bg-gradient-to-br from-[#7b0a0a] to-[#9b1a1a] rounded-full flex items-center justify-center text-white text-sm font-bold">
                    {(user.displayName || user.email).charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {user.displayName || user.username || 'Utilisateur'}
                  </p>
                  <p className="text-xs text-neutral-400 truncate">{user.email}</p>
                </div>
                <div className="flex items-center gap-1 text-xs text-neutral-500">
                  <Calendar className="w-3 h-3" />
                  {new Date(user.createdAt).toLocaleDateString('fr-FR')}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
