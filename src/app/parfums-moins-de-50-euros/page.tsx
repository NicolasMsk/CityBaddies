import type { Metadata } from 'next';
import Link from 'next/link';
import prisma from '@/lib/prisma';
import JsonLd from '@/components/seo/JsonLd';
import { fullProductName } from '@/lib/seo-config';
import { getHighQualityImageUrl, isValidImageUrl } from '@/lib/utils/image';
import SafeImage from '@/components/ui/SafeImage';

// ISR : page mise en cache et régénérée toutes les 900s (liste recalculée à la revalidation).
// Le force-dynamic historique imposait des requêtes DB à CHAQUE visite (TTFB/CWV).
export const revalidate = 900;

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://citybaddies.com';

export const metadata: Metadata = {
  title: 'Parfum femme à moins de 50 € : la liste vérifiée',
  description:
    'Quels grands parfums femme (Chanel, Guerlain, Kenzo, Chloé…) trouve-t-on réellement sous 50 € ? Liste mise à jour à chaque relevé de prix, formats de 20 ml et plus uniquement.',
  alternates: { canonical: `${BASE_URL}/parfums-moins-de-50-euros` },
  openGraph: {
    title: 'Parfum femme à moins de 50 € : la liste vérifiée',
    description: 'La liste vivante des vrais parfums femme sous 50 €, prix relevés 6 fois par jour.',
    url: `${BASE_URL}/parfums-moins-de-50-euros`,
    type: 'article',
  },
};

