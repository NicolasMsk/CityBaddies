import type { Metadata } from 'next';
import Link from 'next/link';
import { cache } from 'react';
import prisma from '@/lib/prisma';
import JsonLd from '@/components/seo/JsonLd';
import { fullProductName } from '@/lib/seo-config';

// ISR : l'observatoire se recalcule (revalidation) — données live, jamais figées.
export const revalidate = 3600;

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://citybaddies.com';
const MERCHANT_LABEL: Record<string, string> = { sephora: 'Sephora', nocibe: 'Nocibé', marionnaud: 'Marionnaud', 'my-origines': 'My-Origines', notino: 'Notino' };
const merchantLabel = (slug: string) => MERCHANT_LABEL[slug] ?? slug;

function moisAnnee(d = new Date()) {
  const s = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export async function generateMetadata(): Promise<Metadata> {
  const mois = moisAnnee();
  const o = await getObservatoire();
  const leader = o.ranking[0];
  const leaderText = leader
    ? `${leader.label} est la moins chère dans ${leader.pct}% des ${o.comparisons} comparaisons`
    : `${o.comparisons} comparaisons de prix à taille égale`;
  const title = leader
    ? `Prix parfums ${mois.toLowerCase()} : ${leader.label} gagne ${leader.pct} %`
    : `Prix des parfums en ${mois.toLowerCase()} : le comparatif`;
  const description = `${leaderText}. Écart moyen : ${o.avgGap.toFixed(2).replace('.', ',')} €. ${o.drops.length} baisses détectées sur 30 jours. Données relevées 6 fois par jour.`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: `${BASE_URL}/observatoire-des-prix` },
    openGraph: {
      title,
      description,
      url: `${BASE_URL}/observatoire-des-prix`,
      type: 'article',
    },
  };
}

