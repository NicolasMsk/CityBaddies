import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import prisma from '@/lib/prisma';
import JsonLd from '@/components/seo/JsonLd';
import { fullProductName } from '@/lib/seo-config';
import { BRAND_CONTENT, fallbackBrandContent } from '@/lib/brand-content';
import { getHighQualityImageUrl, isValidImageUrl } from '@/lib/utils/image';
import SafeImage from '@/components/ui/SafeImage';

// ISR : page mise en cache et régénérée toutes les 600s (prix relevés ~6x/jour).
// Le force-dynamic historique imposait des requêtes DB à CHAQUE visite (TTFB/CWV).
export const revalidate = 600;
// generateStaticParams vide = opt-in ISR à la demande (Next 16) :
// sans lui, la route resterait 100% dynamique malgré revalidate.
export async function generateStaticParams() {
  return [];
}

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://citybaddies.com';

// ──────────────────────────────────────────────────────────────────
// Data
// ──────────────────────────────────────────────────────────────────

const getBrandData = cache(async (slug: string) => {
  const brand = await prisma.brand.findUnique({
    where: { slug },
    include: {
      products: {
        where: { deals: { some: { status: 'ACTIVE', type: 'tracked' } } },
        include: {
          images: { orderBy: { position: 'asc' }, take: 1 },
          deals: {
            where: { status: 'ACTIVE', type: 'tracked' },
            orderBy: { dealPrice: 'asc' },
            include: { merchant: true, variant: true },
          },
        },
        orderBy: { name: 'asc' },
      },
    },
  });
  if (!brand || brand.products.length === 0) return null;
  return brand;
});

// ──────────────────────────────────────────────────────────────────
// Metadata
// ──────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const brand = await getBrandData(slug);

  // Marque inconnue OU sans produit actif → noindex (pas de page vide indexée)
  if (!brand || brand.products.length === 0) {
    return { title: 'Marque non trouvée', robots: { index: false, follow: false } };
  }

  const content = BRAND_CONTENT[slug] || fallbackBrandContent(brand.name);
  const n = brand.products.length;
  const deals = brand.products.flatMap(product => product.deals).sort((a, b) => a.dealPrice - b.dealPrice);
  const best = deals[0];
  const merchantCount = new Set(deals.map(deal => deal.merchant.slug)).size;
  const bestPrice = best.dealPrice.toFixed(2).replace('.', ',');
  const title = `Parfums ${content.displayName} dès ${bestPrice} € : prix comparés`;
  const description = `${n} parfum${n > 1 ? 's' : ''} ${content.displayName} comparé${n > 1 ? 's' : ''} chez ${merchantCount} enseigne${merchantCount > 1 ? 's' : ''}. Meilleur prix : ${bestPrice} € chez ${best.merchant.name}. Relevés 6 fois par jour.`;

  return {
    title: { absolute: title },
    description,
    alternates: { canonical: `${BASE_URL}/marques/${slug}` },
    robots: { index: true, follow: true },
    openGraph: {
      title,
      description,
      url: `${BASE_URL}/marques/${slug}`,
      type: 'website',
    },
  };
}

// ──────────────────────────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────────────────────────

