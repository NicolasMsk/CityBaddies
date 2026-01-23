import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Sparkles, Star, Crown, TrendingDown, Clock } from 'lucide-react';
import prisma from '@/lib/prisma';
import DealCard from '@/components/deals/DealCard';
import CategoryCard from '@/components/categories/CategoryCard';
import DealCarouselSection from '@/components/deals/DealCarouselSection';
import NewsletterSection from '@/components/layout/NewsletterSection';

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
    .filter((cat: any) => cat._count.deals > 0)
    .sort((a: any, b: any) => b._count.deals - a._count.deals);

  // Date d'aujourd'hui (début de journée)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [hotDeals, luxeDeals, latestDeals, stats, dealsToday, topBrands] = await Promise.all([
    // Hot deals classiques - Top 8 par score
    prisma.deal.findMany({
      where: { 
        isExpired: false,
        discountPercent: { gte: 20 },
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
        { score: 'desc' },
        { createdAt: 'desc' },
      ],
      take: 8, // 8 pour le carousel
    }),
    // Deals Luxe (brandTier = 1) - Plus de deals pour le carousel
    prisma.deal.findMany({
      where: { 
        isExpired: false,
        discountPercent: { gte: 20 },
        brandTier: 1, // Marques luxe
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
        { discountPercent: 'desc' },
        { score: 'desc' },
      ],
      take: 8, // Plus pour le carousel
    }),
    // Derniers deals ajoutés - Récupérer par marchand pour mélanger
    (async () => {
      // Récupérer tous les marchands actifs (via leurs produits qui ont des deals)
      const merchants = await prisma.merchant.findMany({
        where: {
          products: {
            some: {
              deals: {
                some: {
                  isExpired: false,
                  discountPercent: { gte: 15 },
                },
              },
            },
          },
        },
      });
      
      const totalDeals = 10;
      const dealsPerMerchant = Math.ceil(totalDeals / Math.max(merchants.length, 1));
      
      // Récupérer les derniers deals de chaque marchand
      const dealsByMerchant = await Promise.all(
        merchants.map(merchant =>
          prisma.deal.findMany({
            where: {
              isExpired: false,
              discountPercent: { gte: 15 },
              product: { merchantId: merchant.id },
            },
            include: {
              product: {
                include: {
                  category: true,
                  merchant: true,
                },
              },
            },
            orderBy: { createdAt: 'desc' },
            take: dealsPerMerchant,
          })
        )
      );
      
      // Mélanger en alternance (round-robin)
      const mixedDeals: any[] = [];
      const maxLength = Math.max(...dealsByMerchant.map(d => d.length));
      
      for (let i = 0; i < maxLength; i++) {
        for (const merchantDeals of dealsByMerchant) {
          if (merchantDeals[i] && mixedDeals.length < totalDeals) {
            mixedDeals.push(merchantDeals[i]);
          }
        }
      }
      
      return mixedDeals;
    })(),
    // Stats globales
    Promise.all([
      prisma.deal.count({ where: { isExpired: false, discountPercent: { gte: 20 } } }),
      prisma.product.count(),
      prisma.merchant.count(),
    ]),
    // Deals ajoutés aujourd'hui
    prisma.deal.count({
      where: {
        createdAt: { gte: today },
        isExpired: false,
      },
    }),
    // Top marques avec deals actifs (pour le bandeau)
    prisma.brand.findMany({
      where: {
        tier: 1, // Marques premium
        products: {
          some: {
            deals: {
              some: {
                isExpired: false,
                discountPercent: { gte: 20 },
              },
            },
          },
        },
      },
      take: 12,
      orderBy: { name: 'asc' },
    }),
  ]);

  return {
    hotDeals,
    luxeDeals,
    latestDeals,
    categories,
    topBrands,
    stats: {
      deals: stats[0],
      products: stats[1],
      merchants: stats[2],
      dealsToday,
    },
  };
}

