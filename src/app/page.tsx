import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Sparkles, Star, Crown, TrendingDown, Clock } from 'lucide-react';
import prisma from '@/lib/prisma';
import DealCard from '@/components/deals/DealCard';
import CategoryCard from '@/components/categories/CategoryCard';
import DealCarouselSection from '@/components/deals/DealCarouselSection';
import NewsletterSection from '@/components/layout/NewsletterSection';
import { getAllPromoPages, stripHtml } from '@/lib/promo-queries';
import JsonLd from '@/components/seo/JsonLd';
import type { Metadata } from 'next';

// Force dynamic - pas de pré-rendu au build
// ISR : page mise en cache et régénérée toutes les 600s (prix relevés ~6x/jour).
// Le force-dynamic historique imposait des requêtes DB à CHAQUE visite (TTFB/CWV).
export const revalidate = 600;

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://citybaddies.com';

// Positionnement assumé : parfums FEMME uniquement (stratégie mono-catégorie,
// cohérente avec la marque) — le title/desc portent la requête « parfum femme ».
export const metadata: Metadata = {
  title: "City Baddies | Comparateur Prix Parfum Femme — Sephora, Nocibé, Marionnaud",
  description: "Comparez les prix de vos parfums femme préférés entre Sephora, Nocibé et Marionnaud. Historique des prix, vraies promos démasquées et fausses réductions exposées. Eau de parfum, eau de toilette et coffrets.",
  keywords: [
    "comparateur prix parfum",
    "parfum femme pas cher",
    "prix parfum femme",
    "promo parfum sephora",
    "parfum nocibé promo",
    "parfum marionnaud soldes",
    "eau de parfum prix",
    "eau de toilette promo",
    "historique prix parfum",
  ],
  alternates: {
    canonical: BASE_URL,
  },
  openGraph: {
    title: "City Baddies Parfums | Comparateur Prix Parfums en France",
    description: "Comparez les prix de vos parfums entre Sephora, Nocibé et Marionnaud. Vraies promos vs fausses réductions.",
    url: BASE_URL,
    type: "website",
  },
};

