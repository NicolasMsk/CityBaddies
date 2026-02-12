/**
 * =============================================================================
 * SCORE-DEALS.TS - Scoring intelligent des deals par LLM
 * =============================================================================
 * 
 * Ce script analyse chaque deal avec GPT-4o pour :
 *   1. Donner une note sur 10 (remplace le score /100)
 *   2. Rédiger un paragraphe "whyGoodDeal" expliquant la note
 * 
 * Le LLM reçoit TOUTES les infos disponibles :
 *   - Produit : nom, marque, tier, catégorie, ingrédients, labels
 *   - Deal : prix, réduction, prix/ml, volume
 *   - Concurrence : prix chez Sephora, Nocibé, Marionnaud
 *   - Historique : évolution des prix sur les derniers mois
 * 
 * Usage:
 *   TEST (1 deal, pas de DB update) : npx tsx scripts/score-deals.ts
 *   PROD (tous les deals, update DB)  : npx tsx scripts/score-deals.ts --all
 * =============================================================================
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import OpenAI from 'openai';

const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const DRY_RUN = !process.argv.includes('--all');

// ============================================================================
// TYPES
// ============================================================================

interface DealWithAllData {
  id: string;
  title: string;
  refinedTitle: string | null;
  dealPrice: number;
  originalPrice: number;
  discountPercent: number;
  discountAmount: number;
  volume: string | null;
  volumeValue: number | null;
  volumeUnit: string | null;
  pricePerUnit: number | null;
  brandTier: number;
  isTrending: boolean;
  isHot: boolean;
  votes: number;
  views: number;
  tags: string | null;
  product: {
    name: string;
    brand: string | null;
    description: string | null;
    ingredients: string | null;
    labels: string | null;
    classifications: any;
    subcategory: string | null;
    subsubcategory: string | null;
    category: { name: string; slug: string };
    merchant: { name: string; slug: string };
    brandRef: { name: string; tier: number; description: string | null } | null;
    availableSizes: string | null;
  };
  competitorPrices: {
    merchantName: string;
    currentPrice: number;
    originalPrice: number | null;
    discountPercent: number | null;
    volume: string | null;
    inStock: boolean;
  }[];
  variant: {
    volumeValue: number;
    volumeUnit: string;
    ean: string | null;
  } | null;
  priceHistory: {
    price: number;
    date: Date;
    volumeRaw: string | null;
  }[];
}

interface LLMScoreResult {
  score: number;        // Note sur 10
  whyGoodDeal: string;  // Paragraphe explicatif
  tags: string[];       // Tags pertinents
}

// ============================================================================
// PROMPT SYSTEM
// ============================================================================

const SYSTEM_PROMPT = `Tu es un expert en deals beauté pour le site City Baddies, le comparateur de bons plans beauté #1 en France.

⚠️ RÈGLE D'OR : SOIS HONNÊTE ET CRITIQUE. Ton rôle c'est de PROTÉGER les utilisateurs, pas de vendre des deals. Si un deal est pourri, DIS-LE clairement. Les gens te font confiance.

Tu dois évaluer la qualité d'un deal cosmétique et donner :
1. Une NOTE SUR 10 (integer, pas de décimales)
2. Un PARAGRAPHE honnête expliquant pourquoi c'est un bon deal OU pourquoi il faut s'en méfier — 2-4 phrases, style direct et cash
3. Des TAGS pertinents parmi cette liste : LUXE, TOP_DEAL, PRIX_MINI, TENDANCE, COFFRET, RARE, BON_RAPPORT, PREMIUM, NOUVEAU, FAUSSE_PROMO, BANALITÉ, MIEUX_AILLEURS

## SIGNAUX D'ALERTE (baisse de note obligatoire) :

### 🚩 Fausse promo / prix gonflé
- Le prix "barré" n'a jamais existé ou le produit est au même prix depuis des mois → C'EST UNE ARNAQUE, note ≤ 3
- Le prix a augmenté juste avant la "promo" pour afficher un gros % → pénalité sévère
- Le prix actuel est le même que le prix moyen historique → la "réduction" n'en est pas une

### 🚩 Concurrent moins cher ou au même prix
- Un concurrent vend le même produit au même prix ou moins cher SANS promo affichée → le deal n'a aucune valeur, note ≤ 4
- Si le concurrent est 5-10% moins cher → mention obligatoire dans l'analyse

### 🚩 Réduction banale sur marque entrée de gamme
- Un -20% sur du NYX ou Maybelline c'est littéralement tous les jours → note ≤ 5, sauf si prix vraiment cassé
- Les marques tier 3 sont TOUJOURS en promo, une réduction classique n'a rien d'exceptionnel

### 🚩 Prix stable depuis longtemps
- Si l'historique montre que le prix n'a pas bougé en plusieurs mois → la "promo" est probablement le prix normal
- Comparer le prix actuel avec la moyenne historique pour démasquer les fausses promos

## CRITÈRES DE NOTATION :

### Réduction (poids majeur)
- 5-15% : Réduction banale → impact faible
- 15-25% : Bonne affaire → impact positif  
- 25-40% : Excellent deal → impact fort
- 40%+ : Deal exceptionnel → impact très fort
- MAIS une grosse réduction ne vaut RIEN si le prix final reste supérieur ou égal aux concurrents

### Marque (Brand Tier)
- Tier 1 (Luxe : Chanel, Dior, La Mer, Tom Ford, YSL) : Un -20% sur du luxe vaut beaucoup plus qu'un -30% sur de l'entrée de gamme
- Tier 2 (Milieu : Benefit, Too Faced, Nars) : Bons deals fréquents
- Tier 3 (Entrée : NYX, Maybelline, L'Oréal Paris) : Toujours en promo, donc quasi jamais un vrai deal

### Prix concurrents (CRUCIAL — le critère le plus important)
- Si le deal est MOINS CHER que tous les concurrents → gros bonus
- Si un concurrent est au même prix → le deal perd BEAUCOUP de valeur
- Si un concurrent est MOINS CHER → le deal est mauvais, point final
- Si pas de données concurrents → neutre, mais le mentionner

### Prix par ml/g (rapport qualité-prix)
- Compare le prix/ml avec la moyenne de la catégorie
- Un parfum à 0.50€/ml est excellent, à 2€/ml c'est cher

### Historique des prix (CRUCIAL — détecteur de fausses promos)
- Prix actuel = plus bas historique → excellent signal, vrai deal
- Prix actuel = prix habituel → fausse promo, le % affiché est trompeur
- Prix qui a augmenté avant de "baisser" → arnaque classique du e-commerce

### Ingrédients & Labels
- Des ingrédients premium (acide hyaluronique, rétinol, vitamine C) = bonus
- Labels (vegan, cruelty-free, bio) = bonus

## ÉCHELLE DE NOTES :
- 1-2 : Arnaque ou fausse promo (prix gonflé, concurrent bien moins cher, prix identique depuis toujours)
- 3-4 : Mauvais deal (réduction insignifiante, concurrent au même prix, marque toujours en promo)
- 5 : Deal moyen (rien d'exceptionnel, promo classique qu'on voit partout)
- 6-7 : Bon deal (vraie réduction, meilleur prix que les concurrents, bon produit)
- 8-9 : Excellent deal (forte réduction sur marque premium, nettement moins cher que partout ailleurs, plus bas historique)
- 10 : Deal légendaire (réduction massive sur produit luxe iconique, prix historiquement bas, introuvable ailleurs)

## STYLE DU PARAGRAPHE :
- Conversationnel, direct et HONNÊTE — comme un pote expert qui te dit la vérité
- Si c'est un bon deal, explique pourquoi avec des chiffres
- Si c'est un mauvais deal, dis-le franchement et explique pourquoi (ex: "même prix chez Nocibé sans promo", "ce prix c'est le prix normal depuis 6 mois")
- Mentionne TOUJOURS les faits concrets (%, prix, comparaisons concurrents)
- 2-4 phrases maximum
- En français
- Pas de "Ce deal est..." en début — soit direct et punchy

## EXEMPLES :

Bon deal :
{
  "score": 8,
  "whyGoodDeal": "Un -25% sur du YSL c'est pas tous les jours ! À 67€ le flacon 100ml, c'est 15€ de moins que chez Nocibé (82€). Le prix/ml de 0.67€ est excellent pour un parfum luxe de cette qualité.",
  "tags": ["LUXE", "BON_RAPPORT", "TOP_DEAL"]
}

Mauvais deal :
{
  "score": 3,
  "whyGoodDeal": "Attention, le -30% affiché est trompeur : ce mascara est à 8.90€ depuis au moins 6 mois d'après l'historique, et Nocibé le vend au même prix sans promo. C'est le prix normal déguisé en deal.",
  "tags": ["FAUSSE_PROMO", "MIEUX_AILLEURS"]
}

Deal moyen :
{
  "score": 5,
  "whyGoodDeal": "Un -15% sur du L'Oréal, c'est la promo classique qu'on retrouve toutes les 2 semaines. Pas une arnaque, mais rien d'exceptionnel — attendez les -30% qui arrivent régulièrement sur cette marque.",
  "tags": ["BANALITÉ"]
}

## FORMAT DE RÉPONSE (JSON strict) :
{
  "score": 7,
  "whyGoodDeal": "...",
  "tags": ["..."]
}`;

// ============================================================================
// BUILD DEAL CONTEXT FOR LLM
// ============================================================================

function buildDealContext(deal: DealWithAllData): string {
  const lines: string[] = [];

  // === PRODUIT ===
  lines.push('## PRODUIT');
  lines.push(`Nom: ${deal.product.name}`);
  lines.push(`Marque: ${deal.product.brand || 'Inconnue'}`);
  if (deal.product.brandRef) {
    const tierLabels: Record<number, string> = { 1: 'Luxe', 2: 'Milieu de gamme', 3: 'Entrée de gamme' };
    lines.push(`Tier marque: ${tierLabels[deal.product.brandRef.tier] || 'Non classé'} (${deal.product.brandRef.tier}/3)`);
    if (deal.product.brandRef.description) {
      lines.push(`Description marque: ${deal.product.brandRef.description}`);
    }
  }
  lines.push(`Catégorie: ${deal.product.category.name}`);
  if (deal.product.subcategory) lines.push(`Sous-catégorie: ${deal.product.subcategory}`);
  if (deal.product.subsubcategory) lines.push(`Sous-sous-catégorie: ${deal.product.subsubcategory}`);
  lines.push(`Marchand: ${deal.product.merchant.name}`);

  // === INGRÉDIENTS & LABELS ===
  if (deal.product.ingredients) {
    lines.push(`\n## INGRÉDIENTS (INCI)`);
    lines.push(deal.product.ingredients.substring(0, 500));
  }
  if (deal.product.labels) {
    lines.push(`\n## LABELS`);
    lines.push(deal.product.labels);
  }
  if (deal.product.classifications) {
    lines.push(`\n## CLASSIFICATIONS`);
    lines.push(JSON.stringify(deal.product.classifications));
  }

  // === DEAL ===
  lines.push(`\n## DEAL`);
  lines.push(`Titre: ${deal.refinedTitle || deal.title}`);
  lines.push(`Prix deal: ${deal.dealPrice.toFixed(2)}€`);
  lines.push(`Prix original: ${deal.originalPrice.toFixed(2)}€`);
  lines.push(`Réduction: -${deal.discountPercent}% (${deal.discountAmount.toFixed(2)}€ d'économie)`);
  if (deal.volume) lines.push(`Volume: ${deal.volume}`);
  if (deal.pricePerUnit && deal.volumeUnit) {
    lines.push(`Prix par ${deal.volumeUnit}: ${deal.pricePerUnit.toFixed(2)}€/${deal.volumeUnit}`);
  }
  if (deal.product.availableSizes) {
    lines.push(`Contenances disponibles: ${deal.product.availableSizes}`);
  }
  lines.push(`Tendance: ${deal.isTrending ? 'Oui (vu sur les réseaux)' : 'Non'}`);
  lines.push(`Votes communauté: ${deal.votes} (${deal.isHot ? '🔥 Hot deal validé' : 'pas encore validé'})`);

  // === PRIX CONCURRENTS ===
  if (deal.competitorPrices.length > 0) {
    lines.push(`\n## PRIX CONCURRENTS`);
    for (const cp of deal.competitorPrices) {
      const priceStr = cp.originalPrice && cp.discountPercent
        ? `${cp.currentPrice.toFixed(2)}€ (au lieu de ${cp.originalPrice.toFixed(2)}€, -${cp.discountPercent}%)`
        : `${cp.currentPrice.toFixed(2)}€`;
      const stockStr = cp.inStock ? '' : ' ⚠️ RUPTURE';
      const volStr = cp.volume ? ` (${cp.volume})` : '';
      lines.push(`- ${cp.merchantName}: ${priceStr}${volStr}${stockStr}`);
    }

    // Calcul automatique de la position prix
    const allPrices = [
      { name: deal.product.merchant.name, price: deal.dealPrice },
      ...deal.competitorPrices.filter(cp => cp.inStock).map(cp => ({ name: cp.merchantName, price: cp.currentPrice })),
    ].sort((a, b) => a.price - b.price);

    const rank = allPrices.findIndex(p => p.name === deal.product.merchant.name) + 1;
    lines.push(`\n→ Position prix: ${rank}/${allPrices.length} (${rank === 1 ? 'MEILLEUR PRIX' : `${allPrices[0].name} est ${(deal.dealPrice - allPrices[0].price).toFixed(2)}€ moins cher`})`);
  } else {
    lines.push(`\n## PRIX CONCURRENTS`);
    lines.push(`Aucune donnée concurrent disponible.`);
  }

  // === HISTORIQUE DES PRIX ===
  if (deal.priceHistory.length > 0) {
    lines.push(`\n## HISTORIQUE DES PRIX (${deal.priceHistory.length} points)`);
    const sorted = [...deal.priceHistory].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const recent = sorted.slice(0, 10);
    for (const ph of recent) {
      const d = new Date(ph.date);
      lines.push(`- ${d.toLocaleDateString('fr-FR')}: ${ph.price.toFixed(2)}€${ph.volumeRaw ? ` (${ph.volumeRaw})` : ''}`);
    }
    const prices = sorted.map(p => p.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
    lines.push(`\n→ Min historique: ${minPrice.toFixed(2)}€ | Max: ${maxPrice.toFixed(2)}€ | Moyenne: ${avgPrice.toFixed(2)}€`);
    lines.push(`→ Prix actuel vs min: ${deal.dealPrice <= minPrice ? '🎯 PLUS BAS HISTORIQUE' : `+${(deal.dealPrice - minPrice).toFixed(2)}€ au-dessus du min`}`);
  }

  return lines.join('\n');
}

// ============================================================================
// APPEL LLM
// ============================================================================

async function scoreDealWithLLM(deal: DealWithAllData): Promise<LLMScoreResult> {
  const context = buildDealContext(deal);

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    temperature: 0.3,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Évalue ce deal :\n\n${context}` },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('Réponse LLM vide');

  const result = JSON.parse(content);

  // Validation
  const score = Math.max(1, Math.min(10, Math.round(result.score)));
  const whyGoodDeal = (result.whyGoodDeal || '').substring(0, 1000);
  const tags = Array.isArray(result.tags) ? result.tags : [];

  return { score, whyGoodDeal, tags };
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('═'.repeat(70));
  console.log('🎯 CITY BADDIES — SCORING LLM DES DEALS');
  console.log(`   Mode: ${DRY_RUN ? '🧪 TEST (1 deal, pas de DB update)' : '🚀 PRODUCTION (tous les deals)'}`);
  console.log('═'.repeat(70));

  // Récupérer les deals avec TOUTES les données
  const deals = await prisma.deal.findMany({
    where: { 
      status: { in: ['ACTIVE', 'PENDING'] },
    },
    take: DRY_RUN ? 1 : undefined,
    orderBy: { createdAt: 'desc' },
    include: {
      product: {
        include: {
          category: true,
          merchant: true,
          brandRef: true,
        },
      },
      competitorPrices: true,
      variant: true,
    },
  });

  if (deals.length === 0) {
    console.log('❌ Aucun deal trouvé.');
    return;
  }

  console.log(`\n📦 ${deals.length} deal(s) à scorer\n`);

  // Pour chaque deal, récupérer aussi l'historique des prix du produit
  for (let i = 0; i < deals.length; i++) {
    const deal = deals[i] as any;

    // Récupérer l'historique des prix
    const priceHistory = await prisma.priceHistory.findMany({
      where: { productId: deal.productId },
      orderBy: { date: 'desc' },
      take: 20,
      select: { price: true, date: true, volumeRaw: true },
    });

    const dealWithHistory: DealWithAllData = { ...deal, priceHistory };

    console.log(`${'─'.repeat(70)}`);
    console.log(`📊 Deal ${i + 1}/${deals.length}: ${deal.refinedTitle || deal.title}`);
    console.log(`   ${deal.product.brand} | ${deal.dealPrice}€ (au lieu de ${deal.originalPrice}€) | -${deal.discountPercent}%`);
    console.log(`   Marchand: ${deal.product.merchant.name} | Catégorie: ${deal.product.category.name}`);

    if (deal.competitorPrices.length > 0) {
      console.log(`   Concurrents: ${deal.competitorPrices.map((cp: any) => `${cp.merchantName}: ${cp.currentPrice}€`).join(', ')}`);
    }

    try {
      console.log(`\n   🤖 Analyse LLM en cours...`);
      const result = await scoreDealWithLLM(dealWithHistory);

      console.log(`\n   ⭐ NOTE: ${result.score}/10`);
      console.log(`   🏷️  TAGS: ${result.tags.join(', ') || 'aucun'}`);
      console.log(`   💬 ANALYSE:`);
      console.log(`   ${result.whyGoodDeal}`);

      if (!DRY_RUN) {
        await prisma.deal.update({
          where: { id: deal.id },
          data: {
            score: result.score,
            tags: result.tags.join(','),
            whyGoodDeal: result.whyGoodDeal,
          },
        });
        console.log(`   ✅ DB mise à jour`);
      } else {
        console.log(`\n   🧪 Mode test — DB non modifiée`);
        console.log(`\n   📝 CONTEXTE ENVOYÉ AU LLM:`);
        console.log('   ' + buildDealContext(dealWithHistory).split('\n').join('\n   '));
      }

    } catch (err) {
      console.error(`   ❌ Erreur: ${err}`);
    }
  }

  console.log(`\n${'═'.repeat(70)}`);
  console.log(`✅ Scoring terminé`);
  console.log(`${'═'.repeat(70)}`);

  await prisma.$disconnect();
}

main().catch(console.error);
