/**
 * Enrichissement 2e passe : fiches produit marchands + contenu IA.
 *
 * Pour chaque deal ACTIVE du marchand qui manque d'enrichissement
 * (whyGoodDeal null OU produit sans images OU ingredients null), visite la
 * fiche produit et remplit : ProductImage[], Product.description/ingredients,
 * Deal.priceConditions/promoCode, puis IA (gpt-4o-mini) pour
 * Product.seoDescription + Deal.whyGoodDeal.
 *
 * Usage:
 *   npx tsx src/scripts/enrich.ts <sephora|nocibe|marionnaud> [--limit N] [--dry-run]
 *
 * --limit N   : max N deals traités (défaut 40)
 * --dry-run   : affiche ce qui serait trouvé, n'écrit RIEN en base
 *
 * ⚠️ Throttle par marchand : nocibe/marionnaud ≥1.5s, sephora ≥8s (Akamai
 * rate-limite par IP — ne pas réduire).
 *
 * Exit codes: 0 = OK (≥1 deal traité, ou rien à enrichir), 1 = échec total.
 */
import 'dotenv/config';
import prisma from '../lib/prisma';
import {
  ProductDetails,
  fetchNocibeDetails,
  fetchMarionnaudDetails,
  fetchSephoraDetails,
} from '../lib/scraping/details';
import { generateProductContent } from '../lib/ai/enrich-content';

const MAX_IMAGES_PER_PRODUCT = 5;

const IMG_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1';

