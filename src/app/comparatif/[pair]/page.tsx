import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import JsonLd from '@/components/seo/JsonLd';
import prisma from '@/lib/prisma';
import { fullProductName } from '@/lib/seo-config';

export const revalidate = 900;

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://citybaddies.com';

const PAIRS = {
  'sephora-vs-nocibe': {
    left: { slug: 'sephora', label: 'Sephora' },
    right: { slug: 'nocibe', label: 'Nocibé' },
  },
  'sephora-vs-marionnaud': {
    left: { slug: 'sephora', label: 'Sephora' },
    right: { slug: 'marionnaud', label: 'Marionnaud' },
  },
  'nocibe-vs-marionnaud': {
    left: { slug: 'nocibe', label: 'Nocibé' },
    right: { slug: 'marionnaud', label: 'Marionnaud' },
  },
} as const;

type PairSlug = keyof typeof PAIRS;

export function generateStaticParams() {
  return Object.keys(PAIRS).map(pair => ({ pair }));
}

const getPairData = cache(async (pair: PairSlug) => {
  const config = PAIRS[pair];
  const merchantSlugs = [config.left.slug, config.right.slug];
  const deals = await prisma.deal.findMany({
    where: {
      status: 'ACTIVE',
      type: 'tracked',
      merchant: { slug: { in: merchantSlugs } },
    },
    include: { merchant: true, product: true, variant: true },
  });

  const grouped = new Map<string, typeof deals>();
  for (const deal of deals) {
    if (!deal.variant) continue;
    const key = `${deal.product.slug}|${deal.variant.volumeValue}${deal.variant.volumeUnit}`;
    const group = grouped.get(key) ?? [];
    group.push(deal);
    grouped.set(key, group);
  }

  const wins: Record<string, number> = {
    [config.left.slug]: 0,
    [config.right.slug]: 0,
  };
  let ties = 0;
  let gapSum = 0;
  const rows: {
    slug: string;
    name: string;
    size: string;
    leftPrice: number;
    rightPrice: number;
    gap: number;
    winner: string | null;
  }[] = [];

  for (const group of grouped.values()) {
    const cheapest = new Map<string, number>();
    for (const deal of group) {
      const current = cheapest.get(deal.merchant.slug);
      if (current === undefined || deal.dealPrice < current) cheapest.set(deal.merchant.slug, deal.dealPrice);
    }
    const leftPrice = cheapest.get(config.left.slug);
    const rightPrice = cheapest.get(config.right.slug);
    if (leftPrice === undefined || rightPrice === undefined) continue;

    const gap = Math.abs(leftPrice - rightPrice);
    const winner = leftPrice === rightPrice
      ? null
      : leftPrice < rightPrice ? config.left.slug : config.right.slug;
    if (winner) wins[winner]++;
    else ties++;
    gapSum += gap;

    const sample = group[0];
    rows.push({
      slug: sample.product.slug,
      name: fullProductName(sample.product.brand, sample.product.name),
      size: `${sample.variant!.volumeValue} ${sample.variant!.volumeUnit}`,
      leftPrice,
      rightPrice,
      gap,
      winner,
    });
  }

  rows.sort((a, b) => b.gap - a.gap);
  const seen = new Set<string>();
  const examples = rows.filter(row => {
    if (seen.has(row.slug)) return false;
    seen.add(row.slug);
    return true;
  }).slice(0, 10);
  const comparisons = rows.length;
  const ranking = [config.left, config.right]
    .map(merchant => ({ ...merchant, wins: wins[merchant.slug] }))
    .sort((a, b) => b.wins - a.wins);
  const freshest = deals
    .map(deal => deal.lastSeenAt)
    .filter((date): date is Date => !!date)
    .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

  return {
    config,
    comparisons,
    ties,
    ranking,
    examples,
    avgGap: comparisons ? gapSum / comparisons : 0,
    freshest,
  };
});

