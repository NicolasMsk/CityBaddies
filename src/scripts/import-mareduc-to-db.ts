/**
 * =============================================================================
 * IMPORT MA-REDUC → DB via LLM (GPT-4o)
 * =============================================================================
 *
 * Lit le JSON scrapé de Ma-Reduc, l'envoie à GPT-4o pour structuration,
 * puis insère les PromoCode + MerchantPromoPage dans la base Prisma.
 *
 * Usage :
 *   npx tsx src/scripts/import-mareduc-to-db.ts                          (sephora par défaut)
 *   npx tsx src/scripts/import-mareduc-to-db.ts --merchant nocibe
 *   npx tsx src/scripts/import-mareduc-to-db.ts --file data/mareduc-nocibe-2026-02-09.json
 *   npx tsx src/scripts/import-mareduc-to-db.ts --dry-run
 *   npx tsx src/scripts/import-mareduc-to-db.ts --force-llm
 *
 * =============================================================================
 */

import * as fs from 'fs';
import * as path from 'path';
import OpenAI from 'openai';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ══════════════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════════════

interface LLMPromoCode {
  code: string | null;
  slug: string;
  title: string;
  description: string | null;
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIPPING' | 'GIFT' | 'CASHBACK';
  discountValue: number | null;
  minimumPurchase: number | null;
  maximumDiscount: number | null;
  applicableTo: string | null;
  conditions: string | null;
  isNewCustomerOnly: boolean;
  isStackable: boolean;
  status: 'ACTIVE' | 'UNVERIFIED';
  expiresAt: string | null;
  isVerified: boolean;
  isExclusive: boolean;
  isFeatured: boolean;
  successRate: number | null;
  sourceUrl: string;
  sourceType: string;
  votes: number;
}

interface LLMMerchantPromoPage {
  canonicalSlug: string;
  metaTitle: string;
  metaDescription: string;
  heroTitle: string;
  heroSubtitle: string;
  introduction: string;
  merchantDescription: string;
  merchantAdvantages: { icon: string; title: string; text: string }[];
  shippingInfo: string | null;
  returnPolicy: string | null;
  loyaltyProgram: string | null;
  howToUse: { step: number; title: string; description: string }[];
  howToUseHtml: string | null;
  tips: { title: string; content: string }[];
  bestTimeToShop: string | null;
  faq: { question: string; answer: string }[];
  averageDiscount: number | null;
  bestCurrentDiscount: number | null;
  totalActiveOffers: number;
  conclusion: string;
  relatedMerchants: string;
  targetKeywords: string;
}

interface LLMResult {
  promoCodes: LLMPromoCode[];
  merchantPromoPage: LLMMerchantPromoPage;
}

// ══════════════════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════════════════

function log(emoji: string, msg: string) {
  console.log(`${emoji}  ${msg}`);
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .substring(0, 80);
}

// ══════════════════════════════════════════════════════════════════════
// Build LLM prompt
// ══════════════════════════════════════════════════════════════════════