const MERCHANTS: Record<string, { fetcher: (url: string) => Promise<ProductDetails>; delayMs: number }> = {
  nocibe: { fetcher: fetchNocibeDetails, delayMs: 1500 },
  marionnaud: { fetcher: fetchMarionnaudDetails, delayMs: 1500 },
  sephora: { fetcher: fetchSephoraDetails, delayMs: 8000 },
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Ne stocke QUE des images qui existent réellement (200 + content-type image) et
 * qui ne sont pas des logos/visuels de marque. Évite d'insérer des URLs 404 que
 * les extracteurs peuvent parfois deviner (variantes -2/-3, chemins HD, etc.).
 */
async function keepValidImages(urls: string[]): Promise<string[]> {
  const valid: string[] = [];
  for (const url of urls) {
    if (/brand-images|\/logo|logogive/i.test(url)) continue;
    try {
      const c = new AbortController();
      const t = setTimeout(() => c.abort(), 12000);
      const r = await fetch(url, { headers: { 'User-Agent': IMG_UA, Accept: 'image/*,*/*' }, signal: c.signal, redirect: 'follow' });
      clearTimeout(t);
      if (r.ok && (r.headers.get('content-type') || '').startsWith('image')) valid.push(url);
    } catch {
      // URL injoignable -> on ne la stocke pas
    }
    if (valid.length >= MAX_IMAGES_PER_PRODUCT) break;
  }
  return valid;
}

async function main() {
  const args = process.argv.slice(2);
  const merchant = args[0];
  const limitIdx = args.indexOf('--limit');
  const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : 40;
  const dryRun = args.includes('--dry-run');

  if (!merchant || !MERCHANTS[merchant]) {
    console.error('Usage: npx tsx src/scripts/enrich.ts <sephora|nocibe|marionnaud> [--limit N] [--dry-run]');
    process.exit(1);
  }
  const { fetcher, delayMs } = MERCHANTS[merchant];

  // Deals ACTIVE du marchand qui manquent d'enrichissement, plus récents d'abord
  const deals = await prisma.deal.findMany({
    where: {
      status: 'ACTIVE',
      merchant: { slug: merchant },
      // NB: ingredients absent n'est PAS un critère de sélection — certaines fiches
      // n'ont pas de section INCI et deviendraient des candidats perpétuels
      // (re-scrape quotidien à vide). L'INCI est rempli opportunément quand le deal
      // est sélectionné pour une autre raison.
      OR: [
        { whyGoodDeal: null },
        { product: { images: { none: {} } } },
      ],
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      product: {
        include: {
          category: { select: { name: true } },
          images: { select: { id: true, url: true } },
        },
      },
    },
  });

  console.log(`🔎 Enrichissement ${merchant} — ${deals.length} deal(s) candidat(s)${dryRun ? ' (DRY RUN)' : ''}`);
  if (deals.length === 0) {
    console.log('✅ Rien à enrichir.');
    process.exit(0);
  }

  let processed = 0;
  let imagesAdded = 0;
  let aiGenerated = 0;
  let errors = 0;
  // Les writes produit sont partagés entre deals d'un même produit — on suit
  // localement les URLs déjà en base/écrites pendant ce run pour éviter les
  // re-writes et le double comptage.
  const productImageUrls = new Map<string, Set<string>>();

  for (let i = 0; i < deals.length; i++) {
    const deal = deals[i];
    const product = deal.product;
    console.log(`\n[${i + 1}/${deals.length}] ${deal.refinedTitle || deal.title}`);

    if (i > 0) await delay(delayMs);

    if (!deal.productUrl) {
      console.log('   ⏭️ Pas de productUrl, skip');
      errors++;
      continue;
    }

    let didSomething = false;

    // La fiche a-t-elle déjà été scrapée ? (images en base + INCI récupéré)
    // Si oui et qu'il ne manque QUE l'IA (whyGoodDeal), on NE re-télécharge PAS
    // la fiche — inutile, et ça épargne des requêtes Akamai. On génère l'IA
    // depuis les données déjà stockées.
    const pageAlreadyScraped = !dryRun && product.images.length > 0 && !!product.ingredients;
    const details = pageAlreadyScraped
      ? { images: [] as string[], description: undefined, ingredients: undefined, priceConditions: undefined, promoCode: undefined }
      : await fetcher(deal.productUrl);
    if (pageAlreadyScraped) console.log('   ↳ fiche déjà scrapée — IA seule, pas de re-fetch');

    if (dryRun) {
      console.log(`   images: ${details.images.length}${details.images[0] ? ` (1ère: ${details.images[0].substring(0, 90)}...)` : ''}`);
      console.log(`   description: ${details.description ? `${details.description.length} chars` : 'non trouvée'}`);
      console.log(`   ingredients: ${details.ingredients ? `${details.ingredients.length} chars` : 'non trouvés'}`);
      console.log(`   priceConditions: ${details.priceConditions || '—'} | promoCode: ${details.promoCode || '—'}`);
      if (details.images.length > 0 || details.description || details.ingredients) processed++;
      continue;
    }

    try {
      // 1. Images — upsert [productId, url], skip si le produit a déjà ≥5 images
      let existingUrls = productImageUrls.get(product.id);
      if (!existingUrls) {
        existingUrls = new Set(product.images.map((img) => img.url));
        productImageUrls.set(product.id, existingUrls);
      }
      // Valider les URLs (200 + image, hors logos) AVANT insertion en base.
      const validImages = details.images.length > 0 ? await keepValidImages(details.images) : [];
      if (validImages.length > 0 && existingUrls.size < MAX_IMAGES_PER_PRODUCT) {
        for (let pos = 0; pos < validImages.length; pos++) {
          const url = validImages[pos];
          const isNew = !existingUrls.has(url);
          if (isNew && existingUrls.size >= MAX_IMAGES_PER_PRODUCT) break;
          await prisma.productImage.upsert({
            where: { productId_url: { productId: product.id, url } },
            update: { position: pos, merchantId: deal.merchantId },
            create: {
              productId: product.id,
              url,
              alt: product.name,
              position: pos,
              merchantId: deal.merchantId,
            },
          });
          if (isNew) {
            existingUrls.add(url);
            imagesAdded++;
          }
          didSomething = true;
        }
      }

      // 2. Champs produit — uniquement s'ils sont vides (jamais d'écrasement)
      const productUpdate: Record<string, string> = {};
      if (!product.description && details.description) productUpdate.description = details.description;
      if (!product.ingredients && details.ingredients) productUpdate.ingredients = details.ingredients;
      if (Object.keys(productUpdate).length > 0) {
        await prisma.product.update({ where: { id: product.id }, data: productUpdate });
        // refléter localement pour les deals suivants du même produit
        if (productUpdate.ingredients) product.ingredients = productUpdate.ingredients;
        if (productUpdate.description) product.description = productUpdate.description;
        didSomething = true;
      }

      // 3. Champs deal — uniquement s'ils sont vides
      const dealUpdate: Record<string, string> = {};
      if (!deal.priceConditions && details.priceConditions) dealUpdate.priceConditions = details.priceConditions;
      if (!deal.promoCode && details.promoCode) dealUpdate.promoCode = details.promoCode;
      if (Object.keys(dealUpdate).length > 0) {
        await prisma.deal.update({ where: { id: deal.id }, data: dealUpdate });
        didSomething = true;
      }

      // 4. IA — seulement si whyGoodDeal manque. Échec IA toléré (retry au prochain run).
      if (deal.whyGoodDeal == null) {
        const content = await generateProductContent({
          productName: product.name,
          brand: product.brand || '',
          category: product.category.name,
          scrapedDescription: details.description || product.description || undefined,
          ingredients: details.ingredients || product.ingredients || undefined,
          dealPrice: deal.dealPrice,
          originalPrice: deal.originalPrice,
          discountPercent: deal.discountPercent,
          volume: deal.volume || undefined,
        });
        if (content) {
          await prisma.deal.update({ where: { id: deal.id }, data: { whyGoodDeal: content.whyGoodDeal } });
          if (!product.seoDescription) {
            await prisma.product.update({
              where: { id: product.id },
              data: { seoDescription: content.seoDescription },
            });
            product.seoDescription = content.seoDescription;
          }
          aiGenerated++;
          didSomething = true;
          console.log('   🤖 seoDescription + whyGoodDeal générés');
        } else {
          console.log('   ⚠️ IA indisponible, whyGoodDeal laissé null (retry au prochain run)');
        }
      }

      console.log(
        `   📦 images: ${details.images.length} trouvées | description: ${details.description ? 'oui' : 'non'} | INCI: ${details.ingredients ? 'oui' : 'non'}`,
      );
      if (didSomething) processed++;
      else console.log('   ⏭️ Rien de nouveau pour ce deal');
    } catch (err) {
      errors++;
      console.error(`   ❌ Erreur: ${err instanceof Error ? err.message : err}`);
    }
  }

  console.log('\n📊 Résumé:');
  console.log(`   deals candidats: ${deals.length} | enrichis: ${processed}`);
  console.log(`   images ajoutées: ${imagesAdded} | contenus IA générés: ${aiGenerated} | erreurs: ${errors}`);

  await prisma.$disconnect();
  // L'enrichissement est BEST-EFFORT (images/descriptions/IA), secondaire au
  // relevé de prix. "0 enrichi" (ex: quota IA épuisé, ou rien de nouveau) n'est
  // PAS un échec — sinon ça fait rougir le job quotidien pour rien. Seul un crash
  // fatal (catch ci-dessous) sort en 1.
  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Erreur fatale:', err);
  process.exit(1);
});
