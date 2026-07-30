import type { Metadata } from 'next';
import Link from 'next/link';
import prisma from '@/lib/prisma';
import JsonLd from '@/components/seo/JsonLd';
import { fullProductName } from '@/lib/seo-config';
import { getHighQualityImageUrl, isValidImageUrl } from '@/lib/utils/image';
import SafeImage from '@/components/ui/SafeImage';

// ISR : page mise en cache et régénérée toutes les 900s (stats recalculées à la revalidation).
// Le force-dynamic historique imposait des requêtes DB à CHAQUE visite (TTFB/CWV).
export const revalidate = 900;

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://citybaddies.com';

export const metadata: Metadata = {
  title: 'Sephora vs Nocibé vs Marionnaud : qui est le moins cher ?',
  description:
    "Comparaison réelle des prix parfums entre Sephora, Nocibé, Marionnaud et My-Origines : victoires par enseigne, écarts constatés à taille égale, mis à jour à chaque relevé (6 fois par jour).",
  alternates: { canonical: `${BASE_URL}/sephora-vs-nocibe-vs-marionnaud` },
  openGraph: {
    title: 'Sephora vs Nocibé vs Marionnaud : qui est le moins cher ?',
    description: 'Le match des enseignes, tranché par de vrais relevés de prix — pas par des impressions.',
    url: `${BASE_URL}/sephora-vs-nocibe-vs-marionnaud`,
    type: 'article',
  },
};

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
      "Non : on relève les prix affichés sur sephora.fr, nocibe.fr et marionnaud.fr. En boutique, les prix peuvent différer, et les programmes de fidélité ajoutent parfois des avantages qu'on ne compte pas ici.",
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
};
const merchantLabel = (slug: string) => MERCHANT_LABEL[slug] ?? slug;

