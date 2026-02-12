import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import prisma from '@/lib/prisma';
import type { Metadata } from 'next';
import Script from 'next/script';

// Force dynamic - pas de pré-rendu au build
export const dynamic = 'force-dynamic';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://citybaddies.com';

import PriceChart from '@/components/deals/PriceChart';
import DealCard from '@/components/deals/DealCard';
import DealFeedback from '@/components/deals/DealFeedback';
import CommentSection from '@/components/comments/CommentSection';
import DealImage from '@/components/deals/DealImage';
import ScoreGauge from '@/components/deals/ScoreGauge';
import { ArrowLeft, ArrowRight, ExternalLink, Store, Tag, Flame, Clock, BadgeCheck, Sparkles, Beaker, ScrollText, CheckCircle2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

// Génération dynamique des métadonnées SEO
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  
  const deal = await prisma.deal.findUnique({
    where: { id },
    include: {
      product: {
        include: {
          category: true,
          merchant: true,
        },
      },
    },
  });

  // Deal non trouvé
  if (!deal) {
    return {
      title: "Deal non trouvé",
      description: "Ce deal n'existe pas ou a expiré.",
      robots: { index: false, follow: false },
    };
  }

  // Les deals actifs ET expirés sont indexables (SEO : garder les pages vivantes)
  // Seuls les PENDING ne doivent pas être indexés
  const shouldIndex = deal.status === 'ACTIVE' || deal.status === 'EXPIRED';

  const productName = deal.refinedTitle || deal.title;
  const brandName = deal.product.brand || '';
  const categoryName = deal.product.category?.name || 'Beauté';
  const merchantName = deal.product.merchant?.name || '';
  const discountText = deal.discountPercent > 0 ? `-${deal.discountPercent}%` : '';

  const title = `${productName} ${discountText} | ${brandName}`.trim();
  const description = `${productName} à ${deal.dealPrice.toFixed(2)}€ au lieu de ${deal.originalPrice.toFixed(2)}€ ${discountText}. ${categoryName} ${brandName} chez ${merchantName}. Deal vérifié sur City Baddies.`;

  return {
    title,
    description,
    robots: shouldIndex ? { index: true, follow: true } : { index: false, follow: false },
    keywords: [
      productName,
      brandName,
      categoryName,
      `promo ${brandName}`,
      `${categoryName} pas cher`,
      merchantName,
      "deal beauté",
      "promotion cosmétique",
    ].filter(Boolean),
    alternates: {
      canonical: `${BASE_URL}/deals/${id}`,
    },
    openGraph: {
      title: `${productName} ${discountText}`,
      description,
      url: `${BASE_URL}/deals/${id}`,
      type: "website",
      images: deal.product.imageUrl ? [
        {
          url: deal.product.imageUrl,
          width: 800,
          height: 600,
          alt: productName,
        },
      ] : [],
    },
    twitter: {
      card: "summary_large_image",
      title: `${productName} ${discountText}`,
      description: `À ${deal.dealPrice.toFixed(2)}€ au lieu de ${deal.originalPrice.toFixed(2)}€`,
      images: deal.product.imageUrl ? [deal.product.imageUrl] : [],
    },
  };
}

// Quotes pour le rituel
const RITUAL_QUOTES = {
  parfum: [
    "Un sillage qui raconte votre histoire avant même que vous ne parliez.",
    "Plus qu'un parfum, une signature invisible et inoubliable.",
    "Laissez cette fragrance révéler une nouvelle facette de votre personnalité.",
    "Quelques gouttes suffisent pour transformer l'ordinaire en moment d'exception.",
    "L'élégance est la seule beauté qui ne se fane jamais, et ce parfum en est la clé."
  ],
  soin: [
    "Prenez le temps de masser ce soin. Votre peau vous remerciera.",
    "Un moment de connexion avec votre beauté naturelle, matin et soir.",
    "L'éclat n'est pas qu'une question de produit, c'est une intention.",
    "Faites de cette application un rituel de bien-être, pas une corvée.",
    "La peau est le miroir de l'âme, prenez-en soin avec douceur."
  ],
  makeup: [
    "Le maquillage n'est pas un masque, c'est un outil de puissance.",
    "Révélez votre créativité. Osez, sublimez, brillez.",
    "Une touche de couleur pour illuminer votre journée et celle des autres.",
    "L'art de se sublimer commence par un geste précis et délicat.",
    "Soyez votre propre muse, chaque jour est une nouvelle toile."
  ],
  cheveux: [
    "Vos cheveux sont votre couronne, portez-la avec fierté.",
    "Un soin profond pour redonner vie et mouvement à votre chevelure.",
    "La beauté commence par des cheveux sains et vibrants.",
    "Détendez-vous et laissez la magie opérer de la racine aux pointes."
  ],
  bain: [
    "Transformez votre salle de bain en sanctuaire de paix.",
    "Lavez les soucis de la journée et retrouvez votre sérénité.",
    "Un moment pour soi, loin du bruit du monde."
  ],
  default: [
    "Prenez le temps d'appliquer ce soin. Un moment de connexion avec votre beauté naturelle.",
    "Chaque geste de beauté est une promesse d'amour envers soi-même.",
    "La beauté réside dans les détails et l'attention que vous vous portez.",
    "Un instant pour soi, une parenthèse de douceur dans votre journée.",
    "Sublimez votre quotidien avec ce petit luxe accessible.",
    "La beauté est une lumière dans le cœur, ce produit aide juste à la faire briller."
  ]
};

