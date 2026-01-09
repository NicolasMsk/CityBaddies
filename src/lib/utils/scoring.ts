/**
 * Module de scoring pour les deals beauté
 * Score sur 100 basé sur : remise, tier de marque, rapport qualité/prix, tendances
 * 
 * Formule simplifiée:
 * Score = (discountScore × 0.40) + (brandScore × 0.25) + (valueScore × 0.20) + (trendingBonus × 0.15) + hotBonus
 * 
 * - 40% de remise = score max (100)
 * - isHot = simple bonus de +1 pt (pas un % du score)
 */

export interface DealScoreInput {
  discountPercent: number;    // Pourcentage de remise (0-100)
  brandTier: number | null;   // 1=Luxe, 2=Milieu, 3=Entrée (null=non classé)
  pricePerUnit: number | null; // Prix par ml/g en euros
  isHot: boolean;             // Validé par la communauté (votes >= 20)
  isTrending: boolean;        // Produit tendance des réseaux sociaux
  categorySlug?: string;      // Pour calculer le ratio vs moyenne catégorie
  subcategorySlug?: string;   // Pour tags contextuels (coffrets, etc.)
  subsubcategorySlug?: string; // Pour tags contextuels plus précis
  createdAt?: Date;           // Pour le tag NOUVEAU
  votes?: number;             // Pour le tag APPROUVÉ
  productName?: string;       // Pour détecter "coffret" dans le nom
}

export interface DealScoreResult {
  score: number;       // Score global 0-100
  tags: string[];      // Liste des tags applicables
  breakdown: {         // Détail des scores par critère
    discountScore: number;
    brandScore: number;
    valueScore: number;
    trendingBonus: number;
    hotBonus: number;
  };
}

// Poids des différents critères (total = 100% sans hot)
const WEIGHTS = {
  discount: 0.40,    // 40% - La remise reste le critère principal
  brand: 0.25,       // 25% - Le tier de marque
  value: 0.20,       // 20% - Le rapport qualité/prix
  trending: 0.15,    // 15% - Tendance réseaux sociaux
};

// Moyennes de référence pour comparer le pricePerUnit par catégorie
const AVG_PRICE_PER_UNIT: Record<string, number> = {
  'parfums': 1.20,       // €/ml - Parfums généralement plus chers
  'soins-visage': 0.80,  // €/ml - Sérums, crèmes
  'maquillage': 2.00,    // €/g ou €/ml - Très variable
  'cheveux': 0.15,       // €/ml - Shampoings, soins
  'soins-corps': 0.12,   // €/ml - Laits, huiles
  'ongles': 0.80,        // €/ml - Vernis
  'accessoires': 1.00,   // Référence par défaut
  'default': 0.60,       // Moyenne générale
};

/**
 * Calcule le score de remise (0-100)
 * Formule: min(discountPercent / 40 × 100, 100) → 40% de réduc = score max
 */
function calculateDiscountScore(discountPercent: number): number {
  return Math.min((discountPercent / 40) * 100, 100);
}

/**
 * Calcule le score de marque basé sur le tier (0-100)
 * tier1: 100 (Luxe), tier2: 60 (Milieu), tier3: 30 (Entrée)
 */
function calculateBrandScore(brandTier: number | null): number {
  if (brandTier === 1) return 100; // Marques luxe (Chanel, Dior, etc.)
  if (brandTier === 2) return 60;  // Marques milieu de gamme (Benefit, Too Faced)
  if (brandTier === 3) return 30;  // Marques entrée de gamme
  return 50; // Non classé = score moyen
}

/**
 * Calcule le score de valeur basé sur le prix par unité (0-100)
 * Formule: 100 - (pricePerUnit / avgPricePerUnit × 50)
 */
function calculateValueScore(pricePerUnit: number | null, categorySlug?: string): number {
  if (pricePerUnit === null || pricePerUnit <= 0) return 50; // Score neutre si pas de données
  
  const avgPrice = AVG_PRICE_PER_UNIT[categorySlug || 'default'] 
    || AVG_PRICE_PER_UNIT['default'];
  
  const score = 100 - (pricePerUnit / avgPrice) * 50;
  
  return Math.max(0, Math.min(100, score));
}

/**
 * Calcule le score global d'un deal
 */