async function getMatchData() {
  const deals = await prisma.deal.findMany({
    where: { status: 'ACTIVE', type: 'tracked' },
    include: {
      merchant: true,
      product: { include: { images: { orderBy: { position: 'asc' }, take: 1 } } },
      variant: true,
    },
  });

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
  }[] = [];

  for (const ds of byPV.values()) {
    const cheapestPerMerchant = new Map<string, number>();
    for (const d of ds) {
      const cur = cheapestPerMerchant.get(d.merchant.slug);
      if (cur === undefined || d.dealPrice < cur) cheapestPerMerchant.set(d.merchant.slug, d.dealPrice);
    }
    if (cheapestPerMerchant.size < 2) continue;
    comparisons++;
    const sorted = [...cheapestPerMerchant.entries()].sort((a, b) => a[1] - b[1]);
    const gap = sorted[sorted.length - 1][1] - sorted[0][1];
    gapSum += gap;
    if (sorted[0][1] === sorted[1][1]) ties++;
    else wins[sorted[0][0]] = (wins[sorted[0][0]] ?? 0) + 1;
    const d0 = ds[0];
    const raw = d0.product.images[0]?.url;
    const hd = raw ? getHighQualityImageUrl(raw) || raw : null;
    gaps.push({
      slug: d0.product.slug,
      name: fullProductName(d0.product.brand, d0.product.name),
      size: `${d0.variant!.volumeValue} ${d0.variant!.volumeUnit}`,
      image: hd && (isValidImageUrl(hd) || isValidImageUrl(raw!)) ? hd : null,
      min: sorted[0][1],
      max: sorted[sorted.length - 1][1],
      gap,
      cheapest: sorted[0][0],
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
      { '@type': 'ListItem', position: 2, name: 'Sephora vs Nocibé vs Marionnaud', item: `${BASE_URL}/sephora-vs-nocibe-vs-marionnaud` },
    ],
  };

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'Sephora vs Nocibé vs Marionnaud : qui est le moins cher ?',
    description: `Comparaison de prix parfums en continu entre les enseignes suivies, sur ${comparisons} comparaisons à taille égale.`,
    author: { '@type': 'Organization', name: 'City Baddies', url: BASE_URL },
    publisher: { '@type': 'Organization', name: 'City Baddies', url: BASE_URL },
    dateModified: freshest?.toISOString(),
    mainEntityOfPage: `${BASE_URL}/sephora-vs-nocibe-vs-marionnaud`,
  };

  // Dataset schema : signale aux IA que cette page EST une source de données de
  // prix (pas un simple article). variableMeasured décrit ce qu'on mesure.
  const datasetSchema = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: 'Comparaison de prix parfums — Sephora vs Nocibé vs Marionnaud',
    description: `Relevés de prix parfums comparés à contenance identique entre Sephora, Nocibé, Marionnaud et My-Origines. ${comparisons} comparaisons, écart moyen ${fmt(avgGap)} € par flacon. Mis à jour six fois par jour.`,
    url: `${BASE_URL}/sephora-vs-nocibe-vs-marionnaud`,
    creator: { '@type': 'Organization', name: 'City Baddies', url: BASE_URL },
    dateModified: freshest?.toISOString(),
    isAccessibleForFree: true,
    measurementTechnique: 'Relevé automatisé des prix affichés sur les fiches produit officielles, six fois par jour, comparés à contenance identique (EAN).',
    variableMeasured: [
      { '@type': 'PropertyValue', name: 'Comparaisons à taille égale', value: comparisons },
      { '@type': 'PropertyValue', name: 'Écart moyen entre enseignes (EUR)', value: Number(avgGap.toFixed(2)) },
      { '@type': 'PropertyValue', name: 'Enseigne la moins chère le plus souvent', value: `${leader.label} (${winShare} %)` },
    ],
  };

  return (
    <>
      <JsonLd id="match-breadcrumb" data={breadcrumbSchema} />
      <JsonLd id="match-article" data={articleSchema} />
      <JsonLd id="match-dataset" data={datasetSchema} />
      <JsonLd id="match-faq" data={faqSchema} />

      <div className="min-h-screen bg-[#0a0a0a] relative overflow-hidden">
        {/* Halos ambiance — même langage que la home */}
        <div className="absolute top-[-5%] right-[-10%] w-[36vw] h-[36vw] bg-[#9b1515] opacity-[0.07] blur-[110px] rounded-full pointer-events-none" />
        <div className="absolute top-[45%] left-[-12%] w-[32vw] h-[32vw] bg-[#d4a855] opacity-[0.05] blur-[120px] rounded-full pointer-events-none" />

        <div className="relative max-w-3xl mx-auto px-6 pt-28 pb-24">

          {/* ── Hero éditorial ── */}
          <div className="mb-16">
            <div className="flex items-center gap-3 mb-8">
              <span className="h-[1px] w-12 bg-[#d4a855]" />
              <span className="text-[#d4a855] text-xs font-bold tracking-[0.25em] uppercase">Le match</span>
            </div>
            <h1 className="font-serif text-white leading-[1.02] mb-8">
              <span className="block text-4xl md:text-6xl font-medium">Sephora. Nocibé. Marionnaud.</span>
              <span className="block text-3xl md:text-5xl italic font-light text-white/70 mt-3">Qui est vraiment la moins chère&nbsp;?</span>
            </h1>
            <p className="text-neutral-400 font-light text-lg leading-relaxed max-w-xl">
              Tout le monde a un avis. Nous, on a les relevés. Même flacon, même contenance,
              quatre enseignes — Sephora, Nocibé, Marionnaud et le discounter My-Origines — et on refait les
              comptes six fois par jour, pour que tu n&apos;aies jamais à croire quelqu&apos;un sur parole. Pas même nous.
            </p>
          </div>

          {/* ── Le verdict — pull-quote magazine, citable (server-rendered) ── */}
          <figure className="relative mb-20 border border-[#d4a855]/25 bg-gradient-to-b from-[#d4a855]/[0.06] to-transparent p-8 sm:p-10">
            <span className="absolute -top-3 left-8 bg-[#0a0a0a] px-3 text-[9px] font-bold uppercase tracking-[0.3em] text-[#d4a855]">
              Le verdict du jour
            </span>
            <div className="flex items-baseline gap-4 mb-5">
              <span className="font-serif text-6xl sm:text-7xl text-[#d4a855] leading-none">{winShare}<span className="text-3xl sm:text-4xl">%</span></span>
              <span className="font-serif italic text-xl sm:text-2xl text-white/85 leading-snug">
                des matchs remportés par {leader.label}
              </span>
            </div>
            <figcaption className="text-neutral-300 font-light leading-relaxed">
              {freshLabel ? `Au ${freshLabel}` : 'Actuellement'}, sur{' '}
              <strong className="text-white font-medium">{comparisons} comparaisons à taille égale</strong> portant sur {products} parfums,{' '}
              {leader.label} affiche le prix le plus bas {leader.wins} fois, contre{' '}
              {ranking.slice(1).map((m, i, arr) => `${m.wins} pour ${m.label}`).reduce((acc, cur, i, arr) => i === 0 ? cur : i === arr.length - 1 ? `${acc} et ${cur}` : `${acc}, ${cur}`, '')}
              {ties > 0 ? ` (${ties} égalité${ties > 1 ? 's' : ''})` : ''}.
              Entre la moins chère et la plus chère, l&apos;écart moyen est de{' '}
              <strong className="text-white font-medium">{fmt(avgGap)}&nbsp;€ par flacon</strong> — le prix d&apos;un deuxième parfum
              qui part en fumée si tu pousses la mauvaise porte.
            </figcaption>
          </figure>

          {/* ── Podium ── */}
          <section className="mb-20">
            <h2 className="font-serif text-2xl md:text-3xl text-white mb-2">
              Le podium, <span className="italic font-light text-white/70">sans filtre</span>
            </h2>
            <p className="text-neutral-500 text-sm font-light mb-8">
              Une victoire = être strictement la moins chère sur un parfum, à une contenance donnée.
            </p>
            <div className="space-y-5">
              {ranking.map((m, i) => {
                const pct = comparisons ? Math.round((m.wins / comparisons) * 100) : 0;
                return (
                  <div key={m.slug}>
                    <div className="flex items-baseline justify-between mb-2">
                      <span className={`font-serif text-lg ${i === 0 ? 'text-[#d4a855] italic' : 'text-white/80'}`}>
                        {i + 1}. {m.label}
                      </span>
                      <span className="font-mono text-xs text-neutral-400">{m.wins} victoires · {pct}&nbsp;%</span>
                    </div>
                    <div className="h-[3px] bg-white/[0.07] relative overflow-hidden">
                      <div
                        className={i === 0 ? 'h-full bg-gradient-to-r from-[#d4a855] to-[#d4a855]/40' : 'h-full bg-white/25'}
                        style={{ width: `${Math.max(pct, 1.5)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* ── Les écarts qui piquent — cartes visuelles ── */}
          <section className="mb-20">
            <h2 className="font-serif text-2xl md:text-3xl text-white mb-2">
              Les écarts <span className="italic font-light text-white/70">qui piquent</span>
            </h2>
            <p className="text-neutral-500 text-sm font-light mb-8">
              Même flacon, même taille, relevés le même jour. Oui, vraiment.
            </p>
            <div className="grid sm:grid-cols-2 gap-px bg-white/10 border border-white/10">
              {topGaps.map(g => (
                <Link
                  key={`${g.slug}-${g.size}`}
                  href={`/produits/${g.slug}`}
                  className="group bg-[#0a0a0a] p-6 hover:bg-white/[0.04] transition-colors"
                >
                  <div className="flex items-start gap-5">
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
                      <div className="mt-3 space-y-1">
                        <span className="block text-sm text-white font-light">
                          {fmt(g.min)}&nbsp;€ <span className="text-neutral-500 text-xs">chez {merchantLabel(g.cheapest)}</span>
                        </span>
                        <span className="block text-xs text-neutral-500 line-through">{fmt(g.max)}&nbsp;€ ailleurs</span>
                      </div>
                      <span className="inline-block mt-3 px-2.5 py-1 bg-[#9b1515]/20 border border-[#9b1515]/40 text-[#e8a0a0] font-mono text-[11px] tracking-wide">
                        tu économises {fmt0(g.gap)}&nbsp;€
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
          <blockquote className="my-20 text-center">
            <p className="font-serif italic text-2xl md:text-3xl text-white/85 leading-snug max-w-lg mx-auto">
              «&nbsp;Un prix barré ne prouve rien.<br />
              <span className="text-[#d4a855]">Un historique, si.</span>&nbsp;»
            </p>
          </blockquote>

          {/* ── Édito ── */}
          <section className="mb-20 space-y-12 text-neutral-300 font-light leading-relaxed">
            <div>
              <h2 className="font-serif text-2xl text-white mb-4">Pourquoi le classement bouge en permanence</h2>
              <p>
                Les enseignes ne jouent pas le même jeu. <strong className="text-white font-medium">Sephora</strong> (LVMH)
                mise sur les exclusivités et des offres ciblées ; <strong className="text-white font-medium">Nocibé</strong> (groupe
                Douglas) dégaine des promos quasi permanentes sur les grandes marques ;{' '}
                <strong className="text-white font-medium">Marionnaud</strong> (A.S. Watson) fonctionne par vagues de coupons
                et d&apos;offres fidélité ; et <strong className="text-white font-medium">My-Origines</strong>, pure-player
                discount, casse les prix au quotidien sur son catalogue. Résultat : ton parfum peut changer d&apos;enseigne
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
          <section className="mb-20">
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
          <div className="pt-10 border-t border-white/10">
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
                Les parfums à −50&nbsp;€
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
