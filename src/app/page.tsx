import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Sparkles, Star, Crown } from 'lucide-react';
import prisma from '@/lib/prisma';
import DealCard from '@/components/deals/DealCard';
import CategoryCard from '@/components/categories/CategoryCard';

async function getHomeData() {
  // D'abord récupérer les catégories avec le compte de deals actifs
  const categoriesWithDeals = await prisma.category.findMany({
    include: {
      products: {
        include: {
          deals: {
            where: {
              isExpired: false,
              discountPercent: { gte: 20 },
            },
          },
        },
      },
    },
  });

  // Calculer le nombre de deals actifs par catégorie et filtrer celles sans deals
  const categories = categoriesWithDeals
    .map((cat: any) => {
      const dealCount = cat.products.reduce((acc: number, prod: any) => acc + prod.deals.length, 0);
      return {
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        imageUrl: cat.imageUrl,
        _count: { deals: dealCount },
      };
    })
    .filter((cat: any) => cat._count.deals > 0) // Ne garder que les catégories avec des deals
    .sort((a: any, b: any) => b._count.deals - a._count.deals); // Trier par nombre de deals

  const [hotDeals, stats] = await Promise.all([
    prisma.deal.findMany({
      where: { 
        isExpired: false,
        discountPercent: { gte: 20 }, // Minimum 20% de réduction
      },
      include: {
        product: {
          include: {
            category: true,
            merchant: true,
          },
        },
      },
      orderBy: [
        { score: 'desc' }, // Trier par score (prend en compte discount, tier marque, etc.)
        { createdAt: 'desc' },
      ],
      take: 6,
    }),
    Promise.all([
      prisma.deal.count({ where: { isExpired: false, discountPercent: { gte: 20 } } }),
      prisma.product.count(),
      prisma.merchant.count(),
    ]),
  ]);

  return {
    hotDeals,
    categories,
    stats: {
      deals: stats[0],
      products: stats[1],
      merchants: stats[2],
    },
  };
}

