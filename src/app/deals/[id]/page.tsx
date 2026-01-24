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
import { ArrowLeft, ExternalLink, Store, Tag, Flame, Clock, BadgeCheck } from 'lucide-react';
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

  if (!deal) {
    return {
      title: "Deal non trouvé",
      description: "Ce deal n'existe pas ou a expiré.",
    };
  }

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

  if (!deal) return null;

  // Incrémenter les vues
  await prisma.deal.update({
    where: { id },
    data: { views: { increment: 1 } },
  });

  // Récupérer des deals similaires
  const similarDeals = await prisma.deal.findMany({
    where: {
      id: { not: id },
      isExpired: false,
      discountPercent: { gte: 20 }, // Minimum 20% de réduction
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
    take: 3,
  });

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
    description: deal.description || `${deal.product.brand || ''} ${deal.product.category?.name || 'Beauté'}`.trim(),
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
      priceValidUntil: deal.endDate ? new Date(deal.endDate).toISOString().split('T')[0] : undefined,
      availability: deal.isExpired ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
      seller: deal.product.merchant ? {
        "@type": "Organization",
        name: deal.product.merchant.name,
      } : undefined,
    },
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
          {/* Back Link - Editorial Style */}
          <Link
            href="/deals"
            className="group inline-flex items-center gap-4 text-[10px] font-bold tracking-[0.3em] uppercase text-neutral-500 hover:text-white transition-colors mb-16"
          >
          <ArrowLeft className="h-3 w-3 group-hover:-translate-x-1 transition-transform" />
          Retour à la collection
        </Link>

        <div className="grid lg:grid-cols-12 gap-12 lg:gap-24">
          
          {/* Left Column: Image (5 cols) */}
          <div className="lg:col-span-5 relative">
            <div className="sticky top-12">
              <div className="relative">
                {/* Badges - Sharp & Technical */}
                 <div className="absolute top-0 left-0 z-20">
                   {deal.discountPercent > 0 && (
                     <span className="inline-block px-4 py-2 bg-[#9b1515] text-white text-sm font-bold tracking-widest uppercase shadow-xl">
                        -{deal.discountPercent}%
                     </span>
                   )}
                </div>
                
                <div className="relative aspect-[4/5] w-full bg-[#0f0f0f] border border-white/5 group overflow-hidden">

                {deal.product.imageUrl ? (
                  <Image
                    src={deal.product.imageUrl}
                    alt={deal.product.name}
                    fill
                    className="object-contain p-8 group-hover:scale-105 transition-transform duration-700 ease-out"
                    priority
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-neutral-700 italic">No Imagery</span>
                  </div>
                )}

                
              </div>
            </div>
              
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

              <h1 className="text-4xl md:text-6xl font-thin text-white tracking-tight leading-none mb-6">
                {deal.refinedTitle || deal.title}
              </h1>

              {deal.description && (
                <p className="text-neutral-500 font-light text-base leading-relaxed max-w-2xl mt-4">
                  {deal.description}
                </p>
              )}
            </div>

            {/* Price Section - Editorial Typography */}
            <div className="mb-12">
                <div className="flex items-baseline gap-6 mb-4">
                  <span className="text-6xl md:text-7xl font-light text-white tracking-tighter">
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
               <a
                  href={deal.product.productUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 bg-white text-black h-14 flex items-center justify-center gap-3 text-xs font-bold tracking-[0.2em] uppercase hover:bg-neutral-200 transition-colors"
                >
                  <Store className="h-4 w-4" />
                  ACHETER CHEZ {deal.product.merchant.name.toUpperCase()}
                </a>
                <DealFeedback 
                  dealId={deal.id} 
                  initialViews={deal.views} 
                  initialVotes={deal.votes} 
                />
            </div>

            {/* Additional Sections */}
            <div className="space-y-16">


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
                            rel="noopener noreferrer"
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

              {/* Price Chart */}
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

              {/* Product Description */}
              {deal.product.description && (
                <div className="border-t border-white/10 pt-12">
                  <h3 className="text-[10px] font-bold tracking-[0.3em] uppercase text-neutral-500 mb-8">
                    Aperçu du Produit
                  </h3>
                  <div className="prose prose-invert max-w-none prose-p:font-light prose-p:text-neutral-400 prose-p:leading-relaxed">
                    <p>{deal.product.description}</p>
                  </div>
                </div>
              )}

              {/* Comments Section */}
              <div className="border-t border-white/10 pt-12">
                <CommentSection dealId={deal.id} />
              </div>

            </div>
          </div>
        </div>

        {/* Similar Deals - Bottom Carousel Layout */}
        {similarDeals.length > 0 && (
          <div className="mt-32 pt-16 border-t border-white/10">
            <h2 className="text-3xl font-thin text-white mb-12 flex items-center gap-6">
              VOUS AIMEREZ AUSSI <span className="h-px flex-1 bg-white/10"></span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {similarDeals.map((similarDeal: any) => (
                <DealCard key={similarDeal.id} deal={similarDeal} />
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
    </>
  );
}
