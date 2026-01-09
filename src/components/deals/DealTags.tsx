'use client';

import { stringToTags } from '@/lib/utils/scoring';

interface DealTagsProps {
  tags: string | null;
  score?: number;
  compact?: boolean; // Pour affichage réduit sur les cards
}

/**
 * Composant d'affichage des tags de deal
 * Style "City Baddies" : dark, rouge bordeaux, touches dorées
 */
export default function DealTags({ tags, score, compact = false }: DealTagsProps) {
  const tagList = stringToTags(tags);
  
  if (tagList.length === 0) return null;

  // En mode compact, on affiche seulement le tag principal + 1-2 secondaires
  const displayTags = compact ? tagList.slice(0, 3) : tagList;

  return (
    <div className="flex flex-wrap gap-1.5">
      {displayTags.map((tag) => (
        <span
          key={tag}
          className={`${getTagStyle(tag)} ${compact ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1'} rounded-full font-medium inline-flex items-center gap-1 transition-all`}
        >
          {getTagIcon(tag)}
          {getTagLabel(tag)}
        </span>
      ))}
      
      {/* Indicateur de score si fourni */}
      {score !== undefined && score >= 60 && !compact && (
        <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-white/5 text-white/60 border border-white/10">
          Score: {score}
        </span>
      )}
    </div>
  );
}

/**
 * Retourne le style Tailwind pour chaque tag
 * Palette City Baddies : noir, bordeaux, or
 */
function getTagStyle(tag: string): string {
  const styles: Record<string, string> = {
    // Tags principaux - très visibles
    'DEAL_EXCEPTIONNEL': 'bg-gradient-to-r from-[#7b0a0a] to-[#d4a855] text-white shadow-lg shadow-[#7b0a0a]/30 animate-pulse-slow',
    'TOP_DEAL': 'bg-[#7b0a0a] text-white shadow-md shadow-[#7b0a0a]/20',
    'BON_DEAL': 'bg-[#2d1a1e] text-[#ff8a8a] border border-[#7b0a0a]/30',
    'DEAL_CORRECT': 'bg-white/5 text-white/70 border border-white/10',
    
    // Tags secondaires - plus subtils
    'LUXE': 'bg-gradient-to-r from-[#d4a855]/20 to-[#b8924a]/20 text-[#d4a855] border border-[#d4a855]/30',
    'MOINS_50': 'bg-[#7b0a0a]/80 text-white',
    'GROSSE_PROMO': 'bg-[#5c1010] text-[#ff8a8a]',
    'TENDANCE': 'bg-gradient-to-r from-pink-500/20 to-[#7b0a0a]/20 text-pink-300 border border-pink-500/30',
    'HOT': 'bg-orange-500/20 text-orange-300 border border-orange-500/30',
    'APPROUVE': 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
    'MEILLEUR_PRIX': 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    'NOUVEAU': 'bg-sky-500/20 text-sky-300 border border-sky-500/30',
    'IDEE_CADEAU': 'bg-[#7b0a0a]/30 text-[#ff8a8a] border border-[#7b0a0a]/40',
    'ESSENTIEL_ETE': 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
  };
  
  return styles[tag] || 'bg-white/5 text-white/60 border border-white/10';
}

/**
 * Retourne l'icône emoji pour chaque tag
 */
function getTagIcon(tag: string): string {
  const icons: Record<string, string> = {
    'DEAL_EXCEPTIONNEL': '🔥',
    'TOP_DEAL': '⭐',
    'BON_DEAL': '👍',
    'DEAL_CORRECT': '💡',
    'LUXE': '💎',
    'MOINS_50': '🏷️',
    'GROSSE_PROMO': '🏷️',
    'TENDANCE': '📈',
    'HOT': '🔥',
    'APPROUVE': '✅',
    'MEILLEUR_PRIX': '💰',
    'NOUVEAU': '🆕',
    'IDEE_CADEAU': '🎁',
    'ESSENTIEL_ETE': '☀️',
  };
  
  return icons[tag] || '';
}

/**
 * Retourne le label lisible pour chaque tag
 */
function getTagLabel(tag: string): string {
  const labels: Record<string, string> = {
    'DEAL_EXCEPTIONNEL': 'Exceptionnel',
    'TOP_DEAL': 'Top Deal',
    'BON_DEAL': 'Bon Deal',
    'DEAL_CORRECT': 'Correct',
    'LUXE': 'Luxe',
    'MOINS_50': '-50%',
    'GROSSE_PROMO': 'Grosse Promo',
    'TENDANCE': 'Tendance',
    'HOT': 'Hot',
    'APPROUVE': 'Approuvé',
    'MEILLEUR_PRIX': 'Meilleur Prix',
    'NOUVEAU': 'Nouveau',
    'IDEE_CADEAU': 'Idée Cadeau',
    'ESSENTIEL_ETE': 'Été',
  };
  
  return labels[tag] || tag;
}

/**
 * Composant pour afficher le badge de score
 */
export function ScoreBadge({ score }: { score: number }) {
  if (score < 40) return null;
  
  let bgColor = 'bg-white/10';
  let textColor = 'text-white/60';
  let icon = '';
  
  if (score >= 90) {
    bgColor = 'bg-gradient-to-r from-[#7b0a0a] to-[#d4a855]';
    textColor = 'text-white';
    icon = '🔥';
  } else if (score >= 75) {
    bgColor = 'bg-[#7b0a0a]';
    textColor = 'text-white';
    icon = '⭐';
  } else if (score >= 60) {
    bgColor = 'bg-[#2d1a1e]';
    textColor = 'text-[#ff8a8a]';
    icon = '👍';
  } else if (score >= 40) {
    bgColor = 'bg-white/5';
    textColor = 'text-white/70';
    icon = '💡';
  }
  
  return (
    <div className={`${bgColor} ${textColor} px-3 py-1.5 rounded-full text-sm font-bold inline-flex items-center gap-1.5 shadow-lg`}>
      <span>{icon}</span>
      <span>{score}</span>
    </div>
  );
}
