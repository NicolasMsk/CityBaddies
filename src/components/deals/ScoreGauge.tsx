'use client';

/**
 * =============================================================================
 * SCORE GAUGE - City Baddies Deal Score Component
 * =============================================================================
 * Affiche le score City Baddies sous forme de jauge circulaire premium.
 * Style cohérent avec le design dark/gold du site.
 * 
 * Variantes:
 * - compact: Petit badge pour les DealCards (cercle + score)
 * - full: Grande jauge pour la page détail (cercle + label + explication)
 */

interface ScoreGaugeProps {
  score: number;
  variant?: 'compact' | 'full';
}

function getScoreConfig(score: number) {
  if (score >= 8) {
    return {
      label: 'Exceptionnel',
      color: '#d4a855',       // gold
      bgRing: 'rgba(212, 168, 85, 0.15)',
      glow: 'rgba(212, 168, 85, 0.3)',
      textColor: 'text-[#d4a855]',
      borderColor: 'border-[#d4a855]',
    };
  }
  if (score >= 6) {
    return {
      label: 'Bon deal',
      color: '#ffffff',        // white
      bgRing: 'rgba(255, 255, 255, 0.1)',
      glow: 'rgba(255, 255, 255, 0.15)',
      textColor: 'text-white',
      borderColor: 'border-white/40',
    };
  }
  if (score >= 4) {
    return {
      label: 'Moyen',
      color: '#a3a3a3',        // neutral-400
      bgRing: 'rgba(163, 163, 163, 0.1)',
      glow: 'rgba(163, 163, 163, 0.1)',
      textColor: 'text-neutral-400',
      borderColor: 'border-neutral-600',
    };
  }
  return {
    label: 'À éviter',
    color: '#9b1515',          // red
    bgRing: 'rgba(155, 21, 21, 0.15)',
    glow: 'rgba(155, 21, 21, 0.1)',
    textColor: 'text-[#9b1515]',
    borderColor: 'border-[#9b1515]',
  };
}

export default function ScoreGauge({ score, variant = 'compact' }: ScoreGaugeProps) {
  if (!score || score < 1) return null;

  const config = getScoreConfig(score);

  // ====== COMPACT: badge horizontal pour DealCard ======
  if (variant === 'compact') {
    const radius = 14;
    const circumference = 2 * Math.PI * radius;
    const progress = (score / 10) * circumference;

    return (
      <div className="flex items-center gap-2.5 py-2" title={`Note City Baddies: ${score}/10 — ${config.label}`}>
        {/* Cercle score */}
        <div className="relative w-[36px] h-[36px] flex-shrink-0">
          <svg
            width="36"
            height="36"
            viewBox="0 0 36 36"
            className="transform -rotate-90"
          >
            <circle
              cx="18"
              cy="18"
              r={radius}
              fill="none"
              stroke={config.bgRing}
              strokeWidth="2"
            />
            <circle
              cx="18"
              cy="18"
              r={radius}
              fill="none"
              stroke={config.color}
              strokeWidth="2"
              strokeDasharray={circumference}
              strokeDashoffset={circumference - progress}
              strokeLinecap="butt"
              className="transition-all duration-700 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-[11px] font-bold ${config.textColor} tracking-tight`}>
              {score}
            </span>
          </div>
        </div>
        {/* Label */}
        <div className="flex flex-col">
          <span className="text-[8px] font-bold uppercase tracking-[0.2em] text-neutral-500">
            Note City Baddies
          </span>
          <span className={`text-[11px] font-medium ${config.textColor}`}>
            {config.label}
          </span>
        </div>
      </div>
    );
  }

  // ====== FULL: grande jauge pour la page deal detail ======
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 10) * circumference;

  return (
    <div className="flex items-center gap-6">
      {/* Circular gauge */}
      <div className="relative w-[100px] h-[100px] flex-shrink-0">
        <svg
          width="100"
          height="100"
          viewBox="0 0 100 100"
          className="transform -rotate-90"
        >
          {/* Background ring */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={config.bgRing}
            strokeWidth="3"
          />
          {/* Progress ring */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={config.color}
            strokeWidth="3"
            strokeDasharray={circumference}
            strokeDashoffset={circumference - progress}
            strokeLinecap="butt"
            className="transition-all duration-1000 ease-out"
            style={{
              filter: `drop-shadow(0 0 6px ${config.glow})`,
            }}
          />
        </svg>
        {/* Score number center */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-2xl font-light tracking-tight ${config.textColor}`}>
            {score}
          </span>
          <span className="text-[8px] text-neutral-600 uppercase tracking-[0.2em]">/10</span>
        </div>
      </div>

      {/* Labels */}
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-neutral-500">
          Score City Baddies
        </span>
        <span className={`text-sm font-medium ${config.textColor}`}>
          {config.label}
        </span>
        <span className="text-[10px] text-neutral-600 leading-relaxed max-w-[200px]">
          Basé sur le % de réduction, le prix au ml et la gamme de la marque.
        </span>
      </div>
    </div>
  );
}
