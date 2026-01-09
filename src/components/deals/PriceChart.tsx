'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { PriceHistory, PriceStats } from '@/types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { TrendingDown, TrendingUp, Minus, AlertCircle } from 'lucide-react';

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
      <div className="bg-[#1a1a1a] rounded-2xl p-6 border border-white/10">
        <h3 className="text-lg font-semibold text-white mb-4">📈 Historique des prix</h3>
        <div className="text-center py-8">
          <p className="text-white/50">Pas encore d&apos;historique de prix disponible</p>
          <p className="text-white/30 text-sm mt-2">Les données seront collectées au fil du temps</p>
        </div>
      </div>
    );
  }

  const chartData = priceHistory.map((ph) => ({
    date: format(new Date(ph.date), 'd MMM', { locale: fr }),
    fullDate: format(new Date(ph.date), 'dd MMMM yyyy', { locale: fr }),
    price: ph.price,
  }));

  const isLowestPrice = currentPrice <= priceStats.lowest * 1.02; // Within 2% of lowest
  const isHighestPrice = currentPrice >= priceStats.highest * 0.98;
  const priceChange = ((currentPrice - priceStats.average) / priceStats.average) * 100;

  const CustomTooltip = ({ active, payload, label }: any) => {
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

  return (
    <div className="bg-[#1a1a1a] rounded-2xl p-6 border border-white/10">
      <h3 className="text-lg font-semibold text-white mb-4">📈 Historique des prix</h3>

      {/* Price Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-[#7b0a0a]/20 rounded-xl p-4 border border-[#7b0a0a]/30">
          <p className="text-white/50 text-xs mb-1">Prix actuel</p>
          <p className="text-xl font-bold price-premium">{priceStats.current.toFixed(2)}€</p>
          {isLowestPrice && (
            <span className="inline-flex items-center gap-1 mt-1 text-xs text-[#ff6b6b]">
              <TrendingDown className="h-3 w-3" /> Plus bas !
            </span>
          )}
        </div>
        <div className="bg-[#7b0a0a]/20 rounded-xl p-4 border border-[#7b0a0a]/30">
          <p className="text-white/50 text-xs mb-1">Prix le plus bas</p>
          <p className="text-xl font-bold text-[#ff6b6b]">{priceStats.lowest.toFixed(2)}€</p>
        </div>
        <div className="bg-[#5a0808]/20 rounded-xl p-4 border border-[#5a0808]/30">
          <p className="text-white/50 text-xs mb-1">Prix le plus haut</p>
          <p className="text-xl font-bold text-[#9b1515]">{priceStats.highest.toFixed(2)}€</p>
        </div>
        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
          <p className="text-white/50 text-xs mb-1">Prix moyen</p>
          <p className="text-xl font-bold text-white/60">{priceStats.average.toFixed(2)}€</p>
          <span className={`inline-flex items-center gap-1 mt-1 text-xs ${priceChange < 0 ? 'text-[#ff6b6b]' : priceChange > 0 ? 'text-[#9b1515]' : 'text-white/40'}`}>
            {priceChange < 0 ? <TrendingDown className="h-3 w-3" /> : priceChange > 0 ? <TrendingUp className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
            {priceChange > 0 ? '+' : ''}{priceChange.toFixed(1)}% vs moyenne
          </span>
        </div>
      </div>

      {/* Recommendation */}
      {isLowestPrice && (
        <div className="mb-6 p-4 bg-[#7b0a0a]/10 border border-[#7b0a0a]/30 rounded-xl flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-[#ff6b6b] flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-[#ff6b6b] font-semibold">C&apos;est le moment d&apos;acheter ! 🎯</p>
            <p className="text-[#ff6b6b]/70 text-sm">
              Le prix actuel est proche du prix le plus bas jamais enregistré. 
              Vous économisez {(priceStats.average - currentPrice).toFixed(2)}€ par rapport au prix moyen.
            </p>
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis 
              dataKey="date" 
              stroke="rgba(255,255,255,0.3)" 
              fontSize={12}
              tickLine={false}
            />
            <YAxis 
              stroke="rgba(255,255,255,0.3)" 
              fontSize={12}
              tickLine={false}
              tickFormatter={(value) => `${value}€`}
              domain={['auto', 'auto']}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine 
              y={priceStats.average} 
              stroke="#9b1515" 
              strokeDasharray="5 5"
              label={{ value: 'Moyenne', fill: '#9b1515', fontSize: 10 }}
            />
            <Line
              type="monotone"
              dataKey="price"
              stroke="url(#gradient)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 6, fill: '#ff6b6b' }}
            />
            <defs>
              <linearGradient id="gradient" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#ff6b6b" />
                <stop offset="100%" stopColor="#7b0a0a" />
              </linearGradient>
            </defs>
          </LineChart>
        </ResponsiveContainer>
      </div>

      <p className="text-white/30 text-xs mt-4 text-center">
        Données sur les 90 derniers jours • Mise à jour quotidienne
      </p>
    </div>
  );
}