function getRitualQuote(categoryName: string | undefined, dealId: string): string {
  const seed = dealId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  
  const lowerCat = (categoryName || '').toLowerCase();
  let selectedQuotes = RITUAL_QUOTES.default;

  if (lowerCat.includes('parfum') || lowerCat.includes('eau de') || lowerCat.includes('toilette') || lowerCat.includes('cologne')) {
    selectedQuotes = RITUAL_QUOTES.parfum;
  } else if (lowerCat.includes('visage') || lowerCat.includes('sérum') || lowerCat.includes('crème') || lowerCat.includes('huile') || lowerCat.includes('nettoyant') || lowerCat.includes('soin')) {
    selectedQuotes = RITUAL_QUOTES.soin;
  } else if (lowerCat.includes('maquillage') || lowerCat.includes('teint') || lowerCat.includes('rouge') || lowerCat.includes('mascara') || lowerCat.includes('poudre') || lowerCat.includes('levre') || lowerCat.includes('yeux')) {
    selectedQuotes = RITUAL_QUOTES.makeup;
  } else if (lowerCat.includes('cheveux') || lowerCat.includes('shampoing') || lowerCat.includes('masque') || lowerCat.includes('capillaire')) {
    selectedQuotes = RITUAL_QUOTES.cheveux;
  } else if (lowerCat.includes('corps') || lowerCat.includes('bain') || lowerCat.includes('douche') || lowerCat.includes('gommage')) {
    selectedQuotes = RITUAL_QUOTES.bain;
  }

  const index = seed % selectedQuotes.length;
  return selectedQuotes[index];
}

async function getDealData(id: string) {
  const deal = await prisma.deal.findUnique({
    where: { id },
    include: {
      product: {
        include: {
          category: true,
          merchant: true,
          priceHistory: {
            orderBy: { date: 'asc' },
          },
        },
      },
      competitorPrices: {
        include: {
          merchant: true,
        },
      },
    },
  });

  // Deal non trouvé = 404
  if (!deal) return null;

  // Deal PENDING = 404 (pas encore validé)
  if (deal.status === 'PENDING') return null;

  // Deal EXPIRED = on retourne les données mais on ne compte pas les vues
  if (deal.status === 'ACTIVE') {
    await prisma.deal.update({
      where: { id },
      data: { views: { increment: 1 } },
    });
  }

  // Récupérer des deals similaires avec un meilleur algorithme
  // Priorité 1: Même marque + même catégorie
  // Priorité 2: Même catégorie + gamme de prix similaire
  // Priorité 3: Même catégorie
  
  const priceRange = {
    min: deal.dealPrice * 0.5,
    max: deal.dealPrice * 1.5,
  };

  // D'abord chercher les deals de la même marque
  const sameBrandDeals = deal.product.brand ? await prisma.deal.findMany({
    where: {
      id: { not: id },
      status: 'ACTIVE',
      product: {
        brand: deal.product.brand,
      },
    },
    include: {
      product: {
        include: {
          category: true,
          merchant: true,
        },
      },
    },
    orderBy: { score: 'desc' },
    take: 3,
  }) : [];

  // Ensuite compléter avec la même catégorie + gamme de prix
  const sameCategoryDeals = await prisma.deal.findMany({
    where: {
      id: { not: id, notIn: sameBrandDeals.map(d => d.id) },
      status: 'ACTIVE',
      dealPrice: { gte: priceRange.min, lte: priceRange.max },
      product: {
        categoryId: deal.product.categoryId,
      },
    },
    include: {
      product: {
        include: {
          category: true,
          merchant: true,
        },
      },
    },
    orderBy: { score: 'desc' },
    take: 6 - sameBrandDeals.length,
  });

  // Combiner les résultats (max 6)
  const similarDeals = [...sameBrandDeals, ...sameCategoryDeals].slice(0, 6);

  // Calculer les stats de prix
  const prices = deal.product.priceHistory.map((ph: { price: number }) => ph.price);
  const priceStats = {
    current: deal.dealPrice, // Prix actuel = dans le Deal, pas Product
    lowest: Math.min(...prices),
    highest: Math.max(...prices),
    average: prices.reduce((a: number, b: number) => a + b, 0) / prices.length,
  };

  return { deal, similarDeals, priceStats };
}