function buildPrompt(data: any): string {
  const offers = data.offers as any[];
  const rc = data.richContent;

  return `Tu es le rédacteur en chef de City Baddies (citybaddies.com), le premier comparateur de prix beauté sélectif en France.

═══ TON & IDENTITÉ CITY BADDIES ═══

VOIX DE MARQUE — naturelle, experte, directe :
• Ton d'une copine qui s'y connaît vraiment en beauté : accessible mais jamais niaise
• Tutoiement naturel, comme si tu parlais à une amie ("on a repéré", "tu peux en profiter")
• Expert beauté : vocabulaire précis sans jargon marketing creux
• Honnête et transparente : pas de survente, pas de superlatifs vides. Si c'est bien, dis-le simplement.
• Un brin insider : "on a repéré pour toi", "les bons plans du moment"

RÈGLES D'ÉCRITURE :
1. TUTOIEMENT obligatoire dans les textes user-facing (introduction, tips, howToUse, conclusion)
2. JAMAIS copier le contenu source tel quel — tout doit être REFORMULÉ avec tes propres mots
3. Phrases claires et directes, pas de blabla corporate ni de formules creuses
4. JAMAIS de mots anglais forcés (pas de "slay", "game", "crush"). Reste naturelle en français.
5. Pas de ton surexcité (pas de "incroyable !", "exceptionnel !"). Confiance calme.
6. Emojis avec parcimonie (1-2 par avantage, pas dans les paragraphes)
7. Le contenu doit avoir l'air d'avoir été écrit par un humain, pas généré par une IA
8. ⚠️ ZÉRO REDONDANCE ENTRE SECTIONS — Chaque section a un RÔLE UNIQUE :
   • introduction = accroche + highlights du moment (2-3 lignes max, PAS de description du marchand)
   • merchantDescription = qui est le marchand, positionnement, marques (PAS de codes/promos)
   • merchantAdvantages = avantages concrets du marchand (PAS les mêmes infos que merchantDescription)
   • shippingInfo = UNIQUEMENT livraison (délais, prix, seuils)
   • returnPolicy = UNIQUEMENT retours (délais, conditions)
   • loyaltyProgram = UNIQUEMENT fidélité (fonctionnement, avantages)
   • tips = astuces CONCRÈTES pour économiser plus (PAS reformuler les codes existants, PAS répéter les infos livraison/retour/fidélité)
   • bestTimeToShop = UNIQUEMENT les périodes (Black Friday, soldes, etc.)
   • faq = questions UTILES dont la réponse n'est PAS déjà dans une autre section
   • conclusion = 1 phrase de wrap-up, c'est tout
   Si une info est dans shippingInfo, elle ne doit PAS être dans tips, faq, introduction ou merchantDescription.

═══ OPTIMISATION SEO — CRITIQUE ═══

Date actuelle : ${new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
Marchand : ${data.merchant}

RÈGLES SEO OBLIGATOIRES :
1. MOT-CLÉ PRINCIPAL : "code promo ${data.merchant}" — DOIT apparaître dans : metaTitle (position 1), metaDescription (70 premiers chars), introduction (dans un <strong>), et au moins 2 questions FAQ
2. MOTS-CLÉS SECONDAIRES à tisser naturellement : "bon de réduction ${data.merchant}", "réduction ${data.merchant}", "promo ${data.merchant}", "${data.merchant} promotion", "coupon ${data.merchant}"
3. FRAÎCHEUR TEMPORELLE : inclure le mois + année en cours dans metaTitle, metaDescription et heroSubtitle
4. CONDITIONS DÉTAILLÉES : JAMAIS simplifier les exclusions. Lister TOUTES les exclusions mot pour mot (petits prix, prix web, points rouges, coffrets, cartes cadeaux, DROM, etc.). Google valorise le contenu exhaustif.
5. NOMS DANS LES TITRES : chaque title de code promo DOIT contenir le nom du marchand
6. FAQ SEO : cibler les requêtes réelles Google People Also Ask. Chaque question DOIT contenir le nom du marchand.
7. HTML SÉMANTIQUE : dans les champs HTML, utiliser <strong> sur 1-2 mots-clés par paragraphe (naturellement, pas de bourrage)
8. ZÉRO CONTENU DUPLIQUÉ : aucune phrase ne doit se retrouver dans 2 sections différentes

═══ DONNÉES BRUTES SCRAPÉES — Ma-Reduc.com — "${data.merchant}" ═══

CES DONNÉES SERVENT DE BASE FACTUELLE. Tu dois extraire les FAITS (prix, conditions, dates) mais RÉÉCRIRE tout le texte.

─── OFFRES (${offers.length}) ───
${offers.map((o: any, i: number) => `
--- Offre ${i + 1} ---
Type: ${o.type}
Titre: ${o.title}
Code: ${o.code || 'Pas de code (bon plan)'}
Description: ${o.description || 'N/A'}
Tableau conditions: ${o.conditionsTable ? JSON.stringify(o.conditionsTable) : 'N/A'}
Expiration: ${o.expiration || 'N/A'}
Badge réduction: ${o.discountBadge || 'N/A'}
Vérifié: ${o.isVerified ? 'Oui' : 'Non'}
Votes: +${o.votesUp} / -${o.votesDown}`).join('\n')}

─── RICH CONTENT SOURCE (MA-REDUC) ───
Titre page: ${rc.pageTitle}
Sous-titre: ${rc.pageSubtitle}
Description marchand: ${rc.merchantDescription || 'N/A'}
Note: ${rc.merchantRating || 'N/A'}
Trust signals: ${rc.trustSignals?.slice(0, 3).join(' | ') || 'N/A'}
Tableau récap:
${rc.summaryTable?.map((r: any) => `  ${r.label} | ${r.code} | ${r.discount}`).join('\n') || 'N/A'}
Sections SEO:
${rc.seoSections?.map((s: any) => `## ${s.heading}\n${s.content}`).join('\n\n') || 'N/A'}
Marchands similaires: ${rc.similarMerchants?.map((m: any) => m.name).join(', ') || 'N/A'}

═══ OUTPUT JSON — 2 CLÉS ═══

1. **"promoCodes"** : tableau d'objets. Pour chaque offre :
   - code (string | null) — le code promo EXACT tel quel, null si bon plan sans code
   - slug (string) — kebab-case unique depuis le titre, max 80 chars
   - title (string) — REFORMULÉ ton City Baddies. Court, percutant, DOIT contenir le nom du marchand pour le SEO. Ex: "20% sur tout Nocibé sans minimum" pas "20% de réduc sur TOUT le site"
   - description (string | null) — REFORMULÉ, direct. DOIT inclure : ce sur quoi c'est valable + les exclusions principales EN DÉTAIL. Ex: "Valable sur tout le site Nocibé. Hors petits prix, prix web, produits outlet, coffrets institut et cartes cadeaux."
   - discountType: "PERCENTAGE" | "FIXED_AMOUNT" | "FREE_SHIPPING" | "GIFT" | "CASHBACK"
   - discountValue (number | null) — 25 pour -25%, 10 pour -10€, null si cadeau
   - minimumPurchase (number | null) — montant min en €
   - maximumDiscount (number | null) — réduction max si plafonnée
   - applicableTo (string | null) — scope précis : "tout le site hors exclusions", "tout le site sauf soldes", "dès 69€ sur tout le site", etc.
   - conditions (string | null) — EXHAUSTIF : lister TOUTES les exclusions. Ex: "Hors petits prix, prix web, prix Nocibé, meilleurs prix, points rouges, produits outlet, coffrets institut, cartes cadeaux, cartes institut, prestations institut, emballages payants, chèques fidélité Nocibé, DROM et Monaco." JAMAIS simplifier en "exclusions s'appliquent".
   - isNewCustomerOnly (boolean)
   - isStackable (boolean) — false par défaut
   - status: "ACTIVE" si vérifié, "UNVERIFIED" sinon
   - expiresAt (string ISO 8601 | null) — null si "Validité permanente"
   - isVerified (boolean)
   - isExclusive (boolean) — true si réservé fidélité/pro
   - isFeatured (boolean) — true pour les 3-5 meilleures offres
   - successRate (number | null) — votesUp / (votesUp + votesDown) * 100
   - sourceUrl: "${data.url}"
   - sourceType: "ma-reduc"
   - votes (number) — votesUp - votesDown

   INCLURE toutes les offres (codes ET bons plans). Bons plans sans code → code=null.
   NE PAS inclure les offres "info" (paiement 4x, recyclage, etc.)

2. **"merchantPromoPage"** : CONTENU ÉDITORIAL 100% ORIGINAL ton City Baddies.
   ⚠️ NE JAMAIS copier/paraphraser Ma-Reduc. Rédige comme si tu écrivais un article original pour citybaddies.com.

   - canonicalSlug: "${data.merchant}"
   - metaTitle (string) — SEO 55-60 chars. DOIT commencer par "Code Promo [Marchand]". Inclure meilleure réduction + mois/année. Pas d'emoji. Ex: "Code Promo Nocibé : Jusqu'à -30% | Février 2026"
   - metaDescription (string) — 150-155 chars. DOIT contenir "code promo [marchand]" dans les 70 premiers chars. Inclure : nombre de codes, meilleure réduction, mois/année, CTA. Ex: "5 codes promo Nocibé vérifiés en février 2026. Jusqu'à -30% sur tout le site. Codes testés et mis à jour quotidiennement."
   - heroTitle (string) — H1 SEO : DOIT contenir "Code Promo [Marchand]" ou "Codes Promo [Marchand]". Ex: "Codes Promo Nocibé" ou "Code Promo Nocibé : les meilleurs en ce moment"
   - heroSubtitle (string) — stats CODES UNIQUEMENT + mois/année. Ex: "5 codes vérifiés • Jusqu'à -30% • Février 2026" (ne compte PAS les bons plans sans code)
   - introduction (string) — 2-3 paragraphes HTML <p>. Ton City Baddies = tutoiement, insider, expert beauté.
     → PREMIER paragraphe : accrocher avec le mot-clé dans un <strong>. Ex: "<p>Tu cherches un <strong>code promo Nocibé</strong> qui marche vraiment ?"
     → Mentionner les highlights : nombre de codes actifs, meilleure réduction, mois en cours
     → Utiliser <strong> sur 1-2 mots-clés par paragraphe (naturellement)
     → ZÉRO copie de Ma-Reduc
   - merchantDescription (string) — HTML <p>. Présentation du marchand. Inclure le nom dans un <strong>. Positionnement, marques phares, forces et limites. Ton City Baddies : expert, honnête, un peu cash. 2-3 paragraphes.
   - merchantAdvantages (array) — [{icon: "emoji", title: "titre court percutant", text: "explication utile, pas du remplissage"}] — 4-5 vrais avantages
   - shippingInfo (string) — HTML, infos livraison factuelles mais rédigées ton City Baddies
   - returnPolicy (string) — HTML, politique retour honnête (y compris les limites)
   - loyaltyProgram (string) — HTML, description programme fidélité. Si c'est bien → dis-le. Si c'est moyen → dis-le aussi.
   - howToUse (array) — [{step: 1, title: "...", description: "..."}] — 3-4 étapes, tutoiement, actionnable
   - howToUseHtml (string) — version <ol><li> du howToUse
   - tips (array) — [{title: "titre court", content: "astuce concrète"}] — 4-5 VRAIS tips de quelqu'un qui connaît le site (pas du générique)
   - bestTimeToShop (string) — meilleurs moments CONCRETS pour acheter (Black Friday, soldes, ventes privées fidélité, etc.)
   - faq (array) — [{question: "...", answer: "..."}] — 8-10 questions ciblant les requêtes Google :
     OBLIGATOIRES :
     → "Comment utiliser un code promo [marchand] ?"
     → "Est-ce que les codes promo [marchand] fonctionnent ?"
     → "Quel est le meilleur code promo [marchand] en [mois] [année] ?"
     → "Peut-on cumuler les codes promo [marchand] ?"
     RECOMMANDÉES :
     → "[Marchand] livraison gratuite code promo"
     → "Combien de codes promo [marchand] sont disponibles ?"
     → Questions spécifiques au marchand (fidélité, retours, marques dispo)
     Chaque question DOIT contenir le nom du marchand. Réponses : 2-4 phrases factuelles, ton City Baddies.
   ⚠️ STATS — UNIQUEMENT basées sur les offres avec un VRAI CODE PROMO (code ≠ null) :
   - averageDiscount (number) — moyenne des réductions des CODES PROMO uniquement (ignorer les bons plans sans code)
   - bestCurrentDiscount (number) — meilleur % de réduction parmi les CODES PROMO uniquement
   - totalActiveOffers (number) — nombre de VRAIS CODES PROMO uniquement (pas les bons plans)
   - conclusion (string) — HTML <p>, 1 paragraphe wrap-up. Inclure le nom du marchand dans un <strong>. CTA naturel, ton insider.
   - relatedMerchants (string) — slugs séparés par virgule
   - targetKeywords (string) — 15-20 mots-clés SEO. INCLURE : "code promo [marchand]", "codes promo [marchand]", "bon de réduction [marchand]", "réduction [marchand]", "promo [marchand] [mois] [année]", "[marchand] code promo", "coupon [marchand]", et variantes longue traîne (parfum, maquillage, soin, etc.)

Réponds UNIQUEMENT avec le JSON valide. Pas de markdown, pas de commentaire, pas de \`\`\`json.`;
}

