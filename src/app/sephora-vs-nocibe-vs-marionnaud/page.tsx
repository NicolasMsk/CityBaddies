import type { Metadata } from 'next';
import Link from 'next/link';
import prisma from '@/lib/prisma';
import JsonLd from '@/components/seo/JsonLd';
import { fullProductName } from '@/lib/seo-config';

export const dynamic = 'force-dynamic';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://citybaddies.com';

export const metadata: Metadata = {
  title: 'Sephora vs Nocibé vs Marionnaud : qui est le moins cher ?',
  description:
    "Comparaison réelle des prix parfums entre Sephora, Nocibé et Marionnaud : victoires par enseigne, écarts constatés à taille égale, mis à jour à chaque relevé (6 fois par jour).",
  alternates: { canonical: `${BASE_URL}/sephora-vs-nocibe-vs-marionnaud` },
  openGraph: {
    title: 'Sephora vs Nocibé vs Marionnaud : qui est le moins cher ?',
    description: 'Le match des enseignes, tranché par nos relevés de prix réels — pas par des impressions.',
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
      "Aucune enseigne ne gagne à tous les coups : le classement change selon le parfum, la contenance et la période. C'est pourquoi cette page recalcule le score à chaque relevé (six fois par jour) au lieu d'affirmer un verdict figé. Les chiffres ci-dessus reflètent l'état réel du moment.",
  },
  {
    question: 'Pourquoi de tels écarts de prix sur le même flacon ?',
    answer:
      "Chaque enseigne mène sa propre politique commerciale : opérations promotionnelles, prix barrés, déstockages, exclusivités. Un même parfum, à contenance strictement identique, peut donc coûter des dizaines d'euros de plus d'une enseigne à l'autre au même moment. Nos comparaisons se font toujours à taille égale, identifiée par code-barres quand il est disponible.",
  },
  {
    question: 'Les prix comparés sont-ils ceux des magasins physiques ?',
    answer:
      "Non : nous relevons les prix affichés sur les sites sephora.fr, nocibe.fr et marionnaud.fr. Les prix en boutique peuvent différer, et les enseignes proposent parfois des offres supplémentaires via leurs programmes de fidélité, non prises en compte ici.",
  },
  {
    question: 'Comment être sûr de payer le meilleur prix ?',
    answer:
      "Trois réflexes : comparer à contenance identique (jamais un 30 ml contre un 100 ml), vérifier l'historique de prix du parfum pour distinguer une vraie baisse d'un prix barré permanent, et regarder le prix au millilitre entre formats — le grand flacon est presque toujours plus rentable.",
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
};

async function getMatchData() {
  const deals = await prisma.deal.findMany({
    where: { status: 'ACTIVE', type: 'tracked' },
    include: { merchant: true, product: true, variant: true },
  });

  // Comparaisons à taille égale : (produit, contenance) présents chez ≥2 enseignes.
  const byPV = new Map<string, typeof deals>();
  for (const d of deals) {
    if (!d.variant) continue;
    const k = `${d.product.slug}|${d.variant.volumeValue}${d.variant.volumeUnit}`;
    if (!byPV.has(k)) byPV.set(k, []);
    byPV.get(k)!.push(d);
  }

  const wins: Record<string, number> = { sephora: 0, nocibe: 0, marionnaud: 0 };
  let ties = 0;
  let comparisons = 0;
  let gapSum = 0;
  const gaps: {
    slug: string; name: string; size: string;
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
    gaps.push({
      slug: d0.product.slug,
      name: fullProductName(d0.product.brand, d0.product.name),
      size: `${d0.variant!.volumeValue} ${d0.variant!.volumeUnit}`,
      min: sorted[0][1],
      max: sorted[sorted.length - 1][1],
      gap,
      cheapest: sorted[0][0],
    });
  }
  gaps.sort((a, b) => b.gap - a.gap);

  const freshest = deals
    .map(d => d.lastSeenAt)
    .filter((d): d is Date => !!d)
    .sort((a, b) => b.getTime() - a.getTime())[0];

  const products = new Set(deals.map(d => d.product.slug)).size;

  return { wins, ties, comparisons, avgGap: comparisons ? gapSum / comparisons : 0, topGaps: gaps.slice(0, 8), freshest, products };
}

export default async function EnseignesMatchPage() {
  const { wins, ties, comparisons, avgGap, topGaps, freshest, products } = await getMatchData();
  const fmt = (n: number) => n.toFixed(2).replace('.', ',');
  const dateFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const freshLabel = freshest ? dateFmt.format(freshest) : null;

  const ranking = (['nocibe', 'sephora', 'marionnaud'] as const)
    .map(slug => ({ slug, label: MERCHANT_LABEL[slug], wins: wins[slug] ?? 0 }))
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
    description: `Comparaison de prix parfums en continu entre les trois enseignes, sur ${comparisons} comparaisons à taille égale.`,
    author: { '@type': 'Organization', name: 'City Baddies', url: BASE_URL },
    publisher: { '@type': 'Organization', name: 'City Baddies', url: BASE_URL },
    dateModified: freshest?.toISOString(),
    mainEntityOfPage: `${BASE_URL}/sephora-vs-nocibe-vs-marionnaud`,
  };

  return (
    <>
      <JsonLd id="match-breadcrumb" data={breadcrumbSchema} />
      <JsonLd id="match-article" data={articleSchema} />
      <JsonLd id="match-faq" data={faqSchema} />

      <div className="min-h-screen bg-[#0a0a0a] pt-28 pb-24">
        <div className="max-w-3xl mx-auto px-6">

          {/* Header */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <span className="h-[1px] w-12 bg-[#d4a855]" />
              <span className="text-[#d4a855] text-xs font-bold tracking-[0.2em] uppercase">Le match des enseignes</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-serif text-white leading-tight mb-6">
              Sephora vs Nocibé vs Marionnaud : <span className="italic font-light">qui est le moins cher ?</span>
            </h1>
            <p className="text-neutral-400 font-light text-lg leading-relaxed">
              Les avis ne tranchent rien, les données si. Cette page compare les prix des trois
              enseignes <strong className="text-white font-medium">à contenance strictement identique</strong>,
              et se recalcule à chaque relevé — six fois par jour.
            </p>
          </div>

          {/* Réponse directe — server-rendered, citable */}
          <div className="border-l-2 border-[#d4a855]/50 pl-5 py-2 mb-14">
            <p className="text-neutral-200 font-light leading-relaxed">
              {freshLabel ? `Au ${freshLabel}` : 'Actuellement'}, sur{' '}
              <strong className="text-white font-medium">{comparisons} comparaisons à taille égale</strong>
              {' '}portant sur {products} parfums,{' '}
              <strong className="text-white font-medium">{leader.label} est l&apos;enseigne la moins chère dans {winShare}&nbsp;% des cas</strong>
              {' '}({leader.wins} victoires, contre {ranking[1].wins} pour {ranking[1].label} et {ranking[2].wins} pour {ranking[2].label}
              {ties > 0 ? `, ${ties} égalité${ties > 1 ? 's' : ''}` : ''}).
              L&apos;écart moyen entre l&apos;enseigne la moins chère et la plus chère atteint{' '}
              <strong className="text-white font-medium">{fmt(avgGap)}&nbsp;€ par flacon</strong>.
            </p>
          </div>

          {/* Podium */}
          <section className="mb-16">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.25em] text-neutral-500 mb-6">
              Victoires par enseigne — comparaisons à taille égale
            </h2>
            <div className="space-y-3">
              {ranking.map((m, i) => {
                const pct = comparisons ? Math.round((m.wins / comparisons) * 100) : 0;
                return (
                  <div key={m.slug} className="flex items-center gap-4">
                    <span className="font-mono text-[10px] text-neutral-500 w-6">{i + 1}.</span>
                    <span className="text-white font-light w-28 sm:w-32">{m.label}</span>
                    <div className="flex-1 h-6 bg-white/5 relative overflow-hidden">
                      <div
                        className={i === 0 ? 'h-full bg-[#d4a855]' : 'h-full bg-white/20'}
                        style={{ width: `${Math.max(pct, 2)}%` }}
                      />
                    </div>
                    <span className="font-mono text-xs text-neutral-400 w-24 text-right">
                      {m.wins} · {pct}&nbsp;%
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="font-mono text-[10px] text-neutral-600 mt-4 tracking-wide">
              Une « victoire » = être strictement l&apos;enseigne la moins chère sur un parfum à une contenance donnée.
            </p>
          </section>

          {/* Top écarts */}
          <section className="mb-16">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.25em] text-neutral-500 mb-6">
              Les plus gros écarts constatés en ce moment
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-[11px] sm:text-xs">
                <thead>
                  <tr className="text-neutral-600 uppercase tracking-widest text-[9px]">
                    <th className="py-2 pr-4 font-medium">Parfum</th>
                    <th className="py-2 pr-4 font-medium">Taille</th>
                    <th className="py-2 pr-4 font-medium">Le moins cher</th>
                    <th className="py-2 pr-4 font-medium">Le plus cher</th>
                    <th className="py-2 font-medium text-right">Écart</th>
                  </tr>
                </thead>
                <tbody className="text-neutral-400">
                  {topGaps.map(g => (
                    <tr key={`${g.slug}-${g.size}`} className="border-t border-white/5">
                      <td className="py-2.5 pr-4">
                        <Link href={`/produits/${g.slug}`} className="text-white hover:text-[#d4a855] transition-colors font-sans font-light">
                          {g.name}
                        </Link>
                      </td>
                      <td className="py-2.5 pr-4 whitespace-nowrap">{g.size}</td>
                      <td className="py-2.5 pr-4 whitespace-nowrap">{fmt(g.min)} € · {MERCHANT_LABEL[g.cheapest] ?? g.cheapest}</td>
                      <td className="py-2.5 pr-4 whitespace-nowrap">{fmt(g.max)} €</td>
                      <td className="py-2.5 text-right text-[#d4a855] whitespace-nowrap">+{fmt(g.gap)} €</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="font-mono text-[10px] text-neutral-600 mt-4 tracking-wide">
              Mêmes flacons, mêmes contenances, relevés le même jour. Cliquez sur un parfum pour voir toutes les offres et l&apos;historique.
            </p>
          </section>

          {/* Édito durable */}
          <section className="mb-16 space-y-10 text-neutral-300 font-light leading-relaxed">
            <div>
              <h2 className="text-xl text-white font-medium mb-4">Pourquoi le classement bouge en permanence</h2>
              <p>
                Les trois enseignes ne jouent pas le même jeu. <strong className="text-white font-medium">Sephora</strong> (groupe LVMH)
                mise sur les exclusivités et des opérations ciblées ; <strong className="text-white font-medium">Nocibé</strong> (groupe
                Douglas) pratique une politique promotionnelle agressive et quasi permanente sur les grandes marques ;{' '}
                <strong className="text-white font-medium">Marionnaud</strong> (groupe A.S. Watson) fonctionne davantage par vagues de
                coupons et d&apos;offres fidélité. Résultat : le même flacon peut changer d&apos;enseigne gagnante d&apos;une semaine à
                l&apos;autre — et c&apos;est précisément pour ça qu&apos;un verdict figé ne vaut rien.
              </p>
            </div>
            <div>
              <h2 className="text-xl text-white font-medium mb-4">Ce que les pourcentages ne disent pas</h2>
              <p>
                Une enseigne peut dominer le classement général et rester plus chère sur <em>votre</em> parfum. Les écarts
                se jouent référence par référence, contenance par contenance. Le bon réflexe n&apos;est donc pas de choisir
                une enseigne une fois pour toutes, mais de vérifier la comparaison du jour sur la fiche du parfum visé —
                chaque fiche affiche les trois prix, l&apos;écart, et la date exacte du relevé.
              </p>
            </div>
            <div>
              <h2 className="text-xl text-white font-medium mb-4">Nos limites, en toute transparence</h2>
              <p>
                Nous comparons les prix affichés en ligne, hors offres de fidélité personnalisées et prix boutique.
                Les chiffres de cette page sont recalculés à chaque relevé — si vous lisez ceci, ils datent
                {freshLabel ? ` du ${freshLabel}` : " du dernier relevé"}. La méthode complète est documentée sur{' '}
                <Link href="/methodologie" className="underline hover:text-white transition-colors">notre page méthodologie</Link>.
              </p>
            </div>
          </section>

          {/* FAQ */}
          <section className="mb-16">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.25em] text-neutral-500 mb-6">
              Questions fréquentes
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

          {/* CTA */}
          <div className="pt-8 border-t border-white/10 flex flex-wrap gap-4">
            <Link
              href="/produits"
              className="px-8 py-4 bg-white text-black text-sm font-bold tracking-widest uppercase hover:bg-neutral-200 transition-colors"
            >
              Comparer un parfum
            </Link>
            <Link
              href="/methodologie"
              className="px-8 py-4 border border-white/20 text-white text-sm font-bold tracking-widest uppercase hover:bg-white/5 transition-colors"
            >
              Notre méthodologie
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