async function getHomeData() {
  // Récupérer les catégories avec le compte de produits
  const categoriesWithProducts = await prisma.category.findMany({
    include: {
      _count: {
        // Ne compter que les produits ayant AU MOINS un deal ACTIVE : les
        // catégories sans offre active (non-parfum aujourd'hui) tombent à 0 et
        // sont filtrées plus bas → le site n'affiche QUE les parfums.
        select: { products: { where: { deals: { some: { status: 'ACTIVE' } } } } },
      },
    },
  });

  // Filtrer les catégories sans produits
  const categories = categoriesWithProducts
    .map((cat: any) => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      imageUrl: cat.imageUrl,
      _count: { products: cat._count.products },
    }))
    .filter((cat: any) => cat._count.products > 0)
    .sort((a: any, b: any) => b._count.products - a._count.products);

  // Date d'aujourd'hui (début de journée)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Récupération séquentielle pour éviter les doublons entre sections
  // 1. D'abord les hotDeals (Sélection Virale)
  const hotDeals = await prisma.deal.findMany({
    where: {
      status: 'ACTIVE',
      discountPercent: { gt: 0 }, // fil "bons plans" = vraies promos uniquement (les variantes non-promo ont discount 0)
    },
    distinct: ['productId'],
    include: {
      merchant: true,
      product: {
        include: {
          category: true,
          images: { orderBy: { position: 'asc' }, take: 5 },
        },
      },
    },
    orderBy: [
      { discountPercent: 'desc' },
      { score: 'desc' },
    ],
    take: 8,
  });
  
  const hotDealIds = hotDeals.map(d => d.id);
  
  // 2. Ensuite les luxeDeals (Archives de Luxe) - en excluant les hotDeals
  const luxeDeals = await prisma.deal.findMany({
    where: {
      status: 'ACTIVE',
      discountPercent: { gt: 0 },
      brandTier: 1,
      id: { notIn: hotDealIds },
    },
    distinct: ['productId'],
    include: {
      merchant: true,
      product: {
        include: {
          category: true,
          images: { orderBy: { position: 'asc' }, take: 5 },
        },
      },
    },
    orderBy: [
      { discountPercent: 'desc' },
      { score: 'desc' },
    ],
    take: 8,
  });
  
  const luxeDealIds = luxeDeals.map(d => d.id);
  const excludedIds = [...hotDealIds, ...luxeDealIds];
  
  // 3. Derniers deals (Derniers Ajouts) - en excluant hotDeals ET luxeDeals
  const latestDeals = await (async () => {
    // Récupérer tous les marchands actifs
    const merchants = await prisma.merchant.findMany({
      where: {
        deals: {
          some: {
            status: 'ACTIVE',
            discountPercent: { gt: 0 },
            id: { notIn: excludedIds },
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
            status: 'ACTIVE',
            discountPercent: { gt: 0 },
            merchantId: merchant.id,
            id: { notIn: excludedIds },
          },
          distinct: ['productId'],
          include: {
            merchant: true,
            product: {
              include: {
                category: true,
                images: { orderBy: { position: 'asc' }, take: 5 },
              },
            },
          },
          orderBy: [
            { discountPercent: 'desc' },
            { createdAt: 'desc' },
          ],
          take: dealsPerMerchant,
        })
      )
    );
    
    // Mélanger en alternance (round-robin) + dédupliquer par productId
    const mixedDeals: any[] = [];
    const seenProductIds = new Set<string>();
    const maxLength = Math.max(...dealsByMerchant.map(d => d.length));
    
    for (let i = 0; i < maxLength; i++) {
      for (const merchantDeals of dealsByMerchant) {
        const deal = merchantDeals[i];
        if (deal && mixedDeals.length < totalDeals && !seenProductIds.has(deal.productId)) {
          seenProductIds.add(deal.productId);
          mixedDeals.push(deal);
        }
      }
    }
    
    return mixedDeals;
  })();

  const [stats, variantsToday, topBrands] = await Promise.all([
    // Stats globales
    Promise.all([
      prisma.productVariant.count(),
      prisma.product.count(),
      prisma.merchant.count(),
    ]),
    // Variantes ajoutées aujourd'hui
    prisma.productVariant.count({
      where: {
        createdAt: { gte: today },
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
                status: 'ACTIVE',
              },
            },
          },
        },
      },
      take: 12,
      orderBy: { name: 'asc' },
    }),
  ]);

  // Codes promo pages pour la section homepage
  const promoPages = await getAllPromoPages();

  // Guides d'achat publiés
  const guides = await prisma.buyingGuide.findMany({
    where: { status: 'PUBLISHED' },
    include: {
      products: {
        include: {
          deal: {
            include: {
              product: { include: { brandRef: true } },
            },
          },
        },
        orderBy: { rank: 'asc' },
        take: 3,
      },
    },
    orderBy: { publishedAt: 'desc' },
    take: 6,
  });

  return {
    hotDeals,
    luxeDeals,
    latestDeals,
    categories,
    topBrands,
    promoPages,
    guides,
    stats: {
      variants: stats[0],
      products: stats[1],
      merchants: stats[2],
      variantsToday,
    },
  };
}