// ══════════════════════════════════════════════════════════════════════
// Call GPT-4o
// ══════════════════════════════════════════════════════════════════════

async function callLLM(prompt: string): Promise<LLMResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY manquante dans .env');

  const client = new OpenAI({ apiKey });

  log('🤖', 'Envoi au LLM (GPT-4o)...');

  const response = await client.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `Tu es la rédactrice de City Baddies (citybaddies.com), comparateur de prix beauté sélectif en France. Tu écris comme une amie experte en beauté : naturelle, directe, honnête. Tu tutoies, tu ne survends jamais, et tu ne copies JAMAIS le contenu source — tu reformules avec tes propres mots. Pas de mots anglais forcés, pas de ton surexcité. Tu réponds UNIQUEMENT en JSON valide, sans aucun formatage markdown.`,
      },
      { role: 'user', content: prompt },
    ],
    temperature: 0.3,
    max_tokens: 16_000,
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('Réponse LLM vide');

  log('📊', `Tokens: ${response.usage?.prompt_tokens} prompt + ${response.usage?.completion_tokens} completion = ${response.usage?.total_tokens} total`);

  const parsed = JSON.parse(content) as LLMResult;

  if (!parsed.promoCodes || !parsed.merchantPromoPage) {
    throw new Error('Réponse LLM mal structurée (clés manquantes)');
  }

  log('✅', `LLM a généré ${parsed.promoCodes.length} codes promo + 1 page marchand`);
  return parsed;
}

