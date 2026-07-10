/**
 * =============================================================================
 * TRACK-PRICES.TS — PRICE TRACKER QUOTIDIEN (comparateur)
 * =============================================================================
 *
 * Pour chaque fiche produit VÉRIFIÉE de ScrapingQueue, récupère le prix courant
 * chez le marchand et écrit un Deal ACTIVE par (variante, marchand) sous un
 * Product CANONIQUE partagé (slug = slugify(productName)). Les 3 marchands d'un
 * même parfum convergent donc vers UN seul Product → la fiche produit affiche la
 * comparaison multi-marchands.
 *
 * Usage:
 *   npx tsx src/scripts/track-prices.ts [--merchant nocibe|sephora|marionnaud] [--limit N] [--dry-run]
 *
 * --merchant M : ne traiter que ce marchand (sinon les trois)
 * --limit N    : max N fiches (au total, ou par marchand si --merchant absent)
 * --dry-run    : affiche "productName | merchant | price | volume", n'écrit RIEN
 *
 * NB: un tracker RAFRAÎCHIT les prix — il n'expire AUCUN deal (≠ scraper promo).
 * Exit: 0 si ≥1 deal écrit ou rien à faire ; 1 si échec total.
 * =============================================================================
 */
import 'dotenv/config';
import prisma from '../lib/prisma';
import {
  fetchMarionnaudProductPrice,
  fetchNocibeProductPrice,
  fetchSephoraProductPrice,
  warmupSession,
  ProductPrice,
  PriceFetchResult,
} from '../lib/scraping/product-price';
import { findOrCreateBrand } from '../lib/brands';
import { findOrCreateVariant, calculatePricePerUnit } from '../lib/utils/volume';

type MerchantSlug = 'marionnaud' | 'nocibe' | 'sephora';

const MERCHANT_INFO: Record<MerchantSlug, { name: string; website: string }> = {
  sephora: { name: 'Sephora', website: 'https://www.sephora.fr' },
  nocibe: { name: 'Nocibé', website: 'https://www.nocibe.fr' },
  marionnaud: { name: 'Marionnaud', website: 'https://www.marionnaud.fr' },
};

// Espacement minimum entre 2 fetches d'un même marchand (ms). Akamai (nocibe /
// sephora) rate-limite par IP même sur IP GitHub (observé: coupure après ~15-20
// requêtes à 5-8s) → espacement large + jitter. Marionnaud : poli.
const THROTTLE_MS: Record<MerchantSlug, number> = {
  marionnaud: 1500,
  nocibe: 10000,
  sephora: 12000,
};
// Jitter aléatoire ajouté au throttle (0..JITTER_MS) — motif moins mécanique.
const JITTER_MS = 4000;

// Backoffs successifs quand un blocage (403/challenge) est détecté : on attend
// longuement puis on reprend — le rate-limit Akamai se relâche après une pause.
const BLOCK_BACKOFFS_MS = [90_000, 180_000];
// Au-delà de N événements de blocage malgré les backoffs, on abandonne le
// marchand pour ce run (le cron du lendemain reprendra).
const MAX_BLOCK_EVENTS = 4;

const FETCHERS: Record<MerchantSlug, (url: string) => Promise<PriceFetchResult>> = {
  marionnaud: fetchMarionnaudProductPrice,
  nocibe: fetchNocibeProductPrice,
  sephora: fetchSephoraProductPrice,
};

const PARFUMS_CATEGORY = { slug: 'parfums', name: 'Parfums', icon: 'Gem', description: 'Parfums femme, homme...' };

/** Slug canonique = slug du productName (identique pour les 3 marchands d'un parfum). */
function canonicalSlug(productName: string): string {
  return productName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 80)
    .replace(/-$/, '');
}

