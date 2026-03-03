'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Scatter, ScatterChart } from 'recharts';
import { PriceHistory, PriceStats } from '@/types';
import { format, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { TrendingDown, TrendingUp, Minus, AlertCircle, Clock } from 'lucide-react';

interface PriceChartProps {
  priceHistory: PriceHistory[];
  priceStats: PriceStats;
  currentPrice: number;
}

export default function PriceChart({ priceHistory, priceStats, currentPrice }: PriceChartProps) {
  // Vérifier si les données sont valides
  const hasValidData = priceHistory && priceHistory.length > 0 && 
    priceStats && 
    isFinite(priceStats.lowest) && 
    isFinite(priceStats.highest) && 
    isFinite(priceStats.average) &&
    !isNaN(priceStats.lowest) &&
    !isNaN(priceStats.highest) &&
    !isNaN(priceStats.average);

  // Si pas de données valides, afficher un message
  if (!hasValidData) {
    return (
      <div className="text-center py-8 bg-white/5 border border-white/10">
        <p className="text-white/50 text-sm tracking-widest uppercase">Pas d'historique de prix disponible</p>
      </div>
    );
  }

  // Calculer le nombre d'observations et la couverture
  const nObservations = priceHistory.length;
  const dates = priceHistory.map(ph => new Date(ph.date));
  const firstSeenDate = dates.length > 0 ? dates[0] : new Date();
  const lastSeenDate = dates.length > 0 ? dates[dates.length - 1] : new Date();
  
  // Vérifier si tous les prix sont identiques (pas de variation)
  const allPricesSame = priceHistory.length > 1 && 
    priceHistory.every(ph => Math.abs(ph.price - priceHistory[0].price) < 0.01);
  
  // Règle : données insuffisantes si <= 2 observations OU tous les prix sont identiques
  const hasInsufficientData = nObservations <= 2 || allPricesSame;
  
  // Cas spécial : une seule observation
  const hasSingleObservation = nObservations === 1;

  const chartData = priceHistory.map((ph) => ({
    date: format(new Date(ph.date), 'd MMM', { locale: fr }),
    fullDate: format(new Date(ph.date), 'dd MMMM yyyy', { locale: fr }),
    price: ph.price,
    volume: ph.volumeRaw || (ph.volumeValue && ph.volumeUnit ? `${ph.volumeValue} ${ph.volumeUnit}` : null),
  }));

  // Ne calculer ces valeurs que si on a assez de données
  const isLowestPrice = !hasInsufficientData && currentPrice <= priceStats.lowest * 1.02;
  const priceChange = ((currentPrice - priceStats.average) / priceStats.average) * 100;
  const savings = priceStats.average - currentPrice;

  // Récupérer le volume le plus récent pour l'afficher dans le titre
  const currentVolume = priceHistory.length > 0 
    ? (priceHistory[priceHistory.length - 1].volumeRaw || 
       (priceHistory[priceHistory.length - 1].volumeValue && priceHistory[priceHistory.length - 1].volumeUnit 
         ? `${priceHistory[priceHistory.length - 1].volumeValue} ${priceHistory[priceHistory.length - 1].volumeUnit}` 
         : null))
    : null;

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#1a1a1a] border border-white/10 rounded-lg p-3 shadow-lg">
          <p className="text-white/50 text-sm">{payload[0].payload.fullDate}</p>
          <p className="text-white font-bold text-lg">{payload[0].value.toFixed(2)}€</p>
          {payload[0].payload.volume && (
            <p className="text-white/40 text-xs mt-1">{payload[0].payload.volume}</p>
          )}
        </div>
      );
    }
    return null;
  };

  // Calcul du domaine Y resserré pour point unique
  const getSinglePointDomain = (price: number): [number, number] => {
    const margin = price * 0.05; // 5% de marge
    return [price - margin, price + margin];
  };

  return (
    <div className="w-full">
      {/* Message données insuffisantes - NE PAS AFFICHER, juste cacher le graphique */}
      {hasInsufficientData && (
        <div className="text-center py-8 bg-white/5 border border-white/10">
          <p className="text-white/50 text-sm tracking-widest uppercase">Pas assez de données pour l'historique</p>
        </div>
      )}

      {/* Stats Cards - Sharp - Afficher seulement si données suffisantes */}
      {!hasInsufficientData && !hasSingleObservation && (
        <div className="grid grid-cols-3 gap-px bg-white/10 border border-white/10 mb-4 sm:mb-6 md:mb-8">
          <div className="bg-[#0a0a0a] p-3 sm:p-4 md:p-6 text-center">
            <p className="text-[9px] sm:text-[10px] text-neutral-500 uppercase tracking-wider sm:tracking-widest mb-1 sm:mb-2">Plus bas</p>
            <p className="text-sm sm:text-base md:text-xl font-light text-emerald-400">{priceStats.lowest.toFixed(2)}€</p>
          </div>
          <div className="bg-[#0a0a0a] p-3 sm:p-4 md:p-6 text-center">
            <p className="text-[9px] sm:text-[10px] text-neutral-500 uppercase tracking-wider sm:tracking-widest mb-1 sm:mb-2">Moyen</p>
            <p className="text-sm sm:text-base md:text-xl font-light text-white">{priceStats.average.toFixed(2)}€</p>
          </div>
          <div className="bg-[#0a0a0a] p-3 sm:p-4 md:p-6 text-center">
            <p className="text-[9px] sm:text-[10px] text-neutral-500 uppercase tracking-wider sm:tracking-widest mb-1 sm:mb-2">Plus haut</p>
            <p className="text-sm sm:text-base md:text-xl font-light text-[#9b1515]">{priceStats.highest.toFixed(2)}€</p>
          </div>
        </div>
      )}

      {/* Analysis Banner */}
      {!hasInsufficientData && !hasSingleObservation && isLowestPrice && (
        <div className="mb-4 sm:mb-6 md:mb-8 p-3 sm:p-4 bg-emerald-500/5 border border-emerald-500/20 flex items-center justify-center gap-2">
          <TrendingDown className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-500 flex-shrink-0" />
          <p className="text-emerald-500 text-[10px] sm:text-xs font-bold tracking-wider sm:tracking-widest uppercase">
            Prix le plus bas jamais vu
          </p>
        </div>
      )}

      {/* Graphique - Afficher seulement si données suffisantes */}
      {!hasInsufficientData && (
        <div className="h-[220px] sm:h-[260px] md:h-[300px] w-full min-w-[200px]">
          <ResponsiveContainer width="100%" height="100%" minWidth={200}>
            {hasSingleObservation ? (
              // Scatter chart pour un point unique
              <ScatterChart margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  stroke="#666" 
                  tick={{ fill: '#666', fontSize: 10, dy: 10 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  stroke="#666"
                  tick={{ fill: '#666', fontSize: 10 }}
                  tickFormatter={(value) => `${value}€`}
                  tickLine={false}
                  axisLine={false}
                  domain={getSinglePointDomain(chartData[0].price)}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)' }} />
                <Scatter name="Prix" data={chartData} fill="#d4a855" shape="circle" />
              </ScatterChart>
            ) : (
              // Line chart classique avec points bien visibles
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  stroke="#666" 
                  tick={{ fill: '#666', fontSize: 10, dy: 10 }}
                  tickLine={false}
                  axisLine={false}
                  padding={{ left: 20, right: 20 }}
                />
                <YAxis 
                  stroke="#666"
                  tick={{ fill: '#666', fontSize: 10 }}
                  tickFormatter={(value) => `${value}€`}
                  tickLine={false}
                  axisLine={false}
                  domain={['auto', 'auto']}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line 
                  type="stepAfter" 
                  dataKey="price" 
                  stroke="#d4a855" 
                  strokeWidth={2}
                  dot={{ fill: '#d4a855', r: 5, strokeWidth: 0 }}
                  activeDot={{ r: 7, fill: '#fff', stroke: '#d4a855', strokeWidth: 2 }}
                />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      )}

      {/* Legend / Info - Afficher seulement si données suffisantes */}
      {!hasInsufficientData && (
        <div className="mt-6 flex items-center justify-between text-[10px] text-neutral-600 uppercase tracking-widest font-medium">
          <span>Daily Price Check</span>
          <span>Source: Official Retailers</span>
        </div>
      )}
    </div>
  );
}