// ══════════════════════════════════════════════════════════════════════
// Trouver le merchant Sephora dans la DB
// ══════════════════════════════════════════════════════════════════════

async function findOrCreateMerchant(slug: string): Promise<string> {
  const merchant = await prisma.merchant.findUnique({ where: { slug } });
  if (merchant) {
    log('🏪', `Marchand trouvé: ${merchant.name} (${merchant.id})`);
    return merchant.id;
  }

  // Créer le marchand s'il n'existe pas
  const created = await prisma.merchant.create({
    data: {
      name: slug.charAt(0).toUpperCase() + slug.slice(1),
      slug,
      website: `https://www.${slug}.fr`,
    },
  });

  log('🏪', `Marchand créé: ${created.name} (${created.id})`);
  return created.id;
}

// ══════════════════════════════════════════════════════════════════════
// Upsert PromoCode dans la DB
// ══════════════════════════════════════════════════════════════════════

async function upsertPromoCodes(codes: LLMPromoCode[], merchantId: string): Promise<number> {
  // ⚡ Filtrer : garder UNIQUEMENT les vrais codes promo (pas les bons plans sans code)
  const realCodes = codes.filter((c) => c.code && c.code.trim().length > 0);
  const skipped = codes.length - realCodes.length;
  if (skipped > 0) {
    log('🚫', `${skipped} bons plans sans code ignorés (seuls les vrais codes sont insérés)`);
  }
  log('🔑', `${realCodes.length} vrais codes promo à insérer`);

  let count = 0;

  for (const code of realCodes) {
    try {
      // Générer un slug unique si manquant
      const baseSlug = code.slug || slugify(code.title);
      let finalSlug = baseSlug;

      // Vérifier unicité du slug
      const existing = await prisma.promoCode.findUnique({ where: { slug: finalSlug } });
      if (existing) {
        finalSlug = `${baseSlug}-${Date.now().toString(36).slice(-4)}`;
      }

      // Vérifier si un code identique existe déjà pour ce merchant
      if (code.code) {
        const duplicate = await prisma.promoCode.findFirst({
          where: { code: code.code, merchantId },
        });
        if (duplicate) {
          // Update au lieu de créer
          await prisma.promoCode.update({
            where: { id: duplicate.id },
            data: {
              title: code.title,
              description: code.description,
              discountType: code.discountType,
              discountValue: code.discountValue,
              minimumPurchase: code.minimumPurchase,
              maximumDiscount: code.maximumDiscount,
              applicableTo: code.applicableTo,
              conditions: code.conditions,
              isNewCustomerOnly: code.isNewCustomerOnly,
              isStackable: code.isStackable || false,
              status: code.status,
              expiresAt: code.expiresAt ? new Date(code.expiresAt) : null,
              isVerified: code.isVerified,
              isExclusive: code.isExclusive,
              isFeatured: code.isFeatured,
              successRate: code.successRate,
              votes: code.votes,
              sourceUrl: code.sourceUrl,
              sourceType: code.sourceType,
              updatedAt: new Date(),
            },
          });
          log('🔄', `  Mis à jour: [${code.code}] ${code.title.substring(0, 50)}`);
          count++;
          continue;
        }
      }

      await prisma.promoCode.create({
        data: {
          code: code.code || `DEAL-${finalSlug.substring(0, 20)}`,
          slug: finalSlug,
          title: code.title,
          description: code.description,
          merchantId,
          discountType: code.discountType,
          discountValue: code.discountValue,
          minimumPurchase: code.minimumPurchase,
          maximumDiscount: code.maximumDiscount,
          applicableTo: code.applicableTo,
          conditions: code.conditions,
          isNewCustomerOnly: code.isNewCustomerOnly,
          isStackable: code.isStackable || false,
          status: code.status,
          startDate: new Date(),
          expiresAt: code.expiresAt ? new Date(code.expiresAt) : null,
          isVerified: code.isVerified,
          isExclusive: code.isExclusive || false,
          isFeatured: code.isFeatured || false,
          successRate: code.successRate,
          votes: code.votes || 0,
          sourceUrl: code.sourceUrl,
          sourceType: code.sourceType,
        },
      });

      log('✅', `  Créé: ${code.code ? `[${code.code}]` : '[BON PLAN]'} ${code.title.substring(0, 50)}`);
      count++;
    } catch (err) {
      log('⚠️', `  Erreur: ${code.title.substring(0, 40)} → ${(err as Error).message}`);
    }
  }

  return count;
}