const getObservatoire = cache(async () => {
  const now = Date.now();
  const d30 = new Date(now - 30 * 864e5);

  const deals = await prisma.deal.findMany({
    where: { status: 'ACTIVE', type: 'tracked' },
    include: { merchant: true, product: true, variant: true },
  });
  // Historique (champs utiles seulement) pour baisses 30j + max observé.
  const hist = await prisma.priceHistory.findMany({
    where: { product: { deals: { some: { status: 'ACTIVE', type: 'tracked' } } } },
    select: { productId: true, volumeValue: true, volumeUnit: true, price: true, date: true },
    orderBy: { date: 'asc' },
  });

  // ── Classement enseignes (comparaisons à taille égale) ──
  const byPV = new Map<string, typeof deals>();
  for (const d of deals) {
    if (!d.variant) continue;
    const k = `${d.product.slug}|${d.variant.volumeValue}${d.variant.volumeUnit}`;
    if (!byPV.has(k)) byPV.set(k, []);
    byPV.get(k)!.push(d);
  }
  // Toutes les enseignes présentes dans les deals (dynamique : 3, 4, ou +).
  const wins: Record<string, number> = {};
  for (const d of deals) if (d.merchant?.slug) wins[d.merchant.slug] ??= 0;
  let comparisons = 0, gapSum = 0;
  const gaps: { name: string; slug: string; size: string; min: number; max: number; gap: number; cheapest: string }[] = [];
  for (const ds of byPV.values()) {
    const m = new Map<string, number>();
    for (const d of ds) { const c = m.get(d.merchant.slug); if (c === undefined || d.dealPrice < c) m.set(d.merchant.slug, d.dealPrice); }
    if (m.size < 2) continue;
    comparisons++;
    const s = [...m.entries()].sort((a, b) => a[1] - b[1]);
    gapSum += s[s.length - 1][1] - s[0][1];
    if (s[0][1] !== s[1][1]) wins[s[0][0]] = (wins[s[0][0]] ?? 0) + 1;
    const d0 = ds[0];
    gaps.push({ name: fullProductName(d0.product.brand, d0.product.name), slug: d0.product.slug, size: `${d0.variant!.volumeValue} ${d0.variant!.volumeUnit}`, min: s[0][1], max: s[s.length - 1][1], gap: s[s.length - 1][1] - s[0][1], cheapest: s[0][0] });
  }
  const ranking = Object.keys(wins)
    .map(slug => ({ slug, label: merchantLabel(slug), wins: wins[slug], pct: comparisons ? Math.round(wins[slug] / comparisons * 100) : 0 }))
    .sort((a, b) => b.wins - a.wins);
  gaps.sort((a, b) => b.gap - a.gap);
  const seenG = new Set<string>();
  const topGaps = gaps.filter(g => (seenG.has(g.slug) ? false : seenG.add(g.slug))).slice(0, 6);

  // ── Baisses ≥5% sur 30j (par produit×contenance) ──
  const prodMeta = new Map(deals.map(d => [d.product.id, d.product]));
  const series = new Map<string, { first: number; last: number; pid: string; vol: string; volValue: number }>();
  for (const h of hist) {
    if (h.date < d30) continue;
    const k = `${h.productId}|${h.volumeValue}${h.volumeUnit}`;
    const cur = series.get(k);
    if (!cur) series.set(k, { first: h.price, last: h.price, pid: h.productId, vol: `${h.volumeValue} ${h.volumeUnit}`, volValue: h.volumeValue ?? 0 });
    else cur.last = h.price;
  }
  const drops = [...series.values()]
    .map(s => { const pr = prodMeta.get(s.pid); return { name: pr ? fullProductName(pr.brand, pr.name) : '', slug: pr?.slug ?? '', vol: s.vol, from: s.first, to: s.last, pct: s.first > 0 ? Math.round((1 - s.last / s.first) * 100) : 0 }; })
    .filter(s => s.pct >= 5 && s.name)
    .sort((a, b) => b.pct - a.pct);

  // ── Prix barrés non conformes à l'historique observé ──
  // Max de prix jamais RELEVÉ par nous, par produit×volumeValue.
  const maxSeen = new Map<string, number>();
  for (const h of hist) { const k = `${h.productId}|${h.volumeValue}`; maxSeen.set(k, Math.max(maxSeen.get(k) ?? 0, h.price)); }
  const histCount = new Map<string, number>();
  for (const h of hist) { const k = `${h.productId}|${h.volumeValue}`; histCount.set(k, (histCount.get(k) ?? 0) + 1); }
  const fakes: { name: string; slug: string; size: string; barre: number; maxSeen: number; merchant: string }[] = [];
  for (const d of deals) {
    if (!d.variant || !d.originalPrice || d.originalPrice <= d.dealPrice) continue;
    const k = `${d.productId}|${d.variant.volumeValue}`;
    const seen = maxSeen.get(k); const n = histCount.get(k) ?? 0;
    if (seen && n >= 5 && d.originalPrice > seen * 1.05) {
      fakes.push({ name: fullProductName(d.product.brand, d.product.name), slug: d.product.slug, size: `${d.variant.volumeValue} ${d.variant.volumeUnit}`, barre: d.originalPrice, maxSeen: seen, merchant: d.merchant.name });
    }
  }
  fakes.sort((a, b) => (b.barre - b.maxSeen) - (a.barre - a.maxSeen));

  const products = new Set(deals.map(d => d.product.slug)).size;
  const releves = hist.length;
  const freshest = deals.map(d => d.lastSeenAt).filter((d): d is Date => !!d).sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

  return {
    products, releves, comparisons, avgGap: comparisons ? gapSum / comparisons : 0,
    ranking, topGaps, drops, fakes, freshest,
    maxDropPct: drops[0]?.pct ?? 0,
  };
});