/** Une URL de ScrapingQueue pointe-t-elle vers une VRAIE fiche produit ? */
function isProductUrl(merchant: MerchantSlug, url: string): boolean {
  if (!url) return false;
  if (/\/search\b|\/search\?/i.test(url)) return false; // pages de recherche
  if (/\/fr\/b\//i.test(url)) return false; // pages marque Nocibé
  switch (merchant) {
    case 'marionnaud':
      return /\/p\/BP_/i.test(url) || /\/p\//i.test(url);
    case 'nocibe':
      return /\/fr\/p\/\d+/i.test(url);
    case 'sephora':
      return /\/p\/.*-P\d+\.html/i.test(url) || /\/p\//i.test(url);
    default:
      return false;
  }
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Summary {
  processed: number;
  written: number;
  priceChanges: number;
  skipped: number;
  errors: number;
}

async function main() {
  const args = process.argv.slice(2);
  const merchantIdx = args.indexOf('--merchant');
  const merchantArg = merchantIdx >= 0 ? (args[merchantIdx + 1] as MerchantSlug) : null;
  const limitIdx = args.indexOf('--limit');
  const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : Infinity;
  const dryRun = args.includes('--dry-run');

  if (merchantArg && !MERCHANT_INFO[merchantArg]) {
    console.error(`Marchand inconnu: ${merchantArg} (attendu: marionnaud|nocibe|sephora)`);
    process.exit(1);
  }

  const merchants: MerchantSlug[] = merchantArg ? [merchantArg] : ['marionnaud', 'nocibe', 'sephora'];
  console.log(`Price tracker — marchands: ${merchants.join(', ')}${dryRun ? ' (DRY RUN)' : ''}, limit=${limit}`);

  // Charger les fiches vérifiées à fiche-produit, par marchand.
  const rows = await prisma.scrapingQueue.findMany({
    // status 'error' = lien mort marqué par un run précédent (404) — on ne retente pas.
    where: { verified: true, merchantSlug: { in: merchants }, status: { not: 'error' } },
    select: { id: true, productName: true, merchantSlug: true, productUrl: true },
    orderBy: [{ merchantSlug: 'asc' }, { productName: 'asc' }],
  });

  // Pré-charger merchant + catégorie parfums (une fois, hors dry-run).
  const merchantIdBySlug = new Map<string, string>();
  let parfumsCategoryId = '';
  if (!dryRun) {
    const cat = await prisma.category.upsert({
      where: { slug: PARFUMS_CATEGORY.slug },
      update: {},
      create: PARFUMS_CATEGORY,
    });
    parfumsCategoryId = cat.id;
    for (const m of merchants) {
      const info = MERCHANT_INFO[m];
      const merchant = await prisma.merchant.upsert({
        where: { slug: m },
        update: {},
        create: { name: info.name, slug: m, website: info.website, logoUrl: `${info.website}/favicon.ico` },
      });
      merchantIdBySlug.set(m, merchant.id);
    }
  }

  const summary: Summary = { processed: 0, written: 0, priceChanges: 0, skipped: 0, errors: 0 };
  const lastFetchAt: Record<string, number> = {};
  const blockEvents: Record<string, number> = {};
  const abandoned = new Set<MerchantSlug>();
  const warmedUp = new Set<MerchantSlug>();
  let count = 0;

  for (const row of rows) {
    if (count >= limit) break;
    const merchant = row.merchantSlug as MerchantSlug;
    if (abandoned.has(merchant)) continue;

    if (!isProductUrl(merchant, row.productUrl)) {
      summary.skipped++;
      continue;
    }
    count++;
    summary.processed++;

    // Warmup de session (cookies Akamai) au 1er fetch du marchand.
    if (!warmedUp.has(merchant)) {
      warmedUp.add(merchant);
      await warmupSession(MERCHANT_INFO[merchant].website, merchant !== 'marionnaud');
      await delay(2000);
    }

    // Throttle par marchand (+ jitter anti-motif mécanique).
    const throttle = THROTTLE_MS[merchant] + Math.floor(Math.random() * JITTER_MS);
    const since = Date.now() - (lastFetchAt[merchant] || 0);
    if (lastFetchAt[merchant] && since < throttle) await delay(throttle - since);
    lastFetchAt[merchant] = Date.now();

    // Fetch avec gestion du blocage: long backoff puis reprise.
    let result: PriceFetchResult = null;
    for (let attempt = 0; ; attempt++) {
      try {
        result = await FETCHERS[merchant](row.productUrl);
      } catch (err) {
        console.warn(`[track] fetch throw ${row.productName} (${merchant}): ${err instanceof Error ? err.message : err}`);
        result = null;
      }
      if (result !== 'BLOCKED') break;
      blockEvents[merchant] = (blockEvents[merchant] || 0) + 1;
      if (blockEvents[merchant] >= MAX_BLOCK_EVENTS) {
        console.warn(`[track] ⛔ ${merchant}: ${blockEvents[merchant]} blocages malgré les pauses — abandon du marchand pour ce run`);
        abandoned.add(merchant);
        break;
      }
      const wait = BLOCK_BACKOFFS_MS[Math.min(attempt, BLOCK_BACKOFFS_MS.length - 1)];
      console.warn(`[track] 🚧 ${merchant} rate-limité (blocage #${blockEvents[merchant]}) — pause ${wait / 1000}s puis reprise...`);
      await delay(wait);
      if (attempt >= BLOCK_BACKOFFS_MS.length) break; // 2 retries max par fiche
    }
    if (abandoned.has(merchant)) { summary.errors++; continue; }

    if (result === 'NOT_FOUND') {
      summary.errors++;
      console.warn(`[track] ✗ ${row.productName} | ${merchant} | lien mort (404) — marqué en base, ne sera plus retenté`);
      if (!dryRun) {
        await prisma.scrapingQueue.update({
          where: { id: row.id },
          data: { status: 'error', errorMessage: 'HTTP 404 — lien mort (track-prices)' },
        }).catch(() => {});
      }
      continue;
    }

    const price = result === 'BLOCKED' ? null : (result as ProductPrice | null);
    if (!price || !(price.currentPrice > 0)) {
      summary.errors++;
      console.warn(`[track] ✗ ${row.productName} | ${merchant} | prix introuvable`);
      continue;
    }

    if (dryRun) {
      console.log(`${row.productName} | ${merchant} | ${price.currentPrice}€ | ${price.volume ?? '?'}`);
      continue;
    }

    try {
      await writeDeal(row, merchant, price, merchantIdBySlug.get(merchant)!, parfumsCategoryId, summary);
    } catch (err) {
      summary.errors++;
      console.warn(`[track] ✗ écriture ${row.productName} (${merchant}): ${err instanceof Error ? err.message : err}`);
    }
  }

  console.log('\n=== Résumé ===');
  console.log(`fiches traitées : ${summary.processed}`);
  console.log(`deals écrits    : ${summary.written}`);
  console.log(`changements prix: ${summary.priceChanges}`);
  console.log(`URLs ignorées   : ${summary.skipped}`);
  console.log(`erreurs         : ${summary.errors}`);

  await prisma.$disconnect();
  // Succès si au moins 1 deal écrit, ou s'il n'y avait rien à faire (dry-run / 0 fiche).
  process.exit(summary.written > 0 || summary.processed === 0 || dryRun ? 0 : 1);
}

async function writeDeal(
  row: { id: string; productName: string; productUrl: string },
  merchant: MerchantSlug,
  price: ProductPrice,
  merchantId: string,
  categoryId: string,
  summary: Summary,
): Promise<void> {
  const currentPrice = price.currentPrice;
  const originalPrice = price.originalPrice && price.originalPrice > currentPrice ? price.originalPrice : currentPrice;
  const discountAmount = Math.round((originalPrice - currentPrice) * 100) / 100;
  const discountPercent = originalPrice > currentPrice ? Math.round((1 - currentPrice / originalPrice) * 100) : 0;

  // Marque : celle de la fiche, sinon 1er(s) mot(s) du productName.
  const brandName = (price.brand && price.brand.trim()) || row.productName.split(/\s+/).slice(0, 2).join(' ');
  const brandId = await findOrCreateBrand(brandName);

  // Product canonique (partagé entre marchands).
  const slug = canonicalSlug(row.productName);
  const product = await prisma.product.upsert({
    where: { slug },
    update: {},
    create: {
      name: row.productName.substring(0, 200),
      slug,
      description: `${brandName} - ${row.productName}`.substring(0, 500),
      imageUrl: price.imageUrl || null,
      brand: brandName,
      brandId,
      categoryId,
    },
  });

  // Variant (nécessite une contenance parsable).
  const variant = await findOrCreateVariant(prisma, product.id, price.volume);
  if (!variant) {
    summary.errors++;
    console.warn(`[track] ✗ ${row.productName} | ${merchant} | contenance non parsable "${price.volume ?? ''}"`);
    return;
  }

  const priceInfo = calculatePricePerUnit(currentPrice, price.volume);

  const dealData = {
    title: `${brandName} : ${row.productName}`.substring(0, 150),
    dealPrice: currentPrice,
    originalPrice,
    discountPercent,
    discountAmount,
    productUrl: row.productUrl,
    imageUrl: price.imageUrl || null,
    promoCode: price.promoCode || null,
    priceConditions: price.priceConditions || null,
    volume: price.volume || null,
    volumeValue: priceInfo?.volumeValue ?? variant.volumeValue,
    volumeUnit: priceInfo?.volumeUnit ?? variant.volumeUnit,
    pricePerUnit: priceInfo?.pricePerUnit ?? null,
    status: 'ACTIVE' as const,
    lastSeenAt: new Date(),
  };

  await prisma.deal.upsert({
    where: { variantId_merchantId: { variantId: variant.id, merchantId } },
    update: dealData,
    create: {
      ...dealData,
      productId: product.id,
      variantId: variant.id,
      merchantId,
      type: 'tracked',
    },
  });
  summary.written++;

  // PriceHistory — uniquement si le dernier prix connu diffère.
  const last = await prisma.priceHistory.findFirst({
    where: { productId: product.id, variantId: variant.id },
    orderBy: { date: 'desc' },
    select: { price: true },
  });
  if (!last || last.price !== currentPrice) {
    await prisma.priceHistory.create({
      data: {
        productId: product.id,
        variantId: variant.id,
        price: currentPrice,
        volumeValue: priceInfo?.volumeValue ?? null,
        volumeUnit: priceInfo?.volumeUnit ?? null,
        volumeRaw: price.volume || null,
      },
    });
    summary.priceChanges++;
  }

  // Marquer la ligne de queue comme traitée.
  await prisma.scrapingQueue.update({
    where: { id: row.id },
    data: { productId: product.id, status: 'done', scrapedAt: new Date() },
  });

  console.log(
    `[track] ✓ ${row.productName} | ${merchant} | ${currentPrice}€${discountPercent ? ` (-${discountPercent}%)` : ''} | ${price.volume ?? '?'}`,
  );
}

main().catch(async (err) => {
  console.error('Erreur fatale:', err);
  await prisma.$disconnect();
  process.exit(1);
});