export function calculateDealScore(input: DealScoreInput): DealScoreResult {
  const discountScore = calculateDiscountScore(input.discountPercent);
  const brandScore = calculateBrandScore(input.brandTier);
  const valueScore = calculateValueScore(input.pricePerUnit, input.categorySlug);
  const trendingBonus = input.isTrending ? 100 : 0;
  const hotBonus = input.isHot ? 1 : 0; // Simple +1 pt si validé par la communauté

  // Calcul du score pondéré
  let score = Math.round(
    discountScore * WEIGHTS.discount +
    brandScore * WEIGHTS.brand +
    valueScore * WEIGHTS.value +
    trendingBonus * WEIGHTS.trending
  );
  
  // Ajouter le petit bonus hot (+1 pt)
  score += hotBonus;

  // Clamp entre 0 et 100
  score = Math.min(100, Math.max(0, score));

  // Génération des tags
  const tags = getDealTags({
    score,
    discountPercent: input.discountPercent,
    brandTier: input.brandTier,
    isHot: input.isHot,
    isTrending: input.isTrending,
    pricePerUnit: input.pricePerUnit,
    categorySlug: input.categorySlug,
    subcategorySlug: input.subcategorySlug,
    subsubcategorySlug: input.subsubcategorySlug,
    createdAt: input.createdAt,
    votes: input.votes,
    productName: input.productName,
  });

  return {
    score,
    tags,
    breakdown: {
      discountScore: Math.round(discountScore),
      brandScore,
      valueScore: Math.round(valueScore),
      trendingBonus,
      hotBonus,
    },
  };
}

/**
 * Détermine les tags applicables à un deal
 */
interface TagInput {
  score: number;
  discountPercent: number;
  brandTier: number | null;
  isHot: boolean;
  isTrending: boolean;
  pricePerUnit: number | null;
  categorySlug?: string;
  subcategorySlug?: string;
  subsubcategorySlug?: string;
  createdAt?: Date;
  votes?: number;
  productName?: string; // Nom du produit pour détecter "coffret"
}

export function getDealTags(input: TagInput): string[] {
  const tags: string[] = [];

  // === 1. Tag principal unique basé sur le score ===
  // On ne garde QU'UN SEUL tag de qualité pour éviter la surcharge
  if (input.score >= 90) {
    tags.push('DEAL_EXCEPTIONNEL'); // 🔥 Rouge/Or - Réservé aux meilleurs
  } else if (input.score >= 80) {
    tags.push('TOP_DEAL');          // ⭐ Orange - Très bon deal
  }
  // On ne met plus BON_DEAL/DEAL_CORRECT - trop de bruit

  // === 2. Tags secondaires (1 seul max, le plus pertinent) ===
  let hasSecondaryTag = false;

  // Priorité 1: Marque luxe (le plus différenciant)
  if (!hasSecondaryTag && input.brandTier === 1) {
    tags.push('LUXE');
    hasSecondaryTag = true;
  }

  // Priorité 2: Grosse remise (>= 50% seulement, plus strict)
  if (!hasSecondaryTag && input.discountPercent >= 50) {
    tags.push('PROMO_FLASH');
    hasSecondaryTag = true;
  }

  // Priorité 3: Tendance réseaux sociaux
  if (!hasSecondaryTag && input.isTrending) {
    tags.push('TENDANCE');
    hasSecondaryTag = true;
  }

  // Priorité 4: Meilleur prix/ml (vraiment exceptionnel: < 50% de la moyenne)
  if (!hasSecondaryTag && input.pricePerUnit !== null && input.pricePerUnit > 0 && input.categorySlug) {
    const avgPrice = AVG_PRICE_PER_UNIT[input.categorySlug] || AVG_PRICE_PER_UNIT['default'];
    if (input.pricePerUnit < avgPrice * 0.5) {
      tags.push('PRIX_IMBATTABLE');
      hasSecondaryTag = true;
    }
  }

  // === 3. Tag contextuel "Idée Cadeau" (coffrets détectés dans le nom ou catégorie) ===
  const productNameLower = input.productName?.toLowerCase() || '';
  const isCoffret = productNameLower.includes('coffret') ||
                    input.subcategorySlug?.includes('coffret') ||
                    input.subsubcategorySlug?.includes('coffret');
  
  // Idée cadeau pour tous les coffrets, toute l'année
  if (isCoffret && tags.length < 2) {
    tags.push('IDEE_CADEAU');
  }

  // === 4. Tag communautaire (très validé seulement) ===
  if (input.votes && input.votes >= 50 && tags.length < 2) {
    tags.push('VALIDE_COMMUNAUTE');
  }

  // Maximum 2 tags pour rester lisible
  return tags.slice(0, 2);
}

