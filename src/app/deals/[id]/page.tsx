import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import prisma from '@/lib/prisma';
import PriceChart from '@/components/deals/PriceChart';
import DealCard from '@/components/deals/DealCard';
import DealFeedback from '@/components/deals/DealFeedback';
import CommentSection from '@/components/comments/CommentSection';
import { ArrowLeft, ExternalLink, Store, Tag, Flame, Clock, BadgeCheck } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

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

  return (
    <div className="min-h-screen py-8 bg-[#0a0a0a]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back Link */}
        <Link
          href="/deals"
          className="inline-flex items-center gap-2 text-bordeaux-400 hover:text-bordeaux-300 transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour aux deals
        </Link>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Deal Header */}
            <div className="bg-[#1a1a1a] rounded-2xl overflow-hidden border border-white/10">
              {/* Image */}
              <div className="relative h-80 md:h-[450px] bg-[#0f0f0f]">
                {deal.product.imageUrl ? (
                  <Image
                    src={deal.product.imageUrl}
                    alt={deal.product.name}
                    fill
                    className="object-contain p-4"
                    priority
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-bordeaux-900 to-black flex items-center justify-center">
                    <Tag className="h-20 w-20 text-bordeaux-500" />
                  </div>
                )}

                {/* Badges */}
                <div className="absolute top-4 left-4 flex flex-wrap gap-2">
                  {deal.isHot && (
                    <span className="flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-[#7b0a0a] to-[#8b1212] rounded-full text-white text-sm font-semibold">
                      <Flame className="h-4 w-4" />
                      HOT DEAL
                    </span>
                  )}
                  <span className="px-3 py-1.5 bg-[#7b0a0a] rounded-full text-white text-sm font-bold">
                    -{deal.discountPercent}%
                  </span>
                </div>
              </div>

              {/* Content */}
              <div className="p-6">
                {/* Category & Merchant */}
                <div className="flex flex-wrap items-center gap-4 mb-4">
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-bordeaux-600/20 rounded-full text-bordeaux-300 text-sm">
                    {deal.product.category.icon} {deal.product.category.name}
                  </span>
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-white/5 rounded-full text-white/60 text-sm">
                    <Store className="h-3 w-3" />
                    {deal.product.merchant.name}
                  </span>
                  <span className="inline-flex items-center gap-1 text-white/40 text-sm">
                    <Clock className="h-3 w-3" />
                    {timeAgo}
                  </span>
                </div>

                {/* Title */}
                <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
                  {deal.refinedTitle || deal.title}
                </h1>

                {/* Brand */}
                {deal.product.brand && (
                  <p className="text-white/50 mb-4">par {deal.product.brand}</p>
                )}

                {/* Description */}
                {deal.description && (
                  <p className="text-white/60 mb-6">{deal.description}</p>
                )}

                {/* Price */}
                <div className="flex flex-wrap items-end gap-4 mb-6 p-4 bg-bordeaux-900/30 border border-bordeaux-600/20 rounded-xl">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-white/50 text-sm">Prix actuel</p>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs rounded-full">
                        <BadgeCheck className="h-3 w-3" />
                        Vérifié il y a {verifiedAgo}
                      </span>
                    </div>
                    <span className="text-4xl font-bold price-premium">
                      {deal.dealPrice.toFixed(2)}€
                    </span>
                  </div>
                  <div>
                    <p className="text-white/50 text-sm mb-1">Prix barré</p>
                    <span className="text-2xl text-white/30 line-through">
                      {deal.originalPrice.toFixed(2)}€
                    </span>
                  </div>
                  <div className="ml-auto text-right">
                    <p className="text-white/50 text-sm mb-1">Économie</p>
                    <span className="text-2xl font-bold text-[#9b1515]">
                      -{deal.discountAmount.toFixed(2)}€
                    </span>
                  </div>
                </div>

                {/* Promo Code */}
                {deal.promoCode && (
                  <div className="mb-6 p-4 bg-gold/10 border border-gold/30 rounded-xl">
                    <p className="text-gold text-sm mb-2">Code promo à utiliser :</p>
                    <div className="flex items-center gap-4">
                      <code className="text-xl font-mono font-bold text-gold bg-gold/20 px-4 py-2 rounded-lg">
                        {deal.promoCode}
                      </code>
                      <button
                        onClick={() => navigator.clipboard.writeText(deal.promoCode!)}
                        className="px-4 py-2 bg-gold/20 text-gold rounded-lg hover:bg-gold/30 transition-colors"
                      >
                        Copier
                      </button>
                    </div>
                  </div>
                )}

                {/* Stats & Feedback */}
                <DealFeedback 
                  dealId={deal.id} 
                  initialViews={deal.views} 
                  initialVotes={deal.votes} 
                />

                {/* CTA */}
                <a
                  href={deal.product.productUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-[#9b1515] via-[#7b0a0a] to-[#9b1515] rounded-xl text-white font-bold text-lg hover:from-[#8b1212] hover:to-[#6b0808] transition-all shadow-lg shadow-[#7b0a0a]/30"
                >
                  Voir l&apos;offre chez {deal.product.merchant.name}
                  <ExternalLink className="h-5 w-5" />
                </a>

                {/* Price Comparison - All Merchants */}
                {(() => {
                  // Build list of all prices: current deal + competitors
                  const allPrices = [
                    {
                      id: 'current-deal',
                      merchantName: deal.product.merchant.name,
                      currentPrice: deal.dealPrice,
                      originalPrice: deal.originalPrice,
                      productUrl: deal.product.productUrl,
                      volume: deal.volume,
                      isCurrent: true,
                    },
                    ...(deal.competitorPrices || []).map((cp: any) => ({
                      id: cp.id,
                      merchantName: cp.merchantName || cp.merchant?.name,
                      currentPrice: cp.currentPrice,
                      originalPrice: cp.originalPrice,
                      productUrl: cp.productUrl,
                      volume: cp.volume || deal.volume,
                      isCurrent: false,
                    })),
                  ].sort((a, b) => a.currentPrice - b.currentPrice);

                  const cheapestPrice = allPrices[0]?.currentPrice;

                  const getMerchantLogo = (name: string) => {
                    const slug = name.toLowerCase();
                    if (slug.includes('nocib')) return '/images/nocibe_logo.png';
                    if (slug.includes('sephora')) return '/images/sephora_logo.png';
                    return null;
                  };

                  return (
                    <div className="mt-6 p-4 bg-white/5 border border-white/10 rounded-xl">
                      <h3 className="text-white/70 text-sm font-medium mb-3 flex items-center gap-2">
                        <Store className="h-4 w-4" />
                        Comparer les prix ({allPrices.length} marchands)
                      </h3>
                      <div className="space-y-3">
                        {allPrices.map((merchant, index) => {
                          const priceDiff = merchant.currentPrice - cheapestPrice;
                          const isCheapest = index === 0;
                          const logoSrc = getMerchantLogo(merchant.merchantName);

                          return (
                            <a
                              key={merchant.id}
                              href={merchant.productUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`group flex items-center justify-between p-3 rounded-lg transition-all cursor-pointer ${
                                isCheapest 
                                  ? 'bg-[#4ade80]/10 border border-[#4ade80]/30 hover:bg-[#4ade80]/20 hover:scale-[1.02]' 
                                  : 'bg-white/5 hover:bg-white/10 border border-transparent hover:border-white/20 hover:scale-[1.02]'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center p-1">
                                  {logoSrc ? (
                                    <Image 
                                      src={logoSrc} 
                                      alt={merchant.merchantName} 
                                      width={40} 
                                      height={40}
                                      className="object-contain"
                                    />
                                  ) : (
                                    <Store className="h-5 w-5 text-gray-500" />
                                  )}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="text-white font-medium group-hover:underline">
                                      {merchant.merchantName}
                                    </p>
                                    {isCheapest && (
                                      <span className="px-2 py-0.5 bg-[#4ade80] text-black text-xs font-bold rounded">
                                        MEILLEUR PRIX
                                      </span>
                                    )}
                                    {merchant.isCurrent && (
                                      <span className="px-2 py-0.5 bg-gold/80 text-black text-xs font-bold rounded">
                                        CE DEAL
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-white/50 text-sm">
                                    {merchant.volume}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="text-right">
                                  <div className="flex items-center gap-2 justify-end">
                                    {merchant.originalPrice && merchant.originalPrice > merchant.currentPrice && (
                                      <span className="text-white/40 line-through text-sm">
                                        {merchant.originalPrice.toFixed(2)}€
                                      </span>
                                    )}
                                    <span className={`font-bold text-lg ${isCheapest ? 'text-[#4ade80]' : 'text-white'}`}>
                                      {merchant.currentPrice.toFixed(2)}€
                                    </span>
                                  </div>
                                  {!isCheapest && priceDiff > 0 && (
                                    <p className="text-[#f87171] text-sm font-medium">
                                      +{priceDiff.toFixed(2)}€
                                    </p>
                                  )}
                                </div>
                                <div className={`p-2 rounded-lg transition-colors ${
                                  isCheapest 
                                    ? 'bg-[#4ade80]/20 group-hover:bg-[#4ade80]/40' 
                                    : 'bg-white/10 group-hover:bg-white/20'
                                }`}>
                                  <ExternalLink className={`h-4 w-4 ${isCheapest ? 'text-[#4ade80]' : 'text-white/70'}`} />
                                </div>
                              </div>
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Price Chart */}
            <PriceChart
              priceHistory={deal.product.priceHistory as any}
              priceStats={priceStats}
              currentPrice={deal.dealPrice}
            />

            {/* Product Details Section */}
            <div className="space-y-4">
              {/* Product Description */}
              {deal.product.description && (
                <div className="bg-[#1a1a1a] rounded-2xl p-6 border border-white/10">
                  <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <span className="w-1 h-6 bg-gradient-to-b from-[#9b1515] to-[#7b0a0a] rounded-full"></span>
                    À propos de ce produit
                  </h2>
                  <p className="text-white/70 leading-relaxed">{deal.product.description}</p>
                </div>
              )}
            </div>

            {/* Comments Section */}
            <CommentSection dealId={deal.id} />
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Similar Deals */}
            {similarDeals.length > 0 && (
              <div className="bg-[#1a1a1a] rounded-2xl p-6 border border-white/10">
                <h2 className="text-lg font-semibold text-white mb-4">Deals similaires</h2>
                <div className="space-y-4">
                  {similarDeals.map((similarDeal: typeof similarDeals[number]) => (
                    <Link
                      key={similarDeal.id}
                      href={`/deals/${similarDeal.id}`}
                      className="block p-3 bg-white/5 rounded-xl hover:bg-bordeaux-600/20 transition-colors"
                    >
                      <div className="flex gap-3">
                        <div className="relative w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden">
                          {similarDeal.product.imageUrl ? (
                            <Image
                              src={similarDeal.product.imageUrl}
                              alt={similarDeal.product.name}
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-bordeaux-900/50 flex items-center justify-center">
                              <Tag className="h-6 w-6 text-bordeaux-500" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium line-clamp-2">
                            {similarDeal.product.name}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="price-premium font-bold">
                              {similarDeal.dealPrice.toFixed(2)}€
                            </span>
                            <span className="text-xs text-[#ff6b6b]">
                              -{similarDeal.discountPercent}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Share */}
            <div className="bg-[#1a1a1a] rounded-2xl p-6 border border-white/10">
              <h2 className="text-lg font-semibold text-white mb-4">Partager ce deal</h2>
              <div className="flex gap-3">
                <button className="flex-1 py-2 bg-[#1da1f2]/20 text-[#1da1f2] rounded-lg hover:bg-[#1da1f2]/30 transition-colors">
                  Twitter
                </button>
                <button className="flex-1 py-2 bg-[#4267B2]/20 text-[#4267B2] rounded-lg hover:bg-[#4267B2]/30 transition-colors">
                  Facebook
                </button>
                <button className="flex-1 py-2 bg-bordeaux-600/20 text-bordeaux-300 rounded-lg hover:bg-bordeaux-600/30 transition-colors">
                  Copier
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
