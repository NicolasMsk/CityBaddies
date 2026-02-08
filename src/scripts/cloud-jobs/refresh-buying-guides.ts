/**
 * Cloud Run Job - Rafraîchissement automatique des Guides d'Achat
 * Exécuté quotidiennement pour remplacer les deals expirés par des deals actifs
 *
 * Pipeline en 4 étapes :
 *   1. SCANNER   - Identifie les guides publiés contenant des deals expirés
 *   2. MATCHER   - Trouve des remplacements intelligents (même catégorie, budget, tier)
 *   3. REWRITER  - GPT réécrit les mini-reviews pour les nouveaux deals
 *   4. UPDATER   - Met à jour la DB (BuyingGuideProduct + contenu HTML du guide)
 */

import { PrismaClient, Deal, Product, Brand, Category, Merchant, ProductVariant } from '@prisma/client';
import OpenAI from 'openai';

const prisma = new PrismaClient();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ============================================================================
// TYPES
// ============================================================================

type DealWithRelations = Deal & {
  product: Product & {
    brandRef: Brand | null;
    category: Category;
    merchant: Merchant;
  };
  variant: ProductVariant | null;
};

type GuideProductWithDeal = {
  id: string;
  guideId: string;
  dealId: string;
  rank: number;
  badge: string | null;
  miniReview: string;
  pros: string | null;
  cons: string | null;
  verdict: string | null;
  rating: number | null;
  deal: DealWithRelations;
};

type GuideWithProducts = {
  id: string;
  slug: string;
  title: string;
  introduction: string;
  content: string;
  conclusion: string | null;
  category: string;
  season: string | null;
  faq: any;
  criteria: any;
  metaTitle: string | null;
  metaDescription: string | null;
  targetKeywords: string | null;
  tags: string | null;
  products: GuideProductWithDeal[];
};

interface RewriterOutput {
  miniReview: string;
  pros: string[];
  cons: string[];
  verdict: string;
  rating: number;
  badge: string;
}

interface GuideTextRefreshOutput {
  introduction: string;
  conclusion: string;
  metaTitle: string;
  metaDescription: string;
}

// ============================================================================
// HELPERS
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callGPT(systemPrompt: string, userPrompt: string, maxTokens = 4000): Promise<string> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    max_tokens: maxTokens,
    temperature: 0.7,
  });
  return response.choices[0]?.message?.content || '';
}

function parseJSON<T>(text: string): T {
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/);
  if (!jsonMatch) throw new Error(`Impossible de parser le JSON: ${text.substring(0, 200)}`);
  return JSON.parse(jsonMatch[1]) as T;
}

// ============================================================================
// ÉTAPE 1 : SCANNER — Trouver les guides avec des deals expirés
// ============================================================================

async function scanGuidesWithExpiredDeals(): Promise<GuideWithProducts[]> {
  console.log('\n🔍 ÉTAPE 1 : Scanner — Recherche des guides avec deals expirés...');

  const guides = await prisma.buyingGuide.findMany({
    where: { status: 'PUBLISHED' },
    include: {
      products: {
        include: {
          deal: {
            include: {
              product: {
                include: {
                  brandRef: true,
                  category: true,
                  merchant: true,
                },
              },
              variant: true,
            },
          },
        },
        orderBy: { rank: 'asc' },
      },
    },
  });

  // Filtrer les guides qui contiennent au moins 1 deal non-ACTIVE
  const staleGuides = guides.filter((guide) =>
    guide.products.some((p) => p.deal.status !== 'ACTIVE')
  ) as unknown as GuideWithProducts[];

  console.log(`   📚 ${guides.length} guides publiés au total`);
  console.log(`   ⚠️  ${staleGuides.length} guides contiennent des deals expirés`);

  for (const guide of staleGuides) {
    const expired = guide.products.filter((p) => p.deal.status !== 'ACTIVE');
    console.log(`   └─ "${guide.title}" → ${expired.length}/${guide.products.length} deals expirés`);
  }

  return staleGuides;
}

