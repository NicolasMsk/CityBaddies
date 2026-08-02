import prisma from '@/lib/prisma';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { ArrowRight, Star } from 'lucide-react';
import DealCard from '@/components/deals/DealCard';
import { Deal } from '@/types';

// ISR : page mise en cache et régénérée toutes les 900s (compteurs de deals).
// Le force-dynamic historique imposait des requêtes DB à CHAQUE visite (TTFB/CWV).
export const revalidate = 900;
// generateStaticParams vide = opt-in ISR à la demande (Next 16) :
// sans lui, la route resterait 100% dynamique malgré revalidate.
export async function generateStaticParams() {
  return [];
}

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://citybaddies.com';

// Mapping des images personnalisées par slug
// Les images doivent être placées dans public/images/categories/
const CATEGORY_IMAGES: Record<string, string> = {
  'parfums': '/images/categories/header-parfums.png',
};

// Descriptions SEO enrichies par catégorie
const CATEGORY_CONTENT: Record<string, {
  heroTitle: string;
  heroDescription: string;
  seoDescription: string;
  keywords: string[];
  tips: string[];
  richContent: {
    intro: string;
    sections: { title: string; content: string }[];
    faq: { question: string; answer: string }[];
  };
}> = {
  'parfums': {
    heroTitle: 'Parfums — Comparateur de Prix entre Sephora, Nocibé & Marionnaud',
    heroDescription: 'Comparez les prix de vos parfums préférés. Eau de parfum, eau de toilette, coffrets — trouvez le meilleur prix sur les fragrances iconiques.',
    seoDescription: 'Comparateur prix parfums : Chanel, Dior, YSL, Guerlain, Lancôme. Comparez Sephora, Nocibé, Marionnaud, My-Origines et Notino. Historique des prix, vraies promos démasquées.',
    keywords: ['parfum femme pas cher', 'comparateur prix parfum', 'eau de parfum promo', 'parfum homme moins cher', 'coffret parfum promo', 'parfum niche pas cher', 'historique prix parfum', 'meilleur prix sephora nocibé marionnaud'],
    tips: [
      'Ne jetez pas vos flacons vides : Sephora et Nocibé offrent -20% sur votre prochain parfum si vous rapportez un flacon vide (même d\'une autre marque).',
      'Les "Testers" sont un mythe en ligne, mais les coffrets sont la réalité. Un coffret (Parfum + Lait Corps) coûte souvent le même prix, voire moins cher, que le parfum seul.',
      'Eau de Parfum vs Toilette : Calculez le prix au "pschitt". Une Eau de Parfum tient 8h, une Eau de Toilette 4h. L\'EDP est souvent plus économique à l\'usage.',
    ],
    richContent: {
      intro: 'Le parfum est l\'accessoire invisible le plus puissant. City Baddies compare les prix entre Sephora, Nocibé, Marionnaud, My-Origines et Notino pour vous aider à trouver le meilleur prix sur vos fragrances préférées. Des classiques indémodables (Chanel N°5, J\'adore Dior) aux nouveautés désirables (Libre YSL, Good Girl Carolina Herrera), découvrez où acheter au meilleur prix.',
      sections: [
        { title: 'Eau de Toilette, Eau de Parfum, Parfum : quelles différences ?', content: 'La concentration en huiles essentielles détermine la tenue et le prix. Eau de Toilette (5-15%) : légère, 3-4h de tenue, idéale pour le quotidien. Eau de Parfum (15-20%) : plus intense, 6-8h, le meilleur rapport qualité-prix. Parfum/Extrait (20-40%) : très concentré, tenue maximale, luxe absolu. Calculez le prix par heure de tenue pour comparer objectivement.' },
        { title: 'Les coffrets : la stratégie gagnante', content: 'Les coffrets parfum (flacon + lait corps + miniature voyage) sont vendus au même prix, voire moins cher, que le flacon seul à Noël et pour la Fête des Mères. C\'est le meilleur moment pour acheter. Le lait corps assorti prolonge la tenue du parfum et renforce le sillage.' },
        { title: 'Parfumerie niche : le luxe accessible en promo', content: 'Les maisons niches (Maison Francis Kurkdjian, Byredo, Diptyque, Jo Malone) sont rarement soldées. Exception : les coffrets découverte et les ventes privées exclusives. City Baddies surveille ces opportunités rares pour vous. Alternative : les dupes de qualité (Dossier, Zara Emotions) offrent des expériences similaires à prix mini.' }
      ],
      faq: [
        { question: 'Comment faire durer son parfum plus longtemps ?', answer: 'Appliquez sur peau hydratée (après une crème ou huile non parfumée). Ciblez les points de chaleur : poignets, cou, derrière les oreilles, plis des coudes. Ne frottez pas vos poignets, cela "casse" les molécules. Vaporisez aussi dans les cheveux (pas directement, sur la brosse).' },
        { question: 'Un parfum peut-il tourner ou périmer ?', answer: 'Oui. Conservez vos parfums à l\'abri de la lumière et de la chaleur (pas dans la salle de bain). Un parfum bien conservé dure 3-5 ans. Les notes de tête (agrumes) s\'évaporent en premier. Si l\'odeur change ou devient vinaigrée, il est temps de le remplacer.' },
        { question: 'Où acheter des parfums moins cher ?', answer: 'Comparez les prix entre Sephora, Nocibé, Marionnaud, My-Origines et Notino sur City Baddies. Les meilleures périodes : ventes privées, soldes d\'hiver (janvier) et d\'été (juillet), Black Friday, et l\'offre "flacon vide" (-20%). Évitez les sites douteux promettant -70% : risque élevé de contrefaçons.' }
      ]
    }
  },
};

