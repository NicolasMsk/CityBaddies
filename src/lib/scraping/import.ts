/**
 * Moteur d'import V2 — minimal.
 * ScrapedProduct[] -> Brand / Product / ProductVariant / Deal(ACTIVE) / PriceHistory
 * puis expiration des deals non revus (avec garde-fou).
 *
 * Schéma actuel: Product est partagé entre enseignes (matché par slug marque-nom),
 * le Deal porte le marchand (unique [variantId, merchantId]).
 */
import prisma from '../prisma';
import { ScrapedProduct } from './types';
import { normalizePrices, isValidDeal, productSlug } from './validate';
import { findOrCreateBrand } from '../brands';
import { findOrCreateVariant, calculatePricePerUnit } from '../utils/volume';

const BATCH_SIZE = 3; // limite pool Supabase (~5 connexions)

// Garde-fou expiration: on n'expire les deals non revus que si le run
// a ramené un volume normal — sinon (site bloqué / HTML changé) on ne touche à rien.
const EXPIRE_MIN_IMPORTED = 50;

const DB_CATEGORIES = [
  { slug: 'maquillage', name: 'Maquillage', icon: 'Sparkles', description: 'Fonds de teint, rouges à lèvres...' },
  { slug: 'soins-visage', name: 'Soins visage', icon: 'Droplets', description: 'Crèmes, sérums...' },
  { slug: 'soins-corps', name: 'Soins corps', icon: 'Heart', description: 'Lotions, gommages...' },
  { slug: 'cheveux', name: 'Cheveux', icon: 'Scissors', description: 'Shampoings, soins...' },
  { slug: 'parfums', name: 'Parfums', icon: 'Gem', description: 'Parfums femme, homme...' },
  { slug: 'ongles', name: 'Ongles', icon: 'Palette', description: 'Vernis, nail art...' },
  { slug: 'accessoires', name: 'Accessoires', icon: 'Crown', description: 'Trousses, miroirs...' },
];

const MERCHANT_INFO: Record<string, { name: string; website: string }> = {
  sephora: { name: 'Sephora', website: 'https://www.sephora.fr' },
  nocibe: { name: 'Nocibé', website: 'https://www.nocibe.fr' },
  marionnaud: { name: 'Marionnaud', website: 'https://www.marionnaud.fr' },
};

export interface ImportResult {
  scraped: number;
  valid: number;
  imported: number;
  expired: number;
  priceChanges: number;
  errors: Array<{ product: string; error: string }>;
}