export default async function ObservatoirePage() {
  const o = await getObservatoire();
  const mois = moisAnnee();
  const fmt = (n: number) => n.toFixed(2).replace('.', ',');
  const dateFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const freshLabel = o.freshest ? dateFmt.format(o.freshest) : null;
  const leader = o.ranking[0];

  const breadcrumbSchema = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'Observatoire des prix', item: `${BASE_URL}/observatoire-des-prix` },
    ],
  };
  const articleSchema = {
    '@context': 'https://schema.org', '@type': 'Article',
    headline: `Observatoire des prix parfums — ${mois}`,
    description: `Étude mensuelle : ${leader.label} moins chère dans ${leader.pct}% des cas, écart moyen ${fmt(o.avgGap)} €, ${o.drops.length} baisses de prix relevées.`,
    author: { '@type': 'Organization', name: 'City Baddies', url: BASE_URL },
    publisher: { '@type': 'Organization', name: 'City Baddies', url: BASE_URL },
    dateModified: o.freshest?.toISOString(),
    mainEntityOfPage: `${BASE_URL}/observatoire-des-prix`,
  };
  const datasetSchema = {
    '@context': 'https://schema.org', '@type': 'Dataset',
    name: `Observatoire des prix parfums City Baddies — ${mois}`,
    description: `Relevés de prix parfums (Sephora, Nocibé, Marionnaud, My-Origines, Notino) : ${o.comparisons} comparaisons à taille égale, écart moyen ${fmt(o.avgGap)} €, ${o.releves} relevés archivés. Mis à jour six fois par jour.`,
    url: `${BASE_URL}/observatoire-des-prix`,
    creator: { '@type': 'Organization', name: 'City Baddies', url: BASE_URL },
    dateModified: o.freshest?.toISOString(),
    isAccessibleForFree: true,
    measurementTechnique: 'Relevé automatisé six fois par jour des prix affichés sur les fiches produit officielles, comparés à contenance identique (EAN).',
    variableMeasured: [
      { '@type': 'PropertyValue', name: 'Comparaisons à taille égale', value: o.comparisons },
      { '@type': 'PropertyValue', name: 'Écart moyen entre enseignes (EUR)', value: Number(o.avgGap.toFixed(2)) },
      { '@type': 'PropertyValue', name: 'Enseigne la moins chère le plus souvent', value: `${leader.label} (${leader.pct} %)` },
      { '@type': 'PropertyValue', name: 'Baisses de prix ≥5% sur 30 jours', value: o.drops.length },
    ],
  };

  const Th = ({ children, right }: { children: React.ReactNode; right?: boolean }) => (
    <th scope="col" className={`pb-3 text-[9px] font-bold uppercase tracking-[0.25em] text-neutral-600 ${right ? 'text-right' : ''}`}>{children}</th>
  );

  return (
    <>
      <JsonLd id="obs-breadcrumb" data={breadcrumbSchema} />
      <JsonLd id="obs-article" data={articleSchema} />
      <JsonLd id="obs-dataset" data={datasetSchema} />

      <div className="min-h-screen bg-[#0a0a0a] relative overflow-hidden">
        <div className="absolute top-[-5%] right-[-10%] w-[36vw] h-[36vw] bg-[#9b1515] opacity-[0.07] blur-[110px] rounded-full pointer-events-none" />
        <div className="absolute top-[45%] left-[-12%] w-[32vw] h-[32vw] bg-[#d4a855] opacity-[0.05] blur-[120px] rounded-full pointer-events-none" />

        <div className="relative max-w-3xl mx-auto px-6 pt-28 pb-24">
          {/* Hero */}
          <div className="mb-14">
            <div className="flex items-center gap-3 mb-8">
              <span className="h-[1px] w-12 bg-[#d4a855]" />
              <span className="text-[#d4a855] text-xs font-bold tracking-[0.25em] uppercase">L&apos;étude du mois</span>
            </div>
            <h1 className="font-serif text-white leading-[1.02] mb-6">
              <span className="block text-4xl md:text-6xl font-medium">Observatoire des prix</span>
              <span className="block text-3xl md:text-5xl italic font-light text-white/70 mt-3">Parfums — {mois}</span>
            </h1>
            <p className="text-neutral-400 font-light text-lg leading-relaxed max-w-xl">
              Chaque mois, ce que révèlent nos relevés de prix sur Sephora, Nocibé, Marionnaud, My-Origines et Notino :
              qui est vraiment la moins chère, de combien, et quelles «&nbsp;promos&nbsp;» n&apos;en sont pas.
            </p>
          </div>

          {/* Synthèse citable */}
          <figure className="relative border border-[#d4a855]/25 bg-gradient-to-b from-[#d4a855]/[0.06] to-transparent p-6 sm:p-8 md:p-10 mb-16">
            <span className="absolute -top-3 left-6 sm:left-8 bg-[#0a0a0a] px-3 text-[9px] font-bold uppercase tracking-[0.3em] text-[#d4a855]">Ce mois-ci</span>
            <p className="text-base sm:text-lg text-neutral-200 font-light leading-relaxed">
              {freshLabel ? `Au ${freshLabel}, ` : ''}sur <strong className="text-white font-medium">{o.comparisons} comparaisons à taille égale</strong> ({o.products} parfums),{' '}
              <strong className="text-white font-medium">{leader.label} est l&apos;enseigne la moins chère dans {leader.pct}&nbsp;% des cas</strong>.
              L&apos;écart moyen entre la moins chère et la plus chère atteint{' '}
              <span className="font-serif italic text-[#d4a855]">{fmt(o.avgGap)}&nbsp;€ par flacon</span>.{' '}
              Nous avons relevé <strong className="text-white font-medium">{o.drops.length} baisses de prix d&apos;au moins 5&nbsp;%</strong> sur 30 jours
              {o.maxDropPct > 0 ? <> (jusqu&apos;à <span className="font-serif italic text-[#d4a855]">−{o.maxDropPct}&nbsp;%</span>)</> : null}
              {o.fakes.length > 0 ? <>, et <strong className="text-white font-medium">{o.fakes.length} prix barrés supérieurs au prix le plus haut jamais relevé</strong> — des «&nbsp;réductions&nbsp;» à regarder de près.</> : '.'}
            </p>
            <figcaption className="mt-5 text-xs font-light italic text-neutral-500">
              {o.releves.toLocaleString('fr-FR')} relevés archivés · six passages par jour.{' '}
              <Link href="/methodologie" className="underline decoration-[#d4a855]/40 underline-offset-4 hover:text-neutral-300 not-italic">Méthodologie</Link>
            </figcaption>
          </figure>

          {/* Classement */}
          <section className="mb-16">
            <h2 className="font-serif text-2xl md:text-3xl text-white mb-6">Quelle enseigne est la moins chère en {mois} ?</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[360px] text-left border-collapse">
                <caption className="sr-only">Classement des enseignes par nombre de comparaisons remportées à contenance identique.</caption>
                <thead><tr className="border-b border-white/10"><Th>Enseigne</Th><Th right>Comparaisons gagnées</Th><Th right>Part</Th></tr></thead>
                <tbody className="divide-y divide-white/5">
                  {o.ranking.map((m, i) => (
                    <tr key={m.slug}>
                      <th scope="row" className={`py-4 font-serif text-lg ${i === 0 ? 'text-[#d4a855] italic' : 'text-white/80'}`}>{i + 1}. {m.label}</th>
                      <td className="py-4 text-right font-light text-neutral-300">{m.wins}</td>
                      <td className="py-4 text-right"><span className="font-serif italic text-[#d4a855]">{m.pct}&nbsp;%</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Baisses du mois */}
          {o.drops.length > 0 && (
            <section className="mb-16">
              <h2 className="font-serif text-2xl md:text-3xl text-white mb-6">Les plus fortes baisses du mois</h2>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] text-left border-collapse">
                  <caption className="sr-only">Parfums dont le prix a le plus baissé sur les 30 derniers jours, à contenance identique.</caption>
                  <thead><tr className="border-b border-white/10"><Th>Parfum</Th><Th>Taille</Th><Th right>Avant → Après</Th><Th right>Baisse</Th></tr></thead>
                  <tbody className="divide-y divide-white/5">
                    {o.drops.slice(0, 10).map(d => (
                      <tr key={`${d.slug}-${d.vol}`}>
                        <th scope="row" className="py-3.5 font-light"><Link href={`/produits/${d.slug}`} className="text-white hover:text-[#d4a855] transition-colors">{d.name}</Link></th>
                        <td className="py-3.5 text-sm font-light text-neutral-400 whitespace-nowrap">{d.vol}</td>
                        <td className="py-3.5 text-right text-sm font-light text-neutral-400 whitespace-nowrap">{fmt(d.from)} € → <span className="text-white">{fmt(d.to)} €</span></td>
                        <td className="py-3.5 text-right"><span className="font-serif italic text-[#d4a855] whitespace-nowrap">−{d.pct}&nbsp;%</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Prix barrés démasqués */}
          {o.fakes.length > 0 && (
            <section className="mb-16">
              <h2 className="font-serif text-2xl md:text-3xl text-white mb-3">Prix barrés à regarder de près</h2>
              <p className="text-neutral-400 font-light text-sm mb-6 max-w-2xl">
                Ces flacons affichent un prix barré <strong className="text-white font-medium">supérieur au prix le plus élevé que nous ayons jamais relevé</strong> pour eux.
                Autrement dit, la «&nbsp;réduction&nbsp;» part d&apos;un prix de référence que le produit n&apos;a jamais atteint dans nos mesures.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[440px] text-left border-collapse">
                  <caption className="sr-only">Prix barrés supérieurs au prix maximum relevé par City Baddies.</caption>
                  <thead><tr className="border-b border-white/10"><Th>Parfum</Th><Th>Enseigne</Th><Th right>Prix barré</Th><Th right>Jamais relevé au-dessus de</Th></tr></thead>
                  <tbody className="divide-y divide-white/5">
                    {o.fakes.slice(0, 10).map(f => (
                      <tr key={`${f.slug}-${f.size}-${f.merchant}`}>
                        <th scope="row" className="py-3.5 font-light"><Link href={`/produits/${f.slug}`} className="text-white hover:text-[#d4a855] transition-colors">{f.name}</Link> <span className="text-neutral-500 text-xs">{f.size}</span></th>
                        <td className="py-3.5 text-sm font-light text-neutral-400">{f.merchant}</td>
                        <td className="py-3.5 text-right text-sm font-light text-neutral-500 line-through whitespace-nowrap">{fmt(f.barre)} €</td>
                        <td className="py-3.5 text-right"><span className="font-serif italic text-[#d4a855] whitespace-nowrap">{fmt(f.maxSeen)} €</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Écarts */}
          {o.topGaps.length > 0 && (
            <section className="mb-16">
              <h2 className="font-serif text-2xl md:text-3xl text-white mb-6">Où l&apos;écart entre enseignes est le plus fort</h2>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] text-left border-collapse">
                  <caption className="sr-only">Parfums dont le prix varie le plus selon l&apos;enseigne, à contenance identique.</caption>
                  <thead><tr className="border-b border-white/10"><Th>Parfum</Th><Th>Taille</Th><Th right>Le moins cher</Th><Th right>Écart</Th></tr></thead>
                  <tbody className="divide-y divide-white/5">
                    {o.topGaps.map(g => (
                      <tr key={`${g.slug}-${g.size}`}>
                        <th scope="row" className="py-3.5 font-light"><Link href={`/produits/${g.slug}`} className="text-white hover:text-[#d4a855] transition-colors">{g.name}</Link></th>
                        <td className="py-3.5 text-sm font-light text-neutral-400 whitespace-nowrap">{g.size}</td>
                        <td className="py-3.5 text-right text-sm font-light text-neutral-400 whitespace-nowrap">{fmt(g.min)} € · {merchantLabel(g.cheapest)}</td>
                        <td className="py-3.5 text-right"><span className="font-serif italic text-[#d4a855] whitespace-nowrap">+{fmt(g.gap)} €</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Méthode courte */}
          <section className="mb-16 text-neutral-300 font-light leading-relaxed">
            <h2 className="font-serif text-2xl text-white mb-4">Comment lire cet observatoire</h2>
            <p>
              Toutes les données viennent de nos relevés automatisés, six fois par jour, sur les fiches produit officielles
              de Sephora, Nocibé, Marionnaud, My-Origines et Notino, comparées <strong className="text-white font-medium">à contenance identique</strong>.
              Les baisses sont mesurées sur 30 jours glissants. La colonne «&nbsp;jamais relevé au-dessus de&nbsp;» reflète notre
              fenêtre d&apos;observation, pas l&apos;historique complet du produit. Rien n&apos;est estimé ni extrapolé.{' '}
              <Link href="/methodologie" className="underline decoration-[#d4a855]/40 underline-offset-4 hover:text-white transition-colors">Méthodologie détaillée</Link>.
            </p>
          </section>

          <div className="pt-8 border-t border-white/10 flex flex-wrap gap-4">
            <Link href="/produits" className="px-8 py-4 bg-white text-black text-sm font-bold tracking-widest uppercase hover:bg-neutral-200 transition-colors">Comparer un parfum</Link>
            <Link href="/comparatif-prix-parfums" className="px-8 py-4 border border-white/20 text-white text-xs sm:text-sm font-bold tracking-widest uppercase hover:bg-white/5 transition-colors">Le match des enseignes</Link>
          </div>
        </div>
      </div>
    </>
  );
}