// ============================================================================
// ÉTAPE 2 : MATCHER — Trouver des remplacements intelligents
// ============================================================================

async function findReplacement(
  expiredProduct: GuideProductWithDeal,
  guideCategory: string,
  excludeDealIds: string[]
): Promise<DealWithRelations | null> {
  const expiredDeal = expiredProduct.deal;
  const categorySlug = expiredDeal.product.category.slug;
  const brandTier = expiredDeal.brandTier;
  const priceRange = {
    min: expiredDeal.dealPrice * 0.5,
    max: expiredDeal.dealPrice * 2.0,
  };

  // Stratégie de matching : du plus précis au plus large
  const strategies = [
    // 1. Même catégorie + même tier + range de prix similaire
    {
      name: 'exact-match',
      where: {
        status: 'ACTIVE' as const,
        id: { notIn: excludeDealIds },
        brandTier: brandTier,
        dealPrice: { gte: priceRange.min, lte: priceRange.max },
        product: {
          category: { slug: categorySlug },
          imageUrl: { not: null },
        },
      },
    },
    // 2. Même catégorie + même tier (sans contrainte de prix)
    {
      name: 'same-tier',
      where: {
        status: 'ACTIVE' as const,
        id: { notIn: excludeDealIds },
        brandTier: brandTier,
        product: {
          category: { slug: categorySlug },
          imageUrl: { not: null },
        },
      },
    },
    // 3. Même catégorie uniquement (élargir le tier)
    {
      name: 'same-category',
      where: {
        status: 'ACTIVE' as const,
        id: { notIn: excludeDealIds },
        product: {
          category: { slug: categorySlug },
          imageUrl: { not: null },
        },
      },
    },
    // 4. Fallback : n'importe quel deal actif avec image dans la même catégorie de guide
    {
      name: 'fallback-guide-category',
      where: {
        status: 'ACTIVE' as const,
        id: { notIn: excludeDealIds },
        product: {
          category: { slug: guideCategory },
          imageUrl: { not: null },
        },
      },
    },
  ];

  for (const strategy of strategies) {
    const candidate = await prisma.deal.findFirst({
      where: strategy.where,
      include: {
        product: {
          include: {
            brandRef: true,
            category: true,
            merchant: true,
          },
        },
        variant: true,
      },
      orderBy: [{ score: 'desc' }, { discountPercent: 'desc' }],
    });

    if (candidate) {
      const brand = candidate.product.brandRef?.name || candidate.product.brand || 'Inconnu';
      console.log(`      ✅ Remplacement trouvé (${strategy.name}) : ${brand} ${candidate.product.name} (-${candidate.discountPercent}%)`);
      return candidate as DealWithRelations;
    }
  }

  console.log(`      ❌ Aucun remplacement trouvé pour rank #${expiredProduct.rank}`);
  return null;
}

// ============================================================================
// ÉTAPE 3 : REWRITER — Réécrire le contenu pour les nouveaux deals
// ============================================================================

