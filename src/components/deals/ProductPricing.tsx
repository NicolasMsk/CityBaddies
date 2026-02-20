'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import { ExternalLink, ChevronDown } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────
interface VariantData {
  volumeValue: number | null;
  volumeUnit: string | null;
}

interface DealData {
  id: string;
  dealPrice: number;
  originalPrice: number;
  discountPercent: number;
  volume: string | null;
  sourceUrl: string | null;
  variant: VariantData | null;
  merchant: { name: string; slug: string };
  productUrl: string | null;
}

interface ProductPricingProps {
  deals: DealData[];
}

// ── Logos marchands (taille cible individuelle pour uniformité visuelle) ──
const MERCHANT_LOGOS: Record<string, { src: string; w: number; h: number }> = {
  'nocibe':     { src: '/images/nocibe_logo.png',      w: 100, h: 36 },
  'sephora':    { src: '/images/sephora_logo.png',     w: 120, h: 20 },
  'marionnaud': { src: '/images/logo_marrionaud.png',  w: 130, h: 28 },
  'notino':     { src: '/images/notino_logo.png',      w: 110, h: 28 },
};

export default function ProductPricing({ deals }: ProductPricingProps) {
  // ── Regrouper les deals par contenance ──
  const variantMap = useMemo(() => {
    const map = new Map<string, { label: string; deals: DealData[] }>();
    for (const deal of deals) {
      const key = deal.variant
        ? `${deal.variant.volumeValue}${deal.variant.volumeUnit}`
        : deal.volume || 'standard';
      const label = deal.variant
        ? `${deal.variant.volumeValue} ${deal.variant.volumeUnit}`
        : deal.volume || 'Standard';
      if (!map.has(key)) {
        map.set(key, { label, deals: [] });
      }
      map.get(key)!.deals.push(deal);
    }
    return map;
  }, [deals]);

  const variantKeys = useMemo(() => Array.from(variantMap.keys()), [variantMap]);
  const hasMultipleVariants = variantKeys.length > 1;

  const [selectedVariant, setSelectedVariant] = useState(variantKeys[0] || 'standard');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Deals pour la contenance sélectionnée
  const currentVariant = variantMap.get(selectedVariant);
  const currentDeals = currentVariant?.deals || [];
  const currentLabel = currentVariant?.label || 'Standard';

  // ── Construire les prix par marchand, triés par prix croissant ──
  const merchantPrices = useMemo(() => {
    const prices: {
      merchantName: string;
      merchantSlug: string;
      currentPrice: number;
      originalPrice: number;
      discountPercent: number;
      url: string;
    }[] = [];

    for (const deal of currentDeals) {
      if (!prices.find(p => p.merchantSlug === deal.merchant.slug)) {
        prices.push({
          merchantName: deal.merchant.name,
          merchantSlug: deal.merchant.slug,
          currentPrice: deal.dealPrice,
          originalPrice: deal.originalPrice,
          discountPercent: deal.discountPercent,
          url: deal.productUrl || '',
        });
      }
    }

    return prices.sort((a, b) => a.currentPrice - b.currentPrice);
  }, [currentDeals]);

  const cheapest = merchantPrices[0];
  const mostExpensive = merchantPrices[merchantPrices.length - 1];
  const priceDiff = mostExpensive && cheapest
    ? (mostExpensive.currentPrice - cheapest.currentPrice).toFixed(2)
    : '0';
  const hasMultipleMerchants = merchantPrices.length > 1;

  if (!cheapest) return null;

  return (
    <div className="space-y-10">
      {/* ── Sélecteur de contenance ── */}
      {hasMultipleVariants && (
        <div className="relative">
          <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-500 mb-4 block">
            Format
          </label>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="w-full flex items-center justify-between bg-transparent border-b border-white/20 pb-4 text-white hover:border-white/60 transition-colors"
          >
            <span className="text-lg font-light tracking-wide">{currentLabel}</span>
            <div className="flex items-center gap-6">
              <span className="text-sm text-neutral-400 font-light">
                à partir de <span className="text-white font-medium">{cheapest.currentPrice.toFixed(2)} €</span>
              </span>
              <ChevronDown className={`h-4 w-4 text-neutral-500 transition-transform duration-300 ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </div>
          </button>

          {isDropdownOpen && (
            <div className="absolute top-full left-0 right-0 z-20 mt-0 bg-[#0a0a0a] border border-t-0 border-white/20 shadow-2xl">
              {variantKeys.map(key => {
                const variant = variantMap.get(key)!;
                const variantBest = variant.deals.sort((a, b) => a.dealPrice - b.dealPrice)[0];
                const isSelected = key === selectedVariant;
                const merchantCount = new Set(variant.deals.map(d => d.merchant.slug)).size;
                return (
                  <button
                    key={key}
                    onClick={() => {
                      setSelectedVariant(key);
                      setIsDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-6 py-5 text-left transition-colors border-b border-white/5 last:border-0 ${
                      isSelected ? 'bg-white/5 text-white' : 'text-neutral-400 hover:bg-white/5 hover:text-neutral-200'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-base font-light tracking-wide">{variant.label}</span>
                      {merchantCount > 1 && (
                        <span className="text-[10px] uppercase tracking-widest text-neutral-500">
                          {merchantCount} offres
                        </span>
                      )}
                    </div>
                    <span className={`text-base font-medium ${isSelected ? 'text-white' : ''}`}>
                      {variantBest.dealPrice.toFixed(2)} €
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Comparateur de prix ── */}
      <div className="space-y-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-500">
            {hasMultipleMerchants ? 'Offres disponibles' : 'Offre disponible'}
          </span>
          {!hasMultipleVariants && currentDeals[0]?.volume && (
            <span className="text-[10px] text-neutral-500 uppercase tracking-widest">
              {currentDeals[0].volume}
            </span>
          )}
        </div>

        <div className="flex flex-col gap-4">
          {merchantPrices.map((mp, index) => {
            const isFirst = index === 0;
            const diffFromBest = isFirst ? 0 : (mp.currentPrice - cheapest.currentPrice);

            return (
              <a
                key={mp.merchantSlug}
                href={mp.url ? `/api/redirect?url=${encodeURIComponent(mp.url)}` : '#'}
                target="_blank"
                rel="nofollow sponsored noopener"
                className={`
                  group flex flex-col sm:flex-row sm:items-center justify-between gap-6 p-6 transition-all duration-500
                  ${isFirst
                    ? 'bg-white text-black hover:bg-neutral-100'
                    : 'bg-transparent border border-white/10 hover:border-white/30 text-white'
                  }
                `}
              >
                {/* Merchant Logo & Price Diff */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-4">
                    {(() => {
                      const logoData = MERCHANT_LOGOS[mp.merchantSlug];
                      if (logoData) {
                        return (
                          <div className="bg-white rounded flex items-center justify-center h-12 w-36 px-3">
                            <Image
                              src={logoData.src}
                              alt={mp.merchantName}
                              width={logoData.w}
                              height={logoData.h}
                              className="object-contain"
                            />
                          </div>
                        );
                      }
                      return (
                        <span className={`text-lg tracking-widest uppercase ${isFirst ? 'font-bold' : 'font-light'}`}>
                          {mp.merchantName}
                        </span>
                      );
                    })()}
                    {isFirst && hasMultipleMerchants && (
                      <span className="text-[9px] font-bold uppercase tracking-[0.2em] px-2 py-1 bg-black text-white">
                        Meilleur Prix
                      </span>
                    )}
                  </div>
                  {diffFromBest > 0 && (
                    <span className="text-xs text-neutral-500 font-light">
                      +{diffFromBest.toFixed(2)} € vs meilleur prix
                    </span>
                  )}
                </div>

                {/* Pricing & CTA */}
                <div className="flex items-center justify-between sm:justify-end gap-8">
                  <div className="flex flex-col items-end">
                    <div className="flex items-baseline gap-3">
                      {mp.originalPrice > mp.currentPrice && (
                        <span className={`text-sm line-through ${isFirst ? 'text-neutral-500' : 'text-neutral-600'}`}>
                          {mp.originalPrice.toFixed(2)} €
                        </span>
                      )}
                      <span className={`text-2xl tracking-tight ${isFirst ? 'font-bold' : 'font-light'}`}>
                        {mp.currentPrice.toFixed(2)} €
                      </span>
                    </div>
                    {mp.discountPercent > 0 && (
                      <span className={`text-[10px] font-medium tracking-widest uppercase mt-1 ${isFirst ? 'text-black' : 'text-neutral-400'}`}>
                        -{mp.discountPercent}%
                      </span>
                    )}
                  </div>

                  <div className={`flex items-center justify-center w-10 h-10 rounded-full transition-transform duration-300 group-hover:translate-x-1 ${
                    isFirst ? 'bg-black text-white' : 'bg-white text-black'
                  }`}>
                    <ExternalLink className="h-4 w-4" />
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}
