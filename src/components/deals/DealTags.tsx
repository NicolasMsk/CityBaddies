'use client';

import { stringToTags } from '@/lib/utils/scoring';
import { Star, Flame, Award, Tag, Zap, Heart, Check, TrendingUp, Gift } from 'lucide-react';

interface DealTagsProps {
  tags: string | null;
  score?: number;
  compact?: boolean; // Pour affichage réduit sur les cards
}

/**
 * Composant d'affichage des tags de deal
 * Style "High-End Editorial": Minimaliste, sharp edges, monochrome & metallic accents
 */
export default function DealTags({ tags, score, compact = false }: DealTagsProps) {
  const tagList = stringToTags(tags);
  
  if (tagList.length === 0) return null;

  // En mode compact, on affiche seulement le tag principal + 1-2 secondaires
  const displayTags = compact ? tagList.slice(0, 3) : tagList;

  return (
    <div className="flex flex-wrap gap-2">
      {displayTags.map((tag) => (
        <span
          key={tag}
          className={`${getTagStyle(tag)} ${compact ? 'text-[10px] px-1.5 py-0.5' : 'text-[10px] px-2 py-1'} font-medium uppercase tracking-[0.2em] inline-flex items-center gap-1.5 border`}
        >
          {getTagIcon(tag, compact)}
          {getTagLabel(tag)}
        </span>
      ))}
      
      {/* Indicateur de score si fourni */}
      {score !== undefined && score >= 60 && !compact && (
        <span className="text-[10px] px-2 py-1 font-bold bg-[#1a1a1a] text-white border border-white/20 uppercase tracking-[0.2em]">
          Score: {score}
        </span>
      )}
    </div>
  );
}

/**
 * Retourne le style Tailwind pour chaque tag
 * Palette Premium: Noir, Blanc, Or, Bordeaux - Bords nets
 */
function getTagStyle(tag: string): string {
  const styles: Record<string, string> = {
    // Tags principaux - très visibles
    'DEAL_EXCEPTIONNEL': 'bg-[#d4a855] text-black border-[#d4a855]',
    'TOP_DEAL': 'bg-[#1a1a1a] text-[#d4a855] border-[#d4a855]',
    'BON_DEAL': 'bg-transparent text-white border-white/40',
    'DEAL_CORRECT': 'bg-transparent text-neutral-500 border-neutral-800',
    
    // Tags secondaires - plus subtils
    'LUXE': 'bg-[#0a0a0a] text-white border-white/20',
    'MOINS_50': 'bg-[#9b1515] text-white border-[#9b1515]',
    'GROSSE_PROMO': 'bg-[#7b0a0a]/50 text-white border-[#7b0a0a]',
    'TENDANCE': 'bg-transparent text-white border-white/30',
    'HOT': 'bg-[#d4a855]/10 text-[#d4a855] border-[#d4a855]/30',
    'APPROUVE': 'bg-emerald-900/20 text-emerald-500 border-emerald-900/50',
    'MEILLEUR_PRIX': 'bg-transparent text-[#d4a855] border-[#d4a855]/50',
    'NOUVEAU': 'bg-white text-black border-white',
    'IDEE_CADEAU': 'bg-transparent text-[#d4a855] border-[#d4a855]/30',
    'ESSENTIEL_ETE': 'bg-transparent text-neutral-400 border-neutral-800',
  };
  
  return styles[tag] || 'bg-transparent text-neutral-500 border-neutral-800';
}

/**
 * Retourne l'icône Lucide pour chaque tag
 */
function getTagIcon(tag: string, compact: boolean) {
  const size = compact ? "w-3 h-3" : "w-3 h-3";
  
  const icons: Record<string, any> = {
    'DEAL_EXCEPTIONNEL': <Flame className={size} />,
    'TOP_DEAL': <Star className={size} fill="currentColor" />,
    'BON_DEAL': <Check className={size} />,
    'DEAL_CORRECT': <Tag className={size} />,
    'LUXE': <Award className={size} />,
    'MOINS_50': <TrendingUp className={`${size} rotate-180`} />, // Down trend
    'GROSSE_PROMO': <Tag className={size} />,
    'TENDANCE': <TrendingUp className={size} />,
    'HOT': <Zap className={size} />,
    'APPROUVE': <Check className={size} />,
    'MEILLEUR_PRIX': <Tag className={size} />,
    'NOUVEAU': <Star className={size} />,
    'IDEE_CADEAU': <Gift className={size} />,
    'ESSENTIEL_ETE': <Star className={size} />,
  };
  
  return icons[tag] || null;
}

/**
 * Retourne le label lisible pour chaque tag
 */
function getTagLabel(tag: string): string {
  const labels: Record<string, string> = {
    'DEAL_EXCEPTIONNEL': 'Exceptionnel',
    'TOP_DEAL': 'Top Deal',
    'BON_DEAL': 'Bon Plan',
    'DEAL_CORRECT': 'Prix Correct',
    'LUXE': 'Luxe',
    'MOINS_50': '-50%',
    'GROSSE_PROMO': 'Grosse Promo',
    'TENDANCE': 'Tendance',
    'HOT': 'Hot',
    'APPROUVE': 'Vérifié',
    'MEILLEUR_PRIX': 'Meilleur Prix',
    'NOUVEAU': 'Nouveau',
    'IDEE_CADEAU': 'Idée Cadeau',
    'ESSENTIEL_ETE': 'Été',
  };
  
  return labels[tag] || tag.replace(/_/g, ' ');
}

/**
 * Composant pour afficher le badge de score
 */
export function ScoreBadge({ score }: { score: number }) {
  if (score < 40) return null;
  
  let styles = 'bg-[#1a1a1a] text-neutral-500 border-neutral-800';
  let icon = null;
  
  if (score >= 90) {
    styles = 'bg-[#d4a855] text-black border-[#d4a855]';
    icon = <Flame className="w-3 h-3" />;
  } else if (score >= 75) {
    styles = 'bg-[#1a1a1a] text-white border-white';
    icon = <Star className="w-3 h-3" fill="currentColor" />;
  } else if (score >= 60) {
    styles = 'bg-[#1a1a1a] text-[#d4a855] border-[#d4a855]';
    icon = <Check className="w-3 h-3" />;
  } else if (score >= 40) {
    styles = 'bg-[#1a1a1a] text-white border-white/20';
    icon = <Tag className="w-3 h-3" />;
  }
  
  return (
    <div className={`${styles} px-2 py-1 text-[10px] font-bold uppercase tracking-[0.2em] inline-flex items-center gap-1.5 border`}>
      {icon}
      <span>{score}</span>
    </div>
  );
}