export default async function MarquePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const brand = await getBrandData(slug);
  if (!brand) notFound();

  const content = BRAND_CONTENT[slug] || fallbackBrandContent(brand.name);
  const dateFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

  // Par produit : meilleur prix actuel (toutes tailles), taille de ce prix,
  // enseigne, nb d'enseignes, fraîcheur — le tout server-rendered (citable).
  const rows = brand.products.map(p => {
    const best = p.deals[0]; // orderBy dealPrice asc
    const merchants = new Set(p.deals.map(d => d.merchant.slug));
    const img = p.images[0]?.url;
    const hd = img ? getHighQualityImageUrl(img) || img : null;
    return {
      slug: p.slug,
      name: fullProductName(brand.name, p.name),
      shortName: content.displayName && p.name.toLowerCase().startsWith(content.displayName.toLowerCase())
        ? p.name.slice(content.displayName.length).trim()
        : p.name,
      bestPrice: best.dealPrice,
      bestSize: best.variant ? `${best.variant.volumeValue} ${best.variant.volumeUnit}` : null,
      bestMerchant: best.merchant.name,
      merchantCount: merchants.size,
      lastSeenAt: best.lastSeenAt,
      image: hd && (isValidImageUrl(hd) || isValidImageUrl(img!)) ? hd : null,
    };
  });

  const prices = rows.map(r => r.bestPrice);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const freshest = brand.products
    .flatMap(p => p.deals.map(d => d.lastSeenAt))
    .filter((d): d is Date => !!d)
    .sort((a, b) => b.getTime() - a.getTime())[0];
  const freshLabel = freshest ? dateFmt.format(freshest) : null;
  const fmt = (n: number) => n.toFixed(2).replace('.', ',');

  // Une réponse dédiée aux recherches "marque + enseigne", sans créer de
  // nouvelles pages minces : chaque bloc repose uniquement sur les offres live.
  const byMerchant = new Map<string, {
    name: string;
    products: { slug: string; name: string; price: number }[];
  }>();
  for (const product of brand.products) {
    const cheapestByMerchant = new Map<string, (typeof product.deals)[number]>();
    for (const deal of product.deals) {
      const current = cheapestByMerchant.get(deal.merchant.slug);
      if (!current || deal.dealPrice < current.dealPrice) cheapestByMerchant.set(deal.merchant.slug, deal);
    }
    for (const [merchantSlug, deal] of cheapestByMerchant) {
      const section = byMerchant.get(merchantSlug) ?? { name: deal.merchant.name, products: [] };
      section.products.push({
        slug: product.slug,
        name: fullProductName(brand.name, product.name),
        price: deal.dealPrice,
      });
      byMerchant.set(merchantSlug, section);
    }
  }
  const merchantSections = [...byMerchant.entries()]
    .map(([merchantSlug, section]) => ({
      merchantSlug,
      ...section,
      products: section.products.sort((a, b) => a.price - b.price),
    }))
    .sort((a, b) => b.products.length - a.products.length);

  // ── Schemas (natifs, HTML initial) ──
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'Marques', item: `${BASE_URL}/marques` },
      { '@type': 'ListItem', position: 3, name: content.displayName, item: `${BASE_URL}/marques/${slug}` },
    ],
  };

  const itemListSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `Parfums ${content.displayName} — prix comparés`,
    url: `${BASE_URL}/marques/${slug}`,
    about: { '@type': 'Brand', name: content.displayName },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: rows.length,
      itemListElement: rows.map((r, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        // item Product + offers : les IA/Google lisent le prix, pas juste le nom
        item: {
          '@type': 'Product',
          name: r.name,
          ...(r.image ? { image: r.image } : {}), // requis Google (rich results Product)
          url: `${BASE_URL}/produits/${r.slug}`,
          brand: { '@type': 'Brand', name: content.displayName },
          offers: {
            '@type': 'Offer',
            price: r.bestPrice,
            priceCurrency: 'EUR',
            availability: 'https://schema.org/InStock',
            seller: { '@type': 'Organization', name: r.bestMerchant },
          },
        },
      })),
    },
  };

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: content.faq.map(f => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  };

  return (
    <>
      <JsonLd id="brand-breadcrumb" data={breadcrumbSchema} />
      <JsonLd id="brand-itemlist" data={itemListSchema} />
      <JsonLd id="brand-faq" data={faqSchema} />

      <div className="min-h-screen bg-[#0a0a0a] pt-28 pb-24">
        <div className="max-w-4xl mx-auto px-6">

          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-[9px] uppercase tracking-[0.25em] text-neutral-500 mb-10 overflow-x-auto whitespace-nowrap">
            <Link href="/" className="hover:text-white transition-colors">Accueil</Link>
            <span className="text-neutral-700">/</span>
            <Link href="/marques" className="hover:text-white transition-colors">Marques</Link>
            <span className="text-neutral-700">/</span>
            <span className="text-neutral-400">{content.displayName}</span>
          </nav>

          {/* Header */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <span className="h-[1px] w-12 bg-[#d4a855]" />
              <span className="text-[#d4a855] text-xs font-bold tracking-[0.2em] uppercase">Maison</span>
            </div>
            {/* Logo maison en silhouette blanche (les wordmarks Wikipédia sont
                noirs/transparents → brightness-0 invert ; 'kenzo' = boîte rouge, tel quel) */}
            {brand.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={brand.logoUrl}
                alt={`Logo ${content.displayName}`}
                className={`h-10 md:h-12 w-auto max-w-[220px] object-contain object-left mb-6 opacity-90 ${
                  slug === 'kenzo' ? '' : 'brightness-0 invert'
                }`}
              />
            )}
            <h1 className="text-4xl md:text-6xl font-serif text-white leading-tight mb-5">
              Parfums <span className="italic font-light">{content.displayName}</span>
            </h1>
            <p className="text-neutral-400 text-lg font-light italic mb-6">{content.signature}</p>

            {/* Phrase réponse-directe — server-rendered, citable.
                Sans légère (pas de mono "technique") : gracieuse mais extractible. */}
            <p className="text-sm font-light text-neutral-300 leading-relaxed border-l-2 border-[#d4a855]/40 pl-5 py-1.5">
              {rows.length} parfum{rows.length > 1 ? 's' : ''} {content.displayName} suivi{rows.length > 1 ? 's' : ''} —
              meilleurs prix actuels de <span className="font-serif italic text-[#d4a855]">{fmt(minPrice)}&nbsp;€</span> à{' '}
              <span className="font-serif italic text-[#d4a855]">{fmt(maxPrice)}&nbsp;€</span>
              {freshLabel ? `, relevés le ${freshLabel}` : ''} chez Sephora, Nocibé, Marionnaud, My-Origines et Notino.
            </p>
          </div>

          {/* Édito */}
          <div className="mb-16">
            <p className="text-neutral-300 font-light leading-relaxed text-base md:text-lg">{content.intro}</p>
          </div>

          {/* Tableau des parfums — prix temps réel, server-rendered */}
          <section className="mb-20">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.25em] text-neutral-500 mb-8">
              Les parfums suivis — meilleur prix actuel
            </h2>
            <div className="flex flex-col divide-y divide-white/5 border-y border-white/10">
              {rows.map(r => (
                <Link
                  key={r.slug}
                  href={`/produits/${r.slug}`}
                  className="group flex items-center gap-5 sm:gap-8 py-6 hover:bg-white/[0.03] transition-colors px-3 -mx-3"
                >
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white rounded flex-shrink-0 overflow-hidden flex items-center justify-center">
                    {r.image ? (
                      <SafeImage src={r.image} alt={r.name} width={80} height={80} className="object-contain w-full h-full" />
                    ) : (
                      <span className="font-serif text-neutral-300 text-xl">{content.displayName.charAt(0)}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="block text-white font-light text-sm sm:text-base truncate group-hover:text-[#d4a855] transition-colors">
                      {r.shortName}
                    </span>
                    <span className="block text-[11px] font-light text-neutral-500 tracking-wide mt-1.5">
                      {r.merchantCount} enseigne{r.merchantCount > 1 ? 's' : ''}
                      {r.bestSize ? ` · dès le ${r.bestSize}` : ''}
                    </span>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="block font-serif text-lg sm:text-xl text-white">
                      dès <span className="italic">{fmt(r.bestPrice)}&nbsp;€</span>
                    </span>
                    <span className="block text-[11px] font-light text-neutral-500 tracking-wide mt-1">
                      chez {r.bestMerchant}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
            <p className="text-xs font-light italic text-neutral-500 mt-6 tracking-wide">
              Prix relevés six fois par jour, comparés à contenance identique.{' '}
              <Link href="/methodologie" className="underline decoration-[#d4a855]/40 underline-offset-4 hover:text-neutral-300 transition-colors not-italic">Notre méthodologie</Link>
            </p>
          </section>

          {/* Intentions "marque + enseigne" observées dans Search Console. */}
          <section className="mb-20">
            <h2 className="font-serif text-2xl sm:text-3xl text-white mb-3">
              Où acheter un parfum {content.displayName} au meilleur prix ?
            </h2>
            <p className="text-sm font-light text-neutral-400 leading-relaxed mb-8">
              Compare les offres disponibles par enseigne. Les montants ci-dessous sont les meilleurs prix
              actuellement relevés pour chaque parfum, toutes contenances disponibles confondues.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {merchantSections.map(section => (
                <article key={section.merchantSlug} className="border border-white/10 p-5 sm:p-6">
                  <h3 className="text-white text-lg font-serif mb-2">
                    Parfums {content.displayName} chez {section.name}
                  </h3>
                  <p className="text-xs text-neutral-500 mb-4">
                    {section.products.length} parfum{section.products.length > 1 ? 's' : ''} disponible{section.products.length > 1 ? 's' : ''}, dès{' '}
                    <span className="text-[#d4a855]">{fmt(section.products[0].price)}&nbsp;€</span>
                  </p>
                  <ul className="space-y-2">
                    {section.products.slice(0, 3).map(product => (
                      <li key={product.slug} className="flex items-baseline justify-between gap-3 text-sm">
                        <Link href={`/produits/${product.slug}`} className="text-neutral-300 hover:text-white transition-colors line-clamp-1">
                          {product.name}
                        </Link>
                        <span className="text-neutral-400 whitespace-nowrap">{fmt(product.price)}&nbsp;€</span>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </section>

          {/* FAQ — visible + FAQPage schema (les deux restent identiques) */}
          <section className="mb-16">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.25em] text-neutral-500 mb-6">
              Questions fréquentes
            </h2>
            <div className="space-y-3">
              {content.faq.map((item, i) => (
                <details key={i} className="group border border-white/10 [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex items-center justify-between p-5 cursor-pointer text-white hover:bg-white/[0.03] transition-colors">
                    <span className="text-sm sm:text-base font-light pr-4">{item.question}</span>
                    <span className="text-[#d4a855] text-xl font-light transition-transform duration-300 group-open:rotate-45 flex-shrink-0">+</span>
                  </summary>
                  <div className="px-5 pb-5 text-neutral-400 text-sm font-light leading-relaxed border-t border-white/5 pt-4">
                    {item.answer}
                  </div>
                </details>
              ))}
            </div>
          </section>

          {/* Maillage */}
          <div className="pt-8 border-t border-white/10 flex flex-wrap gap-4">
            <Link
              href="/marques"
              className="px-6 py-3 border border-white/20 text-white text-xs font-bold tracking-widest uppercase hover:bg-white/5 transition-colors"
            >
              Toutes les marques
            </Link>
            <Link
              href="/produits"
              className="px-6 py-3 border border-white/20 text-white text-xs font-bold tracking-widest uppercase hover:bg-white/5 transition-colors"
            >
              Tous les parfums
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
