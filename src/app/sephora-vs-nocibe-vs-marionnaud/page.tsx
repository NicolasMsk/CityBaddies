import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { cache } from 'react';
import prisma from '@/lib/prisma';
import JsonLd from '@/components/seo/JsonLd';
import { fullProductName } from '@/lib/seo-config';
import { getHighQualityImageUrl, isValidImageUrl } from '@/lib/utils/image';
import SafeImage from '@/components/ui/SafeImage';
import {
  averageCityBaddiesRating,
  buildComparisonProductListSchema,
  type ComparisonOfferSchemaInput,
} from '@/lib/structured-data/comparison-products';

// ISR : page mise en cache et régénérée toutes les 900s (stats recalculées à la revalidation).
// Le force-dynamic historique imposait des requêtes DB à CHAQUE visite (TTFB/CWV).
export const revalidate = 900;

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://citybaddies.com';

// FAQ visible + schema FAQPage (contenu identique, guideline Google).
// Réponses DURABLES : aucun chiffre figé — les chiffres vivent dans la page.
const FAQ = [
  {
    question: 'Quelle enseigne est la moins chère pour les parfums ?',
    answer:
      "Aucune ne gagne à tous les coups : le classement change selon le parfum, la contenance et la semaine. C'est exactement pour ça que cette page se recalcule à chaque relevé — six fois par jour — au lieu de te servir un verdict figé. Les chiffres que tu lis ici sont ceux du moment, pas ceux d'un article écrit il y a deux ans.",
  },
  {
    question: 'Pourquoi de tels écarts de prix sur le même flacon ?',
    answer:
      "Chaque enseigne joue sa propre partition : promos permanentes chez l'une, prix barrés chez l'autre, coupons fidélité chez la troisième. Le même flacon, à contenance strictement identique, peut coûter des dizaines d'euros de plus selon la porte que tu pousses. Nos comparaisons se font toujours à taille égale, vérifiée par code-barres quand il est disponible.",
  },
  {
    question: 'Les prix comparés sont-ils ceux des magasins physiques ?',
    answer:
      "Non : on relève les prix affichés sur Sephora, Nocibé, Marionnaud, My-Origines et Notino. En boutique, les prix peuvent différer, et les programmes de fidélité ajoutent parfois des avantages qu'on ne compte pas ici.",
  },
  {
    question: 'Comment être sûre de payer le meilleur prix ?',
    answer:
      "Trois réflexes de baddie : comparer à contenance identique (jamais un 30 ml contre un 100 ml), ouvrir l'historique de prix pour démasquer les faux prix barrés, et regarder le prix au millilitre — le grand flacon est presque toujours le meilleur calcul.",
  },
];

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ.map(f => ({
    '@type': 'Question',
    name: f.question,
    acceptedAnswer: { '@type': 'Answer', text: f.answer },
  })),
};

const MERCHANT_LABEL: Record<string, string> = {
  sephora: 'Sephora',
  nocibe: 'Nocibé',
  marionnaud: 'Marionnaud',
  'my-origines': 'My-Origines',
  notino: 'Notino',
};
const MERCHANT_LOGO: Record<string, { src: string; width: number; height: number }> = {
  sephora: { src: '/images/sephora_logo.png', width: 120, height: 42 },
  nocibe: { src: '/images/nocibe_logo.png', width: 120, height: 42 },
  marionnaud: { src: '/images/logo_marrionaud.png', width: 120, height: 42 },
  'my-origines': { src: '/images/my-origines_logo.svg', width: 120, height: 42 },
  notino: { src: '/images/notino_logo.png', width: 120, height: 42 },
};
const merchantLabel = (slug: string) => MERCHANT_LABEL[slug] ?? slug;