// ══════════════════════════════════════════════════════════════════════
// Upsert MerchantPromoPage
// ══════════════════════════════════════════════════════════════════════

async function upsertPromoPage(page: LLMMerchantPromoPage, merchantId: string) {
  const existing = await prisma.merchantPromoPage.findUnique({
    where: { merchantId },
  });

  const data = {
    merchantId,
    canonicalSlug: page.canonicalSlug,
    metaTitle: page.metaTitle,
    metaDescription: page.metaDescription,
    heroTitle: page.heroTitle,
    heroSubtitle: page.heroSubtitle,
    introduction: page.introduction,
    merchantDescription: page.merchantDescription,
    merchantAdvantages: page.merchantAdvantages as any,
    shippingInfo: page.shippingInfo,
    returnPolicy: page.returnPolicy,
    loyaltyProgram: page.loyaltyProgram,
    howToUse: page.howToUse as any,
    howToUseHtml: page.howToUseHtml,
    tips: page.tips as any,
    bestTimeToShop: page.bestTimeToShop,
    faq: page.faq as any,
    averageDiscount: page.averageDiscount,
    bestCurrentDiscount: page.bestCurrentDiscount,
    totalActiveOffers: page.totalActiveOffers,
    conclusion: page.conclusion,
    relatedMerchants: page.relatedMerchants,
    targetKeywords: page.targetKeywords,
    lastVerifiedAt: new Date(),
  };

  if (existing) {
    await prisma.merchantPromoPage.update({
      where: { id: existing.id },
      data,
    });
    log('🔄', 'MerchantPromoPage mise à jour');
  } else {
    await prisma.merchantPromoPage.create({ data });
    log('✅', 'MerchantPromoPage créée');
  }
}

