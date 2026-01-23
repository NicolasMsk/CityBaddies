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
  const coverageDays = differenceInDays(new Date(), firstSeenDate);
  
  // Règle : données insuffisantes si < 7 observations OU < 14 jours de couverture
  const hasInsufficientData = nObservations < 7 || coverageDays < 14;
  
  // Cas spécial : une seule observation
  const hasSingleObservation = nObservations === 1;

  const chartData = priceHistory.map((ph) => ({
    date: format(new Date(ph.date), 'd MMM', { locale: fr }),
    fullDate: format(new Date(ph.date), 'dd MMMM yyyy', { locale: fr }),
    price: ph.price,
  }));

  // Ne calculer ces valeurs que si on a assez de données
  const isLowestPrice = !hasInsufficientData && currentPrice <= priceStats.lowest * 1.02;
  const priceChange = ((currentPrice - priceStats.average) / priceStats.average) * 100;
  const savings = priceStats.average - currentPrice;

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#1a1a1a] border border-white/10 rounded-lg p-3 shadow-lg">
          <p className="text-white/50 text-sm">{payload[0].payload.fullDate}</p>
          <p className="text-white font-bold text-lg">{payload[0].value.toFixed(2)}€</p>
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
      {/* Message données insuffisantes */}
      {hasInsufficientData && (
        <div className="mb-8 p-4 bg-transparent border border-amber-500/30 flex items-start gap-4">
          <Clock className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-amber-500 text-xs font-bold tracking-widest uppercase mb-1">Historique en cours</p>
            <p className="text-amber-500/70 text-xs font-light tracking-wide">
              Nous récoltons actuellement des données pour cet article. L'analyse complète sera disponible après 7 jours de suivi.
            </p>
            <div className="flex flex-wrap gap-6 mt-3 text-[10px] text-amber-500/50 uppercase tracking-widest">
              <span>Points : {nObservations}</span>
              <span>Suivi depuis : {format(firstSeenDate, 'd MMM yyyy', { locale: fr })}</span>
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards - Sharp */}
      {!hasInsufficientData && !hasSingleObservation && (
        <div className="grid grid-cols-3 gap-px bg-white/10 border border-white/10 mb-8">
          <div className="bg-[#0a0a0a] p-6 text-center">
            <p className="text-[10px] text-neutral-500 uppercase tracking-widest mb-2">Plus bas</p>
            <p className="text-xl font-light text-emerald-400">{priceStats.lowest.toFixed(2)}€</p>
          </div>
          <div className="bg-[#0a0a0a] p-6 text-center">
            <p className="text-[10px] text-neutral-500 uppercase tracking-widest mb-2">Moyen</p>
            <p className="text-xl font-light text-white">{priceStats.average.toFixed(2)}€</p>
          </div>
          <div className="bg-[#0a0a0a] p-6 text-center">
            <p className="text-[10px] text-neutral-500 uppercase tracking-widest mb-2">Plus haut</p>
            <p className="text-xl font-light text-[#9b1515]">{priceStats.highest.toFixed(2)}€</p>
          </div>
        </div>
      )}

      {/* Analysis Banner */}
      {!hasInsufficientData && !hasSingleObservation && isLowestPrice && (
        <div className="mb-8 p-4 bg-emerald-500/5 border border-emerald-500/20 flex items-center justify-center gap-2">
          <TrendingDown className="h-4 w-4 text-emerald-500" />
          <p className="text-emerald-500 text-xs font-bold tracking-widest uppercase">
            Prix le plus bas jamais vu • C'est le moment !
          </p>
        </div>
      )}

      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          {hasSingleObservation ? (
            // Scatter chart pour un point unique
            <ScatterChart margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
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
            // Line chart classique
            <LineChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
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
                strokeWidth={1}
                dot={{ fill: '#d4a855', r: 2, strokeWidth: 0 }}
                activeDot={{ r: 4, fill: '#fff' }}
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Legend / Info */}
      <div className="mt-6 flex items-center justify-between text-[10px] text-neutral-600 uppercase tracking-widest font-medium">
        <span>Daily Price Check</span>
        <span>Source: Official Retailers</span>
      </div>
    </div>
  );
}