const getMatchData = cache(async () => {
  const deals = await prisma.deal.findMany({
    where: { status: 'ACTIVE', type: 'tracked' },
    include: {
      merchant: true,
      product: { include: { images: { orderBy: { position: 'asc' }, take: 1 } } },
      variant: true,
    },
  });
  const editorialReviews = await prisma.buyingGuideProduct.findMany({
    where: {
      rating: { not: null },
      guide: { status: 'PUBLISHED' },
      deal: { productId: { in: [...new Set(deals.map(deal => deal.productId))] } },
    },
    select: {
      rating: true,
      miniReview: true,
      verdict: true,
      updatedAt: true,
      guide: { select: { slug: true } },
      deal: { select: { productId: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });
  const reviewByProduct = new Map<string, {
    rating: number;
    body: string;
    guideSlug: string;
    updatedAt: Date;
  }>();
  for (const review of editorialReviews) {
    if (review.rating === null || reviewByProduct.has(review.deal.productId)) continue;
    reviewByProduct.set(review.deal.productId, {
      rating: review.rating,
      body: review.verdict || review.miniReview,
      guideSlug: review.guide.slug,
      updatedAt: review.updatedAt,
    });
  }

  // Comparaisons à taille égale : (produit, contenance) présents chez ≥2 enseignes.
  const byPV = new Map<string, typeof deals>();
  for (const d of deals) {
    if (!d.variant) continue;
    const k = `${d.product.slug}|${d.variant.volumeValue}${d.variant.volumeUnit}`;
    if (!byPV.has(k)) byPV.set(k, []);
    byPV.get(k)!.push(d);
  }

  const wins: Record<string, number> = {};
  for (const d of deals) if (d.merchant?.slug) wins[d.merchant.slug] ??= 0;
  let ties = 0;
  let comparisons = 0;
  let gapSum = 0;
  const gaps: {
    slug: string; name: string; size: string; image: string | null;
    min: number; max: number; gap: number; cheapest: string;
    brand: string | null; offers: ComparisonOfferSchemaInput[]; rating: number | null;
    editorialReview: ReturnType<typeof reviewByProduct.get> | null;
  }[] = [];

  for (const ds of byPV.values()) {
    const cheapestPerMerchant = new Map<string, (typeof ds)[number]>();
    for (const d of ds) {
      const cur = cheapestPerMerchant.get(d.merchant.slug);
      if (!cur || d.dealPrice < cur.dealPrice) cheapestPerMerchant.set(d.merchant.slug, d);
    }
    if (cheapestPerMerchant.size < 2) continue;
    comparisons++;
    const sorted = [...cheapestPerMerchant.entries()].sort((a, b) => a[1].dealPrice - b[1].dealPrice);
    const gap = sorted[sorted.length - 1][1].dealPrice - sorted[0][1].dealPrice;
    gapSum += gap;
    if (sorted[0][1].dealPrice === sorted[1][1].dealPrice) ties++;
    else wins[sorted[0][0]] = (wins[sorted[0][0]] ?? 0) + 1;
    const d0 = ds[0];
    const raw = d0.product.images[0]?.url;
    const hd = raw ? getHighQualityImageUrl(raw) || raw : null;
    const offers: ComparisonOfferSchemaInput[] = sorted.map(([, deal]) => ({
      price: deal.dealPrice,
      url: deal.productUrl || `${BASE_URL}/produits/${deal.product.slug}`,
      sellerName: deal.merchant.name,
      sellerUrl: deal.merchant.website,
      score: deal.score,
      lastSeenAt: deal.lastSeenAt,
    }));
    gaps.push({
      slug: d0.product.slug,
      name: fullProductName(d0.product.brand, d0.product.name),
      size: `${d0.variant!.volumeValue} ${d0.variant!.volumeUnit}`,
      image: hd && (isValidImageUrl(hd) || isValidImageUrl(raw!)) ? hd : null,
      min: sorted[0][1].dealPrice,
      max: sorted[sorted.length - 1][1].dealPrice,
      gap,
      cheapest: sorted[0][0],
      brand: d0.product.brand,
      offers,
      rating: averageCityBaddiesRating(offers)?.value ?? null,
      editorialReview: reviewByProduct.get(d0.productId) ?? null,
    });
  }
  gaps.sort((a, b) => b.gap - a.gap);
  // Un parfum = une seule carte (son plus gros écart) : trois Good Girl dans le
  // top 6 rendraient la vitrine répétitive.
  const seenProducts = new Set<string>();
  const dedupedGaps = gaps.filter(g => {
    if (seenProducts.has(g.slug)) return false;
    seenProducts.add(g.slug);
    return true;
  });

  const freshest = deals
    .map(d => d.lastSeenAt)
    .filter((d): d is Date => !!d)
    .sort((a, b) => b.getTime() - a.getTime())[0];

  const products = new Set(deals.map(d => d.product.slug)).size;

  return { wins, ties, comparisons, avgGap: comparisons ? gapSum / comparisons : 0, topGaps: dedupedGaps.slice(0, 6), freshest, products };
});

export async function generateMetadata(): Promise<Metadata> {
  const { wins, comparisons, avgGap, freshest } = await getMatchData();
  const leader = Object.entries(wins).sort((a, b) => b[1] - a[1])[0];
  const leaderName = leader ? merchantLabel(leader[0]) : 'Une enseigne';
  const share = leader && comparisons ? Math.round((leader[1] / comparisons) * 100) : 0;
  const date = freshest
    ? new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' }).format(freshest)
    : "aujourd'hui";
  const title = `Comparatif parfum : ${leaderName} gagne ${share} % sur 5 enseignes`;
  const description = `${leaderName} gagne ${share}% des ${comparisons} comparaisons à taille égale face à Sephora, Nocibé, Marionnaud, My-Origines et Notino. Écart moyen : ${avgGap.toFixed(2).replace('.', ',')} €. Prix vérifiés le ${date}.`;

  return {
    title: { absolute: title },
    description,
    alternates: { canonical: `${BASE_URL}/sephora-vs-nocibe-vs-marionnaud` },
    openGraph: {
      title,
      description,
      url: `${BASE_URL}/sephora-vs-nocibe-vs-marionnaud`,
      type: 'article',
    },
  };
}

export default async function EnseignesMatchPage() {
  const { wins, ties, comparisons, avgGap, topGaps, freshest, products } = await getMatchData();
  const fmt = (n: number) => n.toFixed(2).replace('.', ',');
  const fmt0 = (n: number) => Math.round(n).toString();
  const dateFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const freshLabel = freshest ? dateFmt.format(freshest) : null;

  const ranking = Object.keys(wins)
    .map(slug => ({ slug, label: merchantLabel(slug), wins: wins[slug] }))
    .sort((a, b) => b.wins - a.wins);
  const leader = ranking[0];
  const winShare = comparisons ? Math.round((leader.wins / comparisons) * 100) : 0;

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'Comparatif prix parfums — 5 enseignes', item: `${BASE_URL}/sephora-vs-nocibe-vs-marionnaud` },
    ],
  };

  const productListSchema = buildComparisonProductListSchema(topGaps.map((product, index) => ({
    position: index + 1,
    slug: product.slug,
    name: product.name,
    brand: product.brand,
    image: product.image,
    size: product.size,
    offers: product.offers,
    editorialReview: product.editorialReview ? {
      ratingValue: product.editorialReview.rating,
      bestRating: 5,
      body: product.editorialReview.body,
      url: `${BASE_URL}/guides/${product.editorialReview.guideSlug}`,
      datePublished: product.editorialReview.updatedAt,
    } : null,
  })));

  return (
    <>
      <JsonLd id="match-breadcrumb" data={breadcrumbSchema} />
      <JsonLd id="match-products" data={productListSchema} />
      <JsonLd id="match-faq" data={faqSchema} />

      <div className="min-h-screen bg-[#0a0a0a] relative overflow-hidden">
        <div className="absolute top-[-8%] right-[-12%] w-[38vw] h-[38vw] bg-[#9b1515] opacity-[0.06] blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute top-[42%] left-[-14%] w-[34vw] h-[34vw] bg-[#d4a855] opacity-[0.04] blur-[130px] rounded-full pointer-events-none" />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-16 sm:pt-20 pb-24">

          <header className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-8 lg:gap-14 items-stretch mb-8">
            <div className="min-w-0 flex flex-col justify-center py-4 lg:py-8">
              <div className="flex items-center gap-3 mb-6">
                <span className="h-px w-10 bg-[#d4a855]" />
                <span className="font-mono text-[10px] text-[#d4a855] tracking-[0.22em] uppercase">
                  Comparatif live · 5 enseignes
                </span>
              </div>
              <h1 className="font-serif text-white text-[2.65rem] sm:text-6xl lg:text-7xl leading-[0.95] tracking-[-0.03em] mb-6">
                <span className="block">Le même parfum.</span>
                <span className="block italic font-light text-white/60 mt-2">Cinq prix.</span>
              </h1>
              <p className="text-neutral-400 font-light text-base sm:text-lg leading-relaxed max-w-2xl">
                Sephora, Nocibé, Marionnaud, My-Origines et Notino comparés à flacon et contenance identiques.
                Pas de prix barré pris au mot&nbsp;: uniquement les prix relevés six fois par jour.
              </p>

              <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 mt-7" aria-label="Enseignes comparées">
                {ranking.map(merchant => {
                  const logo = MERCHANT_LOGO[merchant.slug];
                  return (
                    <span key={merchant.slug} className="min-w-0 h-9 inline-flex items-center gap-2 border border-white/10 bg-white/[0.025] px-2.5 text-[10px] text-neutral-300">
                      {logo && <Image src={logo.src} alt="" width={logo.width} height={logo.height} className="h-4 w-12 shrink-0 object-contain brightness-0 invert opacity-70" />}
                      <span className="truncate">{merchant.label}</span>
                    </span>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 sm:flex sm:flex-wrap gap-3 mt-8">
                <a href="#classement" className="w-full sm:w-auto px-6 py-3.5 bg-white text-center text-black text-[11px] font-bold tracking-[0.16em] uppercase hover:bg-[#d4a855] transition-colors">
                  Voir le classement
                </a>
                <Link href="/produits" className="w-full sm:w-auto px-6 py-3.5 border border-white/15 text-center text-white text-[11px] font-bold tracking-[0.16em] uppercase hover:border-[#d4a855]/60 hover:text-[#d4a855] transition-colors">
                  Comparer mon parfum
                </Link>
              </div>
            </div>

            <aside className="relative border border-[#d4a855]/25 bg-[#0d0d0d] p-6 sm:p-8 overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#d4a855] to-transparent" />
              <div className="flex items-center justify-between gap-4 mb-9">
                <span className="inline-flex items-center gap-2 font-mono text-[9px] tracking-[0.22em] uppercase text-[#d4a855]">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                  </span>
                  Verdict actuel
                </span>
                <span className="font-mono text-[9px] text-neutral-600">MAJ {freshLabel || 'dernier relevé'}</span>
              </div>

              <div className="mb-8">
                <p className="font-serif italic text-3xl sm:text-4xl text-white mb-2">{leader.label}</p>
                <div className="flex items-end gap-3">
                  <span className="font-serif text-7xl sm:text-8xl leading-none text-[#d4a855]">{winShare}</span>
                  <span className="font-serif text-3xl text-[#d4a855] mb-2">%</span>
                  <span className="text-xs text-neutral-500 leading-relaxed mb-2 max-w-28">des prix les plus bas</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-px bg-white/10 border border-white/10">
                <div className="bg-[#0d0d0d] p-3 sm:p-4">
                  <strong className="block font-mono text-lg sm:text-xl text-white">{comparisons}</strong>
                  <span className="text-[9px] uppercase tracking-wider text-neutral-600">matchs</span>
                </div>
                <div className="bg-[#0d0d0d] p-3 sm:p-4">
                  <strong className="block font-mono text-lg sm:text-xl text-white">{products}</strong>
                  <span className="text-[9px] uppercase tracking-wider text-neutral-600">parfums</span>
                </div>
                <div className="bg-[#0d0d0d] p-3 sm:p-4">
                  <strong className="block font-mono text-lg sm:text-xl text-white">{fmt0(avgGap)}&nbsp;€</strong>
                  <span className="text-[9px] uppercase tracking-wider text-neutral-600">écart moyen</span>
                </div>
              </div>
              <p className="mt-5 text-xs leading-relaxed text-neutral-500">
                Sur {comparisons} comparaisons à taille égale, {leader.label} gagne {leader.wins} fois
                {ties > 0 ? `, avec ${ties} égalité${ties > 1 ? 's' : ''}` : ''}.
              </p>
            </aside>
          </header>

          <nav aria-label="Navigation du comparatif" className="mb-16 border-y border-white/10 overflow-x-auto">
            <div className="flex min-w-max items-center">
              <a href="#classement" className="px-5 py-4 font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-400 hover:text-white">Classement</a>
              <a href="#ecarts" className="px-5 py-4 font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-400 hover:text-white">Plus gros écarts</a>
              <a href="#methode" className="px-5 py-4 font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-400 hover:text-white">Comprendre</a>
              <span className="h-5 w-px bg-white/10 mx-2" />
              <Link href="/comparatif/sephora-vs-nocibe" className="px-4 py-4 text-[10px] text-neutral-500 hover:text-[#d4a855]">Sephora vs Nocibé</Link>
              <Link href="/comparatif/sephora-vs-marionnaud" className="px-4 py-4 text-[10px] text-neutral-500 hover:text-[#d4a855]">Sephora vs Marionnaud</Link>
              <Link href="/comparatif/nocibe-vs-marionnaud" className="px-4 py-4 text-[10px] text-neutral-500 hover:text-[#d4a855]">Nocibé vs Marionnaud</Link>
            </div>
          </nav>

          <section id="classement" className="mb-24 scroll-mt-24">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-8">
              <div>
                <span className="font-mono text-[9px] tracking-[0.2em] uppercase text-[#d4a855]">01 · Classement live</span>
                <h2 className="font-serif text-3xl md:text-4xl text-white mt-2">
                  Cinq enseignes, <span className="italic font-light text-white/60">un seul podium</span>
                </h2>
              </div>
              <p className="max-w-sm text-neutral-500 text-xs font-light sm:text-right">
                Une victoire = le prix le plus bas sur le même parfum et la même contenance.
              </p>
            </div>
            <div className="flex lg:grid lg:grid-cols-5 gap-px overflow-x-auto lg:overflow-visible snap-x snap-mandatory bg-white/10 border border-white/10">
              {ranking.map((m, i) => {
                const pct = comparisons ? Math.round((m.wins / comparisons) * 100) : 0;
                const logo = MERCHANT_LOGO[m.slug];
                return (
                  <article key={m.slug} className={`relative min-w-[78vw] sm:min-w-[42vw] lg:min-w-0 min-h-48 p-5 bg-[#0a0a0a] snap-start ${i === 0 ? 'lg:-translate-y-2 border-t-2 border-[#d4a855]' : ''}`}>
                    <div className="flex items-start justify-between gap-3 mb-8">
                      <span className={`font-serif text-4xl leading-none ${i === 0 ? 'text-[#d4a855]' : 'text-white/15'}`}>0{i + 1}</span>
                      {i === 0 && <span className="font-mono text-[8px] tracking-[0.18em] uppercase text-[#d4a855]">Leader</span>}
                    </div>
                    {logo && (
                      <div className="h-6 mb-3 flex items-center">
                        <Image src={logo.src} alt={`Logo ${m.label}`} width={logo.width} height={logo.height} className="max-h-5 w-auto max-w-24 object-contain brightness-0 invert opacity-65" />
                      </div>
                    )}
                    <h3 className={`font-serif text-xl ${i === 0 ? 'text-white' : 'text-white/80'}`}>{m.label}</h3>
                    <p className="font-mono text-[10px] text-neutral-500 mt-1">{m.wins} victoires</p>
                    <div className="mt-5 flex items-end justify-between gap-3">
                      <div className="h-1 flex-1 bg-white/[0.07] overflow-hidden">
                        <div className={`h-full ${i === 0 ? 'bg-[#d4a855]' : 'bg-white/30'}`} style={{ width: `${Math.max(pct, 1.5)}%` }} />
                      </div>
                      <span className={`font-mono text-sm ${i === 0 ? 'text-[#d4a855]' : 'text-neutral-400'}`}>{pct}%</span>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          <section id="ecarts" className="mb-24 scroll-mt-24">
            <div className="mb-8">
              <span className="font-mono text-[9px] tracking-[0.2em] uppercase text-[#d4a855]">02 · Là où ça fait mal</span>
              <h2 className="font-serif text-3xl md:text-4xl text-white mt-2">
                Les écarts <span className="italic font-light text-white/60">qui piquent</span>
              </h2>
              <p className="text-neutral-500 text-sm font-light mt-3">Même flacon, même taille, relevés le même jour.</p>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-px bg-white/10 border border-white/10">
              {topGaps.map(g => (
                <Link
                  key={`${g.slug}-${g.size}`}
                  href={`/produits/${g.slug}`}
                  className="group relative bg-[#0a0a0a] p-5 hover:bg-white/[0.04] transition-colors"
                >
                  <span className="absolute right-4 top-4 font-mono text-[8px] uppercase tracking-widest text-neutral-700 group-hover:text-[#d4a855] transition-colors">Voir les prix →</span>
                  <div className="flex items-start gap-4 pt-5">
                    <div className="w-16 h-20 bg-white flex-shrink-0 flex items-center justify-center overflow-hidden">
                      {g.image ? (
                        <SafeImage src={g.image} alt={g.name} width={64} height={80} className="object-contain w-full h-full" />
                      ) : (
                        <span className="font-serif text-neutral-300 text-2xl">{g.name.charAt(0)}</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="block font-serif text-base text-white leading-snug group-hover:text-[#d4a855] transition-colors">
                        {g.name}
                      </span>
                      <span className="block font-mono text-[10px] text-neutral-500 mt-1.5">{g.size}</span>
                      {(g.editorialReview || g.rating) && (
                        <span className="block font-mono text-[10px] text-[#d4a855] mt-1.5">
                          Note City Baddies&nbsp;: {g.editorialReview
                            ? `${g.editorialReview.rating.toFixed(1).replace('.', ',')}/5`
                            : `${g.rating!.toFixed(1).replace('.', ',')}/10`}
                        </span>
                      )}
                      <div className="mt-3 space-y-1">
                        <span className="block text-sm text-white font-light">
                          {fmt(g.min)}&nbsp;€ <span className="text-neutral-500 text-xs">chez {merchantLabel(g.cheapest)}</span>
                        </span>
                        <span className="block text-xs text-neutral-500 line-through">{fmt(g.max)}&nbsp;€ ailleurs</span>
                      </div>
                      {g.editorialReview && (
                        <span className="block mt-2 text-[10px] leading-relaxed text-neutral-600 line-clamp-2">
                          {g.editorialReview.body}
                        </span>
                      )}
                      <span className="inline-block mt-3 px-2.5 py-1 bg-[#9b1515]/15 border border-[#9b1515]/30 text-[#e8a0a0] font-mono text-[10px] tracking-wide">
                        écart de {fmt0(g.gap)}&nbsp;€
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            <p className="font-mono text-[10px] text-neutral-600 mt-4 tracking-wide">
              Chiffres recalculés à chaque relevé — clique sur un flacon pour voir tous les prix et l&apos;historique.
            </p>
          </section>

          {/* ── Pull quote ── */}
          <blockquote className="my-24 text-center max-w-3xl mx-auto">
            <p className="font-serif italic text-2xl md:text-3xl text-white/85 leading-snug max-w-lg mx-auto">
              «&nbsp;Un prix barré ne prouve rien.<br />
              <span className="text-[#d4a855]">Un historique, si.</span>&nbsp;»
            </p>
          </blockquote>

          {/* ── Édito ── */}
          <section id="methode" className="mb-24 max-w-3xl mx-auto space-y-12 text-neutral-300 font-light leading-relaxed scroll-mt-24">
            <div className="border-b border-white/10 pb-6">
              <span className="font-mono text-[9px] tracking-[0.2em] uppercase text-[#d4a855]">03 · Comprendre les chiffres</span>
            </div>
            <div>
              <h2 className="font-serif text-2xl text-white mb-4">Pourquoi le classement bouge en permanence</h2>
              <p>
                Les enseignes ne jouent pas le même jeu. <strong className="text-white font-medium">Sephora</strong> (LVMH)
                mise sur les exclusivités et des offres ciblées ; <strong className="text-white font-medium">Nocibé</strong> (groupe
                Douglas) dégaine des promos quasi permanentes sur les grandes marques ;{' '}
                <strong className="text-white font-medium">Marionnaud</strong> (A.S. Watson) fonctionne par vagues de coupons
                et d&apos;offres fidélité ; enfin <strong className="text-white font-medium">My-Origines</strong> et{' '}
                <strong className="text-white font-medium">Notino</strong>, pure-players discount, cassent les prix au
                quotidien sur leur catalogue. Résultat : ton parfum peut changer d&apos;enseigne
                gagnante d&apos;une semaine à l&apos;autre. Un verdict figé ne vaut rien — le nôtre se réécrit tout seul.
              </p>
            </div>
            <div>
              <h2 className="font-serif text-2xl text-white mb-4">Ce que les pourcentages ne te disent pas</h2>
              <p>
                Une enseigne peut écraser le classement général et rester plus chère sur <em>ton</em> parfum à toi.
                Les écarts se jouent flacon par flacon, taille par taille. Le bon réflexe n&apos;est pas de jurer
                fidélité à une enseigne — c&apos;est d&apos;ouvrir la fiche du parfum que tu veux et de regarder tous les
                prix du jour, avec la date du relevé. Trente secondes qui valent parfois un billet de cent.
              </p>
            </div>
            <div>
              <h2 className="font-serif text-2xl text-white mb-4">Nos limites, en toute transparence</h2>
              <p>
                On compare les prix affichés en ligne, hors offres fidélité personnalisées et prix boutique.
                Les chiffres de cette page datent {freshLabel ? `du ${freshLabel}` : 'du dernier relevé'} et se
                recalculent en continu. La méthode complète est sur{' '}
                <Link href="/methodologie" className="underline decoration-[#d4a855]/50 underline-offset-4 hover:text-white transition-colors">notre page méthodologie</Link>.
              </p>
            </div>
          </section>

          {/* ── FAQ ── */}
          <section className="mb-20 max-w-3xl mx-auto">
            <h2 className="font-serif text-2xl md:text-3xl text-white mb-8">
              Les questions <span className="italic font-light text-white/70">qu&apos;on nous pose</span>
            </h2>
            <div className="space-y-3">
              {FAQ.map((item, i) => (
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

          {/* ── CTA ── */}
          <div className="max-w-3xl mx-auto pt-10 border-t border-white/10">
            <p className="font-serif italic text-lg text-white/70 mb-6">Ton parfum mérite le bon prix.</p>
            <div className="flex flex-wrap gap-4">
              <Link
                href="/produits"
                className="px-8 py-4 bg-white text-black text-sm font-bold tracking-widest uppercase hover:bg-neutral-200 transition-colors"
              >
                Comparer mon parfum
              </Link>
              <Link
                href="/parfums-moins-de-50-euros"
                className="px-8 py-4 border border-white/20 text-white text-xs sm:text-sm font-bold tracking-widest uppercase hover:bg-white/5 transition-colors"
              >
                Les parfums à moins de 50&nbsp;€
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