export default async function HomePage() {
  const { hotDeals, categories, stats } = await getHomeData();

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Hero Section - Dark Baddie Style */}
      <section className="relative overflow-hidden min-h-[75vh] flex items-center">
        {/* Background Image */}
        <div className="absolute inset-0">
          <Image
            src="/images/hero-bg.png"
            alt="City Baddies Beauty"
            fill
            className="object-cover object-center"
            priority
            quality={90}
          />
          {/* Dark overlay gradient */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0a] via-[#0a0a0a]/80 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-[#0a0a0a]/30" />
        </div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24 lg:py-32">
          <div className="max-w-2xl">
            {/* Tagline */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#7b0a0a] rounded-full mb-8 border border-[#9b1515]/30">
              <Crown className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-xs font-medium text-white tracking-wide uppercase">
                Les deals que tu mérites
              </span>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-light text-white leading-[1.1] mb-6">
              Slay ta routine,
              <br />
              <span className="font-semibold text-[#d4a855]">pas ton budget.</span>
            </h1>

            <p className="text-lg md:text-xl text-neutral-400 max-w-xl mb-10 leading-relaxed">
              On traque les meilleures promos beauté pour toi. 
              Sephora, Nocibé... les vrais deals, zéro arnaque.
            </p>

            <div className="flex flex-col sm:flex-row items-start gap-4">
              <Link
                href="/deals"
                className="group flex items-center gap-3 px-6 py-3.5 bg-[#7b0a0a] hover:bg-[#8b1212] rounded-full text-white font-medium transition-all border border-[#9b1515]/30"
              >
                Voir les deals 🔥
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                href="/categories"
                className="flex items-center gap-2 px-6 py-3.5 text-neutral-400 font-medium hover:text-white transition-colors"
              >
                Explorer par catégorie
              </Link>
            </div>
          </div>

          {/* Stats - Minimal Dark */}
          <div className="flex items-center gap-8 mt-16 pt-8 border-t border-white/10">
            <div>
              <p className="text-3xl font-semibold text-white">{stats.deals}</p>
              <p className="text-sm text-neutral-500">deals actifs</p>
            </div>
            <div className="w-px h-12 bg-white/10" />
            <div>
              <p className="text-3xl font-semibold text-white">{stats.products}</p>
              <p className="text-sm text-neutral-500">produits traqués</p>
            </div>
            <div className="w-px h-12 bg-white/10 hidden sm:block" />
            <div className="hidden sm:block">
              <p className="text-3xl font-semibold text-white">{stats.merchants}</p>
              <p className="text-sm text-neutral-500">enseignes scannées</p>
            </div>
          </div>
        </div>
      </section>

      {/* Categories - Dark Grid */}
      <section className="py-16 md:py-24 bg-[#0f0f0f]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#9b1515] mb-2">
              Par catégorie
            </p>
            <h2 className="text-2xl md:text-3xl font-light text-white">
              Trouve ton <span className="font-semibold text-[#d4a855]">obsession</span>
            </h2>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {categories.map((category: typeof categories[number]) => (
              <CategoryCard key={category.id} category={category as any} />
            ))}
          </div>
        </div>
      </section>

      {/* Featured Picks */}
      <section className="py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-10">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#9b1515] mb-2">
                Hot right now 🔥
              </p>
              <h2 className="text-2xl md:text-3xl font-light text-white">
                Les deals qui <span className="font-semibold text-[#d4a855]">cassent tout</span>
              </h2>
            </div>
            <Link
              href="/deals"
              className="hidden md:flex items-center gap-2 text-sm font-medium text-neutral-400 hover:text-white transition-colors"
            >
              Voir tout
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {hotDeals.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
              {hotDeals.map((deal: typeof hotDeals[number]) => (
                <DealCard key={deal.id} deal={deal as any} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 bg-white/5 rounded-2xl border border-white/10">
              <Sparkles className="h-8 w-8 text-neutral-600 mx-auto mb-4" />
              <p className="text-neutral-500">Pas de deals pour l&apos;instant, reviens vite !</p>
            </div>
          )}

          {/* Mobile CTA */}
          <div className="mt-8 text-center md:hidden">
            <Link
              href="/deals"
              className="inline-flex items-center gap-2 text-sm font-medium text-neutral-400"
            >
              Voir tous les deals
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Value Props - Dark */}
      <section className="py-16 md:py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8 md:gap-12">
            {[
              {
                icon: '💅',
                title: 'On fait le tri pour toi',
                description: 'Fini les faux deals. On vérifie chaque promo avant de te la montrer.',
              },
              {
                icon: '�',
                title: 'Le vrai prix, pas le fake',
                description: 'Historique des prix pour savoir si c\'est vraiment une bonne affaire.',
              },
              {
                icon: '⚡',
                title: 'Sois la première',
                description: 'Les meilleurs deals partent vite. On te notifie avant tout le monde.',
              },
            ].map((feature, index) => (
              <div key={index} className="text-center">
                <span className="text-3xl mb-4 block">{feature.icon}</span>
                <h3 className="text-lg font-medium text-white mb-2">{feature.title}</h3>
                <p className="text-sm text-neutral-500 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter - Bordeaux */}
      <section className="py-16 md:py-24 bg-gradient-to-br from-[#1a0f11] via-[#2d1a1e] to-[#1a0f11]">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Star className="h-6 w-6 text-[#d4a855] mx-auto mb-6" />
          <h2 className="text-2xl md:text-3xl font-light text-white mb-4">
            Rejoins le <span className="font-semibold text-[#d4a855]">squad</span>
          </h2>
          <p className="text-neutral-400 mb-8 max-w-md mx-auto">
            Les meilleures promos beauté direct dans ta boîte mail. 
            Une fois par semaine, pas plus.
          </p>
          <form className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
            <input
              type="email"
              placeholder="ton@email.com"
              className="flex-1 px-5 py-3 bg-white/5 border border-[#7b0a0a]/50 rounded-full text-white placeholder-neutral-500 focus:outline-none focus:border-[#9b1515] transition-colors"
            />
            <button
              type="submit"
              className="px-6 py-3 bg-[#7b0a0a] hover:bg-[#8b1212] border border-[#9b1515]/30 rounded-full text-white font-medium transition-colors"
            >
              Je m&apos;inscris
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