// Génération des métadonnées dynamiques
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const category = await prisma.category.findUnique({
    where: { slug },
  });

  if (!category) {
    return {
      title: 'Catégorie non trouvée',
      robots: { index: false, follow: false },
    };
  }

  // Catégorie sans aucun deal actif (ex: non-parfum aujourd'hui) → noindex.
  // + on récupère la VRAIE remise max (fini le « -70% » codé en dur, potentiellement
  // faux → risque de superlatif non fondé pénalisant en SEO/GEO).
  const topDeal = await prisma.deal.findFirst({
    where: { status: 'ACTIVE', discountPercent: { gt: 0 }, product: { categoryId: category.id } },
    orderBy: { discountPercent: 'desc' },
    select: { discountPercent: true },
  });
  if (!topDeal) {
    return {
      title: `${category.name} | City Baddies`,
      robots: { index: false, follow: false },
    };
  }
  const maxDisc = topDeal.discountPercent;

  const content = CATEGORY_CONTENT[slug] || {
    seoDescription: `Comparez les prix ${category.name.toLowerCase()} entre Sephora, Nocibé, Marionnaud, My-Origines et Notino${maxDisc > 0 ? `, jusqu'à -${maxDisc}% en ce moment` : ''}.`,
    keywords: [`${category.name} pas cher`, `${category.name} promo`],
  };

  return {
    title: maxDisc >= 10 ? `${category.name} : prix comparés, jusqu'à -${maxDisc}% | City Baddies` : `${category.name} : prix comparés | City Baddies`,
    description: content.seoDescription,
    keywords: content.keywords,
    alternates: {
      canonical: `${BASE_URL}/categories/${slug}`,
    },
    openGraph: {
      title: `Deals ${category.name} | City Baddies`,
      description: content.seoDescription,
      url: `${BASE_URL}/categories/${slug}`,
      type: 'website',
    },
  };
}

