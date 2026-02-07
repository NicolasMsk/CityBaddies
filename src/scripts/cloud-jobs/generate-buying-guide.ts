/**
 * Cloud Run Job - Génération automatique de Guides d'Achat
 * Exécuté quotidiennement pour créer des guides SEO basés sur les deals actifs
 *
 * Pipeline en 3 étapes :
 *   1. STRATEGIST - Analyse les deals actifs, choisit un thème porteur + sélectionne 5-8 deals
 *   2. WRITER     - Rédige le guide complet en style City Baddies (slay, baddie, pas vulgaire)
 *   3. SEO        - Optimise les meta tags, génère la FAQ schema.org, affine les keywords
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

interface StrategistOutput {
  theme: string;
  slug: string;
  category: string;
  season: string;
  targetKeywords: string[];
  selectedDealIds: string[];
  reasoning: string;
}

interface WriterOutput {
  title: string;
  introduction: string;
  criteria: string[];
  products: {
    dealId: string;
    rank: number;
    badge: string;
    rating: number;
    miniReview: string;
    pros: string[];
    cons: string[];
    verdict: string;
  }[];
  conclusion: string;
}

interface SEOOutput {
  metaTitle: string;
  metaDescription: string;
  refinedTitle: string;
  faq: { question: string; answer: string }[];
  targetKeywords: string[];
  tags: string[];
}

// ============================================================================
// HELPERS
// ============================================================================

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 80);
}

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
    temperature: 0.8,
  });
  return response.choices[0]?.message?.content || '';
}

function parseJSON<T>(text: string): T {
  // Extraire le JSON du texte (parfois GPT entoure de ```json ... ```)
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/);
  if (!jsonMatch) throw new Error(`Impossible de parser le JSON: ${text.substring(0, 200)}`);
  return JSON.parse(jsonMatch[1]) as T;
}

// ============================================================================
// ÉTAPE 1 : STRATEGIST - Choix du thème et sélection des deals
// ============================================================================

async function runStrategist(deals: DealWithRelations[]): Promise<StrategistOutput> {
  console.log('\n🧠 ÉTAPE 1 : Strategist - Analyse des deals...');

  // Résumer les deals disponibles pour le LLM
  const dealSummaries = deals.map((d) => ({
    id: d.id,
    brand: d.product.brandRef?.name || d.product.brand || 'Inconnu',
    brandTier: d.brandTier,
    product: d.product.name,
    category: d.product.category.name,
    subcategory: d.product.subcategory || '',
    merchant: d.product.merchant.name,
    dealPrice: d.dealPrice,
    originalPrice: d.originalPrice,
    discountPercent: d.discountPercent,
    score: d.score,
    volume: d.variant?.volumeRaw || d.volume || '',
    tags: d.tags || '',
    hasImage: !!d.product.imageUrl,
  }));

  const systemPrompt = `Tu es le STRATEGIST de City Baddies, un site de bons plans beauté.
Tu analyses les deals beauté actifs et tu choisis un thème de guide d'achat qui va cartonner en SEO ET apporter une vraie valeur à l'utilisatrice.

PRINCIPES STRATÉGIQUES :
- Choisis un angle PRÉCIS qui correspond à un VRAI besoin ("Quel sérum vitamine C choisir selon son type de peau ?", "Les 6 meilleurs soins anti-taches testés et comparés", "Crème hydratante : luxe vs drugstore, qui gagne vraiment ?")
- L'angle doit répondre à une QUESTION que les gens tapent sur Google (intention de recherche transactionnelle ou informationnelle)
- Sélectionne 5 à 8 deals qui permettent un VRAI comparatif (même catégorie de produit, pas des produits trop différents)
- VARIE les marques — pas 3 produits de la même marque
- VARIE les gammes de prix pour couvrir différents budgets (entrée de gamme, milieu, premium)
- Privilégie les deals avec images et de bonnes réductions (>25%)
- Le slug doit être court et SEO-friendly

Réponds UNIQUEMENT en JSON valide (pas de markdown, pas de commentaires).`;

  const userPrompt = `Voici les ${dealSummaries.length} deals actifs disponibles :

${JSON.stringify(dealSummaries, null, 2)}

Date du jour : ${new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}

Mois actuel pour la saison : ${new Date().toLocaleDateString('fr-FR', { month: 'long' })}

Choisis un thème de guide d'achat pertinent et sélectionne les meilleurs deals.

Format JSON attendu :
{
  "theme": "Titre du thème (ex: Les meilleurs sérums anti-âge à prix cassé)",
  "slug": "meilleurs-serums-anti-age-prix-casse",
  "category": "soins-visage",
  "season": "all",
  "targetKeywords": ["sérum anti-âge pas cher", "meilleur sérum promo", ...],
  "selectedDealIds": ["id1", "id2", ...],
  "reasoning": "Explication courte du choix"
}`;

  const result = await callGPT(systemPrompt, userPrompt, 2000);
  const parsed = parseJSON<StrategistOutput>(result);

  console.log(`   ✅ Thème choisi : "${parsed.theme}"`);
  console.log(`   📦 ${parsed.selectedDealIds.length} deals sélectionnés`);
  console.log(`   💡 Raison : ${parsed.reasoning}`);

  return parsed;
}

// ============================================================================
// ÉTAPE 2 : WRITER - Rédaction du guide complet
// ============================================================================

async function runWriter(strategy: StrategistOutput, selectedDeals: DealWithRelations[]): Promise<WriterOutput> {
  console.log('\n✍️ ÉTAPE 2 : Writer - Rédaction du guide...');

  const dealsContext = selectedDeals.map((d) => ({
    id: d.id,
    brand: d.product.brandRef?.name || d.product.brand || 'Inconnu',
    name: d.product.name,
    category: d.product.category.name,
    merchant: d.product.merchant.name,
    dealPrice: d.dealPrice,
    originalPrice: d.originalPrice,
    discountPercent: d.discountPercent,
    description: d.product.description || '',
    seoDescription: d.product.seoDescription || '',
    whyGoodDeal: d.whyGoodDeal || '',
    volume: d.variant?.volumeRaw || d.volume || '',
    ingredients: d.product.ingredients || '',
    application: d.product.application || '',
    labels: d.product.labels || '',
    score: d.score,
    tags: d.tags || '',
  }));

  const systemPrompt = `Tu es la RÉDACTRICE en chef de City Baddies, experte beauté et cosmétiques. Tu rédiges des guides d'achat qui ont une VRAIE VALEUR ÉDITORIALE.

TON STYLE :
- Confiante, directe, experte — tu connais tes produits sur le bout des doigts
- Tu parles comme une amie experte qui te donne les vrais conseils sans bullshit
- Un peu d'attitude "slay/baddie" mais SANS en abuser — 1-2 expressions max par paragraphe, pas plus
- Le fond prime sur la forme : EXPERTISE > attitude

INTRODUCTION (CRITIQUE — c'est ce qui fait rester ou partir la lectrice) :
- Paragraphe 1 : Pose le PROBLÈME / la question que se pose la lectrice ("Choisir une crème hydratante, c'est un vrai casse-tête. Entre les textures, les actifs, les promesses marketing...")
- Paragraphe 2 : Explique TA MÉTHODOLOGIE de test/comparaison ("On a comparé X produits sur 3 critères : composition, rapport qualité-prix, et résultats réels...")
- Paragraphe 3 : Donne un APERÇU des résultats ("Spoiler : le gagnant n'est pas celui qu'on attendait...")
- L'intro doit faire 150-250 mots, en HTML (<p> tags), DENSE en information

MINI-REVIEW DE CHAQUE PRODUIT (le cœur du guide) :
- 6-10 phrases MINIMUM, pas 3 phrases vides
- Décris la TEXTURE, l'ODEUR, la SENSATION à l'application
- Parle de la COMPOSITION (actifs clés, ce qui fait la différence)
- Compare avec les autres produits du guide ("Contrairement au #1, celui-ci...")
- Mentionne pour QUEL TYPE DE PEAU / profil c'est adapté
- Si tu as des infos sur les ingrédients, utilise-les !
- En HTML simple (<p> tags)

PROS/CONS :
- 3-5 pros SPÉCIFIQUES (pas "bonne qualité" mais "Acide hyaluronique concentré à 2% pour une hydratation profonde")
- 2-3 cons HONNÊTES et utiles (pas "le packaging est pas ouf" mais "Contient du parfum synthétique, à éviter pour les peaux sensibles")

VERDICT : 2-3 phrases qui disent CLAIREMENT pour qui c'est fait et pourquoi le choisir (ou pas)

RATING : Note sur 5 (avec .5 possible) — JUSTIFIÉE par la review. Le #1 n'est pas forcément 5/5.

CRITÈRES DE SÉLECTION : Liste les 4-6 critères que tu as utilisés pour évaluer les produits (ex: "Composition et actifs", "Rapport contenance/prix", "Adaptabilité aux types de peau", "Avis et retours utilisateurs")

CONCLUSION :
- Résumé comparatif en 2-3 phrases ("Si budget serré → #3, si tu veux le meilleur → #1")
- Un conseil pratique bonus lié au sujet

Réponds UNIQUEMENT en JSON valide.`;

  const userPrompt = `Thème du guide : "${strategy.theme}"
Catégorie : ${strategy.category}
Saison : ${strategy.season}

Voici les ${dealsContext.length} deals à reviewer (utilise TOUTES les infos produit disponibles pour enrichir tes reviews) :

${JSON.stringify(dealsContext, null, 2)}

Rédige un guide d'achat COMPLET et UTILE. Classe les produits du meilleur au moins bon.
Les rangs DOIVENT être séquentiels : 1, 2, 3, 4... sans trou.

IMPORTANT :
- Chaque miniReview doit faire 6-10 phrases MINIMUM avec de vraies infos produit
- Les pros doivent être SPÉCIFIQUES au produit (composition, texture, efficacité)
- Les cons doivent être HONNÊTES et utiles pour la lectrice
- Le rating doit être cohérent avec le classement (le #1 a le meilleur rating)
- Inclus TOUS les deals fournis, n'en élimine aucun

Format JSON :
{
  "title": "Titre accrocheur mais informatif (inclure le bénéfice principal)",
  "introduction": "<p>Paragraphe 1 : le problème/question</p><p>Paragraphe 2 : ta méthodologie</p><p>Paragraphe 3 : aperçu des résultats</p>",
  "criteria": ["Critère 1 utilisé pour évaluer", "Critère 2", "Critère 3", "Critère 4"],
  "products": [
    {
      "dealId": "...",
      "rank": 1,
      "badge": "Le Choix Baddie 👑",
      "rating": 4.5,
      "miniReview": "<p>Review détaillée en HTML, 6-10 phrases avec texture/composition/comparaison</p>",
      "pros": ["Avantage spécifique 1", "Avantage spécifique 2", "Avantage spécifique 3"],
      "cons": ["Inconvénient honnête 1", "Inconvénient honnête 2"],
      "verdict": "2-3 phrases : pour qui, pourquoi le choisir"
    }
  ],
  "conclusion": "<p>Résumé comparatif + conseil pratique bonus</p>"
}`;

  const result = await callGPT(systemPrompt, userPrompt, 8000);
  const parsed = parseJSON<WriterOutput>(result);

  console.log(`   ✅ Guide rédigé : "${parsed.title}"`);
  console.log(`   📝 ${parsed.products.length} produits reviewés`);
  console.log(`   📏 ${parsed.criteria?.length || 0} critères de sélection`);

  return parsed;
}

// ============================================================================
// ÉTAPE 3 : SEO OPTIMIZER - Meta tags, FAQ schema, keywords
// ============================================================================

async function runSEO(strategy: StrategistOutput, writerOutput: WriterOutput): Promise<SEOOutput> {
  console.log('\n🔍 ÉTAPE 3 : SEO Optimizer...');

  const systemPrompt = `Tu es l'expert SEO de City Baddies. Tu optimises les guides d'achat pour Google FR.

Règles :
- metaTitle : max 60 caractères, avec le mot-clé principal en début, inclure l'année (2025 ou 2026)
- metaDescription : max 155 caractères, incitative au clic, mentionner le nombre de produits testés
- FAQ : 5-7 questions que les gens recherchent VRAIMENT sur Google (utilise la formulation naturelle type "People Also Ask")
- Les réponses FAQ doivent être SUBSTANTIELLES : 4-6 phrases avec de vrais conseils, pas du remplissage. Chaque réponse doit pouvoir se suffire à elle-même.
- targetKeywords : 10-15 mots-clés longue traîne variés (inclure des variantes : "meilleur", "comparatif", "avis", "pas cher", "quelle ... choisir")
- tags : 3-5 tags courts pour la catégorisation interne

Réponds UNIQUEMENT en JSON valide.`;

  const userPrompt = `Thème : "${strategy.theme}"
Titre du guide : "${writerOutput.title}"
Catégorie : ${strategy.category}
Keywords initiaux : ${strategy.targetKeywords.join(', ')}

Nombre de produits : ${writerOutput.products.length}
Premier paragraphe de l'intro : ${writerOutput.introduction.substring(0, 300)}

Optimise le SEO de ce guide.

Format JSON :
{
  "metaTitle": "Titre SEO (<60 chars) | City Baddies",
  "metaDescription": "Description SEO (<155 chars) 🔥",
  "refinedTitle": "Titre H1 optimisé pour le SEO (peut être différent du metaTitle)",
  "faq": [
    {"question": "Question naturelle ?", "answer": "Réponse informative avec mots-clés."},
    ...
  ],
  "targetKeywords": ["mot-clé 1", "mot-clé 2", ...],
  "tags": ["tag1", "tag2", ...]
}`;

  const result = await callGPT(systemPrompt, userPrompt, 2000);
  const parsed = parseJSON<SEOOutput>(result);

  console.log(`   ✅ Meta title : "${parsed.metaTitle}"`);
  console.log(`   📋 ${parsed.faq.length} FAQ générées`);
  console.log(`   🏷️ ${parsed.targetKeywords.length} keywords ciblés`);

  return parsed;
}

// ============================================================================
// SAUVEGARDE EN BASE
// ============================================================================

async function saveGuide(
  strategy: StrategistOutput,
  writerOutput: WriterOutput,
  seo: SEOOutput,
  selectedDeals: DealWithRelations[]
): Promise<void> {
  console.log('\n💾 Sauvegarde en base de données...');

  // Générer un slug unique (avec date pour éviter les doublons)
  const dateSlug = new Date().toISOString().split('T')[0]; // 2026-01-15
  let slug = `${slugify(strategy.slug)}-${dateSlug}`;

  // Vérifier que le slug n'existe pas déjà
  const existing = await prisma.buyingGuide.findUnique({ where: { slug } });
  if (existing) {
    slug = `${slug}-${Date.now().toString(36)}`;
  }

  // L'image hero = image du produit #1
  const topDealId = writerOutput.products[0]?.dealId;
  const topDeal = selectedDeals.find((d) => d.id === topDealId);
  const heroImageUrl = topDeal?.product.imageUrl || null;

  // Construire le contenu HTML structuré à partir des products
  const contentHtml = writerOutput.products
    .map((p) => {
      const deal = selectedDeals.find((d) => d.id === p.dealId);
      if (!deal) return '';

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

  // Sauvegarder
  const guide = await prisma.buyingGuide.create({
    data: {
      slug,
      title: seo.refinedTitle || writerOutput.title,
      metaTitle: seo.metaTitle,
      metaDescription: seo.metaDescription,
      heroImageUrl,
      introduction: writerOutput.introduction,
      content: contentHtml,
      conclusion: writerOutput.conclusion,
      faq: seo.faq,
      criteria: writerOutput.criteria || [],
      category: strategy.category,
      tags: seo.tags.join(','),
      season: strategy.season,
      targetKeywords: seo.targetKeywords.join(','),
      status: 'PUBLISHED',
      publishedAt: new Date(),
      products: {
        create: writerOutput.products.map((p, index) => ({
          dealId: p.dealId,
          rank: index + 1, // Force sequential ranks (1, 2, 3, 4...)
          badge: p.badge,
          miniReview: p.miniReview,
          pros: p.pros.join('|'),
          cons: p.cons.join('|'),
          verdict: p.verdict,
          rating: p.rating || null,
        })),
      },
    },
    include: { products: true },
  });

  console.log(`   ✅ Guide créé : ${guide.slug}`);
  console.log(`   📦 ${guide.products.length} produits associés`);
  console.log(`   🔗 URL : /guides/${guide.slug}`);
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║     🛍️ CITY BADDIES — Génération Guide d\'Achat      ║');
  console.log('╚══════════════════════════════════════════════════════╝');

  const startTime = Date.now();

  try {
    // 1. Récupérer tous les deals actifs avec leurs relations
    console.log('\n📊 Récupération des deals actifs...');
    const deals = await prisma.deal.findMany({
      where: {
        status: 'ACTIVE',
        product: {
          imageUrl: { not: null }, // On veut des deals avec images
        },
      },
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
      orderBy: [
        { score: 'desc' },
        { discountPercent: 'desc' },
      ],
      take: 100, // Top 100 deals pour le strategist
    });

    console.log(`   ✅ ${deals.length} deals actifs avec images trouvés`);

    if (deals.length < 5) {
      console.log('   ⚠️ Pas assez de deals actifs (<5). Guide non généré.');
      return;
    }

    // Vérifier combien de guides ont été publiés aujourd'hui
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayGuides = await prisma.buyingGuide.count({
      where: {
        publishedAt: { gte: todayStart },
        status: 'PUBLISHED',
      },
    });

    const MAX_GUIDES_PER_DAY = 2;
    if (todayGuides >= MAX_GUIDES_PER_DAY) {
      console.log(`   ⚠️ ${todayGuides} guide(s) déjà publié(s) aujourd'hui (max ${MAX_GUIDES_PER_DAY}). Arrêt.`);
      return;
    }

    // 2. STRATEGIST — Choix du thème + sélection
    const strategy = await runStrategist(deals as DealWithRelations[]);
    await sleep(1000);

    // Filtrer les deals sélectionnés par le strategist
    const selectedDeals = deals.filter((d) =>
      strategy.selectedDealIds.includes(d.id)
    ) as DealWithRelations[];

    if (selectedDeals.length < 3) {
      console.log('   ⚠️ Moins de 3 deals valides sélectionnés. Guide non généré.');
      return;
    }

    console.log(`   📦 ${selectedDeals.length} deals effectivement trouvés en base`);

    // 3. WRITER — Rédaction du guide
    const writerOutput = await runWriter(strategy, selectedDeals);
    await sleep(1000);

    // Filtrer les produits dont le dealId existe réellement
    writerOutput.products = writerOutput.products.filter((p) =>
      selectedDeals.some((d) => d.id === p.dealId)
    );

    if (writerOutput.products.length < 3) {
      console.log('   ⚠️ Moins de 3 produits valides après filtrage. Guide non généré.');
      return;
    }

    // 4. SEO — Optimisation
    const seo = await runSEO(strategy, writerOutput);
    await sleep(500);

    // 5. SAVE — Sauvegarde en base
    await saveGuide(strategy, writerOutput, seo, selectedDeals);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n✅ Guide d'achat généré avec succès en ${elapsed}s !`);
  } catch (error) {
    console.error('\n❌ Erreur lors de la génération :', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