async function rewriteProductReview(
  newDeal: DealWithRelations,
  rank: number,
  totalProducts: number,
  guideTitle: string,
  guideCategory: string,
  otherProducts: { brand: string; name: string; rank: number }[]
): Promise<RewriterOutput> {
  const brand = newDeal.product.brandRef?.name || newDeal.product.brand || 'Inconnu';

  const systemPrompt = `Tu es la RÉDACTRICE en chef de City Baddies, experte beauté et cosmétiques.
Tu rédiges une mini-review pour un produit qui REMPLACE un ancien produit dans un guide d'achat existant.

TON STYLE :
- Confiante, directe, experte
- Tu parles comme une amie experte qui te donne les vrais conseils
- Un peu d'attitude "slay/baddie" mais sans en abuser

MINI-REVIEW :
- 6-10 phrases MINIMUM
- Décris la TEXTURE, l'ODEUR, la SENSATION
- Parle de la COMPOSITION (actifs clés)
- Compare avec les autres produits du guide si pertinent
- Mentionne pour QUEL TYPE DE PEAU / profil c'est adapté
- En HTML simple (<p> tags)

PROS/CONS :
- 3-5 pros SPÉCIFIQUES
- 2-3 cons HONNÊTES

RATING : Note sur 5 (avec .5), cohérente avec le rang (#1 = meilleur rating)

BADGE : Un badge accrocheur adapté au rang (ex: "Le Choix Baddie 👑", "Best Value 💰", "Le Luxe Accessible ✨", "Valeur Sûre 🎯", "Le Petit Prix Malin 🔥")

Réponds UNIQUEMENT en JSON valide.`;

  const userPrompt = `Guide : "${guideTitle}" (catégorie: ${guideCategory})
Ce produit sera classé #${rank} sur ${totalProducts}.

Autres produits dans le guide :
${otherProducts.map((p) => `  #${p.rank} — ${p.brand} ${p.name}`).join('\n')}

NOUVEAU PRODUIT À REVIEWER :
- Marque : ${brand}
- Nom : ${newDeal.product.name}
- Prix : ${newDeal.dealPrice.toFixed(2)}€ (au lieu de ${newDeal.originalPrice.toFixed(2)}€, soit -${newDeal.discountPercent}%)
- Marchand : ${newDeal.product.merchant.name}
- Catégorie : ${newDeal.product.category.name}
- Volume : ${newDeal.variant?.volumeRaw || newDeal.volume || 'Non spécifié'}
- Description : ${newDeal.product.description || 'Non disponible'}
- Description SEO : ${newDeal.product.seoDescription || 'Non disponible'}
- Ingrédients : ${newDeal.product.ingredients || 'Non disponible'}
- Application : ${newDeal.product.application || 'Non disponible'}
- Labels : ${newDeal.product.labels || 'Non disponible'}
- Avis expert : ${newDeal.whyGoodDeal || 'Non disponible'}
- Tags : ${newDeal.tags || 'Non disponible'}
- Score : ${newDeal.score || 'N/A'}

Format JSON attendu :
{
  "miniReview": "<p>Review détaillée, 6-10 phrases</p>",
  "pros": ["Avantage spécifique 1", "Avantage 2", "Avantage 3"],
  "cons": ["Inconvénient 1", "Inconvénient 2"],
  "verdict": "2-3 phrases verdict",
  "rating": 4.5,
  "badge": "Le Choix Baddie 👑"
}`;

  const result = await callGPT(systemPrompt, userPrompt, 3000);
  return parseJSON<RewriterOutput>(result);
}

async function refreshGuideText(
  guide: GuideWithProducts,
  updatedProducts: { rank: number; brand: string; name: string; price: number; merchant: string }[]
): Promise<GuideTextRefreshOutput> {
  console.log('   ✍️  Réécriture introduction/conclusion...');

  const systemPrompt = `Tu es la RÉDACTRICE en chef de City Baddies. Tu rafraîchis l'intro et la conclusion d'un guide d'achat existant.

L'intro et la conclusion doivent REFLÉTER les produits actuellement dans le guide (certains ont changé).

INTRODUCTION (3 paragraphes en HTML <p> tags) :
- Paragraphe 1 : Le problème / la question de la lectrice
- Paragraphe 2 : Ta méthodologie de comparaison
- Paragraphe 3 : Aperçu des résultats (spoiler léger)
- 150-250 mots

CONCLUSION :
- Résumé comparatif en 2-3 phrases
- Conseil pratique bonus
- En HTML <p> tags

META SEO :
- metaTitle : max 60 chars, mot-clé principal + année 2026
- metaDescription : max 155 chars, incitative

Réponds UNIQUEMENT en JSON valide.`;

  const productsListStr = updatedProducts
    .map((p) => `#${p.rank} — ${p.brand} ${p.name} à ${p.price.toFixed(2)}€ chez ${p.merchant}`)
    .join('\n');

  const userPrompt = `Guide existant : "${guide.title}"
Catégorie : ${guide.category}

Produits actuels dans le guide (MIS À JOUR) :
${productsListStr}

Ancienne intro (pour garder le ton) :
${guide.introduction.substring(0, 500)}

Date du jour : ${new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}

Réécris l'intro, la conclusion et les metas pour refléter le nouveau comparatif.

Format JSON :
{
  "introduction": "<p>...</p><p>...</p><p>...</p>",
  "conclusion": "<p>...</p>",
  "metaTitle": "Titre SEO (<60 chars) | City Baddies",
  "metaDescription": "Description (<155 chars) 🔥"
}`;

  const result = await callGPT(systemPrompt, userPrompt, 3000);
  return parseJSON<GuideTextRefreshOutput>(result);
}