export default async function HomePage() {
  const { hotDeals, luxeDeals, latestDeals, categories, topBrands, stats } = await getHomeData();

  return (
    <div className="min-h-screen bg-[#0a0a0a] relative selection:bg-[#d4a855] selection:text-black">
      {/* Background Base - Subtle Studio Gradient */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_0%,_#1a1a1a_0%,_#0a0a0a_80%)] z-0 pointer-events-none" />
      
      {/* Ambient Color Glows - Refined for elegance (No image required) */}
      <div className="fixed top-[-10%] left-[-10%] w-[40vw] h-[40vw] bg-[#9b1515] opacity-[0.08] blur-[100px] rounded-full pointer-events-none z-0" />
      <div className="fixed bottom-[10%] right-[-5%] w-[30vw] h-[30vw] bg-[#d4a855] opacity-[0.05] blur-[120px] rounded-full pointer-events-none z-0" />
      <div className="fixed top-[40%] right-[-10%] w-[30vw] h-[30vw] bg-[#7b0a0a] opacity-[0.06] blur-[120px] rounded-full pointer-events-none z-0" />

      {/* Hero Section - Editorial Dark */}
      <section className="relative z-10 min-h-[90vh] flex items-center bg-transparent overflow-hidden pb-32">
        
        {/* Background - kept subtle */}
        <div className="absolute inset-0 z-0">
           <Image
            src="/images/hero-bg.png"
            alt="Editorial Beauty"
            fill
            className="object-cover object-center opacity-50"
            priority
            quality={90}
          />
           {/* Gradient Lateral (Texte lisible) */}
           <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0a] via-[#0a0a0a]/90 via-30% to-transparent" />
           
           {/* Gradient Bottom (Transition douce avec le reste de la page) */}
           <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a] via-10% to-transparent opacity-100" />
        </div>

        <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20">
          <div className="max-w-4xl">
            
            {/* Editorial Header */}
            <div className="mb-8 flex items-center gap-4">
              <div className="h-px w-12 bg-white/30" />
              <span className="text-xs font-bold tracking-[0.3em] text-white/80 uppercase">
                Deals Beauté Premium
              </span>
            </div>

            <h1 className="text-6xl md:text-8xl lg:text-9xl font-thin text-white tracking-tighter leading-[0.9] mb-12">
              SLAY TA <br/>
              <span className="font-normal italic text-[#d4a855] pr-4">ROUTINE</span> <br/>
              <span className="text-4xl md:text-6xl lg:text-7xl font-light tracking-normal text-neutral-400 block mt-4">PAS TON BUDGET.</span>
            </h1>

            <div className="flex flex-col md:flex-row items-start md:items-center gap-8 md:gap-16 border-t border-white/10 pt-12 mt-12">
              <p className="max-w-sm text-neutral-400 font-light leading-relaxed">
                Nocibé, Sephora, Marionnaud. Nous suivons les baisses de prix pour vous. Seulement les vrais deals.
              </p>
              
              <div className="flex items-center gap-6">
                 <Link
                  href="/deals"
                  className="px-8 py-4 bg-white text-black text-sm font-bold tracking-widest uppercase hover:bg-neutral-200 transition-colors"
                >
                  Voir les Offres
                </Link>
                <Link
                  href="/categories"
                  className="text-sm font-medium tracking-widest uppercase text-white hover:text-[#d4a855] transition-colors border-b border-white/20 pb-1"
                >
                  Parcourir
                </Link>
              </div>
            </div>

          </div>

          {/* Stats - Refined */}
          <div className="flex items-center gap-12 mt-24">
            <div className="space-y-1">
              <p className="text-4xl font-light text-white">{stats.deals}</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#9b1515]">Deals Actifs</p>
            </div>
            <div className="w-px h-12 bg-white/10" />
            <div className="space-y-1">
               <p className="text-4xl font-light text-white">{stats.products}</p>
               <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Produits Suivis</p>
            </div>
            <div className="hidden sm:block w-px h-12 bg-white/10" />
            <div className="hidden sm:block space-y-1">
               <p className="text-4xl font-light text-white">{stats.merchants}</p>
               <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Partenaires</p>
            </div>
             {stats.dealsToday > 0 && (
              <>
                <div className="hidden lg:block w-px h-12 bg-white/10" />
                 <div className="hidden lg:block space-y-1">
                   <p className="text-4xl font-light text-[#d4a855]">+{stats.dealsToday}</p>
                   <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Ajoutés Aujourd&apos;hui</p>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Top Marques - Logo Band */}
      {topBrands.length > 0 && (
        <section className="relative z-10 py-24 border-b border-white/5 bg-gradient-to-b from-[#0a0a0a] to-transparent">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <p className="text-xs text-center text-neutral-500 mb-6 tracking-widest uppercase">
              On traque les plus grandes marques
            </p>
            <div className="flex flex-wrap justify-center items-center gap-x-8 gap-y-4 md:gap-x-12">
              {topBrands.map((brand) => (
                <Link
                  key={brand.id}
                  href={`/deals?search=${encodeURIComponent(brand.name)}`}
                  className="group"
                >
                  {brand.logoUrl ? (
                    <Image
                      src={brand.logoUrl}
                      alt={brand.name}
                      width={80}
                      height={32}
                      className="h-6 md:h-8 w-auto object-contain opacity-40 grayscale group-hover:opacity-100 group-hover:grayscale-0 transition-all duration-300"
                    />
                  ) : (
                    <span className="text-sm md:text-base font-light text-neutral-600 group-hover:text-[#d4a855] transition-colors tracking-wider uppercase">
                      {brand.name}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Categories - Dark Grid */}
      <section className="relative z-10 py-16 md:py-24 bg-transparent">
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

      {/* Featured Picks - Carousel */}
      <section className="relative z-10 py-16 md:py-24 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-12">
            <div>
              <div className="flex items-center gap-4 mb-4">
                <span className="h-px w-8 bg-[#9b1515]" />
                <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-[#9b1515]">
                  Tendances
                </span>
              </div>
              <h2 className="text-4xl md:text-5xl font-thin text-white tracking-tight leading-none">
                LA SÉLECTION <span className="italic font-normal text-white">VIRALE</span>
              </h2>
            </div>
            <Link
              href="/deals"
              className="hidden md:flex items-center gap-4 text-xs font-bold tracking-widest uppercase text-neutral-400 hover:text-white transition-colors group"
            >
              Voir la Collection
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>

          {hotDeals.length > 0 ? (
            <DealCarouselSection deals={hotDeals as any} autoPlayInterval={4500} />
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

      {/* Luxe Accessible Section - Carousel */}
      {luxeDeals.length > 0 && (
        <section className="relative z-10 py-16 md:py-24 bg-gradient-to-b from-transparent to-black/50 overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-end justify-between mb-12">
              <div>
                <div className="flex items-center gap-4 mb-4">
                  <span className="h-px w-8 bg-[#d4a855]" />
                  <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-[#d4a855]">
                    Haut de Gamme
                  </span>
                </div>
                <h2 className="text-4xl md:text-5xl font-thin text-white tracking-tight leading-none">
                  ARCHIVES <span className="italic font-normal text-[#d4a855]">DE LUXE</span>
                </h2>
                <p className="text-sm tracking-wide text-neutral-400 mt-6 max-w-sm border-l border-white/20 pl-6 leading-relaxed">
                  Maisons iconiques. Réductions rares. Sélectionné pour les initiés.
                </p>
              </div>
              <Link
                href="/deals?tier=1"
                className="hidden md:flex items-center gap-4 text-xs font-bold tracking-widest uppercase text-[#d4a855] hover:text-white transition-colors group"
              >
                Accéder aux Archives
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>

            <DealCarouselSection deals={luxeDeals as any} autoPlayInterval={5000} />

            {/* Mobile CTA */}
            <div className="mt-8 text-center md:hidden">
              <Link
                href="/deals?tier=1"
                className="inline-flex items-center gap-2 text-sm font-medium text-[#d4a855]"
              >
                Voir tous les deals luxe
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Derniers Deals Ajoutés - Carousel */}
      {latestDeals.length > 0 && (
        <section className="relative z-10 py-16 md:py-24 bg-transparent overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-end justify-between mb-12">
              <div>
                <div className="flex items-center gap-4 mb-4">
                  <span className="h-px w-8 bg-neutral-600" />
                  <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-neutral-400">
                    Nouveautés
                  </span>
                </div>
                <h2 className="text-4xl md:text-5xl font-thin text-white tracking-tight leading-none">
                  DERNIERS <span className="italic font-normal text-white">AJOUTS</span>
                </h2>
                <p className="text-sm tracking-wide text-neutral-400 mt-6 max-w-sm border-l border-white/20 pl-6 leading-relaxed">
                  Baisses de prix détectées en temps réel par nos algorithmes.
                </p>
              </div>
              <Link
                href="/deals?sort=newest"
                className="hidden md:flex items-center gap-4 text-xs font-bold tracking-widest uppercase text-neutral-400 hover:text-white transition-colors group"
              >
                Voir les Nouveautés
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>

            <DealCarouselSection deals={latestDeals as any} autoPlayInterval={3500} />

            {/* Mobile CTA */}
            <div className="mt-8 text-center md:hidden">
              <Link
                href="/deals?sort=newest"
                className="inline-flex items-center gap-2 text-sm font-medium text-neutral-400"
              >
                Voir les nouveautés
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      )}



      {/* About Section - Le Concept (Redesigned) */}
      <section className="relative z-10 py-32 bg-transparent">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Section Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-24 pb-8 border-b border-white/10">
            <h2 className="text-4xl md:text-6xl font-extralight text-white tracking-tight">
              LE <span className="font-semibold text-[#d4a855]">CONCEPT</span>
            </h2>
            <div className="mt-4 md:mt-0 text-right">
              <p className="text-xs font-medium tracking-[0.3em] uppercase text-neutral-500">
                 Tracking Beauté Exclusif
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-24">
            
            {/* Left Column: Manifesto */}
            <div className="lg:col-span-5 space-y-12">
              <div>
                <span className="text-[#9b1515] text-xs font-bold tracking-widest uppercase mb-4 block">01 — Le Problème</span>
                <h3 className="text-2xl font-light text-white mb-6 leading-tight">
                  La beauté de luxe ne devrait pas coûter un loyer.
                </h3>
                <p className="text-neutral-400 text-lg font-light leading-relaxed">
                  On connaît le problème. Vous voulez le meilleur pour votre routine — Dior, Chanel, YSL — mais les prix sont impitoyables. Le marché est inondé de fausses promos, de ventes flash éphémères et de bruit constant.
                </p>
              </div>

              <div>
                <span className="text-[#9b1515] text-xs font-bold tracking-widest uppercase mb-4 block">02 — La Solution</span>
                <p className="text-neutral-400 text-lg font-light leading-relaxed">
                  Nous avons construit un moteur sophistiqué qui scanne sans relâche les revendeurs premium. Nous éliminons le marketing pour ne révéler que les vraies baisses de prix. <span className="text-white">Données pures, pour les passionnés.</span>
                </p>
              </div>
            </div>

            {/* Right Column: Features & Sources */}
            <div className="lg:col-span-7">
              <div className="space-y-px bg-white/10 border-y border-white/10">
                
                {/* Feature 1 */}
                <div className="group relative bg-[#0a0a0a] p-8 md:p-10 hover:bg-[#0f0f0f] transition-colors duration-500">
                  <div className="flex flex-col md:flex-row md:items-start gap-6">
                    <span className="text-2xl font-light text-neutral-600 group-hover:text-[#d4a855] transition-colors">01</span>
                    <div>
                      <h4 className="text-lg font-medium text-white mb-2 uppercase tracking-wide">Curation Algorithmique</h4>
                      <p className="text-neutral-500 font-light leading-relaxed">
                        Nos robots surveillent des milliers de produits chez Sephora, Nocibé et autres 24/7. Seules les réductions de 20%+ sont retenues. Pas de remplissage.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Feature 2 */}
                <div className="group relative bg-[#0a0a0a] p-8 md:p-10 hover:bg-[#0f0f0f] transition-colors duration-500">
                  <div className="flex flex-col md:flex-row md:items-start gap-6">
                    <span className="text-2xl font-light text-neutral-600 group-hover:text-[#d4a855] transition-colors">02</span>
                    <div>
                      <h4 className="text-lg font-medium text-white mb-2 uppercase tracking-wide">Vérification Historique</h4>
                      <p className="text-neutral-500 font-light leading-relaxed">
                        Nous suivons l&apos;historique pour exposer les fausses promotions. Quand on dit que c&apos;est un deal, c&apos;est mathématiquement vrai.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Sources */}
                <div className="group relative bg-[#0a0a0a] p-8 md:p-10 hover:bg-[#0f0f0f] transition-colors duration-500">
                  <div className="flex flex-col md:flex-row md:items-start gap-6">
                    <span className="text-2xl font-light text-neutral-600 group-hover:text-[#d4a855] transition-colors">03</span>
                    <div className="w-full">
                      <h4 className="text-lg font-medium text-white mb-6 uppercase tracking-wide">Sources Élite</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <p className="text-white font-medium border-l-2 border-[#d4a855] pl-4">Nocibé</p>
                          <p className="text-sm text-neutral-500 pl-4.5">Partenaire Officiel • 1200+ Réfs</p>
                        </div>
                        <div className="space-y-2">
                          <p className="text-white font-medium border-l-2 border-neutral-700 pl-4">Sephora</p>
                          <p className="text-sm text-neutral-500 pl-4.5">Leader Mondial • Marques Exclusives</p>
                        </div>
                        <div className="space-y-2 opacity-50">
                          <p className="text-neutral-400 border-l-2 border-transparent pl-4">Marionnaud</p>
                          <p className="text-sm text-neutral-600 pl-4.5">Intégration...</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* Footer Statement */}
          <div className="mt-24 pt-12 border-t border-white/5 text-center">
            <p className="max-w-xl mx-auto text-xl md:text-2xl font-light italic text-neutral-400">
              "On a créé ça parce qu&apos;on en avait marre de payer trop cher pour l&apos;essentiel. <span className="text-white not-italic font-normal">Bienvenue dans le cercle.</span>"
            </p>
          </div>
        </div>
      </section>

      {/* Newsletter - Club Privé */}
      <NewsletterSection />
    </div>
  );
}
