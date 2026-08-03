'use client';

import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { PriceHistory, PriceStats } from '@/types';
import { format, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';

// ── Types ──────────────────────────────────────────────────────────

interface PriceChartProps {
  priceHistory: PriceHistory[];
  priceStats: PriceStats;
  currentPrice: number;
}

// ── Helpers ────────────────────────────────────────────────────────

/** Déduplique l'historique : 1 point par jour, on garde le prix MIN (meilleur deal du jour) */
function deduplicateByDay(history: PriceHistory[]) {
  const dayMap = new Map<string, PriceHistory>();
  for (const ph of history) {
    const dayKey = new Date(ph.date).toISOString().split('T')[0];
    const existing = dayMap.get(dayKey);
    if (!existing || ph.price < existing.price) {
      dayMap.set(dayKey, ph);
    }
  }
  return Array.from(dayMap.values()).sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
}

/** Calcule le "score de prix" : 0 = plus bas historique, 100 = plus haut historique */
function getPriceScore(current: number, lowest: number, highest: number): number {
  if (highest === lowest) return 50;
  return Math.round(((current - lowest) / (highest - lowest)) * 100);
}

/** Retourne le verdict d'achat basé sur le score */
function getPriceVerdict(score: number): {
  label: string;
  sublabel: string;
  color: string;
  bgColor: string;
  borderColor: string;
} {
  if (score <= 25) {
    return {
      label: 'Excellent Prix',
      sublabel: 'Le prix est actuellement à son plus bas.',
      color: 'text-[#d4a855]',
      bgColor: 'bg-[#d4a855]/5',
      borderColor: 'border-[#d4a855]/20',
    };
  }
  if (score <= 50) {
    return {
      label: 'Bon Prix',
      sublabel: 'Un tarif intéressant par rapport à la moyenne.',
      color: 'text-white',
      bgColor: 'bg-white/5',
      borderColor: 'border-white/10',
    };
  }
  if (score <= 75) {
    return {
      label: 'Prix Habituel',
      sublabel: 'Ce tarif correspond à la moyenne de nos relevés.',
      color: 'text-white/60',
      bgColor: 'bg-transparent',
      borderColor: 'border-white/5',
    };
  }
  return {
    label: 'Prix Élevé',
    sublabel: 'Le prix est supérieur à la moyenne de nos observations.',
    color: 'text-rose-300',
    bgColor: 'bg-rose-500/5',
    borderColor: 'border-rose-500/10',
  };
}

/** Calcule la tendance récente (les N derniers points) */
function getPriceTrend(data: { price: number }[]): 'up' | 'down' | 'stable' {
  if (data.length < 2) return 'stable';
  const recent = data.slice(-Math.min(5, data.length));
  const first = recent[0].price;
  const last = recent[recent.length - 1].price;
  const changePercent = ((last - first) / first) * 100;
  if (changePercent > 2) return 'up';
  if (changePercent < -2) return 'down';
  return 'stable';
}

// ── Component ──────────────────────────────────────────────────────

export default function PriceChart({ priceHistory, priceStats, currentPrice }: PriceChartProps) {
  // ── Validation ──
  const hasValidData =
    priceHistory &&
    priceHistory.length > 0 &&
    priceStats &&
    isFinite(priceStats.lowest) &&
    isFinite(priceStats.highest) &&
    isFinite(priceStats.average) &&
    !isNaN(priceStats.lowest) &&
    !isNaN(priceStats.highest) &&
    !isNaN(priceStats.average);

  if (!hasValidData) {
    return (
      <div className="text-center py-6 sm:py-8">
        <p className="text-white/40 text-xs tracking-widest uppercase">
          Suivi des prix en cours
        </p>
        <p className="text-white/20 text-[10px] mt-2 max-w-xs mx-auto">
          Nous collectons les prix chaque jour pour vous offrir un historique fiable.
        </p>
      </div>
    );
  }

  // ── Data Processing ──
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const deduplicated = useMemo(() => deduplicateByDay(priceHistory), [priceHistory]);
  const uniqueDays = deduplicated.length;
  const allPricesSame = deduplicated.every(
    (ph) => Math.abs(ph.price - deduplicated[0].price) < 0.01
  );

  const priceScore = getPriceScore(currentPrice, priceStats.lowest, priceStats.highest);
  const verdict = getPriceVerdict(priceScore);
  const trend = getPriceTrend(deduplicated);
  const savings = priceStats.average - currentPrice;
  const hasEnoughForChart = uniqueDays >= 3 && !allPricesSame;

  // ── Chart data ──
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const chartData = useMemo(
    () =>
      deduplicated.map((ph) => ({
        date: format(new Date(ph.date), 'd MMM', { locale: fr }),
        fullDate: format(new Date(ph.date), 'dd MMMM yyyy', { locale: fr }),
        price: ph.price,
        volume:
          ph.volumeRaw ||
          (ph.volumeValue && ph.volumeUnit
            ? `${ph.volumeValue} ${ph.volumeUnit}`
            : null),
      })),
    [deduplicated]
  );

  const trackingSince = deduplicated.length > 0
    ? format(new Date(deduplicated[0].date), 'd MMMM yyyy', { locale: fr })
    : null;
  const daysCovered = deduplicated.length >= 2
    ? differenceInDays(
        new Date(deduplicated[deduplicated.length - 1].date),
        new Date(deduplicated[0].date)
      )
    : 0;

  // ── Custom Tooltip ──
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      const price = payload[0].value as number;
      const vsAvg = price - priceStats.average;
      return (
        <div className="bg-[#141414] border border-white/10 rounded-xl p-3.5 shadow-2xl min-w-[160px]">
          <p className="text-white/40 text-[10px] uppercase tracking-widest mb-1.5">
            {d.fullDate}
          </p>
          <p className="text-white font-medium text-lg tracking-tight">
            {price.toFixed(2).replace('.', ',')} €
          </p>
          {d.volume && (
            <p className="text-white/30 text-[10px] mt-0.5">{d.volume}</p>
          )}
          <div className="mt-2.5 pt-2 border-t border-white/5">
            <p className={`text-[10px] font-medium ${vsAvg <= 0 ? 'text-[#d4a855]' : 'text-rose-300'}`}>
              {vsAvg <= 0
                ? `${Math.abs(vsAvg).toFixed(2).replace('.', ',')} € sous la moyenne`
                : `${vsAvg.toFixed(2).replace('.', ',')} € au-dessus`}
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  // ── Custom Dot ──
  const CustomDot = (props: any) => {
    const { cx, cy } = props;
    if (!cx || !cy) return null;
    return (
      <circle cx={cx} cy={cy} r={3} fill="#d4a855" stroke="#1a1a1a" strokeWidth={1.5} />
    );
  };

  const CustomActiveDot = (props: any) => {
    const { cx, cy } = props;
    if (!cx || !cy) return null;
    return (
      <>
        <circle cx={cx} cy={cy} r={9} fill="rgba(212,168,85,0.12)" />
        <circle cx={cx} cy={cy} r={4.5} fill="#fff" stroke="#d4a855" strokeWidth={2} />
      </>
    );
  };

  const yMin = Math.floor(priceStats.lowest * 0.95 * 100) / 100;
  const yMax = Math.ceil(priceStats.highest * 1.05 * 100) / 100;

  return (
    <div className="w-full space-y-5">

      {/* ── 1. VERDICT ── */}
      {uniqueDays >= 2 && !allPricesSame && (
        <div className={`${verdict.bgColor} ${verdict.borderColor} border rounded-2xl p-5 sm:p-6`}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h4 className={`text-sm sm:text-base font-medium uppercase tracking-widest ${verdict.color}`}>
                  {verdict.label}
                </h4>
                {trend !== 'stable' && (
                  <span className={`text-[9px] uppercase tracking-widest px-2.5 py-1 rounded-full ${
                    trend === 'down'
                      ? 'bg-[#d4a855]/10 text-[#d4a855]'
                      : 'bg-rose-500/10 text-rose-300'
                  }`}>
                    {trend === 'down' ? 'En baisse' : 'En hausse'}
                  </span>
                )}
              </div>
              <p className="text-white/50 text-xs sm:text-sm mt-1.5 font-light leading-relaxed">
                {verdict.sublabel}
              </p>
            </div>
            {savings !== 0 && (
              <div className="sm:text-right flex-shrink-0">
                <p className={`text-sm sm:text-base font-medium ${savings >= 0 ? 'text-[#d4a855]' : 'text-rose-300'}`}>
                  {savings >= 0 ? `-${savings.toFixed(2).replace('.', ',')} €` : `+${Math.abs(savings).toFixed(2).replace('.', ',')} €`}
                </p>
                <p className="text-white/30 text-[9px] mt-0.5 uppercase tracking-widest">vs moyenne</p>
              </div>
            )}
          </div>

          {/* Jauge */}
          <div className="mt-5 pt-4 border-t border-white/5">
            <div className="flex items-center justify-between text-[10px] text-white/35 uppercase tracking-widest mb-2.5">
              <span>{priceStats.lowest.toFixed(2).replace('.', ',')} €</span>
              <span>{priceStats.highest.toFixed(2).replace('.', ',')} €</span>
            </div>
            <div className="relative h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background: 'linear-gradient(to right, #d4a855, rgba(255,255,255,0.3) 50%, #fb7185)',
                  opacity: 0.7,
                }}
              />
              <div
                className="absolute top-1/2 w-3 h-3 rounded-full border-2 border-[#1a1a1a] bg-white shadow-md transition-all duration-700"
                style={{
                  left: `clamp(6px, ${priceScore}%, calc(100% - 6px))`,
                  transform: 'translate(-50%, -50%)',
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── 2. GRAPHIQUE ── */}
      {hasEnoughForChart ? (
        <div>
          <div className="h-[200px] sm:h-[240px] md:h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#d4a855" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="#d4a855" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke="transparent"
                  tick={{ fill: '#555', fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  padding={{ left: 15, right: 15 }}
                />
                <YAxis
                  stroke="transparent"
                  tick={{ fill: '#555', fontSize: 10 }}
                  tickFormatter={(v) => `${v}€`}
                  tickLine={false}
                  axisLine={false}
                  domain={[yMin, yMax]}
                  width={55}
                />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine
                  y={priceStats.average}
                  stroke="rgba(255,255,255,0.12)"
                  strokeDasharray="6 4"
                  label={{
                    value: `Moy. ${priceStats.average.toFixed(2).replace('.', ',')}€`,
                    position: 'insideTopRight',
                    fill: '#555',
                    fontSize: 9,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="price"
                  stroke="#d4a855"
                  strokeWidth={2}
                  fill="url(#priceGradient)"
                  dot={<CustomDot />}
                  activeDot={<CustomActiveDot />}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Légende minimale */}
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-1.5 text-[9px] text-white/20 uppercase tracking-widest">
              <div className="w-4 border-t border-dashed border-white/15" />
              <span>Moyenne</span>
            </div>
            <span className="text-[9px] text-white/20 uppercase tracking-widest">
              {uniqueDays} relevés · {daysCovered}j
            </span>
          </div>
        </div>
      ) : (
        <div className="text-center py-5 sm:py-6 border border-white/5 rounded-xl">
          <p className="text-white/30 text-[10px] uppercase tracking-widest font-medium">
            Graphique disponible prochainement
          </p>
          <p className="text-white/15 text-[10px] mt-2 max-w-[280px] mx-auto leading-relaxed">
            {trackingSince && <>Suivi démarré le {trackingSince}. </>}
            {uniqueDays < 3
              ? `${uniqueDays} relevé${uniqueDays > 1 ? 's' : ''} collecté${uniqueDays > 1 ? 's' : ''} — il en faut au moins 3 pour tracer une courbe.`
              : 'Le prix n\'a pas encore varié — le graphique apparaîtra dès un changement.'}
          </p>
          <div className="mt-3 mx-auto max-w-[180px]">
            <div className="flex items-center justify-between text-[8px] text-white/20 mb-1">
              <span>{uniqueDays} jour{uniqueDays > 1 ? 's' : ''}</span>
              <span>7j</span>
            </div>
            <div className="h-1 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#d4a855]/30 rounded-full transition-all duration-700"
                style={{ width: `${Math.min(100, (uniqueDays / 7) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── 3. STATS ── */}
      {uniqueDays >= 2 && !allPricesSame && (
        <div className="flex gap-2">
          <div className="flex-1 bg-white/[0.03] border border-white/5 rounded-2xl p-3 sm:p-4 text-center">
            <p className="text-[9px] sm:text-[10px] text-white/35 uppercase tracking-widest mb-1.5">Habituel</p>
            <p className="text-sm sm:text-base font-light text-white/70 tabular-nums">
              {priceStats.average.toFixed(2).replace('.', ',')} €
            </p>
          </div>
          <div className="flex-1 bg-white/[0.03] border border-white/5 rounded-2xl p-3 sm:p-4 text-center">
            <p className="text-[9px] sm:text-[10px] text-white/35 uppercase tracking-widest mb-1.5">Plus haut</p>
            <p className="text-sm sm:text-base font-light text-rose-300/70 tabular-nums">
              {priceStats.highest.toFixed(2).replace('.', ',')} €
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