// FAQ affichée sur la home — source unique pour le rendu ET le schema FAQPage
// (Google exige que le schema reflète le contenu visible).
const HOME_FAQ = [
  {
    q: "C'est quoi la Note City Baddies /10 ?",
    a: "Chaque offre est analysée en profondeur : prix actuel, historique des prix, comparaison avec les concurrents, qualité de la marque. On attribue une note de 1 à 10. Un 8+/10, c'est exceptionnel. Un 3/10, c'est une fausse promo qu'on démasque pour vous."
  },
  {
    q: "Vous ne montrez pas que des bonnes promos ?",
    a: "Non, et c'est notre force. On affiche TOUTES les offres qu'on trouve, même les mauvaises. Un produit affiché -30% mais dont le prix n'a jamais bougé ? On le dit. Un concurrent moins cher ? On le signale. Notre but c'est l'honnêteté, pas la vente à tout prix."
  },
  {
    q: "Est-ce que je commande chez vous ?",
    a: "Non, City Baddies est un comparateur et analyste indépendant. On vous redirige vers le site officiel du marchand (Sephora, Nocibé, Marionnaud) pour acheter en toute sécurité. Vous profitez de leurs garanties et SAV."
  },
  {
    q: "Pourquoi City Baddies est gratuit ?",
    a: "L'accès est 100% gratuit. On se rémunère par l'affiliation : une petite commission quand vous achetez via nos liens, sans surcoût pour vous. Ça ne change rien à nos notes — une mauvaise offre reste une mauvaise offre, même si elle nous rapporterait une commission."
  },
  {
    q: "Comment détectez-vous les fausses promos ?",
    a: "On suit l'historique des prix sur plusieurs mois. Si un produit est 'en promo' mais que son prix n'a jamais changé, c'est une fausse promo. On compare aussi avec les concurrents : si Nocibé vend le même produit moins cher sans promo, l'offre Sephora n'en est pas une."
  }
];

const homeFaqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: HOME_FAQ.map(item => ({
    '@type': 'Question',
    name: item.q,
    acceptedAnswer: { '@type': 'Answer', text: item.a },
  })),
};

