import type { Metadata } from 'next';
import Link from 'next/link';
import prisma from '@/lib/prisma';
import JsonLd from '@/components/seo/JsonLd';
import { BRAND_CONTENT } from '@/lib/brand-content';

export const dynamic = 'force-dynamic';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://citybaddies.com';

export const metadata: Metadata = {
  title: 'Toutes les marques de parfum comparées',
  description:
    'Toutes les maisons de parfum suivies par City Baddies : Chanel, Dior, Guerlain, Lancôme, YSL… Prix relevés 6 fois par jour chez Sephora, Nocibé et Marionnaud.',
  alternates: { canonical: `${BASE_URL}/marques` },
  openGraph: {
    title: 'Toutes les marques de parfum comparées | City Baddies',
    description: 'Prix relevés 6 fois par jour chez Sephora, Nocibé et Marionnaud, maison par maison.',
    url: `${BASE_URL}/marques`,
    type: 'website',
  },
};

async function getBrands() {
  const brands = await prisma.brand.findMany({
    include: {
      products: {
        where: { deals: { some: { status: 'ACTIVE', type: 'tracked' } } },
        include: {
          deals: {
            where: { status: 'ACTIVE', type: 'tracked' },
            orderBy: { dealPrice: 'asc' },
            take: 1,
            select: { dealPrice: true },
          },
        },
      },
    },
    orderBy: { name: 'asc' },
  });
  return brands
    .filter(b => b.products.length > 0)
    .map(b => {
      const prices = b.products.flatMap(p => p.deals.map(d => d.dealPrice));
      return {
        slug: b.slug,
        displayName: BRAND_CONTENT[b.slug]?.displayName || b.name,
        signature: BRAND_CONTENT[b.slug]?.signature || null,
        count: b.products.length,
        fromPrice: prices.length ? Math.min(...prices) : null,
        logoUrl: b.logoUrl,
      };
    });
}

// Logos "en boîte" (fond coloré intégré, ex. Kenzo blanc-sur-rouge) : le filtre
// brightness-0/invert les transformerait en pavé blanc — on les affiche tels quels.
const BOXED_LOGOS = new Set(['kenzo']);

export default async function MarquesPage() {
  const brands = await getBrands();
  const fmt = (n: number) => n.toFixed(2).replace('.', ',');

  const listSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Marques de parfum comparées — City Baddies',
    url: `${BASE_URL}/marques`,
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: brands.length,
      itemListElement: brands.map((b, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: b.displayName,
        url: `${BASE_URL}/marques/${b.slug}`,
      })),
    },
  };

  return (
    <>
      <JsonLd id="marques-list" data={listSchema} />
      <div className="min-h-screen bg-[#0a0a0a] pt-28 pb-24">
        <div className="max-w-5xl mx-auto px-6">
          {/* Header */}
          <div className="mb-14">
            <div className="flex items-center gap-3 mb-6">
              <span className="h-[1px] w-12 bg-[#d4a855]" />
              <span className="text-[#d4a855] text-xs font-bold tracking-[0.2em] uppercase">Les maisons</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-serif text-white leading-tight mb-5">
              Toutes les <span className="italic font-light">marques</span>
            </h1>
            <p className="text-neutral-400 font-light text-lg max-w-2xl">
              {brands.length} maisons suivies. Pour chacune : les parfums comparés, le meilleur prix actuel
              chez Sephora, Nocibé et Marionnaud, et l&apos;historique des relevés.
            </p>
          </div>

          {/* Grid — cartes aérées (gap réel + padding généreux, pas de mur collé) */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {brands.map(b => (
              <Link
                key={b.slug}
                href={`/marques/${b.slug}`}
                className="group bg-white/[0.02] border border-white/10 hover:border-[#d4a855]/40 hover:bg-white/[0.05] transition-all duration-300 p-8 flex flex-col justify-between min-h-[200px]"
              >
                <div>
                  {/* Logo maison en silhouette blanche (brightness-0 invert sur les
                      wordmarks noirs/transparents) ; fallback = nom serif seul */}
                  {b.logoUrl ? (
                    <span className="block h-10 mb-6">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={b.logoUrl}
                        alt={`Logo ${b.displayName}`}
                        className={`h-full w-auto max-w-[160px] object-contain object-left opacity-80 group-hover:opacity-100 transition-opacity ${
                          BOXED_LOGOS.has(b.slug) ? '' : 'brightness-0 invert'
                        }`}
                        loading="lazy"
                      />
                    </span>
                  ) : (
                    <span className="block font-serif text-2xl text-white group-hover:text-[#d4a855] transition-colors mb-4">
                      {b.displayName}
                    </span>
                  )}
                  {b.signature && (
                    <span className="block text-neutral-500 text-xs font-light leading-relaxed line-clamp-2">
                      {b.signature}
                    </span>
                  )}
                </div>
                {/* Ligne méta gracieuse : sans légère + prix en serif italique or */}
                <span className="block text-xs font-light text-neutral-400 tracking-wide mt-6 pt-4 border-t border-white/5">
                  {b.count} parfum{b.count > 1 ? 's' : ''}
                  {b.fromPrice != null && (
                    <> · <span className="font-serif italic text-sm text-[#d4a855]">dès {fmt(b.fromPrice)} €</span></>
                  )}
                </span>
              </Link>
            ))}
          </div>

          <p className="text-xs font-light italic text-neutral-500 mt-8 tracking-wide">
            Prix relevés six fois par jour, comparés à contenance identique.{' '}
            <Link href="/methodologie" className="underline decoration-[#d4a855]/40 underline-offset-4 hover:text-neutral-300 transition-colors not-italic">Notre méthodologie</Link>
          </p>
        </div>
      </div>
    </>
  );
}