export async function generateMetadata({ params }: { params: Promise<{ pair: string }> }): Promise<Metadata> {
  const { pair } = await params;
  if (!(pair in PAIRS)) return { title: 'Comparatif introuvable', robots: { index: false, follow: false } };

  const data = await getPairData(pair as PairSlug);
  const leader = data.ranking[0];
  const share = data.comparisons ? Math.round((leader.wins / data.comparisons) * 100) : 0;
  const title = `${data.config.left.label} vs ${data.config.right.label} : qui est le moins cher ?`;
  const description = `${leader.label} gagne ${share}% des ${data.comparisons} comparaisons de parfums à taille égale. Écart moyen : ${data.avgGap.toFixed(2).replace('.', ',')} €. Prix relevés 6 fois par jour.`;

  return {
    title: { absolute: title },
    description,
    alternates: { canonical: `${BASE_URL}/comparatif/${pair}` },
    robots: { index: true, follow: true },
    openGraph: { title, description, url: `${BASE_URL}/comparatif/${pair}`, type: 'article' },
  };
}

export default async function PairComparisonPage({ params }: { params: Promise<{ pair: string }> }) {
  const { pair } = await params;
  if (!(pair in PAIRS)) notFound();

  const data = await getPairData(pair as PairSlug);
  const { left, right } = data.config;
  const leader = data.ranking[0];
  const share = data.comparisons ? Math.round((leader.wins / data.comparisons) * 100) : 0;
  const fmt = (value: number) => value.toFixed(2).replace('.', ',');
  const date = data.freshest
    ? new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(data.freshest)
    : 'au dernier relevé';
  const faq = [
    {
      question: `Qui est le moins cher entre ${left.label} et ${right.label} pour les parfums ?`,
      answer: `${leader.label} est actuellement moins cher le plus souvent : ${leader.wins} victoires sur ${data.comparisons} comparaisons à contenance identique, soit ${share} %. Le résultat peut changer selon le parfum et la promotion en cours.`,
    },
    {
      question: `Pourquoi les prix diffèrent-ils entre ${left.label} et ${right.label} ?`,
      answer: `Les deux enseignes n'appliquent pas les mêmes promotions, coupons et avantages fidélité au même moment. City Baddies compare uniquement les prix en ligne affichés publiquement, pour un même parfum et une même contenance.`,
    },
    {
      question: 'À quelle fréquence les prix sont-ils vérifiés ?',
      answer: `Les prix sont relevés six fois par jour. Cette page a été recalculée ${date} à partir des offres encore actives.`,
    },
  ];
  const pageUrl = `${BASE_URL}/comparatif/${pair}`;
  const schemas = [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Accueil', item: BASE_URL },
        { '@type': 'ListItem', position: 2, name: 'Comparatif des enseignes', item: `${BASE_URL}/sephora-vs-nocibe-vs-marionnaud` },
        { '@type': 'ListItem', position: 3, name: `${left.label} vs ${right.label}`, item: pageUrl },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Dataset',
      name: `Prix parfums : ${left.label} vs ${right.label}`,
      description: `${data.comparisons} comparaisons à contenance identique, écart moyen ${fmt(data.avgGap)} € par flacon.`,
      url: pageUrl,
      creator: { '@type': 'Organization', name: 'City Baddies', url: BASE_URL },
      dateModified: data.freshest?.toISOString(),
      isAccessibleForFree: true,
      measurementTechnique: 'Relevé automatisé des prix en ligne six fois par jour, comparaison à parfum et contenance identiques.',
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faq.map(item => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer },
      })),
    },
  ];

  return (
    <main className="min-h-screen bg-[#0a0a0a] pt-28 pb-24">
      {schemas.map((schema, index) => <JsonLd key={index} id={`pair-schema-${index}`} data={schema} />)}
      <div className="max-w-4xl mx-auto px-6">
        <nav className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 mb-10">
          <Link href="/" className="hover:text-white">Accueil</Link> <span className="mx-2">/</span>
          <Link href="/sephora-vs-nocibe-vs-marionnaud" className="hover:text-white">Comparatifs</Link>
        </nav>

        <header className="mb-14">
          <p className="text-[#d4a855] text-xs font-bold tracking-[0.22em] uppercase mb-5">Comparatif prix parfums</p>
          <h1 className="font-serif text-4xl md:text-6xl text-white leading-tight mb-6">
            {left.label} vs {right.label} : <span className="italic font-light">qui est le moins cher ?</span>
          </h1>
          <p className="text-lg text-neutral-400 font-light leading-relaxed max-w-2xl">
            Au {date}, {leader.label} remporte {leader.wins} des {data.comparisons} comparaisons à taille égale.
            L&apos;écart moyen entre les deux enseignes est de {fmt(data.avgGap)}&nbsp;€ par flacon.
          </p>
        </header>

        <section className="grid sm:grid-cols-2 gap-px bg-white/10 border border-white/10 mb-16">
          {data.ranking.map((merchant, index) => (
            <div key={merchant.slug} className="bg-[#0a0a0a] p-7">
              <p className="text-xs uppercase tracking-widest text-neutral-500 mb-3">{index === 0 ? 'Gagnant actuel' : 'Deuxième'}</p>
              <h2 className="font-serif text-3xl text-white mb-2">{merchant.label}</h2>
              <p className="text-[#d4a855] font-mono">{merchant.wins} victoires</p>
            </div>
          ))}
        </section>

        <section className="mb-16">
          <h2 className="font-serif text-3xl text-white mb-3">Comparaison parfum par parfum</h2>
          <p className="text-sm text-neutral-500 mb-7">Même parfum, même contenance, prix actifs lors du dernier relevé.</p>
          <div className="overflow-x-auto border-y border-white/10">
            <table className="w-full min-w-[620px] text-left">
              <thead className="text-[10px] uppercase tracking-widest text-neutral-500 border-b border-white/10">
                <tr><th className="py-4 pr-4">Parfum</th><th className="py-4 px-4">Taille</th><th className="py-4 px-4 text-right">{left.label}</th><th className="py-4 pl-4 text-right">{right.label}</th></tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.examples.map(row => (
                  <tr key={`${row.slug}-${row.size}`}>
                    <td className="py-4 pr-4"><Link href={`/produits/${row.slug}`} className="text-white hover:text-[#d4a855]">{row.name}</Link></td>
                    <td className="py-4 px-4 text-neutral-500 text-sm">{row.size}</td>
                    <td className={`py-4 px-4 text-right ${row.winner === left.slug ? 'text-[#d4a855]' : 'text-neutral-300'}`}>{fmt(row.leftPrice)}&nbsp;€</td>
                    <td className={`py-4 pl-4 text-right ${row.winner === right.slug ? 'text-[#d4a855]' : 'text-neutral-300'}`}>{fmt(row.rightPrice)}&nbsp;€</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.ties > 0 && <p className="text-xs text-neutral-500 mt-4">{data.ties} comparaison{data.ties > 1 ? 's' : ''} à égalité.</p>}
        </section>

        <section className="mb-16">
          <h2 className="font-serif text-3xl text-white mb-7">Questions fréquentes</h2>
          <div className="space-y-3">
            {faq.map(item => (
              <details key={item.question} className="border border-white/10 p-5">
                <summary className="text-white cursor-pointer">{item.question}</summary>
                <p className="text-sm text-neutral-400 leading-relaxed mt-4">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <aside className="border-t border-white/10 pt-8">
          <p className="text-sm text-neutral-500 mb-4">Voir les autres comparatifs :</p>
          <div className="flex flex-wrap gap-3">
            {(Object.entries(PAIRS) as [PairSlug, (typeof PAIRS)[PairSlug]][]).filter(([slug]) => slug !== pair).map(([slug, config]) => (
              <Link key={slug} href={`/comparatif/${slug}`} className="border border-white/15 px-4 py-3 text-sm text-neutral-300 hover:text-white hover:border-white/30">
                {config.left.label} vs {config.right.label}
              </Link>
            ))}
          </div>
        </aside>
      </div>
    </main>
  );
}