export default async function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getDealData(id);

  if (!data) {
    notFound();
  }

  const { deal, similarDeals, priceStats } = data;
  const isExpired = deal.status === 'EXPIRED';
  
  // Sélection de la citation rituel
  const ritualQuote = getRitualQuote(deal.product.category?.name, deal.id);

  const timeAgo = formatDistanceToNow(new Date(deal.createdAt), {
    addSuffix: true,
    locale: fr,
  });

  const verifiedAgo = formatDistanceToNow(new Date(deal.updatedAt), {
    addSuffix: false,
    locale: fr,
  });

  // Schema.org JSON-LD pour le produit (Rich Snippets)
  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: deal.refinedTitle || deal.title,
    description: deal.description || deal.product.description || `${deal.product.brand || ''} ${deal.product.category?.name || 'Beauté'} - Promotion exceptionnelle`.trim(),
    image: deal.product.imageUrl || undefined,
    brand: deal.product.brand ? {
      "@type": "Brand",
      name: deal.product.brand,
    } : undefined,
    category: deal.product.category?.name,
    sku: deal.id,
    offers: {
      "@type": "Offer",
      url: `${BASE_URL}/deals/${deal.id}`,
      priceCurrency: "EUR",
      price: deal.dealPrice,
      priceValidUntil: deal.endDate ? new Date(deal.endDate).toISOString().split('T')[0] : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      availability: deal.status === 'EXPIRED' ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: deal.product.merchant ? {
        "@type": "Organization",
        name: deal.product.merchant.name,
      } : undefined,
      priceSpecification: {
        "@type": "PriceSpecification",
        price: deal.dealPrice,
        priceCurrency: "EUR",
        valueAddedTaxIncluded: true,
      },
    },
    // Prix de référence (prix barré)
    ...(deal.originalPrice > deal.dealPrice && {
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        priceType: "https://schema.org/ListPrice",
        price: deal.originalPrice,
        priceCurrency: "EUR",
      },
    }),
  };

  // Schema BreadcrumbList pour la navigation
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Accueil",
        item: BASE_URL,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Deals",
        item: `${BASE_URL}/deals`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: deal.product.category?.name || "Catégorie",
        item: `${BASE_URL}/deals?category=${deal.product.category?.slug || ''}`,
      },
      {
        "@type": "ListItem",
        position: 4,
        name: deal.refinedTitle || deal.title,
        item: `${BASE_URL}/deals/${deal.id}`,
      },
    ],
  };

  return (
    <>
      <Script
        id="product-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
      />
      <Script
        id="breadcrumb-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <div className="min-h-screen bg-[#0a0a0a] text-white selection:bg-[#d4a855] selection:text-black">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-12">

          {/* ============================================================ */}
          {/* EXPIRED DEAL BANNER                                          */}
          {/* ============================================================ */}
          {isExpired && (
            <div className="mb-16">
              {/* Expired Notice — Bold & Unmissable */}
              <div className="relative overflow-hidden border-l-4 border-[#9b1515] bg-[#0d0d0d] p-8 md:p-12">
                {/* Background Texture */}
                <div className="absolute inset-0 bg-gradient-to-br from-[#9b1515]/8 via-transparent to-transparent pointer-events-none" />
                <div className="absolute top-0 right-0 w-64 h-64 bg-[#9b1515]/5 blur-[100px] pointer-events-none" />
                
                {/* Top Bar — Status Indicator */}
                <div className="relative z-10 flex items-center gap-3 mb-6 pb-6 border-b border-white/5">
                  <div className="h-3 w-3 rounded-full bg-[#9b1515] animate-pulse shadow-[0_0_12px_rgba(155,21,21,0.5)]" />
                  <span className="text-xs font-black tracking-[0.3em] uppercase text-[#9b1515]">Offre Expirée</span>
                  <span className="text-[10px] tracking-widest text-neutral-600 ml-auto uppercase hidden md:block">Cette promotion n'est plus active</span>
                </div>

                <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center gap-8">
                  {/* Product Image Thumbnail */}
                  {deal.product.imageUrl && (
                    <div className="relative w-20 h-20 md:w-28 md:h-28 bg-white/5 overflow-hidden shrink-0">
                      <Image
                        src={deal.product.imageUrl}
                        alt={deal.product.name}
                        fill
                        className="object-contain p-2 grayscale opacity-50"
                        sizes="112px"
                      />
                      {/* Diagonal Strike */}
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-[140%] h-px bg-[#9b1515]/60 rotate-45" />
                      </div>
                    </div>
                  )}

                  <div className="flex-1">
                    <h2 className="text-xl md:text-2xl font-black text-white/80 tracking-tight mb-2 line-through decoration-[#9b1515]/40 decoration-2">
                      {deal.refinedTitle || deal.title}
                    </h2>
                    <p className="text-sm text-neutral-400 leading-relaxed max-w-2xl">
                      Le deal <span className="text-white/70 font-medium">{deal.product.brand}</span> à <span className="text-white/70 font-medium">{deal.dealPrice.toFixed(2)}€</span> au lieu de {deal.originalPrice.toFixed(2)}€ n&apos;est plus disponible.
                      Découvrez nos alternatives actives ci-dessous.
                    </p>
                  </div>

                  <div className="shrink-0 flex flex-col gap-3">
                    <Link
                      href={deal.product.brand ? `/deals?brand=${encodeURIComponent(deal.product.brand)}` : '/deals'}
                      className="inline-flex items-center gap-3 px-6 py-3 bg-white text-black text-[10px] font-black tracking-[0.15em] uppercase hover:bg-[#d4a855] transition-colors duration-300"
                    >
                      Offres {deal.product.brand || 'similaires'}
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                    <Link
                      href="/deals"
                      className="inline-flex items-center justify-center gap-3 px-6 py-3 border border-white/10 text-white/50 text-[10px] font-bold tracking-[0.15em] uppercase hover:text-white hover:border-white/30 transition-all duration-300"
                    >
                      Tous les deals
                    </Link>
                  </div>
                </div>
              </div>

              {/* Active Alternatives */}
              {similarDeals.length > 0 && (
                <div className="mt-12">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="h-px flex-1 bg-white/5" />
                    <h3 className="text-[10px] font-black tracking-[0.3em] uppercase text-neutral-500">Alternatives Disponibles</h3>
                    <div className="h-px flex-1 bg-white/5" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {similarDeals.map((similarDeal: any) => (
                      <DealCard key={similarDeal.id} deal={similarDeal} />
                    ))}
                  </div>
                </div>
              )}

              {/* Browse All CTA */}
              <div className="mt-12 text-center">
                <Link
                  href="/deals"
                  className="inline-flex items-center gap-3 text-[10px] font-black tracking-[0.2em] uppercase text-neutral-500 hover:text-white transition-colors"
                >
                  Explorer tous les deals actifs
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          )}
          
          {/* Breadcrumb Navigation */}
          <nav aria-label="Fil d'Ariane" className="mb-8">
            <ol className="flex items-center gap-2 text-[10px] font-medium tracking-[0.15em] uppercase">
              <li>
                <Link href="/" className="text-neutral-500 hover:text-white transition-colors">
                  Accueil
                </Link>
              </li>
              <li className="text-neutral-600">/</li>
              <li>
                <Link href="/deals" className="text-neutral-500 hover:text-white transition-colors">
                  Deals
                </Link>
              </li>
              <li className="text-neutral-600">/</li>
              <li>
                <Link 
                  href={`/categories/${deal.product.category?.slug || ''}`} 
                  className="text-neutral-500 hover:text-white transition-colors"
                >
                  {deal.product.category?.name || 'Catégorie'}
                </Link>
              </li>
              {deal.product.brand && (
                <>
                  <li className="text-neutral-600">/</li>
                  <li>
                    <Link 
                      href={`/deals?brand=${encodeURIComponent(deal.product.brand)}`} 
                      className="text-[#d4a855] hover:text-white transition-colors"
                    >
                      {deal.product.brand}
                    </Link>
                  </li>
                </>
              )}
            </ol>
          </nav>

          {/* Back Link - Editorial Style */}
          <Link
            href="/deals"
            className="group inline-flex items-center gap-4 text-[10px] font-bold tracking-[0.3em] uppercase text-neutral-500 hover:text-white transition-colors mb-12"
          >
          <ArrowLeft className="h-3 w-3 group-hover:-translate-x-1 transition-transform" />
          Retour à la collection
        </Link>

        <div className="grid lg:grid-cols-12 gap-12 lg:gap-24">
          
          {/* Left Column: Image (5 cols) */}
          <div className="lg:col-span-5 relative">
            <div className="sticky top-12">
              <DealImage
                imageUrl={deal.product.imageUrl}
                productName={deal.product.name}
                discountPercent={deal.discountPercent}
                isExpired={isExpired}
              />
              
              {/* Share Actions - Minimal */}
              <div className="mt-6 flex justify-between items-center border-t border-white/10 pt-6">
                 <p className="text-[10px] uppercase tracking-[0.2em] text-neutral-500">Partager ce deal</p>
                 <div className="flex gap-4">
                    <button className="text-white/40 hover:text-white transition-colors uppercase text-[10px] tracking-widest">Lien</button>
                    <button className="text-white/40 hover:text-white transition-colors uppercase text-[10px] tracking-widest">X / Twitter</button>
                 </div>
              </div>
            </div>
          </div>

          {/* Right Column: Details (7 cols) */}
          <div className="lg:col-span-7 flex flex-col">
            
            {/* Header Info */}
            <div className="mb-12 border-b border-white/10 pb-12">
              <div className="flex flex-wrap items-center gap-6 mb-8 text-[10px] font-bold tracking-[0.2em] uppercase text-neutral-500">
                <span className="text-[#d4a855]">{deal.product.brand || 'Marque Inconnue'}</span>
                <span className="w-px h-3 bg-white/20" />
                <span>{deal.product.category.name}</span>
                <span className="w-px h-3 bg-white/20" />
                <span>Vérifié il y a {timeAgo}</span>
              </div>

              <h1 className="text-2xl md:text-4xl font-thin text-white tracking-tight leading-none mb-6">
                {deal.refinedTitle || deal.title}
              </h1>

              {deal.description && (
                <p className="text-neutral-500 font-light text-sm leading-relaxed max-w-2xl mt-4">
                  {deal.description}
                </p>
              )}

              {deal.tags && (
                <div className="flex flex-wrap gap-2 mt-6">
                  {deal.tags.split(',').map((tag: string) => (
                    <span key={tag} className="px-3 py-1 bg-white/5 border border-white/10 text-[9px] tracking-[0.15em] uppercase text-neutral-400 rounded-full">
                      {tag.trim()}
                    </span>
                  ))}
                </div>
              )}

              {/* City Baddies Score */}
              {deal.score && deal.score >= 1 && (
                <div className="mt-8 pt-6 border-t border-white/5">
                  <ScoreGauge score={deal.score} variant="full" />
                </div>
              )}
            </div>

            {/* Price Section - Editorial Typography */}
            <div className={`mb-12 ${isExpired ? 'opacity-50' : ''}`}>
                {isExpired && (
                  <div className="mb-4 text-[10px] font-black tracking-[0.3em] uppercase text-[#9b1515]">
                    Prix constaté lors de la promotion
                  </div>
                )}
                <div className="flex items-baseline gap-6 mb-4">
                  <span className="text-4xl md:text-5xl font-light text-white tracking-tighter">
                    {deal.dealPrice.toFixed(2)}€
                  </span>
                  <div className="flex flex-col items-start">
                    <span className="text-lg text-neutral-600 line-through decoration-1">
                      {deal.originalPrice.toFixed(2)}€
                    </span>
                    <span className="text-[#9b1515] text-sm font-bold tracking-[0.2em] uppercase mt-2 block">
                      ÉCONOMIE : {deal.discountAmount.toFixed(2)}€
                    </span>
                  </div>
                </div>
                
                {deal.promoCode && (
                  <div className="flex items-center gap-4 py-4 border-y border-white/10 my-6">
                     <span className="text-[10px] uppercase tracking-[0.2em] text-neutral-500">Code Promo</span>
                     <code className="text-[#d4a855] font-mono text-lg">{deal.promoCode}</code>
                     <button
                        onClick={() => navigator.clipboard.writeText(deal.promoCode!)} 
                        className="ml-auto text-xs underline text-neutral-400 hover:text-white"
                      >
                        COPIER
                     </button>
                  </div>
                )}
            </div>

            {/* Merchant Access */}
            <div className="flex items-center gap-6 mb-16">
               {isExpired ? (
                 <a
                    href={deal.product.productUrl}
                    target="_blank"
                    rel="nofollow sponsored noopener noreferrer"
                    className="flex-1 h-14 flex items-center justify-center gap-3 bg-[#1a1a1a] border border-white/10 text-neutral-400 text-[10px] font-bold tracking-[0.2em] uppercase hover:bg-white/5 hover:text-white transition-all duration-300"
                  >
                    <Store className="h-3.5 w-3.5" />
                    VOIR CHEZ {deal.product.merchant.name.toUpperCase()}
                    <span className="text-[8px] tracking-[0.15em] text-[#9b1515] font-black ml-1">· SANS PROMO</span>
                  </a>
               ) : (
                 <a
                    href={deal.product.productUrl}
                    target="_blank"
                    rel="nofollow sponsored noopener noreferrer"
                    className="flex-1 bg-white text-black h-14 flex items-center justify-center gap-3 text-xs font-bold tracking-[0.2em] uppercase hover:bg-neutral-200 transition-colors"
                  >
                    <Store className="h-4 w-4" />
                    ACHETER CHEZ {deal.product.merchant.name.toUpperCase()}
                  </a>
               )}
                <DealFeedback 
                  dealId={deal.id} 
                  initialViews={deal.views} 
                  initialVotes={deal.votes} 
                />
            </div>

            {/* Additional Sections */}
            <div className="space-y-16">

              {/* Why Good Deal - IA Analysis - Editorial Style - Ultra Clean */}
              {deal.whyGoodDeal && (
                <div className="relative border-l-2 border-[#d4a855] pl-8 py-2">
                   <h3 className="text-[10px] font-bold tracking-[0.4em] uppercase text-[#d4a855] mb-4 transform translate-y-1">
                      L'Avis L'Expert
                   </h3>
                   <div className="text-sm md:text-base font-light text-neutral-200 leading-relaxed text-justify">
                      <p>{deal.whyGoodDeal}</p>
                   </div>
                </div>
              )}


              {/* Price Comparison - All Merchants */}
              {(() => {
                // Fonction pour extraire le volume numérique d'une string (ex: "250 ml" -> 250)
                const extractVolumeValue = (vol: string | null | undefined): number | null => {
                  if (!vol) return null;
                  const match = vol.match(/(\d+(?:[.,]\d+)?)\s*(ml|g|l|kg)/i);
                  if (!match) return null;
                  let value = parseFloat(match[1].replace(',', '.'));
                  const unit = match[2].toLowerCase();
                  // Convertir en ml/g de base
                  if (unit === 'l') value *= 1000;
                  if (unit === 'kg') value *= 1000;
                  return value;
                };

                // Calculer le prix par unité
                const calculatePricePerUnit = (price: number, volume: string | null | undefined): number | null => {
                  const vol = extractVolumeValue(volume);
                  if (!vol || vol === 0) return null;
                  return price / vol;
                };

                const currentPricePerUnit = calculatePricePerUnit(deal.dealPrice, deal.volume);

                const rawPrices = [
                  {
                    id: 'current-deal',
                    merchantName: deal.product.merchant.name,
                    merchantSlug: deal.product.merchant.slug,
                    currentPrice: deal.dealPrice,
                    originalPrice: deal.originalPrice,
                    productUrl: deal.product.productUrl,
                    volume: deal.volume,
                    pricePerUnit: currentPricePerUnit,
                    isCurrent: true,
                  },
                  ...(deal.competitorPrices || []).map((cp: any) => ({
                    id: cp.id,
                    merchantName: cp.merchantName || cp.merchant?.name,
                    merchantSlug: cp.merchantSlug || cp.merchant?.slug || (cp.merchantName || cp.merchant?.name || '').toLowerCase(),
                    currentPrice: cp.currentPrice,
                    originalPrice: cp.originalPrice,
                    productUrl: cp.productUrl,
                    volume: cp.volume || deal.volume,
                    pricePerUnit: calculatePricePerUnit(cp.currentPrice, cp.volume || deal.volume),
                    isCurrent: false,
                  })),
                ].filter(p => p.pricePerUnit !== null); // Exclure ceux sans prix/unité calculable

                // Dédupliquer par marchand (garder le meilleur prix/unité)
                const dedupeMap = new Map<string, typeof rawPrices[0]>();
                for (const price of rawPrices) {
                  const key = price.merchantSlug;
                  const existing = dedupeMap.get(key);
                  if (!existing || price.isCurrent || (price.pricePerUnit && existing.pricePerUnit && price.pricePerUnit < existing.pricePerUnit)) {
                    dedupeMap.set(key, price);
                  }
                }
                
                // Trier par prix/unité (meilleur rapport qualité/prix en premier)
                const allPrices = Array.from(dedupeMap.values()).sort((a, b) => (a.pricePerUnit || 999) - (b.pricePerUnit || 999));
                const uniqueMerchantCount = new Set(allPrices.map(p => p.merchantSlug)).size;
                const cheapestPricePerUnit = allPrices[0]?.pricePerUnit;

                const getMerchantLogo = (name: string) => {
                  const slug = name.toLowerCase();
                  if (slug.includes('nocib')) return '/images/nocibe_logo.png';
                  if (slug.includes('sephora')) return '/images/sephora_logo.png';
                  if (slug.includes('marionnaud')) return '/images/logo_marrionaud.png';
                  return null;
                };

                if (uniqueMerchantCount <= 1) return null;

                return (
                  <div className="border-t border-white/10 pt-12">
                    <h3 className="text-[10px] font-bold tracking-[0.3em] uppercase text-neutral-500 mb-8">
                      Analyse du Marché
                    </h3>
                    <div className="flex flex-col border border-white/10 divide-y divide-white/10">
                      {allPrices.map((merchant, index) => {
                        const isBestValue = index === 0;
                        const logoSrc = getMerchantLogo(merchant.merchantName);
                        const pricePerUnitDiff = merchant.pricePerUnit && cheapestPricePerUnit 
                          ? ((merchant.pricePerUnit - cheapestPricePerUnit) / cheapestPricePerUnit * 100)
                          : 0;

                        return (
                          <a
                            key={merchant.id}
                            href={merchant.productUrl}
                            target="_blank"
                            rel="nofollow sponsored noopener noreferrer"
                            className="group flex items-center justify-between p-6 hover:bg-white/5 transition-colors"
                          >
                            <div className="flex items-center gap-6">
                              <div className="w-10 h-10 flex items-center justify-center bg-white rounded">
                                {logoSrc ? (
                                  <Image 
                                    src={logoSrc} 
                                    alt={merchant.merchantName} 
                                    width={36} 
                                    height={36}
                                    className="object-contain"
                                  />
                                ) : (
                                  <Store className="h-5 w-5 text-black" />
                                )}
                              </div>
                              <div>
                                <div className="flex items-center gap-3">
                                  <p className="text-sm font-medium text-white tracking-widest uppercase">
                                    {merchant.merchantName}
                                  </p>
                                  {isBestValue && (
                                    <span className="text-[9px] font-bold text-[#d4a855] border border-[#d4a855] px-2 py-0.5 tracking-wider">
                                      MEILLEUR RAPPORT
                                    </span>
                                  )}
                                </div>
                                {merchant.volume && (
                                  <p className="text-xs text-neutral-500 mt-1">
                                    Format: {merchant.volume}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="text-right">
                              <div className="flex items-center gap-3 justify-end">
                                {merchant.originalPrice && merchant.originalPrice > merchant.currentPrice && (
                                  <span className="text-neutral-600 line-through text-xs decoration-white/20">
                                    {merchant.originalPrice.toFixed(2)}€
                                  </span>
                                )}
                                <span className={`text-xl font-light tracking-tight ${isBestValue ? 'text-white' : 'text-neutral-400'}`}>
                                  {merchant.currentPrice.toFixed(2)}€
                                </span>
                              </div>
                              {merchant.pricePerUnit && (
                                <p className={`text-[10px] font-medium mt-1 ${isBestValue ? 'text-[#d4a855]' : 'text-neutral-500'}`}>
                                  {(merchant.pricePerUnit * 100).toFixed(2)}€ / 100ml
                                  {!isBestValue && pricePerUnitDiff > 0 && (
                                    <span className="text-[#9b1515] ml-2">+{pricePerUnitDiff.toFixed(0)}%</span>
                                  )}
                                </p>
                              )}
                            </div>
                          </a>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* PREMIUM RICH CONTENT - EDITORIAL LAYOUT */}
              <div className="mt-20 space-y-12">
                  
                  {/* 01. THE PRODUCT - Hero Description */}
                  {(deal.product.description || deal.product.seoDescription) && (
                    <div className="relative">
                       {/* Background Number */}
                       <span className="absolute -top-10 -left-4 text-[80px] font-black text-white/[0.03] select-none pointer-events-none z-0">
                         01
                       </span>
                       
                       <div className="relative z-10 pl-8 md:pl-10 border-l border-[#d4a855]">
                           <h3 className="text-[10px] font-bold tracking-[0.4em] text-[#d4a855] uppercase mb-4 transform translate-y-1">
                             L'Expérience
                           </h3>
                           <div className="text-sm md:text-base font-light text-neutral-200 leading-relaxed text-justify max-w-3xl">
                                {deal.product.seoDescription ? (
                                  <div className="whitespace-pre-wrap">{deal.product.seoDescription}</div>
                                ) : (
                                  <p>{deal.product.description}</p>
                                )}
                           </div>
                       </div>
                    </div>
                  )}

                  {/* 02. INGREDIENTS - Dark Card */}
                  {deal.product.ingredients && (
                    <div className="relative">
                       <span className="absolute -top-10 right-0 text-[80px] font-black text-white/[0.03] select-none pointer-events-none z-0">
                         02
                       </span>
                       
                       <div className="relative z-10 bg-[#111111] p-8 border border-white/5">
                           <div className="flex flex-col md:flex-row md:items-baseline justify-between mb-6 gap-4 border-b border-white/10 pb-4">
                             <h3 className="text-[10px] font-bold tracking-[0.4em] text-white uppercase transform translate-y-1">
                               Formulation
                             </h3>
                             <span className="text-[10px] tracking-widest text-neutral-600 uppercase">
                               Analyse des actifs
                             </span>
                           </div>
                           <p className="text-sm md:text-base font-light text-neutral-200 leading-relaxed text-justify">
                              {deal.product.ingredients}
                           </p>
                       </div>
                    </div>
                  )}

                  {/* 03. APPLICATION - Standard Layout */}
                  {deal.product.application && (
                    <div className="relative">
                       <span className="absolute -top-10 -left-4 text-[80px] font-black text-white/[0.03] select-none pointer-events-none z-0">
                         03
                       </span>
                       
                       <div className="relative z-10 pl-8 md:pl-10 border-l border-white/20">
                           <h3 className="text-[10px] font-bold tracking-[0.4em] text-white uppercase mb-4 transform translate-y-1">
                             Conseil d'Application
                           </h3>
                           <p className="text-sm md:text-base font-light text-neutral-200 leading-relaxed text-left md:text-justify">
                                {deal.product.application}
                           </p>
                       </div>
                    </div>
                  )}

                  {/* 04. BRAND UNIVERSE - Center Stage */}
                  {deal.product.brand && (
                    <div className="relative pt-16 border-t border-white/5">
                        <div className="text-center max-w-2xl mx-auto">
                            <span className="text-[10px] font-bold tracking-[0.4em] text-neutral-700 uppercase block mb-6">
                              Univers de la marque
                            </span>
                            <h2 className="text-2xl md:text-4xl font-thin text-white tracking-tight mb-8">
                                {deal.product.brand}
                            </h2>
                            <Link
                                href={`/deals?brand=${encodeURIComponent(deal.product.brand)}`}
                                className="group inline-flex items-center gap-3 px-6 py-3 bg-white text-black text-[10px] font-bold tracking-[0.2em] uppercase hover:bg-[#d4a855] transition-colors duration-500"
                            >
                                <span>Explorer</span>
                                <ArrowRight className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
                            </Link>
                        </div>
                    </div>
                  )}

                  {/* 05. RITUEL - MOOD QUOTE */}
                  <div className="flex justify-center pt-8 pb-4">
                      <div className="text-center max-w-lg mx-auto">
                          <h3 className="text-[10px] font-bold tracking-[0.4em] text-[#d4a855] uppercase mb-6">
                            Le Rituel
                          </h3>
                          <p className="text-base md:text-lg font-light italic text-white/40 font-serif leading-relaxed">
                            "{ritualQuote}"
                          </p>
                      </div>
                  </div>
                  
              </div>

              {/* Price Chart - Afficher seulement si plus de 2 données et variation de prix */}
              {deal.product.priceHistory && 
               deal.product.priceHistory.length > 2 &&
               !(deal.product.priceHistory.length > 1 && 
                 deal.product.priceHistory.every((ph: any) => 
                   Math.abs(ph.price - deal.product.priceHistory[0].price) < 0.01
                 )) && (
                <div className="border-t border-white/10 pt-12">
                   <h3 className="text-[10px] font-bold tracking-[0.3em] uppercase text-neutral-500 mb-8">
                      Historique des Prix
                   </h3>
                   <PriceChart
                     priceHistory={deal.product.priceHistory as any}
                     priceStats={priceStats}
                     currentPrice={deal.dealPrice}
                   />
                </div>
              )}

              {/* Comments Section */}
              <div className="border-t border-white/10 pt-12">
                <CommentSection dealId={deal.id} />
              </div>

            </div>
          </div>
        </div>

        {/* Similar Deals - Bottom Carousel Layout (hidden when expired, shown in top banner instead) */}
        {!isExpired && similarDeals.length > 0 && (
          <div className="mt-32 pt-16 border-t border-white/10">
            <h2 className="text-xl md:text-2xl font-thin text-white mb-12 flex items-center gap-6">
              VOUS AIMEREZ AUSSI <span className="h-px flex-1 bg-white/10"></span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {similarDeals.map((similarDeal: any) => (
                <DealCard key={similarDeal.id} deal={similarDeal} />
              ))}
            </div>
          </div>
        )}

      {/* Affiliate Disclosure */}
      <p className="text-[9px] text-neutral-700 tracking-wide text-center mt-16 mb-4">
        Ce site peut percevoir une rémunération via les liens présentés. <a href="/legal#mentions" className="underline hover:text-neutral-500 transition-colors">Détails</a>
      </p>
      </div>
    </div>
    </>
  );
}