// ============================================================================
// ÉTAPE 4 : UPDATER — Mettre à jour la base de données
// ============================================================================

function rebuildContentHtml(
  products: {
    rank: number;
    badge: string;
    dealId: string;
    miniReview: string;
    pros: string[];
    cons: string[];
    verdict: string;
    deal: DealWithRelations;
  }[]
): string {
  return products
    .map((p) => {
      const deal = p.deal;
      const brand = deal.product.brandRef?.name || deal.product.brand || '';
      const imageUrl = deal.product.imageUrl || '';
      const merchant = deal.product.merchant.name;
      const volume = deal.variant?.volumeRaw || deal.volume || '';

      return `<article class="guide-product" data-rank="${p.rank}" data-deal-id="${p.dealId}">
<div class="guide-product-header">
  <span class="guide-badge">${p.badge}</span>
  <h3>#${p.rank} — ${brand} ${deal.product.name}${volume ? ` (${volume})` : ''}</h3>
</div>
<div class="guide-product-image">
  <img src="${imageUrl}" alt="${brand} ${deal.product.name}" loading="lazy" />
</div>
<div class="guide-product-price">
  <span class="guide-price-current">${deal.dealPrice.toFixed(2)}€</span>
  <span class="guide-price-original">${deal.originalPrice.toFixed(2)}€</span>
  <span class="guide-price-discount">-${deal.discountPercent}%</span>
  <span class="guide-merchant">chez ${merchant}</span>
</div>
<div class="guide-product-review">${p.miniReview}</div>
<div class="guide-product-pros-cons">
  <div class="guide-pros"><strong>✅ Les +</strong><ul>${p.pros.map((pro) => `<li>${pro}</li>`).join('')}</ul></div>
  <div class="guide-cons"><strong>⚠️ Les -</strong><ul>${p.cons.map((con) => `<li>${con}</li>`).join('')}</ul></div>
</div>
<div class="guide-verdict"><strong>💬 Le verdict :</strong> ${p.verdict}</div>
</article>`;
    })
    .join('\n\n');
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║   🔄 CITY BADDIES — Rafraîchissement Guides d\'Achat    ║');
  console.log('╚══════════════════════════════════════════════════════════╝');

  const startTime = Date.now();
  let totalReplaced = 0;
  let totalGuidesFreshened = 0;

  try {
    // ── ÉTAPE 1 : SCANNER ──
    const staleGuides = await scanGuidesWithExpiredDeals();

    if (staleGuides.length === 0) {
      console.log('\n✅ Tous les guides sont à jour ! Rien à faire.');
      return;
    }

    // ── Traiter chaque guide ──
    for (const guide of staleGuides) {
      console.log(`\n${'═'.repeat(60)}`);
      console.log(`📖 Traitement : "${guide.title}"`);
      console.log(`   Slug : ${guide.slug}`);
      console.log(`${'═'.repeat(60)}`);

      const expiredProducts = guide.products.filter((p) => p.deal.status !== 'ACTIVE');
      const activeProducts = guide.products.filter((p) => p.deal.status === 'ACTIVE');

      console.log(`   🟢 ${activeProducts.length} deals toujours actifs`);
      console.log(`   🔴 ${expiredProducts.length} deals expirés à remplacer`);

      // Si TOUS les deals sont expirés, archiver le guide
      if (activeProducts.length === 0) {
        console.log('   ⚠️  Tous les deals sont expirés → Archivage du guide');
        await prisma.buyingGuide.update({
          where: { id: guide.id },
          data: { status: 'ARCHIVED' },
        });
        continue;
      }

      // Collecter les IDs déjà utilisés dans ce guide (pour éviter les doublons)
      const usedDealIds = guide.products.map((p) => p.dealId);
      const replacements: Map<string, { old: GuideProductWithDeal; new: DealWithRelations }> = new Map();

      // ── ÉTAPE 2 : MATCHER — Trouver les remplacements ──
      console.log('\n   🎯 MATCHING — Recherche de remplacements...');
      for (const expiredProduct of expiredProducts) {
        const oldBrand = expiredProduct.deal.product.brandRef?.name || expiredProduct.deal.product.brand || 'Inconnu';
        console.log(`\n   └─ #${expiredProduct.rank} ${oldBrand} ${expiredProduct.deal.product.name} (${expiredProduct.deal.status})`);

        const replacement = await findReplacement(expiredProduct, guide.category, usedDealIds);

        if (replacement) {
          replacements.set(expiredProduct.id, { old: expiredProduct, new: replacement });
          usedDealIds.push(replacement.id); // Éviter de réutiliser ce deal
        }
      }

      if (replacements.size === 0) {
        console.log('\n   ⚠️  Aucun remplacement trouvé. On supprime les entrées expirées du guide.');
        // Supprimer les produits expirés et renuméroter
        for (const expiredProduct of expiredProducts) {
          await prisma.buyingGuideProduct.delete({ where: { id: expiredProduct.id } });
        }
        // Renuméroter les rangs restants
        const remaining = activeProducts.sort((a, b) => a.rank - b.rank);
        for (let i = 0; i < remaining.length; i++) {
          await prisma.buyingGuideProduct.update({
            where: { id: remaining[i].id },
            data: { rank: i + 1 },
          });
        }
        continue;
      }

      // ── ÉTAPE 3 : REWRITER — Réécrire les mini-reviews ──
      console.log(`\n   ✍️  REWRITER — Réécriture de ${replacements.size} produit(s)...`);

      // Construire la liste complète des produits (actifs + nouveaux remplacements)
      const finalProducts: {
        guideProductId: string;
        rank: number;
        deal: DealWithRelations;
        isNew: boolean;
        badge: string;
        miniReview: string;
        pros: string[];
        cons: string[];
        verdict: string;
        rating: number;
      }[] = [];

      // D'abord les actifs qu'on garde
      for (const product of activeProducts) {
        finalProducts.push({
          guideProductId: product.id,
          rank: product.rank,
          deal: product.deal,
          isNew: false,
          badge: product.badge || '',
          miniReview: product.miniReview,
          pros: product.pros?.split('|') || [],
          cons: product.cons?.split('|') || [],
          verdict: product.verdict || '',
          rating: product.rating || 4,
        });
      }

      // Puis les nouveaux remplacements (réécrits par GPT)
      for (const [guideProductId, { old: expiredProduct, new: newDeal }] of replacements) {
        const otherProducts = [...activeProducts, ...Array.from(replacements.values())
          .filter(r => r.new.id !== newDeal.id)
          .map(r => r.new)]
          .map((p) => {
            const d = 'deal' in p ? (p as GuideProductWithDeal).deal : p as DealWithRelations;
            return {
              brand: d.product.brandRef?.name || d.product.brand || 'Inconnu',
              name: d.product.name,
              rank: 'rank' in p ? (p as GuideProductWithDeal).rank : 0,
            };
          });

        const review = await rewriteProductReview(
          newDeal,
          expiredProduct.rank,
          guide.products.length,
          guide.title,
          guide.category,
          otherProducts
        );

        const newBrand = newDeal.product.brandRef?.name || newDeal.product.brand || 'Inconnu';
        console.log(`      ✅ Review écrite pour ${newBrand} ${newDeal.product.name} (${review.rating}/5)`);

        finalProducts.push({
          guideProductId,
          rank: expiredProduct.rank,
          deal: newDeal,
          isNew: true,
          badge: review.badge,
          miniReview: review.miniReview,
          pros: review.pros,
          cons: review.cons,
          verdict: review.verdict,
          rating: review.rating,
        });

        await sleep(1000); // Rate limiting GPT
      }

      // Trier par rang
      finalProducts.sort((a, b) => a.rank - b.rank);

      // ── Réécrire l'intro/conclusion si >50% des deals ont changé ──
      let refreshedText: GuideTextRefreshOutput | null = null;
      const changeRatio = replacements.size / guide.products.length;

      if (changeRatio >= 0.4) {
        const updatedProductsList = finalProducts.map((p) => ({
          rank: p.rank,
          brand: p.deal.product.brandRef?.name || p.deal.product.brand || 'Inconnu',
          name: p.deal.product.name,
          price: p.deal.dealPrice,
          merchant: p.deal.product.merchant.name,
        }));
        refreshedText = await refreshGuideText(guide, updatedProductsList);
        await sleep(1000);
      }

      // ── ÉTAPE 4 : UPDATER — Mettre à jour la DB ──
      console.log('\n   💾 UPDATER — Mise à jour base de données...');

      // Mettre à jour chaque BuyingGuideProduct
      for (const product of finalProducts) {
        if (product.isNew) {
          // Supprimer l'ancien lien et créer le nouveau
          await prisma.buyingGuideProduct.delete({ where: { id: product.guideProductId } });
          await prisma.buyingGuideProduct.create({
            data: {
              guideId: guide.id,
              dealId: product.deal.id,
              rank: product.rank,
              badge: product.badge,
              miniReview: product.miniReview,
              pros: product.pros.join('|'),
              cons: product.cons.join('|'),
              verdict: product.verdict,
              rating: product.rating,
            },
          });
          totalReplaced++;
        }
      }

      // Reconstruire le HTML du contenu
      const contentHtml = rebuildContentHtml(
        finalProducts.map((p) => ({
          rank: p.rank,
          badge: p.badge,
          dealId: p.deal.id,
          miniReview: p.miniReview,
          pros: p.pros,
          cons: p.cons,
          verdict: p.verdict,
          deal: p.deal,
        }))
      );

      // Hero image = image du #1
      const topDeal = finalProducts.find((p) => p.rank === 1);
      const heroImageUrl = topDeal?.deal.product.imageUrl || null;

      // Mettre à jour le guide
      await prisma.buyingGuide.update({
        where: { id: guide.id },
        data: {
          content: contentHtml,
          heroImageUrl,
          ...(refreshedText && {
            introduction: refreshedText.introduction,
            conclusion: refreshedText.conclusion,
            metaTitle: refreshedText.metaTitle,
            metaDescription: refreshedText.metaDescription,
          }),
          updatedAt: new Date(),
        },
      });

      totalGuidesFreshened++;
      console.log(`   ✅ Guide mis à jour : ${replacements.size} deal(s) remplacé(s)${refreshedText ? ' + intro/conclusion réécrites' : ''}`);
    }

    // ── RÉSUMÉ ──
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║                    📊 RÉSUMÉ                             ║');
    console.log('╠══════════════════════════════════════════════════════════╣');
    console.log(`║  Guides rafraîchis  : ${totalGuidesFreshened}                                  `);
    console.log(`║  Deals remplacés    : ${totalReplaced}                                  `);
    console.log(`║  Durée              : ${elapsed}s                                `);
    console.log('╚══════════════════════════════════════════════════════════╝');
  } catch (error) {
    console.error('\n❌ Erreur lors du rafraîchissement :', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