export default async function HomePage() {
  const { hotDeals, luxeDeals, latestDeals, categories, topBrands, promoPages, guides, stats } = await getHomeData();

  return (
    <div className="min-h-screen bg-[#0a0a0a] relative selection:bg-[#d4a855] selection:text-black">
      {/* FAQPage : reflète la FAQ visible en bas de page (source unique HOME_FAQ) */}
      <JsonLd id="home-faq-schema" data={homeFaqSchema} />
      {/* Background Base - Subtle Studio Gradient */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_0%,_#1a1a1a_0%,_#0a0a0a_80%)] z-0 pointer-events-none" />
      
      {/* Ambient Color Glows - Refined for elegance (No image required) */}
      <div className="fixed top-[-10%] left-[-10%] w-[40vw] h-[40vw] bg-[#9b1515] opacity-[0.08] blur-[100px] rounded-full pointer-events-none z-0" />
      <div className="fixed bottom-[10%] right-[-5%] w-[30vw] h-[30vw] bg-[#d4a855] opacity-[0.05] blur-[120px] rounded-full pointer-events-none z-0" />
      <div className="fixed top-[40%] right-[-10%] w-[30vw] h-[30vw] bg-[#7b0a0a] opacity-[0.06] blur-[120px] rounded-full pointer-events-none z-0" />

      {/* Hero Section - Premium Magazine Redesign */}
      {/* min-h-screen (pas h-screen) : le titre didone est haut, h-screen + justify-end
          tronquait le haut sur petits écrans. On garantit la hauteur d'écran ET la place. */}
      <section className="relative min-h-screen flex flex-col justify-end pt-28 pb-0 overflow-hidden">

        {/* Background Image */}
        <div className="absolute inset-0 z-0">
           {/* LCP de la home : quality 80 suffit largement pour une photo de fond
               assombrie par le dégradé — quality 100 doublait le poids pour rien. */}
           <Image
            src="/images/hero-bg-premium.png" // User requested baddies image
            alt="City Baddies Squad"
            fill
            sizes="100vw"
            className="object-cover object-top"
            priority
            quality={80}
          />
           {/* Sophisticated Gradient - Dark at bottom for text readability */}
           <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/40 to-transparent via-50%" />
        </div>

        {/* Content Container */}
        <div className="relative z-10 w-full max-w-[1400px] mx-auto px-6 pb-12 lg:pb-16 flex flex-col md:flex-row items-end justify-between gap-12">
          
          {/* Main Text Block */}
          <div className="max-w-3xl animate-in fade-in slide-in-from-bottom-10 duration-1000">
            <div className="flex items-center gap-3 mb-6">
              <span className="h-[1px] w-12 bg-[#d4a855]"></span>
              <span className="text-[#d4a855] text-xs font-bold tracking-[0.2em] uppercase">
                Comparateur Prix Parfums
              </span>
            </div>

            <h1 className="text-6xl md:text-8xl lg:text-9xl font-serif text-white leading-[0.85] tracking-tight mb-8">
              <span className="block italic font-light opacity-90">Ton Parfum.</span>
              <span className="block font-medium">Meilleur Prix.</span>
            </h1>

            <p className="text-xl md:text-2xl text-neutral-300 font-light max-w-xl border-l border-white/20 pl-6 mb-10">
              Pas les fausses promos. <span className="text-white/60 text-base block mt-2">On compare chaque parfum entre Sephora, Nocibé et Marionnaud. Historique des prix, vraies réductions — on te dit la vérité.</span>
            </p>

            <div className="flex flex-wrap items-center gap-4">
               <Link
                href="/produits"
                className="group relative px-8 py-4 bg-white text-black overflow-hidden"
              >
                <div className="absolute inset-0 w-3 bg-[#d4a855] transition-all duration-[250ms] ease-out group-hover:w-full opacity-10"></div>
                <span className="relative text-sm font-bold tracking-widest uppercase flex items-center gap-2">
                  Voir les Offres <ArrowRight className="w-4 h-4" />
                </span>
              </Link>
              {/* /marques est l'axe de navigation réel (34 pages) — /categories n'a
                  qu'une seule carte tant que le site est 100% parfums */}
              <Link
                href="/marques"
                className="px-8 py-4 border border-white/20 text-white hover:bg-white/5 text-sm font-bold tracking-widest uppercase transition-colors"
              >
                Par marque
              </Link>
            </div>
          </div>

        </div>

        {/* Provenance — la donnée réelle comme preuve, avec les vrais chiffres du jour */}
        <div className="relative z-10 w-full border-t border-white/10 bg-black/30">
          <div className="max-w-[1400px] mx-auto px-6 py-3">
            <p className="font-mono text-[11px] md:text-xs text-neutral-400 tracking-wide">
              Prix relevés six fois par jour chez {stats.merchants > 0 ? `${stats.merchants} enseignes — Sephora, Nocibé et Marionnaud` : 'Sephora, Nocibé et Marionnaud'} : {stats.products} parfums, {stats.variants} contenances suivies{stats.variantsToday > 0 ? `, ${stats.variantsToday} relevés aujourd'hui` : ''} — avec historique.
            </p>
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
                  // Page marque dédiée (édito + prix temps réel) — bien meilleur
                  // maillage interne qu'une URL de recherche.
                  href={`/marques/${brand.slug}`}
                  className="group"
                >
                  {brand.logoUrl ? (
                    <Image
                      src={brand.logoUrl}
                      alt={brand.name}
                      width={80}
                      height={32}
                      // brightness-0 invert : les wordmarks (noirs/transparents) deviennent
                      // des silhouettes blanches — lisibles sur fond sombre, rendu couture.
                      // Exception 'kenzo' (boîte rouge) : affiché tel quel.
                      className={`h-6 md:h-8 w-auto object-contain opacity-50 group-hover:opacity-100 transition-all duration-300 ${
                        brand.slug === 'kenzo' ? '' : 'brightness-0 invert'
                      }`}
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
              href="/produits"
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
              <p className="text-neutral-500">Pas de produits pour l&apos;instant, reviens vite !</p>
            </div>
          )}

          {/* Mobile CTA */}
          <div className="mt-8 text-center md:hidden">
            <Link
              href="/produits"
              className="inline-flex items-center gap-2 text-sm font-medium text-neutral-400"
            >
              Voir toutes les offres
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
                href="/produits?tier=1"
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
                href="/produits?tier=1"
                className="inline-flex items-center gap-2 text-sm font-medium text-[#d4a855]"
              >
                Voir les produits luxe
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
                  Nouveaux produits analysés et notés chaque jour. On te dit si ça vaut le coup — ou pas.
                </p>
              </div>
              <Link
                href="/produits?sortBy=createdAt"
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
                href="/produits?sortBy=createdAt"
                className="inline-flex items-center gap-2 text-sm font-medium text-neutral-400"
              >
                Voir les nouveautés
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      )}



      {/* ══════════════════════════════════════════════════════════ */}
      {/* SECTION CODES PROMO — SEO optimized                       */}
      {/* ══════════════════════════════════════════════════════════ */}
      {promoPages.length > 0 && (
        <section className="relative z-10 py-16 md:py-24 border-t border-white/5">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-end justify-between mb-12">
              <div>
                <div className="flex items-center gap-4 mb-4">
                  <span className="h-px w-8 bg-[#d4a855]" />
                  <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-[#d4a855]">
                    Codes Promo
                  </span>
                </div>
                <h2 className="text-4xl md:text-5xl font-thin text-white tracking-tight leading-none">
                  CODES <span className="italic font-normal text-[#d4a855]">PROMO</span>
                </h2>
                <p className="text-sm tracking-wide text-neutral-400 mt-6 max-w-md border-l border-white/20 pl-6 leading-relaxed">
                  Codes promo vérifiés et testés. Économise sur ton parfum chez Sephora, Nocibé et Marionnaud.
                </p>
              </div>
              <Link
                href="/codes-promo"
                className="hidden md:flex items-center gap-4 text-xs font-bold tracking-widest uppercase text-[#d4a855] hover:text-white transition-colors group"
              >
                Tous les codes
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {promoPages.map((page) => {
                const codeCount = page.merchant?._count?.promoCodes ?? 0;
                const intro = page.introduction ? stripHtml(page.introduction).substring(0, 120) + '…' : null;
                const logoUrl = page.merchant?.logoUrl;
                const merchantName = page.merchant?.name || page.canonicalSlug;

                return (
                  <Link
                    key={page.id}
                    href={`/codes-promo/${page.canonicalSlug}`}
                    className="group relative bg-white/[0.02] border border-white/5 hover:border-[#d4a855]/30 hover:bg-white/[0.04] transition-all duration-300 overflow-hidden"
                  >
                    <div className="p-6 md:p-8">
                      {/* Header with logo */}
                      <div className="flex items-start justify-between mb-5">
                        <div className="flex items-center gap-3">
                          {logoUrl && (
                            <div className="w-10 h-10 bg-white rounded-sm flex items-center justify-center p-1.5 shrink-0">
                              <Image
                                src={logoUrl}
                                alt={merchantName}
                                width={32}
                                height={32}
                                className="w-full h-full object-contain"
                              />
                            </div>
                          )}
                          <div>
                            <h3 className="text-base font-medium text-white group-hover:text-[#d4a855] transition-colors">
                              {merchantName}
                            </h3>
                            {codeCount > 0 && (
                              <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-neutral-500">
                                {codeCount} code{codeCount > 1 ? 's' : ''} actif{codeCount > 1 ? 's' : ''}
                              </p>
                            )}
                          </div>
                        </div>
                        {page.bestCurrentDiscount && (
                          <span className="text-2xl font-serif text-[#d4a855] opacity-80">
                            -{page.bestCurrentDiscount}%
                          </span>
                        )}
                      </div>

                      {/* Stats row */}
                      <div className="flex items-center gap-4 mb-4">
                        {page.bestCurrentDiscount && (
                          <span className="text-[10px] font-bold tracking-[0.1em] uppercase text-emerald-500 border border-emerald-500/20 px-2 py-0.5">
                            Jusqu&apos;à -{page.bestCurrentDiscount}%
                          </span>
                        )}
                        <span className="text-[10px] font-bold tracking-[0.1em] uppercase text-neutral-600">
                          Vérifié
                        </span>
                      </div>

                      {/* Description preview */}
                      {intro && (
                        <p className="text-xs text-neutral-500 font-light leading-relaxed line-clamp-2 mb-4">
                          {intro}
                        </p>
                      )}

                      {/* CTA */}
                      <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-neutral-400 group-hover:text-[#d4a855] transition-colors flex items-center gap-2">
                        Voir les codes
                        <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                      </span>
                    </div>

                    {/* Bottom accent line */}
                    <div className="h-[2px] w-0 group-hover:w-full bg-gradient-to-r from-[#d4a855] to-[#9b1515] transition-all duration-500" />
                  </Link>
                );
              })}
            </div>

            {/* Mobile CTA */}
            <div className="mt-8 text-center md:hidden">
              <Link
                href="/codes-promo"
                className="inline-flex items-center gap-2 text-sm font-medium text-[#d4a855]"
              >
                Tous les codes promo
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* SECTION GUIDES D'ACHAT — Dynamic from DB                 */}
      {/* ══════════════════════════════════════════════════════════ */}
      {guides.length > 0 && (
        <section className="relative z-10 py-16 md:py-24 border-t border-white/5">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-end justify-between mb-12">
              <div>
                <div className="flex items-center gap-4 mb-4">
                  <span className="h-px w-8 bg-[#9b1515]" />
                  <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-[#9b1515]">
                    Expertise
                  </span>
                </div>
                <h2 className="text-4xl md:text-5xl font-thin text-white tracking-tight leading-none">
                  GUIDES <span className="italic font-normal text-white">D&apos;ACHAT</span>
                </h2>
                <p className="text-sm tracking-wide text-neutral-400 mt-6 max-w-md border-l border-white/20 pl-6 leading-relaxed">
                  On t&apos;aide à choisir ton parfum selon tes goûts, l&apos;occasion et ton budget — avec les vrais prix en face.
                </p>
              </div>
              <Link
                href="/guides"
                className="hidden md:flex items-center gap-4 text-xs font-bold tracking-widest uppercase text-neutral-400 hover:text-white transition-colors group"
              >
                Tous les guides
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>

            <div className={`grid gap-4 ${
              guides.length === 1
                ? 'max-w-lg mx-auto'
                : guides.length === 2
                  ? 'md:grid-cols-2 max-w-4xl mx-auto'
                  : 'md:grid-cols-2 lg:grid-cols-3'
            }`}>
              {guides.map((guide, i) => {
                const categoryStyles: Record<string, string> = {
                  'maquillage': 'text-pink-400',
                  'soins-visage': 'text-violet-400',
                  'soins-corps': 'text-amber-400',
                  'cheveux': 'text-emerald-400',
                  'parfums': 'text-indigo-400',
                  'ongles': 'text-rose-400',
                  'accessoires': 'text-cyan-400',
                };
                const catColor = categoryStyles[guide.category ?? ''] || 'text-[#d4a855]';
                const catLabel = (guide.category ?? 'beauté').replace(/-/g, ' ');

                return (
                  <Link
                    key={guide.id}
                    href={`/guides/${guide.slug}`}
                    className="group relative bg-white/[0.02] border border-white/5 hover:border-white/10 hover:bg-white/[0.04] transition-all duration-300 overflow-hidden"
                  >
                    {/* Hero image if available */}
                    {guide.heroImageUrl && (
                      <div className="relative aspect-[16/9] w-full overflow-hidden">
                        <Image
                          src={guide.heroImageUrl}
                          alt={guide.title}
                          fill
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                          unoptimized
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-transparent" />
                      </div>
                    )}

                    <div className="p-6 md:p-8">
                      {/* Category */}
                      <div className="flex items-center justify-between mb-4">
                        <span className={`text-[10px] font-bold tracking-[0.2em] uppercase ${catColor}`}>
                          {catLabel}
                        </span>
                        {guide.tags && guide.tags.length > 0 && (
                          <span className="text-[10px] tracking-[0.1em] uppercase text-neutral-600">
                            {guide.tags[0]}
                          </span>
                        )}
                      </div>

                      {/* Number watermark */}
                      <span className="text-5xl font-serif text-white/[0.03] block mb-3 leading-none group-hover:text-[#d4a855]/10 transition-colors">
                        0{i + 1}
                      </span>

                      {/* Title */}
                      <h3 className="text-lg font-light text-white mb-2 group-hover:text-[#d4a855] transition-colors leading-tight">
                        {guide.title}
                      </h3>
                      {guide.introduction && (
                        <p className="text-xs text-neutral-500 font-light leading-relaxed mb-4 line-clamp-2">
                          {guide.introduction.replace(/<[^>]*>/g, '').slice(0, 120)}…
                        </p>
                      )}

                      {/* Product thumbnails + CTA */}
                      <div className="flex items-center justify-between">
                        {guide.products && guide.products.length > 0 ? (
                          <div className="flex -space-x-2">
                            {guide.products.map((gp: any) => (
                              <div
                                key={gp.id || gp.dealId}
                                className="w-7 h-7 rounded-full border-2 border-[#0a0a0a] bg-neutral-800 overflow-hidden"
                              >
                                {gp.deal?.imageUrl ? (
                                  <Image
                                    src={gp.deal.imageUrl}
                                    alt={gp.deal.product.name || ''}
                                    width={28}
                                    height={28}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full bg-neutral-700" />
                                )}
                              </div>
                            ))}
                            {guide.products.length > 0 && (
                              <span className="ml-3 text-[10px] text-neutral-500 self-center">
                                {guide.products.length} produit{guide.products.length > 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] font-bold tracking-[0.1em] uppercase text-neutral-600 border border-white/5 px-2 py-0.5">
                            Guide
                          </span>
                        )}
                        <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-neutral-500 group-hover:text-white transition-colors flex items-center gap-1">
                          Lire
                          <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                        </span>
                      </div>
                    </div>

                    {/* Bottom accent line */}
                    <div className="h-[2px] w-0 group-hover:w-full bg-gradient-to-r from-[#9b1515] to-[#d4a855] transition-all duration-500" />
                  </Link>
                );
              })}
            </div>

            {/* Mobile CTA */}
            <div className="mt-8 text-center md:hidden">
              <Link
                href="/guides"
                className="inline-flex items-center gap-2 text-sm font-medium text-neutral-400"
              >
                Voir tous les guides
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Visual Interlude - Baddies 5 */}
      <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-24 mt-12 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300">
        <div className="relative aspect-[4/5] sm:aspect-[16/8] md:aspect-[21/9] w-full overflow-hidden rounded-2xl border border-white/10 group">
           <img 
              src="/images/baddies_5.png" 
              alt="City Baddies Mood" 
              className="w-full h-full object-cover"
           />
           <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-2xl z-20 pointer-events-none" />
        </div>
      </div>

      {/* About Section - Le Concept (Redesigned) */}
      <section className="relative z-10 py-32 bg-transparent">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Section Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 pb-8 border-b border-white/10">
            <h2 className="text-4xl md:text-6xl font-serif text-white tracking-tight">
              La méthode
            </h2>
            <div className="mt-4 md:mt-0 text-right">
              <p className="text-xs font-medium tracking-[0.3em] uppercase text-neutral-500">
                 Comparateur indépendant
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 lg:gap-24">

            {/* Colonne gauche : le principe, en clair */}
            <div className="lg:col-span-5 space-y-10">
              <div>
                <h3 className="text-2xl font-light text-white mb-6 leading-tight">
                  Un prix barré ne prouve rien.<br />Un historique, si.
                </h3>
                <p className="text-neutral-400 text-lg font-light leading-relaxed">
                  « −30 % » sur un prix gonflé la veille, ce n&apos;est pas une réduction.
                  La seule façon de le savoir, c&apos;est de suivre le prix dans le temps.
                  C&apos;est exactement ce qu&apos;on fait, parfum par parfum, contenance par contenance.
                </p>
              </div>

              <div>
                <p className="text-neutral-400 text-lg font-light leading-relaxed">
                  Chaque matin (et cinq autres fois dans la journée), on relève les prix
                  affichés sur les fiches produit de Sephora, Nocibé et Marionnaud.
                  Chaque relevé est daté et archivé. Tu vois le prix du jour, celui d&apos;hier,
                  et la courbe complète.
                </p>
              </div>
            </div>

            {/* Colonne droite : ce que tu obtiens, concrètement */}
            <div className="lg:col-span-7">
              <div className="space-y-px bg-white/10 border-y border-white/10">

                <div className="bg-[#0a0a0a] p-8 md:p-10">
                  <h4 className="text-lg font-medium text-white mb-2">Le même flacon, trois prix</h4>
                  <p className="text-neutral-500 font-light leading-relaxed">
                    Un parfum, toutes ses contenances, et pour chacune le prix constaté chez
                    chaque enseigne — avec le prix au millilitre pour comparer ce qui est comparable.
                    Le 100&nbsp;ml peut coûter 40&nbsp;€ de moins d&apos;une boutique à l&apos;autre : on te montre où.
                  </p>
                </div>

                <div className="bg-[#0a0a0a] p-8 md:p-10">
                  <h4 className="text-lg font-medium text-white mb-2">Des relevés datés, pas des promesses</h4>
                  <p className="text-neutral-500 font-light leading-relaxed">
                    Chaque prix affiché ici vient d&apos;une fiche produit publique, relevée
                    automatiquement dans la journée. Si une « promo » affiche un prix barré
                    que le produit n&apos;a jamais coûté, ça se voit sur la courbe.
                  </p>
                </div>

                <div className="bg-[#0a0a0a] p-8 md:p-10">
                  <h4 className="text-lg font-medium text-white mb-6">Trois enseignes suivies</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <div className="space-y-1 border-l-2 border-[#d4a855] pl-4">
                      <p className="text-white font-medium">Sephora</p>
                      <p className="text-sm text-neutral-500">sephora.fr</p>
                    </div>
                    <div className="space-y-1 border-l-2 border-[#d4a855] pl-4">
                      <p className="text-white font-medium">Nocibé</p>
                      <p className="text-sm text-neutral-500">nocibe.fr</p>
                    </div>
                    <div className="space-y-1 border-l-2 border-[#d4a855] pl-4">
                      <p className="text-white font-medium">Marionnaud</p>
                      <p className="text-sm text-neutral-500">marionnaud.fr</p>
                    </div>
                  </div>
                  <p className="text-sm text-neutral-600 font-light mt-6">
                    City Baddies est indépendant des trois enseignes. Les prix sont ceux
                    affichés publiquement sur leurs sites au moment du relevé.
                  </p>
                </div>

              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Visual Interlude 2 - Baddies 2 */}
      <div className="relative w-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mb-0 mt-32">
        {/* Ratio ajusté pour mobile (4/5 portrait) et desktop (2/1 paysage) */}
        <div className="relative aspect-[4/5] sm:aspect-[16/9] md:aspect-[2/1] w-full overflow-hidden rounded-2xl border border-white/5">
           <img 
              src="/images/baddies_2.png" 
              alt="Community Mood" 
              className="w-full h-full object-cover"
           />
        </div>
      </div>

      {/* FAQ Section */}
      <section className="relative z-10 py-24 border-t border-transparent bg-[#0a0a0a] -mt-32">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 relative z-20">
          <div className="text-center mb-16 bg-[#0a0a0a]/80 backdrop-blur-md py-8 rounded-2xl border border-white/5 inline-block w-full shadow-2xl">
            <h2 className="text-3xl md:text-4xl font-light text-white mb-4 tracking-tight">
              QUESTIONS <span className="font-semibold text-[#d4a855]">FRÉQUENTES</span>
            </h2>
            <p className="text-neutral-500 text-sm tracking-widest uppercase">Tout ce que tu dois savoir</p>
          </div>

          <div className="space-y-4">
            {HOME_FAQ.map((item, i) => (
              <div key={i} className="group border border-white/10 bg-white/5 rounded-none overflow-hidden transition-all hover:bg-white/10">
                <details className="group [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex items-center justify-between p-6 cursor-pointer text-white">
                    <span className="text-lg font-light tracking-wide">{item.q}</span>
                    <span className="text-[#d4a855] text-2xl font-light transition-transform duration-300 group-open:rotate-45">+</span>
                  </summary>
                  <div className="px-6 pb-6 text-neutral-400 font-light leading-relaxed border-t border-white/5 pt-4">
                    {item.a}
                  </div>
                </details>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter - Club Privé */}
      <NewsletterSection />
    </div>
  );
}
