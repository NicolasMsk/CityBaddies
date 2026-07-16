/**
 * Synchronise les codes promo CAPTURÉS SUR LES FICHES PRODUIT vers la section
 * /codes-promo.
 *
 * Principe (zéro code mort, par construction) :
 * - Source unique : Deal.promoCode, relevé par le tracker sur les fiches
 *   produit officielles des enseignes (6×/jour). Un code présent ici est,
 *   par définition, actuellement affiché par l'enseigne elle-même.
 * - Un code qui DISPARAÎT des fiches (plus aucun deal actif ne le porte)
 *   est automatiquement passé en EXPIRED au run suivant.
 * - Les chiffres affichés (réduction max, nb de parfums) sont recalculés
 *   à chaque run depuis les relevés — jamais figés.
 *
 * Ne touche QUE les codes sourceType='fiche-produit' : les codes ajoutés à la
 * main (newsletter, exclus…) ne sont jamais expirés par ce script.
 *
 * Usage : npx tsx src/scripts/sync-promo-codes.ts [--dry-run]
 * Branché dans .github/workflows/track-prices.yml après le relevé.
 */
import 'dotenv/config';
import prisma from '../lib/prisma';

const SOURCE = 'fiche-produit';

function slugify(merchantSlug: string, code: string): string {
  return `${merchantSlug}-${code.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}`;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const now = new Date();

  // 1. Codes actuellement visibles sur les fiches (deals actifs suivis)
  const deals = await prisma.deal.findMany({
    where: { status: 'ACTIVE', type: 'tracked', promoCode: { not: null } },
    include: { merchant: true, product: true },
  });

  interface Agg {
    merchantId: string;
    merchantSlug: string;
    merchantName: string;
    code: string;
    offerCount: number;
    maxDiscount: number;
    products: Set<string>;
    conditions: Set<string>;
    sourceUrl: string | null;
  }
  const byCode = new Map<string, Agg>();
  for (const d of deals) {
    const code = d.promoCode!.trim();
    if (!code) continue;
    const key = slugify(d.merchant.slug, code);
    const cur = byCode.get(key) ?? {
      merchantId: d.merchantId,
      merchantSlug: d.merchant.slug,
      merchantName: d.merchant.name,
      code,
      offerCount: 0,
      maxDiscount: 0,
      products: new Set<string>(),
      conditions: new Set<string>(),
      sourceUrl: null,
    };
    cur.offerCount++;
    cur.maxDiscount = Math.max(cur.maxDiscount, d.discountPercent ?? 0);
    cur.products.add(d.product.name);
    if (d.priceConditions) cur.conditions.add(d.priceConditions.trim());
    if (!cur.sourceUrl && d.productUrl) cur.sourceUrl = d.productUrl;
    byCode.set(key, cur);
  }

  console.log(`Codes visibles sur les fiches : ${byCode.size}`);

  // 2. Upsert chaque code vu
  for (const [slug, a] of byCode) {
    const productList = [...a.products].slice(0, 5).join(', ');
    const title = a.maxDiscount > 0
      ? `Code ${a.code} — jusqu'à -${a.maxDiscount}% constaté chez ${a.merchantName}`
      : `Code ${a.code} chez ${a.merchantName}`;
    const description =
      `Code relevé automatiquement sur les fiches produit officielles de ${a.merchantName} ` +
      `(dernier relevé : nos passages tournent six fois par jour). ` +
      `Vu actif sur ${a.products.size} parfum${a.products.size > 1 ? 's' : ''} suivi${a.products.size > 1 ? 's' : ''}` +
      `${productList ? ` — dont ${productList}` : ''}. ` +
      (a.maxDiscount > 0 ? `Réduction maximale constatée à taille égale : -${a.maxDiscount}%. ` : '') +
      `Le code disparaît de cette page dès qu'il n'est plus affiché par l'enseigne.`;
    const conditions = a.conditions.size > 0
      ? `Conditions affichées par l'enseigne : ${[...a.conditions].slice(0, 3).join(' · ')}`
      : 'S\'applique aux parfums sur lesquels l\'enseigne l\'affiche — vérifiez le panier avant paiement.';

    if (dryRun) {
      console.log(`~ ${slug} : "${title}" (${a.offerCount} offres)`);
      continue;
    }
    await prisma.promoCode.upsert({
      where: { slug },
      update: {
        title, description, conditions,
        discountType: 'PERCENTAGE',
        discountValue: a.maxDiscount > 0 ? a.maxDiscount : null,
        applicableTo: 'parfums (sélection affichée par l\'enseigne)',
        status: 'ACTIVE',
        isVerified: true,
        sourceType: SOURCE,
        sourceUrl: a.sourceUrl,
      },
      create: {
        slug,
        code: a.code,
        title, description, conditions,
        merchantId: a.merchantId,
        discountType: 'PERCENTAGE',
        discountValue: a.maxDiscount > 0 ? a.maxDiscount : null,
        applicableTo: 'parfums (sélection affichée par l\'enseigne)',
        status: 'ACTIVE',
        isVerified: true,
        sourceType: SOURCE,
        sourceUrl: a.sourceUrl,
      },
    });
    console.log(`✓ ${slug} — ${a.offerCount} offres, jusqu'à -${a.maxDiscount}%, ${a.products.size} parfums`);
  }

  // 3. Auto-expiration : codes fiche-produit qui ne sont plus vus
  if (!dryRun) {
    const expired = await prisma.promoCode.updateMany({
      where: { sourceType: SOURCE, status: 'ACTIVE', slug: { notIn: [...byCode.keys()] } },
      data: { status: 'EXPIRED', expiresAt: now },
    });
    if (expired.count > 0) console.log(`⏳ ${expired.count} code(s) disparus des fiches → EXPIRED`);
  }

  // 4. Rafraîchir les stats des pages enseignes
  if (!dryRun) {
    const pages = await prisma.merchantPromoPage.findMany({ select: { id: true, merchantId: true } });
    for (const pg of pages) {
      const active = await prisma.promoCode.findMany({
        where: { merchantId: pg.merchantId, status: 'ACTIVE' },
        select: { discountValue: true },
      });
      const best = active.reduce((m, c) => Math.max(m, c.discountValue ?? 0), 0);
      await prisma.merchantPromoPage.update({
        where: { id: pg.id },
        data: {
          totalActiveOffers: active.length,
          bestCurrentDiscount: best > 0 ? best : null,
          lastVerifiedAt: now,
        },
      });
    }
    console.log(`Stats des ${pages.length} pages enseignes rafraîchies.`);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
