/**
 * Studio — helpers PARTAGÉS entre make-video.ts et concepts.ts.
 * (Séparé pour éviter d'importer make-video.ts, qui exécute main() à l'import.)
 */
import prisma from '../../lib/prisma';
import { fullProductName } from '../../lib/seo-config';

export const MERCHANT_LABEL: Record<string, string> = {
  sephora: 'Sephora', nocibe: 'Nocibé', marionnaud: 'Marionnaud', 'my-origines': 'My-Origines', notino: 'Notino',
};
// UA mobile iOS : passe la protection Akamai des CDN images (Sephora, Marionnaud,
// Nocibé) — sinon l'UA desktop du headless se prend un 403 → flacon cassé.
export const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1';
// Hôtes dont le CDN sert les bots/headless (image affichable dans la vidéo).
// Sephora (media.sephora.eu) et Marionnaud (media.marionnaud.fr) = Akamai → 403.
export const RENDERABLE = /nocibe\.|notinoimg|demandware|my-origines/i;
// Motifs de vrais packshots (face avant / global) plutôt qu'un swatch ou dos/côté.
export const PACKSHOT = /front|global|_p\.jpg|-1-|media_1/i;

export interface Story {
  slug: string; brand: string; displayName: string; meta: string;
  oldPrice: number; newPrice: number; gap: number; merchant: string; merchantSlug: string;
  volumeLabel: string; image: string;
}

/** Un produit du catalogue avec son meilleur prix comparé (≥2 enseignes, image affichable). */
export interface CatalogItem {
  slug: string; brand: string; brandSlug: string; displayName: string;
  volumeLabel: string; meta: string; image: string;
  cheapest: number; cheapestMerchant: string; cheapestMerchantSlug: string;
  highest: number; gap: number; gapPct: number; merchantsCount: number;
}

/** Nom d'affichage court : marque + ligne, sans le suffixe "Eau de Parfum/Toilette". */
export function cleanName(brand: string | null, name: string): string {
  let full = fullProductName(brand, name);
  full = full.replace(/\b(eau de parfum|eau de toilette|eau de cologne|eau fra[iî]che)\b.*$/i, '').trim();
  return full.replace(/[-–—]\s*$/, '').trim() || fullProductName(brand, name);
}
export function concentration(name: string): string {
  if (/intense/i.test(name)) return 'Eau de Parfum Intense';
  if (/toilette/i.test(name)) return 'Eau de Toilette';
  if (/cologne/i.test(name)) return 'Eau de Cologne';
  return 'Eau de Parfum';
}
export const fmt = (n: number) => n.toFixed(2).replace('.', ',');
export const fmtInt = (n: number) => (Math.abs(n - Math.round(n)) < 0.005 ? String(Math.round(n)) : fmt(n));
export const slugify = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

/** Choisit la meilleure image AFFICHABLE (packshot de face de préférence). */
function pickImage(images: { url: string; type: string }[]): string {
  const renderable = images.filter((i) => RENDERABLE.test(i.url));
  return (
    renderable.find((i) => i.type === 'packshot' && PACKSHOT.test(i.url))?.url ||
    renderable.find((i) => i.type === 'packshot')?.url ||
    renderable.find((i) => PACKSHOT.test(i.url))?.url ||
    renderable[0]?.url ||
    ''
  );
}

/**
 * Construit le catalogue : pour chaque produit × contenance comparé sur ≥2
 * enseignes et disposant d'une image affichable, calcule le prix le moins cher,
 * le plus cher, l'écart. Dédupliqué par produit (garde la contenance au plus
 * gros écart — la plus "parlante").
 */
export async function getCatalog(opts?: { productSlug?: string }): Promise<CatalogItem[]> {
  const deals = await prisma.deal.findMany({
    where: { status: 'ACTIVE', type: 'tracked', ...(opts?.productSlug ? { product: { slug: opts.productSlug } } : {}) },
    include: {
      merchant: { select: { slug: true } },
      product: { select: { slug: true, name: true, brand: true, images: { select: { url: true, type: true }, orderBy: { position: 'asc' } } } },
      variant: true,
    },
  });

  const byPV = new Map<string, typeof deals>();
  for (const d of deals) {
    if (!d.variant) continue;
    const k = `${d.product.slug}|${d.variant.volumeValue}${d.variant.volumeUnit}`;
    (byPV.get(k) ?? byPV.set(k, []).get(k)!).push(d);
  }

  const bySlug = new Map<string, CatalogItem>();
  for (const ds of byPV.values()) {
    const cheapest = new Map<string, number>();
    for (const d of ds) { const c = cheapest.get(d.merchant.slug); if (c === undefined || d.dealPrice < c) cheapest.set(d.merchant.slug, d.dealPrice); }
    if (cheapest.size < 2) continue;
    const sorted = [...cheapest.entries()].sort((a, b) => a[1] - b[1]);
    const [minSlug, minP] = sorted[0];
    const maxP = sorted[sorted.length - 1][1];
    const gap = maxP - minP;
    const d0 = ds[0];
    const image = pickImage(d0.product.images);
    if (!image) continue; // aucune image affichable → produit ignoré
    const item: CatalogItem = {
      slug: d0.product.slug, brand: d0.product.brand || '', brandSlug: slugify(d0.product.brand || ''),
      displayName: cleanName(d0.product.brand, d0.product.name),
      volumeLabel: `${d0.variant!.volumeValue} ${d0.variant!.volumeUnit}`,
      meta: `${concentration(d0.product.name)} · ${d0.variant!.volumeValue} ${d0.variant!.volumeUnit}`,
      image, cheapest: minP, cheapestMerchant: MERCHANT_LABEL[minSlug] ?? minSlug, cheapestMerchantSlug: minSlug,
      highest: maxP, gap, gapPct: maxP > 0 ? (gap / maxP) * 100 : 0, merchantsCount: cheapest.size,
    };
    const prev = bySlug.get(item.slug);
    if (!prev || item.gap > prev.gap) bySlug.set(item.slug, item); // 1 entrée/produit : la + parlante
  }
  return [...bySlug.values()];
}

/** Convertit un CatalogItem en Story (format 1 parfun de template.html). */
export function itemToStory(it: CatalogItem): Story {
  return {
    slug: it.slug, brand: it.brand, displayName: it.displayName, meta: it.meta,
    oldPrice: it.highest, newPrice: it.cheapest, gap: it.gap,
    merchant: it.cheapestMerchant, merchantSlug: it.cheapestMerchantSlug,
    volumeLabel: it.volumeLabel, image: it.image,
  };
}