// Récupérer les deals de la catégorie
async function getCategoryDeals(slug: string) {
  const category = await prisma.category.findUnique({
    where: { slug },
  });

  if (!category) return null;

  // Récupérer les deals de cette catégorie
  const rawDeals = await (prisma.deal as any).findMany({
    where: {
      status: 'ACTIVE',
      discountPercent: { gt: 0 }, // liste "bons plans" = promos réelles (variantes non-promo exclues)
      product: {
        categoryId: category.id,
      },
    },
    distinct: ['productId'],
    include: {
      merchant: true,
      product: {
        include: {
          brandRef: true,
          category: true,
          images: { orderBy: { position: 'asc' }, take: 5 },
        },
      },
    },
    orderBy: {
      score: 'desc',
    },
  });

  // Transformer les données pour correspondre au type Deal
  const deals: Deal[] = rawDeals.map((d: any) => ({
    id: d.id,
    product: {
      id: d.product.id,
      name: d.product.name,
      slug: d.product.slug,
      brand: d.product.brandRef?.name || d.product.brand,
      category: d.product.category,
      currentPrice: d.dealPrice,
      images: d.product.images?.map((img: any) => ({
        id: img.id,
        url: img.url,
        alt: img.alt,
        type: img.type,
        position: img.position,
      })) || [],
    },
    merchant: d.merchant,
    imageUrl: d.imageUrl,
    productUrl: d.productUrl,
    title: d.title || d.product.name,
    refinedTitle: d.refinedTitle,
    dealPrice: d.dealPrice,
    originalPrice: d.originalPrice,
    discountPercent: d.discountPercent,
    discountAmount: d.originalPrice - d.dealPrice,
    volume: d.volume,
    volumeValue: d.volumeValue,
    volumeUnit: d.volumeUnit,
    pricePerUnit: d.pricePerUnit,
    score: d.score,
    tags: d.tags,
    promoCode: d.promoCode,
    priceConditions: d.priceConditions,
    startDate: d.startDate?.toISOString() || new Date().toISOString(),
    endDate: d.endDate?.toISOString(),
    isHot: d.isHot || false,
    status: d.status,
    votes: d.votes || 0,
    views: d.views || 0,
    createdAt: d.createdAt?.toISOString() || new Date().toISOString(),
  }));

  // Date du relevé le plus récent (fraîcheur en clair — les IA privilégient le daté).
  const freshest = rawDeals
    .map((d: any) => d.lastSeenAt as Date | null)
    .filter((d: Date | null): d is Date => !!d)
    .sort((a: Date, b: Date) => b.getTime() - a.getTime())[0] ?? null;

  return { category, deals, freshest };
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getCategoryDeals(slug);

  // 404 si catégorie inexistante OU sans deal actif (pages vides/expirées non indexées).
  if (!data || data.deals.length === 0) {
    notFound();
  }

  const { category, deals, freshest } = data;
  const topDeals = deals.slice(0, 6);
  const content = CATEGORY_CONTENT[slug];
  const headerImage = CATEGORY_IMAGES[slug];

  // Compter les deals actifs
  const totalDeals = deals.length;
  // Vraie remise max + date de relevé (fini le « -70% » codé en dur).
  const maxDiscount = deals.reduce((m, d) => Math.max(m, d.discountPercent ?? 0), 0);
  const freshLabel = freshest
    ? new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(freshest)
    : null;

  // ItemList (Product + Offer) des meilleures offres — citable par les IA.
  const itemListSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Meilleures offres ${category.name}`,
    numberOfItems: topDeals.length,
    itemListElement: topDeals.map((d, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Product',
        name: d.product.brand && !d.product.name.toLowerCase().startsWith(String(d.product.brand).toLowerCase())
          ? `${d.product.brand} ${d.product.name}` : d.product.name,
        // image requise Google — préférer une image accessible aux bots.
        image: (d.product.images || []).map((im: { url: string }) => im.url).find((u: string) => /nocibe\.|my-origines|notinoimg|demandware/i.test(u)) || d.product.images?.[0]?.url,
        url: `${BASE_URL}/produits/${d.product.slug}`,
        offers: {
          '@type': 'Offer',
          price: d.dealPrice,
          priceCurrency: 'EUR',
          availability: 'https://schema.org/InStock',
          seller: { '@type': 'Organization', name: d.merchant?.name },
        },
      },
    })),
  };

  // FAQPage : reflète la FAQ visible plus bas (richContent.faq) — schema natif
  // dans le HTML initial pour crawlers sans JS.
  const faqSchema = content?.richContent?.faq && content.richContent.faq.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: content.richContent.faq.map((f: { question: string; answer: string }) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  } : null;

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'Catégories', item: `${BASE_URL}/categories` },
      { '@type': 'ListItem', position: 3, name: category.name, item: `${BASE_URL}/categories/${slug}` },
    ],
  };

  return (
    <div className="min-h-screen pb-16">
      {faqSchema && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema).replace(/</g, '\\u003c') }} />
      )}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema).replace(/</g, '\\u003c') }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema).replace(/</g, '\\u003c') }} />
      
      {/* Hero Section Immersive */}
      <div className="relative mb-20">
        {/* Background Image Header - Ratio adapté aux images 1526x1024 (≈3:2) */}
        <div className="absolute left-0 right-0 top-0 w-full aspect-[3/2] max-h-[85vh] overflow-hidden">
          {/* Gradient Overlay moins agressif pour mieux voir l'image */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-[#0a0a0a] z-10" />
          
          {headerImage ? (
            <Image
              src={headerImage}
              alt={content?.heroTitle || category.name}
              fill
              priority
              sizes="100vw"
              className="object-cover object-[center_25%]"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-neutral-800 to-neutral-900" />
          )}
        </div>

        {/* Hero Content - Positionné en bas de l'image */}
        <div className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col justify-end aspect-[3/2] max-h-[85vh] pb-24">
          <div className="max-w-3xl">
            <div className="flex items-center gap-3 text-[#d4a855] mb-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <span className="w-8 h-[1px] bg-[#d4a855] shadow-[0_0_10px_#d4a855]"></span>
              <span className="text-xs font-bold uppercase tracking-[0.2em] drop-shadow-md bg-black/20 backdrop-blur-sm px-2 py-1 rounded">{category.name}</span>
            </div>
            
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-4 tracking-tight leading-tight animate-in fade-in slide-in-from-bottom-5 duration-700 delay-100 drop-shadow-xl">
              {content?.heroTitle || `Deals ${category.name}`}
            </h1>
            
            <p className="text-lg md:text-xl text-white max-w-2xl font-light leading-relaxed animate-in fade-in slide-in-from-bottom-6 duration-700 delay-200 drop-shadow-lg shadow-black">
              {content?.heroDescription || `Découvrez les meilleures promotions ${category.name} du moment.`}
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-2 text-white/90 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-300 bg-black/30 backdrop-blur-md w-fit px-4 py-2 rounded-full border border-white/10">
               <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.8)]"></span>
               <span className="text-sm font-medium">
                 {totalDeals} offres vérifiées{maxDiscount >= 10 ? `, jusqu'à -${maxDiscount}%` : ''}
                 {freshLabel ? ` · relevé le ${freshLabel}` : ''}
               </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-12 relative z-30">
        {/* Top Deals Section */}
        {topDeals.length > 0 && (
          <section className="mb-20">
            <div className="flex items-end justify-between mb-8 border-b border-white/5 pb-4">
              <h2 className="text-3xl font-light text-white">
                Top Deals
              </h2>
              <Link 
                href={`/produits?category=${slug}&sortBy=discountPercent`}
                className="text-white hover:text-bordeaux-400 transition-colors flex items-center gap-2 text-sm font-medium uppercase tracking-wider"
              >
                Voir tout
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
              {topDeals.map((deal) => (
                <DealCard key={deal.id} deal={deal} />
              ))}
            </div>
          </section>
        )}

        {/* Tips Section */}
        {content?.tips && content.tips.length > 0 && (
          <section className="mb-20 bg-[#1a1a1a]/50 p-8 md:p-12">
            <h2 className="text-2xl font-light text-white mb-8 border-l-2 border-bordeaux-500 pl-4">
              Conseils d'expert
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
              {content.tips.map((tip, index) => (
                <div key={index} className="space-y-3">
                  <span className="text-bordeaux-500 font-serif italic text-4xl opacity-50">0{index + 1}</span>
                  <p className="text-slate-300 text-sm leading-relaxed font-light">{tip}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* CTA Section */}
        <section className="text-center py-24 border-t border-white/5">
          <h2 className="text-3xl font-light text-white mb-6">
            Plus de deals {category.name}
          </h2>
          <p className="text-slate-400 mb-10 max-w-2xl mx-auto font-light leading-relaxed">
            Nous comparons quotidiennement les offres de Sephora, Nocibé, Marionnaud, My-Origines et Notino pour vous garantir les meilleurs prix sur vos produits {category.name.toLowerCase()} favoris.
          </p>
          <Link
            href={`/produits?category=${slug}&sortBy=discountPercent`}
            className="inline-flex items-center gap-3 px-8 py-3 bg-white text-black text-sm font-bold uppercase tracking-wider hover:bg-slate-200 transition-colors"
          >
            Voir les {totalDeals} offres
            <ArrowRight className="h-4 w-4" />
          </Link>
        </section>

        {/* Rich Content SEO */}
        {content?.richContent && (
          <section className="mt-24 mb-20">
            
            {/* Header Section Guide */}
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 border-b border-white/5 pb-6 gap-6">
              <div>
                <span className="text-[#d4a855] text-sm uppercase tracking-widest font-medium mb-2 block">
                  Guide d'achat
                </span>
                <h2 className="text-3xl md:text-4xl font-serif text-white">
                  Acheter {category.name} moins cher
                </h2>
              </div>
              <p className="text-slate-400 text-sm max-w-md text-right hidden md:block">
                Nos experts analysent le marché quotidiennement pour vous dénicher les meilleures offres.
              </p>
            </div>

            <div className="grid lg:grid-cols-[1.5fr_1fr] gap-16 mb-20">
              {/* Main Content Column */}
              <div className="space-y-12">
                {/* Intro Block */}
                <div className="prose prose-invert max-w-none">
                  <p className="text-xl text-slate-200 leading-relaxed font-light mb-8 border-l-2 border-[#d4a855] pl-6 italic">
                    City Baddies compare chaque jour les prix des produits {category.name.toLowerCase()} chez les principales enseignes beauté françaises. 
                    Notre équipe déniche les meilleures promotions et sélectionne le meilleur rapport qualité-prix.
                  </p>
                  <div className="text-slate-300 leading-relaxed font-light space-y-6">
                    {content.richContent.intro.split('\n\n').map((paragraph, index) => (
                      <p key={index}>{paragraph}</p>
                    ))}
                    <p>
                      Les deals sont mis à jour en temps réel. Inscrivez-vous à notre newsletter pour ne manquer aucune offre exclusive.
                    </p>
                  </div>
                </div>

                {/* Article Image or Highlight could go here */}
              </div>

              {/* Side Column / Additional Info */}
              <div className="space-y-8">
                <div className="bg-[#1a1a1a] p-8 border border-white/5 sticky top-24">
                  <h3 className="text-lg font-medium text-white mb-6 flex items-center gap-3">
                    <Star className="w-5 h-5 text-[#d4a855]" />
                    Points clés
                  </h3>
                  <ul className="space-y-4">
                    {content.richContent.sections.map((section, idx) => (
                       <li key={idx} className="text-slate-400 text-sm pb-4 border-b border-white/5 last:border-0">
                         <strong className="block text-slate-200 mb-1">{section.title}</strong>
                         <span className="line-clamp-2">{section.content}</span>
                       </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Detailed Sections Grid */}
            <div className="grid md:grid-cols-2 gap-8 mb-24">
              {content.richContent.sections.map((section, index) => (
                <div key={index} className="bg-gradient-to-br from-[#111] to-black border border-white/10 p-8 hover:border-[#d4a855]/30 transition-colors group">
                  <h3 className="text-xl font-serif text-[#d4a855] mb-4 group-hover:text-[#e5bf75] transition-colors">
                    {section.title}
                  </h3>
                  <div className="w-12 h-[1px] bg-white/10 mb-6 group-hover:w-24 group-hover:bg-[#d4a855]/50 transition-all duration-500"></div>
                  <p className="text-slate-400 leading-relaxed font-light text-sm md:text-base">
                    {section.content}
                  </p>
                </div>
              ))}
            </div>

            {/* FAQ */}
            <div className="mt-16">
              <div className="text-center mb-12">
                <h2 className="text-2xl md:text-3xl font-light text-white mb-2 tracking-tight">
                  QUESTIONS <span className="font-semibold text-[#d4a855]">FRÉQUENTES</span>
                </h2>
                <p className="text-neutral-500 text-sm tracking-widest uppercase">Tout savoir sur {category.name}</p>
              </div>

              <div className="space-y-4 max-w-3xl mx-auto">
                {content.richContent.faq.map((item, index) => (
                  <div key={index} className="group border border-white/10 bg-white/5 rounded-none overflow-hidden transition-all hover:bg-white/10">
                    <details className="group [&_summary::-webkit-details-marker]:hidden">
                      <summary className="flex items-center justify-between p-6 cursor-pointer text-white">
                        <span className="text-lg font-light tracking-wide">{item.question}</span>
                        <span className="text-[#d4a855] text-2xl font-light transition-transform duration-300 group-open:rotate-45">+</span>
                      </summary>
                      <div className="px-6 pb-6 text-neutral-400 font-light leading-relaxed border-t border-white/5 pt-4">
                        {item.answer}
                      </div>
                    </details>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Removed old hardcoded SEO Text section since it is now integrated above */}

      </div>
    </div>
  );
}