/**
 * Convertit un tableau de tags en chaîne séparée par des virgules
 */
export function tagsToString(tags: string[]): string {
  return tags.join(',');
}

/**
 * Parse une chaîne de tags en tableau
 */
export function stringToTags(tagsString: string | null): string[] {
  if (!tagsString) return [];
  return tagsString.split(',').filter(Boolean);
}

/**
 * Formate le score pour l'affichage avec émojis
 */
export function formatScore(score: number): string {
  if (score >= 90) return `🔥 ${score}`;
  if (score >= 75) return `⭐ ${score}`;
  if (score >= 60) return `👍 ${score}`;
  if (score >= 40) return `💡 ${score}`;
  return `${score}`;
}

/**
 * Retourne la couleur du texte associée à un score pour l'UI
 */
export function getScoreColor(score: number): string {
  if (score >= 90) return 'text-red-600';
  if (score >= 75) return 'text-orange-600';
  if (score >= 60) return 'text-green-600';
  if (score >= 40) return 'text-blue-600';
  return 'text-gray-500';
}

/**
 * Retourne la couleur de fond associée à un score pour l'UI
 */
export function getScoreBgColor(score: number): string {
  if (score >= 90) return 'bg-red-100';
  if (score >= 75) return 'bg-orange-100';
  if (score >= 60) return 'bg-green-100';
  if (score >= 40) return 'bg-blue-100';
  return 'bg-gray-100';
}

/**
 * Retourne le label du tag avec émoji pour l'affichage
 */
export function getTagLabel(tag: string): string {
  const labels: Record<string, string> = {
    'DEAL_EXCEPTIONNEL': '🔥 Deal Exceptionnel',
    'TOP_DEAL': '⭐ Top Deal',
    'BON_DEAL': '👍 Bon Deal',
    'DEAL_CORRECT': '💡 Deal Correct',
    'LUXE': '💎 Luxe',
    'MOINS_50': '🏷️ -50% et plus',
    'GROSSE_PROMO': '🏷️ Grosse Promo',
    'TENDANCE': '🔥 Tendance',
    'HOT': '🔥 Hot',
    'APPROUVE': '✅ Approuvé',
    'MEILLEUR_PRIX': '💰 Meilleur Prix/ml',
    'NOUVEAU': '🆕 Nouveau',
    'IDEE_CADEAU': '🎁 Idée Cadeau',
    'ESSENTIEL_ETE': '☀️ Essentiel Été',
  };
  return labels[tag] || tag;
}

/**
 * Retourne la couleur du tag pour l'UI
 */
export function getTagColor(tag: string): { bg: string; text: string } {
  const colors: Record<string, { bg: string; text: string }> = {
    'DEAL_EXCEPTIONNEL': { bg: 'bg-gradient-to-r from-red-500 to-amber-500', text: 'text-white' },
    'TOP_DEAL': { bg: 'bg-orange-500', text: 'text-white' },
    'BON_DEAL': { bg: 'bg-green-500', text: 'text-white' },
    'DEAL_CORRECT': { bg: 'bg-blue-500', text: 'text-white' },
    'LUXE': { bg: 'bg-gradient-to-r from-purple-500 to-amber-400', text: 'text-white' },
    'MOINS_50': { bg: 'bg-red-600', text: 'text-white' },
    'GROSSE_PROMO': { bg: 'bg-orange-500', text: 'text-white' },
    'TENDANCE': { bg: 'bg-pink-500', text: 'text-white' },
    'HOT': { bg: 'bg-red-500', text: 'text-white' },
    'APPROUVE': { bg: 'bg-blue-600', text: 'text-white' },
    'MEILLEUR_PRIX': { bg: 'bg-green-600', text: 'text-white' },
    'NOUVEAU': { bg: 'bg-sky-400', text: 'text-white' },
    'IDEE_CADEAU': { bg: 'bg-red-500', text: 'text-white' },
    'ESSENTIEL_ETE': { bg: 'bg-amber-400', text: 'text-black' },
  };
  return colors[tag] || { bg: 'bg-gray-200', text: 'text-gray-800' };
}
