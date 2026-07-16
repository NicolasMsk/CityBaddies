import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import JsonLd from '@/components/seo/JsonLd';
import { fullProductName } from '@/lib/seo-config';
import { BRAND_CONTENT, fallbackBrandContent } from '@/lib/brand-content';
import { getHighQualityImageUrl, isValidImageUrl } from '@/lib/utils/image';
import SafeImage from '@/components/ui/SafeImage';

export const dynamic = 'force-dynamic';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://citybaddies.com';

// ──────────────────────────────────────────────────────────────────
// Data
// ──────────────────────────────────────────────────────────────────

async function getBrandData(slug: string) {
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
}

// ──────────────────────────────────────────────────────────────────
// Metadata
// ──────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const brand = await prisma.brand.findUnique({
    where: { slug },
    include: { products: { where: { deals: { some: { status: 'ACTIVE', type: 'tracked' } } }, select: { id: true } } },
  });

  // Marque inconnue OU sans produit actif → noindex (pas de page vide indexée)
  if (!brand || brand.products.length === 0) {
    return { title: 'Marque non trouvée', robots: { index: false, follow: false } };
  }

  const content = BRAND_CONTENT[slug] || fallbackBrandContent(brand.name);
  const n = brand.products.length;
  const title = `Parfums ${content.displayName} : prix comparés Sephora, Nocibé, Marionnaud`;
  const description = `${n} parfum${n > 1 ? 's' : ''} ${content.displayName} suivi${n > 1 ? 's' : ''} : prix relevés 6 fois par jour chez Sephora, Nocibé et Marionnaud, comparés à taille égale, avec historique. ${content.signature}`;

  return {
    title,
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
        name: r.name,
        url: `${BASE_URL}/produits/${r.slug}`,
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

            {/* Phrase réponse-directe — server-rendered, citable */}
            <p className="font-mono text-xs text-neutral-400 tracking-wide border-l-2 border-[#d4a855]/40 pl-4 py-1">
              {rows.length} parfum{rows.length > 1 ? 's' : ''} {content.displayName} suivi{rows.length > 1 ? 's' : ''} —
              meilleurs prix actuels de {fmt(minPrice)}&nbsp;€ à {fmt(maxPrice)}&nbsp;€
              {freshLabel ? `, relevés le ${freshLabel}` : ''} chez Sephora, Nocibé et Marionnaud.
            </p>
          </div>

          {/* Édito */}
          <div className="mb-14">
            <p className="text-neutral-300 font-light leading-relaxed text-base md:text-lg">{content.intro}</p>
          </div>

          {/* Tableau des parfums — prix temps réel, server-rendered */}
          <section className="mb-16">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.25em] text-neutral-500 mb-6">
              Les parfums suivis — meilleur prix actuel
            </h2>
            <div className="flex flex-col divide-y divide-white/5 border-y border-white/10">
              {rows.map(r => (
                <Link
                  key={r.slug}
                  href={`/produits/${r.slug}`}
                  className="group flex items-center gap-4 sm:gap-6 py-4 hover:bg-white/[0.03] transition-colors px-2 -mx-2"
                >
                  <div className="w-14 h-14 sm:w-16 sm:h-16 bg-white rounded flex-shrink-0 overflow-hidden flex items-center justify-center">
                    {r.image ? (
                      <SafeImage src={r.image} alt={r.name} width={64} height={64} className="object-contain w-full h-full" />
                    ) : (
                      <span className="font-serif text-neutral-300 text-xl">{content.displayName.charAt(0)}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="block text-white font-light text-sm sm:text-base truncate group-hover:text-[#d4a855] transition-colors">
                      {r.shortName}
                    </span>
                    <span className="block font-mono text-[10px] text-neutral-500 mt-1">
                      {r.merchantCount} enseigne{r.merchantCount > 1 ? 's' : ''}
                      {r.bestSize ? ` · dès le ${r.bestSize}` : ''}
                    </span>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="block text-white text-base sm:text-lg font-medium">
                      dès {fmt(r.bestPrice)} €
                    </span>
                    <span className="block font-mono text-[10px] text-neutral-500 mt-0.5">
                      chez {r.bestMerchant}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
            <p className="font-mono text-[10px] text-neutral-600 mt-4 tracking-wide">
              Prix relevés six fois par jour, comparés à contenance identique.{' '}
              <Link href="/methodologie" className="underline hover:text-neutral-400 transition-colors">Notre méthodologie</Link>
            </p>
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