// ══════════════════════════════════════════════════════════════════════
// Main
// ══════════════════════════════════════════════════════════════════════

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const fileFlag = args.indexOf('--file');
  const merchantFlag = args.indexOf('--merchant');
  const merchantSlug = merchantFlag >= 0 && args[merchantFlag + 1] ? args[merchantFlag + 1] : 'sephora';

  // Trouver le fichier JSON le plus récent
  let jsonPath: string;
  if (fileFlag >= 0 && args[fileFlag + 1]) {
    jsonPath = path.resolve(args[fileFlag + 1]);
  } else {
    // Chercher le dernier fichier mareduc-{merchant} dans data/
    const dataDir = path.resolve('data');
    const prefix = `mareduc-${merchantSlug}`;
    const files = fs.readdirSync(dataDir)
      .filter((f) => f.startsWith(prefix) && f.endsWith('.json') && !f.includes('llm-prompt') && !f.includes('llm-result'))
      .sort()
      .reverse();

    if (files.length === 0) {
      log('❌', `Aucun fichier ${prefix}*.json trouvé dans data/`);
      log('💡', `Lance d'abord: npx tsx src/scripts/scrape-mareduc.ts --merchant ${merchantSlug}`);
      process.exit(1);
    }
    jsonPath = path.join(dataDir, files[0]);
  }

  log('📂', `Fichier source: ${jsonPath}`);
  const rawData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  log('📊', `${rawData.offers.length} offres scrapées, ${rawData.stats.codes} codes, ${rawData.stats.deals} deals`);

  // ── Vérifier s'il existe déjà un résultat LLM ──
  const llmOutputPath = jsonPath.replace('.json', '-llm-result.json');
  let llmResult: LLMResult;

  if (fs.existsSync(llmOutputPath) && !args.includes('--force-llm')) {
    log('♻️', `Résultat LLM existant trouvé → ${llmOutputPath}`);
    log('♻️', 'Utilisation du cache (ajoute --force-llm pour re-appeler GPT)');
    llmResult = JSON.parse(fs.readFileSync(llmOutputPath, 'utf-8'));
  } else {
    // Appeler le LLM
    const prompt = buildPrompt(rawData);
    llmResult = await callLLM(prompt);
    fs.writeFileSync(llmOutputPath, JSON.stringify(llmResult, null, 2), 'utf-8');
    log('💾', `Résultat LLM sauvegardé → ${llmOutputPath}`);
  }

  // ── Séparer codes vs deals ──
  const realCodes = llmResult.promoCodes.filter((pc) => pc.code && pc.code.trim().length > 0);
  const deals = llmResult.promoCodes.filter((pc) => !pc.code || pc.code.trim().length === 0);
  const mp = llmResult.merchantPromoPage;

  log('', '');
  log('📋', '═══════════════════════════════════════════════════════════');
  log('📋', '  RÉSUMÉ — CE QUI SERA INSÉRÉ DANS LA DB');
  log('📋', '═══════════════════════════════════════════════════════════');

  // ── Codes promo (les seuls insérés) ──
  log('', '');
  log('🔑', `── CODES PROMO → table PromoCode (${realCodes.length} insertions) ──`);
  for (const pc of realCodes) {
    log('🔑', `  Code: ${pc.code}`);
    log('  ', `    slug: ${pc.slug}`);
    log('  ', `    title: ${pc.title}`);
    log('  ', `    description: ${pc.description?.substring(0, 80) || 'null'}`);
    log('  ', `    discountType: ${pc.discountType} | discountValue: ${pc.discountValue ?? 'null'}`);
    log('  ', `    minimumPurchase: ${pc.minimumPurchase ?? 'null'} | maximumDiscount: ${pc.maximumDiscount ?? 'null'}`);
    log('  ', `    applicableTo: ${pc.applicableTo || 'null'}`);
    log('  ', `    conditions: ${pc.conditions?.substring(0, 60) || 'null'}`);
    log('  ', `    status: ${pc.status} | isVerified: ${pc.isVerified} | isExclusive: ${pc.isExclusive}`);
    log('  ', `    expiresAt: ${pc.expiresAt || 'null (permanent)'}`);
    log('  ', `    votes: ${pc.votes} | successRate: ${pc.successRate ?? 'null'}`);
    log('  ', `    sourceType: ${pc.sourceType} | sourceUrl: ${pc.sourceUrl}`);
    log('', '');
  }
  if (deals.length > 0) {
    log('🚫', `── ${deals.length} BONS PLANS IGNORÉS (pas de code) ──`);
    for (const d of deals) {
      log('  ', `    ❌ ${d.title.substring(0, 70)}`);
    }
  }

  // ── Rich Content ──
  log('', '');
  log('📝', `── RICH CONTENT → table MerchantPromoPage (1 upsert) ──`);
  log('  ', `  canonicalSlug: ${mp.canonicalSlug}`);
  log('  ', `  metaTitle: ${mp.metaTitle}`);
  log('  ', `  metaDescription: ${mp.metaDescription}`);
  log('  ', `  heroTitle: ${mp.heroTitle}`);
  log('  ', `  heroSubtitle: ${mp.heroSubtitle}`);
  log('  ', `  introduction: ${mp.introduction.substring(0, 100)}...`);
  log('  ', `  merchantDescription: ${mp.merchantDescription.substring(0, 100)}...`);
  log('  ', `  merchantAdvantages: ${mp.merchantAdvantages.length} items → ${mp.merchantAdvantages.map((a) => a.title).join(', ')}`);
  log('  ', `  shippingInfo: ${mp.shippingInfo ? 'OUI' : 'null'}`);
  log('  ', `  returnPolicy: ${mp.returnPolicy ? 'OUI' : 'null'}`);
  log('  ', `  loyaltyProgram: ${mp.loyaltyProgram ? 'OUI' : 'null'}`);
  log('  ', `  howToUse: ${mp.howToUse.length} étapes`);
  log('  ', `  tips: ${mp.tips.length} astuces → ${mp.tips.map((t) => t.title).join(', ')}`);
  log('  ', `  faq: ${mp.faq.length} questions → ${mp.faq.map((f) => f.question.substring(0, 40)).join(' | ')}`);
  log('  ', `  averageDiscount: ${mp.averageDiscount}% | bestCurrentDiscount: ${mp.bestCurrentDiscount}%`);
  log('  ', `  totalActiveOffers: ${mp.totalActiveOffers}`);
  log('  ', `  relatedMerchants: ${mp.relatedMerchants.substring(0, 80)}...`);
  log('  ', `  targetKeywords: ${mp.targetKeywords}`);
  log('  ', `  bestTimeToShop: ${mp.bestTimeToShop}`);
  log('  ', `  conclusion: ${mp.conclusion.substring(0, 80)}...`);

  log('', '');
  log('📋', '═══════════════════════════════════════════════════════════');

  if (isDryRun) {
    log('🏃', 'Mode --dry-run : pas d\'insertion en base');
    log('💡', 'Relance sans --dry-run pour insérer');
    await prisma.$disconnect();
    return;
  }

  // ── Insérer dans la DB ──
  log('', '');
  log('🗄️', '═══ INSERTION EN BASE ═══');

  const merchantId = await findOrCreateMerchant(rawData.merchant);

  log('', '');
  log('📝', '── Codes Promo ──');
  const insertedCount = await upsertPromoCodes(llmResult.promoCodes, merchantId);
  log('📊', `${insertedCount}/${llmResult.promoCodes.length} codes promo insérés/mis à jour`);

  log('', '');
  log('📝', '── Page Marchand ──');
  await upsertPromoPage(llmResult.merchantPromoPage, merchantId);

  log('', '');
  log('🎉', '═══════════════════════════════════════════');
  log('🎉', 'IMPORT TERMINÉ AVEC SUCCÈS !');
  log('🎉', `  ${insertedCount} codes promo dans la base`);
  log('🎉', `  1 page marchand ${rawData.merchant}`);
  log('🎉', '═══════════════════════════════════════════');

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('❌ Erreur fatale:', err);
  prisma.$disconnect();
  process.exit(1);
});