// FAQ visible + schema — réponses durables, aucun chiffre figé.
const FAQ = [
  {
    question: 'Peut-on vraiment avoir un parfum de marque pour moins de 50 € ?',
    answer:
      "Oui — à deux conditions : viser les formats 20 à 50 ml plutôt que les grands flacons, et acheter au bon moment, parce que les enseignes font tourner leurs promos en permanence. La liste ci-dessus ne contient que des offres réellement relevées sur les sites de Sephora, Nocibé, Marionnaud et My-Origines, avec la date du relevé. Zéro spéculation.",
  },
  {
    question: 'Un petit format, est-ce un bon calcul ?',
    answer:
      "Au prix au millilitre, non : le grand flacon gagne presque toujours. Mais le petit format a d'autres arguments — tester un parfum avant d'investir, faire tourner ta collection, glisser un flacon dans chaque sac, ou simplement respecter ton budget du mois. L'important, c'est de payer CE format-là au meilleur prix. C'est exactement ce que cette liste vérifie.",
  },
  {
    question: 'Pourquoi la liste change-t-elle régulièrement ?',
    answer:
      "Parce que les prix bougent : nos relevés tournent six fois par jour, et un parfum peut passer sous la barre des 50 € le temps d'une opération, puis en ressortir. Chaque ligne indique l'enseigne du moment et renvoie vers la fiche complète, avec l'historique de prix.",
  },
  {
    question: 'Ces parfums pas chers sont-ils authentiques ?',
    answer:
      "Tous les prix listés viennent exclusivement des sites officiels de Sephora, Nocibé, Marionnaud et My-Origines — des distributeurs agréés. Ni marketplaces, ni revendeurs parallèles, ni « testeurs » douteux : le parfum pas cher ne doit jamais être un parfum risqué.",
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

async function getUnder50() {
  const deals = await prisma.deal.findMany({
    where: {
      status: 'ACTIVE',
      type: 'tracked',
      dealPrice: { lte: 50 },
      // Formats ≥ 20 ml uniquement : en dessous, ce sont des miniatures/voyage —
      // les inclure ferait passer la liste pour un attrape-clics.
      variant: { volumeUnit: 'ml', volumeValue: { gte: 20 } },
    },
    include: {
      merchant: true,
      product: { include: { images: { orderBy: { position: 'asc' }, take: 1 } } },
      variant: true,
    },
    orderBy: { dealPrice: 'asc' },
  });

  // Une entrée par parfum : sa meilleure offre sous 50 €.
  const seen = new Set<string>();
  const rows: {
    slug: string; name: string; brand: string; price: number; originalPrice: number;
    size: string; merchant: string; discount: number; lastSeenAt: Date | null; image: string | null;
  }[] = [];
  for (const d of deals) {
    if (seen.has(d.product.slug)) continue;
    seen.add(d.product.slug);
    const raw = d.product.images[0]?.url;
    const hd = raw ? getHighQualityImageUrl(raw) || raw : null;
    rows.push({
      slug: d.product.slug,
      name: fullProductName(d.product.brand, d.product.name),
      brand: d.product.brand || '',
      price: d.dealPrice,
      originalPrice: d.originalPrice,
      size: `${d.variant!.volumeValue} ${d.variant!.volumeUnit}`,
      merchant: d.merchant.name,
      discount: d.discountPercent,
      lastSeenAt: d.lastSeenAt,
      image: hd && (isValidImageUrl(hd) || isValidImageUrl(raw!)) ? hd : null,
    });
  }

  const freshest = rows
    .map(r => r.lastSeenAt)
    .filter((d): d is Date => !!d)
    .sort((a, b) => b.getTime() - a.getTime())[0];

  return { rows, freshest };
}

export default async function Under50Page() {
  const { rows, freshest } = await getUnder50();
  const fmt = (n: number) => n.toFixed(2).replace('.', ',');
  const dateFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const freshLabel = freshest ? dateFmt.format(freshest) : null;

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'Parfums à moins de 50 €', item: `${BASE_URL}/parfums-moins-de-50-euros` },
    ],
  };

  const listSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Parfums de marque à moins de 50 €',
    numberOfItems: rows.length,
    itemListElement: rows.map((r, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'Product',
        name: `${r.name} ${r.size}`,
        url: `${BASE_URL}/produits/${r.slug}`,
        ...(r.brand ? { brand: { '@type': 'Brand', name: r.brand } } : {}),
        offers: {
          '@type': 'Offer',
          price: r.price,
          priceCurrency: 'EUR',
          availability: 'https://schema.org/InStock',
          seller: { '@type': 'Organization', name: r.merchant },
        },
      },
    })),
  };

  return (
    <>
      <JsonLd id="under50-breadcrumb" data={breadcrumbSchema} />
      <JsonLd id="under50-list" data={listSchema} />
      <JsonLd id="under50-faq" data={faqSchema} />

      <div className="min-h-screen bg-[#0a0a0a] relative overflow-hidden">
        {/* Halos ambiance */}
        <div className="absolute top-[-8%] left-[-10%] w-[34vw] h-[34vw] bg-[#d4a855] opacity-[0.06] blur-[110px] rounded-full pointer-events-none" />
        <div className="absolute top-[55%] right-[-12%] w-[30vw] h-[30vw] bg-[#9b1515] opacity-[0.06] blur-[120px] rounded-full pointer-events-none" />

        <div className="relative max-w-3xl mx-auto px-6 pt-28 pb-24">

          {/* ── Hero ── */}
          <div className="mb-16">
            <div className="flex items-center gap-3 mb-8">
              <span className="h-[1px] w-12 bg-[#d4a855]" />
              <span className="text-[#d4a855] text-xs font-bold tracking-[0.25em] uppercase">Baddie on a budget</span>
            </div>
            <h1 className="font-serif text-white leading-[1.02] mb-8">
              <span className="block text-4xl md:text-6xl font-medium">Le luxe à moins de <span className="text-[#d4a855]">50&nbsp;€</span>.</span>
              <span className="block text-3xl md:text-5xl italic font-light text-white/70 mt-3">Sans arnaque, sans miniature piège.</span>
            </h1>
            <p className="text-neutral-400 font-light text-lg leading-relaxed max-w-xl">
              Un vrai parfum de marque sous 50&nbsp;€, ça existe — à condition de savoir où regarder
              et quand. Ici, que des flacons de <strong className="text-white font-medium">20&nbsp;ml et plus</strong>,
              à des prix réellement relevés chez Sephora, Nocibé, Marionnaud et My-Origines. La liste respire
              avec les prix : elle se met à jour toute seule, six fois par jour.
            </p>
          </div>

          {/* ── Le chiffre du jour — citable ── */}
          <figure className="relative mb-20 border border-[#d4a855]/25 bg-gradient-to-b from-[#d4a855]/[0.06] to-transparent p-8 sm:p-10">
            <span className="absolute -top-3 left-8 bg-[#0a0a0a] px-3 text-[9px] font-bold uppercase tracking-[0.3em] text-[#d4a855]">
              En ce moment
            </span>
            <div className="flex items-baseline gap-4 mb-5">
              <span className="font-serif text-6xl sm:text-7xl text-[#d4a855] leading-none">{rows.length}</span>
              <span className="font-serif italic text-xl sm:text-2xl text-white/85 leading-snug">
                parfums de marque sous la barre
              </span>
            </div>
            <figcaption className="text-neutral-300 font-light leading-relaxed">
              {freshLabel ? `Au ${freshLabel}` : 'Actuellement'}, {rows.length} parfums de marque s&apos;affichent
              sous 50&nbsp;€ en format 20&nbsp;ml ou plus
              {rows[0] ? (
                <> — le ticket d&apos;entrée : <strong className="text-white font-medium">{fmt(rows[0].price)}&nbsp;€</strong> pour {rows[0].name} en {rows[0].size}, chez {rows[0].merchant}</>
              ) : null}. Chaque prix est daté, chaque fiche garde l&apos;historique.
            </figcaption>
          </figure>

          {/* ── La liste — vitrine ── */}
          <section className="mb-20">
            <h2 className="font-serif text-2xl md:text-3xl text-white mb-2">
              La sélection, <span className="italic font-light text-white/70">du plus petit prix au plus grand</span>
            </h2>
            <p className="text-neutral-500 text-sm font-light mb-8">
              Clique sur un flacon : tu verras les quatre enseignes, toutes les tailles, et l&apos;évolution du prix.
            </p>
            <div className="grid sm:grid-cols-2 gap-px bg-white/10 border border-white/10">
              {rows.map(r => (
                <Link
                  key={r.slug}
                  href={`/produits/${r.slug}`}
                  className="group bg-[#0a0a0a] p-6 hover:bg-white/[0.04] transition-colors"
                >
                  <div className="flex items-start gap-5">
                    <div className="w-16 h-20 bg-white flex-shrink-0 flex items-center justify-center overflow-hidden">
                      {r.image ? (
                        <SafeImage src={r.image} alt={r.name} width={64} height={80} className="object-contain w-full h-full" />
                      ) : (
                        <span className="font-serif text-neutral-300 text-2xl">{r.name.charAt(0)}</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="block text-[9px] font-bold uppercase tracking-[0.25em] text-neutral-500">
                        {r.brand}
                      </span>
                      <span className="block font-serif text-base text-white leading-snug mt-1 group-hover:text-[#d4a855] transition-colors">
                        {r.brand && r.name.toLowerCase().startsWith(r.brand.toLowerCase())
                          ? r.name.slice(r.brand.length).trim()
                          : r.name}
                      </span>
                      <span className="block font-mono text-[10px] text-neutral-500 mt-1.5">
                        {r.size} · chez {r.merchant}
                      </span>
                      <div className="flex items-baseline gap-2.5 mt-3">
                        <span className="font-serif text-2xl text-white">{fmt(r.price)}&nbsp;€</span>
                        {r.originalPrice > r.price && (
                          <span className="font-mono text-[11px] text-neutral-600 line-through">{fmt(r.originalPrice)}&nbsp;€</span>
                        )}
                        {r.discount > 0 && (
                          <span className="font-mono text-[10px] text-[#d4a855]">−{r.discount}%</span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            <p className="font-mono text-[10px] text-neutral-600 mt-4 tracking-wide">
              Prix relevés six fois par jour sur les sites officiels.{' '}
              <Link href="/methodologie" className="underline hover:text-neutral-400 transition-colors">Notre méthodologie</Link>
            </p>
          </section>

          {/* ── Pull quote ── */}
          <blockquote className="my-20 text-center">
            <p className="font-serif italic text-2xl md:text-3xl text-white/85 leading-snug max-w-lg mx-auto">
              «&nbsp;Le secret, ce n&apos;est pas la contrefaçon.<br />
              <span className="text-[#d4a855]">C&apos;est le format.</span>&nbsp;»
            </p>
          </blockquote>

          {/* ── Édito ── */}
          <section className="mb-20 space-y-12 text-neutral-300 font-light leading-relaxed">
            <div>
              <h2 className="font-serif text-2xl text-white mb-4">Même jus, flacon plus petit</h2>
              <p>
                Sous 50&nbsp;€, le marché regorge de pièges — décants douteux, marketplaces sans garantie,
                «&nbsp;testeurs&nbsp;» invérifiables. La voie sûre est ailleurs : presque toutes les maisons déclinent
                leurs parfums en 20, 30 ou 50&nbsp;ml, vendus par les mêmes enseignes agréées que les grands formats.
                Même concentration, même tenue, même flacon en plus mignon sur ta coiffeuse. C&apos;est cette
                réalité-là que la liste capture.
              </p>
            </div>
            <div>
              <h2 className="font-serif text-2xl text-white mb-4">L&apos;eau de toilette, la mal-aimée qui a tout compris</h2>
              <p>
                À ligne identique, l&apos;eau de toilette coûte sensiblement moins cher que l&apos;eau de parfum.
                Plus légère, plus fraîche, tenue plus courte — mais pour le bureau, l&apos;été ou un premier
                rendez-vous, c&apos;est souvent le meilleur rapport plaisir/prix du marché. Plusieurs flacons
                de la sélection en sont la preuve vivante.
              </p>
            </div>
            <div>
              <h2 className="font-serif text-2xl text-white mb-4">Acheter au creux, pas au prix barré</h2>
              <p>
                Un «&nbsp;−30&nbsp;%&nbsp;» ne veut rien dire si le prix barré est artificiel. Avant de craquer,
                ouvre la fiche du parfum : l&apos;historique montre en un coup d&apos;œil si le prix du jour est un
                vrai creux ou juste du théâtre. C&apos;est toute la différence entre une promo et une bonne affaire —
                et c&apos;est exactement pour ça qu&apos;on archive tout.
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
            <p className="font-serif italic text-lg text-white/70 mb-6">Ton budget est une contrainte. Pas ton parfum.</p>
            <div className="flex flex-wrap gap-4">
              <Link
                href="/produits"
                className="px-8 py-4 bg-white text-black text-sm font-bold tracking-widest uppercase hover:bg-neutral-200 transition-colors"
              >
                Tous les parfums comparés
              </Link>
              <Link
                href="/sephora-vs-nocibe-vs-marionnaud"
                className="px-8 py-4 border border-white/20 text-white text-xs sm:text-sm font-bold tracking-widest uppercase hover:bg-white/5 transition-colors"
              >
                Le match des enseignes
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
