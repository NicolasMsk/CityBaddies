/**
 * =============================================================================
 * TRACK-PRICES.TS — PRICE TRACKER QUOTIDIEN (comparateur)
 * =============================================================================
 *
 * Pour chaque fiche produit VÉRIFIÉE de ScrapingQueue, récupère TOUTES les
 * contenances (tailles) et leurs prix chez le marchand et écrit un Deal ACTIVE
 * par (variante, marchand) sous un Product CANONIQUE partagé
 * (slug = slugify(productName)). Les 3 marchands d'un même parfum convergent
 * donc vers UN seul Product → la fiche produit affiche la comparaison
 * multi-marchands ET multi-contenances (sélecteur de taille).
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
  VariantPrice,
} from '../lib/scraping/product-price';
import { findOrCreateBrand } from '../lib/brands';
import { findOrCreateVariant, calculatePricePerUnit, parseVolume } from '../lib/utils/volume';

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

// IMPORTANT (constat des runs GHA) : le blocage Akamai est lié à la RÉPUTATION
// de l'IP datacenter, PAS au rythme. Attendre 90-180s ne lève pas le blocage.
// Stratégie retenue : sur blocage, 1 courte retry puis on ABANDONNE le marchand
// pour ce run — c'est un run ULTÉRIEUR (IP GitHub fraîche) qui reprendra les
// fiches manquantes. Le tracker est INCRÉMENTAL (voir STALE_HOURS) : chaque run
// ne retraite que les fiches périmées, donc plusieurs petits runs/jour couvrent
// tout le catalogue morceau par morceau.
const BLOCK_RETRY_MS = 20_000; // une seule courte retry
const MAX_BLOCK_EVENTS = 2; // au 2e blocage, on abandonne le marchand pour ce run

// Ne retraiter une fiche que si son offre n'a pas été rafraîchie depuis N heures.
// Rend les runs incrémentaux/idempotents : les runs suivants attaquent le reliquat.
const DEFAULT_STALE_HOURS = 20;

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
  const staleIdx = args.indexOf('--stale-hours');
  const staleHours = staleIdx >= 0 ? parseInt(args[staleIdx + 1], 10) : DEFAULT_STALE_HOURS;
  const dryRun = args.includes('--dry-run');
  const staleCutoff = new Date(Date.now() - staleHours * 3600_000);

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

  // Offres tracker déjà rafraîchies récemment -> on les saute (incrémental).
  const freshKeys = new Set<string>();
  if (!dryRun) {
    const recent = await prisma.deal.findMany({
      where: { type: 'tracked', lastSeenAt: { gte: staleCutoff }, merchant: { slug: { in: merchants } } },
      select: { merchant: { select: { slug: true } }, product: { select: { slug: true } } },
    });
    for (const d of recent) freshKeys.add(`${d.product.slug}|${d.merchant.slug}`);
    console.log(`Incrémental: ${freshKeys.size} offres déjà rafraîchies (<${staleHours}h) seront sautées`);
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

    // Incrémental : sauter les offres déjà rafraîchies récemment.
    if (freshKeys.has(`${canonicalSlug(row.productName)}|${merchant}`)) {
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
      if (blockEvents[merchant] >= MAX_BLOCK_EVENTS || attempt >= 1) {
        console.warn(`[track] ⛔ ${merchant}: bloqué par Akamai (IP datacenter) — abandon du marchand pour CE run ; un run ultérieur (IP fraîche) reprendra le reliquat`);
        abandoned.add(merchant);
        break;
      }
      console.warn(`[track] 🚧 ${merchant} bloqué — 1 courte retry dans ${BLOCK_RETRY_MS / 1000}s...`);
      await delay(BLOCK_RETRY_MS);
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
      const sizes = variantsToWrite(price)
        .map((v) => `${v.volume || '?'}=${v.currentPrice}€`)
        .join(', ');
      console.log(`${row.productName} | ${merchant} | ${sizes}`);
      continue;
    }

    try {
      await writeDeals(row, merchant, price, merchantIdBySlug.get(merchant)!, parfumsCategoryId, summary);
    } catch (err) {
      summary.errors++;
      console.warn(`[track] ✗ écriture ${row.productName} (${merchant}): ${err instanceof Error ? err.message : err}`);
    }
  }

  console.log('\n=== Résumé ===');
  console.log(`fiches traitées : ${summary.processed}`);
  console.log(`offres écrites  : ${summary.written} (une par taille x marchand)`);
  console.log(`changements prix: ${summary.priceChanges}`);
  console.log(`URLs ignorées   : ${summary.skipped}`);
  console.log(`erreurs         : ${summary.errors}`);

  await prisma.$disconnect();
  // Succès si au moins 1 deal écrit, ou s'il n'y avait rien à faire (dry-run / 0 fiche).
  process.exit(summary.written > 0 || summary.processed === 0 || dryRun ? 0 : 1);
}

/**
 * Contenances à écrire pour une fiche : toutes celles remontées par le fetcher
 * (`price.variants`, qui inclut la variante affichée), sinon — fail soft — la
 * seule variante affichée (comportement historique).
 */