export async function importProducts(
  merchantSlug: string,
  rawProducts: ScrapedProduct[],
): Promise<ImportResult> {
  const runStart = new Date();
  const result: ImportResult = {
    scraped: rawProducts.length,
    valid: 0,
    imported: 0,
    expired: 0,
    priceChanges: 0,
    errors: [],
  };

  // 1. Merchant + catégories
  const info = MERCHANT_INFO[merchantSlug];
  if (!info) throw new Error(`Marchand inconnu: ${merchantSlug}`);
  const merchant = await prisma.merchant.upsert({
    where: { slug: merchantSlug },
    update: {},
    create: {
      name: info.name,
      slug: merchantSlug,
      website: info.website,
      logoUrl: `${info.website}/favicon.ico`,
    },
  });
  for (const cat of DB_CATEGORIES) {
    await prisma.category.upsert({ where: { slug: cat.slug }, update: {}, create: cat });
  }
  const categories = await prisma.category.findMany();
  const categoryBySlug = new Map(categories.map((c) => [c.slug, c]));
  const defaultCategory = categoryBySlug.get('maquillage')!;

  // 2. Normaliser, filtrer, dédupliquer (par URL produit)
  const seen = new Set<string>();
  const products = rawProducts
    .map(normalizePrices)
    .filter((p) => isValidDeal(p))
    .filter((p) => (seen.has(p.productUrl) ? false : (seen.add(p.productUrl), true)));
  result.valid = products.length;
  console.log(`[import] ${result.scraped} scrapés -> ${result.valid} deals valides`);

  const brandCache = new Map<string, string | null>();

  // 3. Import par batch de 3
  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (p) => {
        try {
          // Brand
          let brandId = brandCache.get(p.brand);
          if (brandId === undefined) {
            brandId = await findOrCreateBrand(p.brand);
            brandCache.set(p.brand, brandId);
          }

          // Product (partagé entre enseignes, matché par slug marque-nom)
          const slug = productSlug(p.brand, p.name);
          const product = await prisma.product.upsert({
            where: { slug },
            update: {},
            create: {
              name: p.name.substring(0, 200),
              slug,
              description: `${p.brand} - ${p.name}`.substring(0, 500),
              imageUrl: p.imageUrl || null,
              brand: p.brand,
              brandId,
              categoryId: (categoryBySlug.get(p.category) ?? defaultCategory).id,
            },
          });

          // Variant (volume garanti par isValidDeal)
          const variant = await findOrCreateVariant(prisma, product.id, p.volume);
          if (!variant) return;

          // Deal — upsert sur la contrainte unique [variantId, merchantId]
          const priceInfo = calculatePricePerUnit(p.currentPrice, p.volume);
          const dealData = {
            title: `${p.brand} -${p.discountPercent}% : ${p.name.substring(0, 100)}`,
            description: `${p.discountPercent}% de réduction !`,
            dealPrice: p.currentPrice,
            originalPrice: p.originalPrice,
            discountPercent: p.discountPercent,
            discountAmount: Math.round((p.originalPrice - p.currentPrice) * 100) / 100,
            imageUrl: p.imageUrl || null,
            productUrl: p.productUrl,
            sourceUrl: p.sourceUrl || null,
            volume: p.volume || null,
            volumeValue: priceInfo?.volumeValue ?? null,
            volumeUnit: priceInfo?.volumeUnit ?? null,
            pricePerUnit: priceInfo?.pricePerUnit ?? null,
            status: 'ACTIVE' as const,
            lastSeenAt: new Date(),
          };
          await prisma.deal.upsert({
            where: { variantId_merchantId: { variantId: variant.id, merchantId: merchant.id } },
            update: dealData,
            create: {
              ...dealData,
              productId: product.id,
              variantId: variant.id,
              merchantId: merchant.id,
              type: 'scraped',
            },
          });

          // PriceHistory — seulement si le prix a changé pour cette variante
          const lastPrice = await prisma.priceHistory.findFirst({
            where: { productId: product.id, variantId: variant.id },
            orderBy: { date: 'desc' },
            select: { price: true },
          });
          if (!lastPrice || lastPrice.price !== p.currentPrice) {
            await prisma.priceHistory.create({
              data: {
                productId: product.id,
                variantId: variant.id,
                price: p.currentPrice,
                volumeValue: priceInfo?.volumeValue ?? null,
                volumeUnit: priceInfo?.volumeUnit ?? null,
                volumeRaw: p.volume || null,
              },
            });
            result.priceChanges++;
          }

          result.imported++;
        } catch (err) {
          result.errors.push({
            product: p.name,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }),
    );

    if ((i / BATCH_SIZE) % 20 === 0 && i > 0) {
      console.log(`[import] ${Math.min(i + BATCH_SIZE, products.length)}/${products.length}...`);
    }
  }

  // 4. Expiration des deals non revus — avec garde-fou
  if (result.imported >= EXPIRE_MIN_IMPORTED) {
    const expired = await prisma.deal.updateMany({
      where: {
        merchantId: merchant.id,
        status: 'ACTIVE',
        lastSeenAt: { lt: runStart },
      },
      data: { status: 'EXPIRED' },
    });
    result.expired = expired.count;
  } else {
    console.warn(
      `[import] ⚠️ Seulement ${result.imported} deals importés (< ${EXPIRE_MIN_IMPORTED}) — expiration SKIPPÉE par sécurité`,
    );
  }

  return result;
}
