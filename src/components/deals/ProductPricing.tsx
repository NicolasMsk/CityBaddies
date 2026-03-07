'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import { ExternalLink, ChevronDown, Tag, Info } from 'lucide-react';
import PriceChart from './PriceChart';
import type { PriceHistory } from '@/types';

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
  promoCode?: string | null;
  priceConditions?: string | null;
  variant: VariantData | null;
  merchant: { name: string; slug: string };
  productUrl: string | null;
}

interface ProductPricingProps {
  deals: DealData[];
  priceHistory?: PriceHistory[];
}

// ── Logos marchands (taille cible individuelle pour uniformité visuelle) ──
const MERCHANT_LOGOS: Record<string, { src: string; w: number; h: number }> = {
  'nocibe':     { src: '/images/nocibe_logo.png',      w: 100, h: 36 },
  'sephora':    { src: '/images/sephora_logo.png',     w: 120, h: 20 },
  'marionnaud': { src: '/images/logo_marrionaud.png',  w: 130, h: 28 },
  'notino':     { src: '/images/notino_logo.png',      w: 110, h: 28 },
};

export default function ProductPricing({ deals, priceHistory }: ProductPricingProps) {
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

  // Trier les contenances par volume croissant (pas par prix)
  const variantKeys = useMemo(() => {
    return Array.from(variantMap.keys()).sort((a, b) => {
      const dealsA = variantMap.get(a)!.deals;
      const dealsB = variantMap.get(b)!.deals;
      const volA = dealsA[0]?.variant?.volumeValue ?? parseFloat(a) ?? 0;
      const volB = dealsB[0]?.variant?.volumeValue ?? parseFloat(b) ?? 0;
      return volA - volB;
    });
  }, [variantMap]);
  const hasMultipleVariants = variantKeys.length > 1;

  const [selectedVariant, setSelectedVariant] = useState(variantKeys[0] || 'standard');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [conditionsOpen, setConditionsOpen] = useState(false);

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
      promoCode: string | null;
      priceConditions: string | null;
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
          promoCode: deal.promoCode || null,
          priceConditions: deal.priceConditions || null,
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
    <div className="space-y-6 sm:space-y-8 md:space-y-10">
      {/* ── Sélecteur de contenance ── */}
      {hasMultipleVariants && (
        <div className="relative">
          <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-500 mb-3 sm:mb-4 block">
            Format
          </label>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="w-full flex items-center justify-between bg-transparent border-b border-white/20 pb-3 sm:pb-4 text-white hover:border-white/60 transition-colors"
          >
            <span className="text-base sm:text-lg font-light tracking-wide">{currentLabel}</span>
            <div className="flex items-center gap-3 sm:gap-6">
              <span className="text-xs sm:text-sm text-neutral-400 font-light">
                <span className="hidden sm:inline">à partir de </span><span className="text-white font-medium">{cheapest.currentPrice.toFixed(2)} €</span>
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
                    className={`w-full flex items-center justify-between px-4 py-3.5 sm:px-6 sm:py-5 text-left transition-colors border-b border-white/5 last:border-0 ${
                      isSelected ? 'bg-white/5 text-white' : 'text-neutral-400 hover:bg-white/5 hover:text-neutral-200'
                    }`}
                  >
                    <div className="flex items-center gap-3 sm:gap-4">
                      <span className="text-sm sm:text-base font-light tracking-wide">{variant.label}</span>
                      {merchantCount > 1 && (
                        <span className="text-[10px] uppercase tracking-widest text-neutral-500">
                          {merchantCount} offres
                        </span>
                      )}
                    </div>
                    <span className={`text-sm sm:text-base font-medium ${isSelected ? 'text-white' : ''}`}>
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
      <div className="space-y-4 sm:space-y-6">
        <div className="flex items-center justify-between mb-1 sm:mb-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-500">
            {hasMultipleMerchants ? 'Offres disponibles' : 'Offre disponible'}
          </span>
          {!hasMultipleVariants && currentDeals[0]?.volume && (
            <span className="text-[10px] text-neutral-500 uppercase tracking-widest">
              {currentDeals[0].volume}
            </span>
          )}
        </div>

        <div className="flex flex-col gap-3 sm:gap-4">
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
                  group flex items-center justify-between gap-3 sm:gap-6 p-3 sm:p-4 md:p-6 transition-all duration-500
                  ${isFirst
                    ? 'bg-white text-black hover:bg-neutral-100'
                    : 'bg-transparent border border-white/10 hover:border-white/30 text-white'
                  }
                `}
              >
                {/* Merchant Logo & Price Diff */}
                <div className="flex flex-col gap-1 sm:gap-2 min-w-0 flex-1">
                  <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                    {(() => {
                      const logoData = MERCHANT_LOGOS[mp.merchantSlug];
                      if (logoData) {
                        return (
                          <div className="bg-white rounded flex items-center justify-center h-8 w-24 sm:h-10 sm:w-28 md:h-12 md:w-36 px-2 sm:px-3">
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
                        <span className={`text-sm sm:text-lg tracking-widest uppercase ${isFirst ? 'font-bold' : 'font-light'}`}>
                          {mp.merchantName}
                        </span>
                      );
                    })()}
                    {isFirst && hasMultipleMerchants && (
                      <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-[0.15em] sm:tracking-[0.2em] px-1.5 py-0.5 sm:px-2 sm:py-1 bg-black text-white">
                        Meilleur Prix
                      </span>
                    )}
                  </div>
                  {diffFromBest > 0 && (
                    <span className="text-[10px] sm:text-xs text-neutral-500 font-light">
                      +{diffFromBest.toFixed(2)} € vs meilleur prix
                    </span>
                  )}
                  {mp.promoCode && (
                    <div className={`flex items-center gap-1.5 sm:gap-2 ${isFirst ? 'text-amber-700' : 'text-[#d4a855]'}`}>
                      <Tag className="h-2.5 w-2.5 sm:h-3 sm:w-3 flex-shrink-0" />
                      <span className="text-[10px] sm:text-xs font-mono font-bold tracking-wider truncate">
                        Code : {mp.promoCode}
                      </span>
                    </div>
                  )}
                </div>

                {/* Pricing & CTA */}
                <div className="flex items-center gap-3 sm:gap-6 md:gap-8 flex-shrink-0">
                  <div className="flex flex-col items-end">
                    <div className="flex items-baseline gap-1.5 sm:gap-3">
                      {mp.originalPrice > mp.currentPrice && (
                        <span className={`text-[10px] sm:text-sm line-through ${isFirst ? 'text-neutral-500' : 'text-neutral-600'}`}>
                          {mp.originalPrice.toFixed(2)} €
                        </span>
                      )}
                      <span className={`text-lg sm:text-xl md:text-2xl tracking-tight ${isFirst ? 'font-bold' : 'font-light'}`}>
                        {mp.currentPrice.toFixed(2)} €
                      </span>
                    </div>
                    {mp.discountPercent > 0 && (
                      <span className={`text-[9px] sm:text-[10px] font-medium tracking-widest uppercase mt-0.5 sm:mt-1 ${isFirst ? 'text-black' : 'text-neutral-400'}`}>
                        -{mp.discountPercent}%
                      </span>
                    )}
                  </div>

                  <div className={`flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full transition-transform duration-300 group-hover:translate-x-1 ${
                    isFirst ? 'bg-black text-white' : 'bg-white text-black'
                  }`}>
                    <ExternalLink className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      </div>

      {/* ── Conditions déroulantes ── */}
      {(() => {
        const conditions = merchantPrices
          .filter(mp => mp.priceConditions)
          .map(mp => ({ merchant: mp.merchantName, condition: mp.priceConditions! }));
        if (conditions.length === 0) return null;
        return (
          <div className="border border-white/10">
            <button
              onClick={() => setConditionsOpen(!conditionsOpen)}
              className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <Info className="h-3.5 w-3.5 text-[#d4a855]" />
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-neutral-400">
                  Conditions
                </span>
              </div>
              <ChevronDown className={`h-3.5 w-3.5 text-neutral-500 transition-transform duration-300 ${conditionsOpen ? 'rotate-180' : ''}`} />
            </button>
            {conditionsOpen && (
              <div className="px-5 pb-4 space-y-3 border-t border-white/5">
                {conditions.map((c, idx) => (
                  <div key={idx} className="flex items-start gap-3 pt-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 w-24 flex-shrink-0 pt-0.5">
                      {c.merchant}
                    </span>
                    <span className="text-[11px] text-neutral-400 font-light leading-relaxed">
                      {c.condition}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Historique de prix pour cette contenance ── */}
      {priceHistory && priceHistory.length > 0 && (() => {
        // Filtrer l'historique par la contenance sélectionnée
        const currentVariantData = currentDeals[0];
        const selectedVolumeValue = currentVariantData?.variant?.volumeValue;
        const selectedVolumeUnit = currentVariantData?.variant?.volumeUnit;

        const filteredHistory = priceHistory.filter(ph => {
          // Si la contenance sélectionnée a une variante avec volume
          if (selectedVolumeValue && selectedVolumeUnit) {
            return (
              ph.volumeValue === selectedVolumeValue &&
              ph.volumeUnit?.toLowerCase() === selectedVolumeUnit.toLowerCase()
            );
          }
          // Si pas de variante, prendre l'historique sans volume
          return !ph.volumeValue && !ph.volumeUnit;
        });

        // Si le filtre strict ne donne rien, essayer avec le volumeRaw du deal
        const historyToShow = filteredHistory.length > 0 ? filteredHistory : 
          selectedVolumeValue ? priceHistory.filter(ph => {
            // Fallback: chercher par volumeValue seul
            return ph.volumeValue === selectedVolumeValue;
          }) : [];

        if (historyToShow.length <= 1) return null;

        const variantLabel = selectedVolumeValue && selectedVolumeUnit
          ? `${selectedVolumeValue} ${selectedVolumeUnit}`
          : currentDeals[0]?.volume || '';

        const prices = historyToShow.map(p => p.price);
        const currentPrice = cheapest.currentPrice;

        return (
          <div className="mt-8 sm:mt-10 md:mt-12">
            <div className="flex items-center gap-2 mb-4 sm:mb-6">
              <h3 className="text-[11px] sm:text-xs font-medium uppercase tracking-[0.2em] text-white/80">
                Historique & Tendances
              </h3>
              {variantLabel && (
                <span className="text-[10px] text-white/40 uppercase tracking-widest px-2 py-0.5 rounded-full border border-white/10 bg-white/5">
                  {variantLabel}
                </span>
              )}
            </div>
            <div className="bg-[#121212] rounded-3xl border border-white/5 p-4 sm:p-6 md:p-8">
              <PriceChart
                priceHistory={historyToShow}
                priceStats={{
                  current: currentPrice,
                  lowest: Math.min(...prices),
                  highest: Math.max(...prices),
                  average: prices.reduce((a, b) => a + b, 0) / prices.length,
                }}
                currentPrice={currentPrice}
              />
            </div>
          </div>
        );
      })()}
    </div>
  );
}