function variantsToWrite(price: ProductPrice): VariantPrice[] {
  if (price.variants && price.variants.length > 0) return price.variants;
  return [{ volume: price.volume ?? '', currentPrice: price.currentPrice, originalPrice: price.originalPrice }];
}

async function writeDeals(
  row: { id: string; productName: string; productUrl: string },
  merchant: MerchantSlug,
  price: ProductPrice,
  merchantId: string,
  categoryId: string,
  summary: Summary,
): Promise<void> {
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

  // Une offre (Deal) par contenance de la fiche.
  const written: string[] = [];
  const seenVolumes = new Set<string>();
  for (const v of variantsToWrite(price)) {
    const currentPrice = v.currentPrice;
    if (!(currentPrice > 0)) continue;

    // Garde-fous : contenance parsable + dédup par volume normalisé.
    const volInfo = parseVolume(v.volume);
    if (!volInfo) {
      console.warn(`[track] ✗ ${row.productName} | ${merchant} | contenance non parsable "${v.volume ?? ''}"`);
      continue;
    }
    const volKey = `${volInfo.volumeValue}${volInfo.volumeUnit}`;
    if (seenVolumes.has(volKey)) continue;
    seenVolumes.add(volKey);

    // Promo valide uniquement si prix barré > prix courant.
    const originalPrice = v.originalPrice && v.originalPrice > currentPrice ? v.originalPrice : currentPrice;
    const discountAmount = Math.round((originalPrice - currentPrice) * 100) / 100;
    const discountPercent = originalPrice > currentPrice ? Math.round((1 - currentPrice / originalPrice) * 100) : 0;

    const variant = await findOrCreateVariant(prisma, product.id, v.volume, v.ean);
    if (!variant) continue; // même parseVolume → ne devrait pas arriver

    const priceInfo = calculatePricePerUnit(currentPrice, v.volume);

    const dealData = {
      title: `${brandName} : ${row.productName}`.substring(0, 150),
      dealPrice: currentPrice,
      originalPrice,
      discountPercent,
      discountAmount,
      productUrl: v.url || row.productUrl,
      imageUrl: price.imageUrl || null,
      promoCode: price.promoCode || null,
      priceConditions: price.priceConditions || null,
      volume: v.volume || null,
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

    // PriceHistory — uniquement si le dernier prix connu diffère (par variante).
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
          volumeRaw: v.volume || null,
        },
      });
      summary.priceChanges++;
    }

    written.push(`${v.volume}=${currentPrice}€${discountPercent ? ` (-${discountPercent}%)` : ''}`);
  }

  if (written.length === 0) {
    summary.errors++;
    console.warn(`[track] ✗ ${row.productName} | ${merchant} | aucune contenance exploitable`);
    return;
  }

  // Marquer la ligne de queue comme traitée.
  await prisma.scrapingQueue.update({
    where: { id: row.id },
    data: { productId: product.id, status: 'done', scrapedAt: new Date() },
  });

  console.log(
    `[track] ✓ ${row.productName} | ${merchant} | ${written.length} taille${written.length > 1 ? 's' : ''}: ${written.join(', ')}`,
  );
}

main().catch(async (err) => {
  console.error('Erreur fatale:', err);
  await prisma.$disconnect();
  process.exit(1);
});
