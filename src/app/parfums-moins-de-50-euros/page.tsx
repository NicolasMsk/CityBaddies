import type { Metadata } from 'next';
import Link from 'next/link';
import prisma from '@/lib/prisma';
import JsonLd from '@/components/seo/JsonLd';
import { fullProductName } from '@/lib/seo-config';

export const dynamic = 'force-dynamic';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://citybaddies.com';

export const metadata: Metadata = {
  title: 'Parfums de marque à moins de 50 € : la liste vérifiée',
  description:
    'Quels grands parfums (Chanel, Guerlain, Kenzo, Chloé…) trouve-t-on réellement sous 50 € ? Liste mise à jour à chaque relevé de prix, formats de 20 ml et plus uniquement.',
  alternates: { canonical: `${BASE_URL}/parfums-moins-de-50-euros` },
  openGraph: {
    title: 'Parfums de marque à moins de 50 € : la liste vérifiée',
    description: 'La liste vivante des vrais parfums sous 50 €, prix relevés 6 fois par jour.',
    url: `${BASE_URL}/parfums-moins-de-50-euros`,
    type: 'article',
  },
};

// FAQ visible + schema — réponses durables, aucun chiffre figé.
const FAQ = [
  {
    question: 'Peut-on vraiment avoir un parfum de marque pour moins de 50 € ?',
    answer:
      "Oui, à deux conditions : viser les formats 20 à 50 ml plutôt que les grands flacons, et acheter au bon moment — les enseignes font tourner leurs promotions en permanence. La liste ci-dessus ne montre que des offres réellement relevées sur les sites de Sephora, Nocibé et Marionnaud, avec la date du relevé.",
  },
  {
    question: 'Un petit format est-il un bon calcul ?',
    answer:
      "Au prix au millilitre, non : le grand flacon est presque toujours plus rentable. Mais le petit format a d'autres vertus — découvrir un parfum avant d'investir, varier sa collection, ou simplement respecter un budget. L'important est de payer ce petit format au meilleur prix, ce que cette liste permet de vérifier.",
  },
  {
    question: 'Pourquoi la liste change-t-elle régulièrement ?',
    answer:
      "Parce que les prix bougent : nos relevés tournent six fois par jour, et un parfum peut passer sous la barre des 50 € pendant une opération puis en ressortir. Chaque ligne indique l'enseigne et renvoie vers la fiche complète avec l'historique de prix.",
  },
  {
    question: 'Ces parfums pas chers sont-ils authentiques ?',
    answer:
      "Tous les prix listés proviennent exclusivement des sites officiels de Sephora, Nocibé et Marionnaud — des distributeurs agréés. Nous ne référençons ni marketplaces, ni revendeurs parallèles, où le risque de contrefaçon existe.",
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
    include: { merchant: true, product: true, variant: true },
    orderBy: { dealPrice: 'asc' },
  });

  // Une entrée par parfum : sa meilleure offre sous 50 €.
  const seen = new Set<string>();
  const rows: {
    slug: string; name: string; price: number; originalPrice: number;
    size: string; merchant: string; discount: number; lastSeenAt: Date | null;
  }[] = [];
  for (const d of deals) {
    if (seen.has(d.product.slug)) continue;
    seen.add(d.product.slug);
    rows.push({
      slug: d.product.slug,
      name: fullProductName(d.product.brand, d.product.name),
      price: d.dealPrice,
      originalPrice: d.originalPrice,
      size: `${d.variant!.volumeValue} ${d.variant!.volumeUnit}`,
      merchant: d.merchant.name,
      discount: d.discountPercent,
      lastSeenAt: d.lastSeenAt,
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
      name: `${r.name} ${r.size}`,
      url: `${BASE_URL}/produits/${r.slug}`,
    })),
  };

  return (
    <>
      <JsonLd id="under50-breadcrumb" data={breadcrumbSchema} />
      <JsonLd id="under50-list" data={listSchema} />
      <JsonLd id="under50-faq" data={faqSchema} />

      <div className="min-h-screen bg-[#0a0a0a] pt-28 pb-24">
        <div className="max-w-3xl mx-auto px-6">

          {/* Header */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-6">
              <span className="h-[1px] w-12 bg-[#d4a855]" />
              <span className="text-[#d4a855] text-xs font-bold tracking-[0.2em] uppercase">Budget maîtrisé</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-serif text-white leading-tight mb-6">
              Parfums de marque <span className="italic font-light">à moins de 50 €</span>
            </h1>
            <p className="text-neutral-400 font-light text-lg leading-relaxed">
              Pas de miniatures piège, pas de prix périmés : uniquement des flacons de{' '}
              <strong className="text-white font-medium">20 ml et plus</strong>, à des prix réellement relevés
              sur les sites de Sephora, Nocibé et Marionnaud. La liste se met à jour à chaque relevé.
            </p>
          </div>

          {/* Réponse directe — citable */}
          <div className="border-l-2 border-[#d4a855]/50 pl-5 py-2 mb-14">
            <p className="text-neutral-200 font-light leading-relaxed">
              {freshLabel ? `Au ${freshLabel}` : 'Actuellement'},{' '}
              <strong className="text-white font-medium">{rows.length} parfums de marque</strong> sont disponibles
              sous 50&nbsp;€ en format 20&nbsp;ml ou plus
              {rows[0] ? (
                <> — à partir de <strong className="text-white font-medium">{fmt(rows[0].price)}&nbsp;€</strong> pour {rows[0].name} ({rows[0].size}, chez {rows[0].merchant})</>
              ) : null}.
            </p>
          </div>

          {/* Liste vivante */}
          <section className="mb-16">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.25em] text-neutral-500 mb-6">
              La liste — du moins cher au plus cher
            </h2>
            <div className="flex flex-col divide-y divide-white/5 border-y border-white/10">
              {rows.map(r => (
                <Link
                  key={r.slug}
                  href={`/produits/${r.slug}`}
                  className="group flex items-center justify-between gap-4 py-4 hover:bg-white/[0.03] transition-colors px-2 -mx-2"
                >
                  <div className="min-w-0">
                    <span className="block text-white font-light text-sm sm:text-base truncate group-hover:text-[#d4a855] transition-colors">
                      {r.name}
                    </span>
                    <span className="block font-mono text-[10px] text-neutral-500 mt-1">
                      {r.size} · chez {r.merchant}
                      {r.discount > 0 ? ` · -${r.discount}%` : ''}
                    </span>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {r.originalPrice > r.price && (
                      <span className="block font-mono text-[10px] text-neutral-600 line-through">
                        {fmt(r.originalPrice)} €
                      </span>
                    )}
                    <span className="block text-white text-base sm:text-lg font-medium">{fmt(r.price)} €</span>
                  </div>
                </Link>
              ))}
            </div>
            <p className="font-mono text-[10px] text-neutral-600 mt-4 tracking-wide">
              Prix relevés six fois par jour sur les sites officiels des enseignes.{' '}
              <Link href="/methodologie" className="underline hover:text-neutral-400 transition-colors">Notre méthodologie</Link>
            </p>
          </section>

          {/* Édito durable */}
          <section className="mb-16 space-y-10 text-neutral-300 font-light leading-relaxed">
            <div>
              <h2 className="text-xl text-white font-medium mb-4">Le vrai secret : le format, pas la contrefaçon</h2>
              <p>
                Sous 50&nbsp;€, le marché regorge de pièges — décants douteux, marketplaces sans garantie,
                « testeurs » invérifiables. La voie sûre est ailleurs : les maisons déclinent presque toutes leurs
                parfums en 20, 30 ou 50&nbsp;ml, vendus par les mêmes enseignes agréées que les grands formats.
                Même jus, même concentration, flacon plus petit. C&apos;est cette réalité-là que la liste ci-dessus capture.
              </p>
            </div>
            <div>
              <h2 className="text-xl text-white font-medium mb-4">Eau de toilette : l&apos;option sous-estimée</h2>
              <p>
                À ligne identique, l&apos;eau de toilette coûte sensiblement moins cher que l&apos;eau de parfum. La
                concentration est plus légère, la tenue plus courte — mais pour un parfum de journée ou d&apos;été,
                c&apos;est souvent le meilleur rapport plaisir/prix du marché. Plusieurs entrées de la liste en sont la preuve.
              </p>
            </div>
            <div>
              <h2 className="text-xl text-white font-medium mb-4">Acheter au creux, pas au prix barré</h2>
              <p>
                Un « -30&nbsp;% » ne veut rien dire si le prix barré est artificiel. Avant d&apos;acheter, ouvrez la fiche
                du parfum : l&apos;historique montre si le prix du jour est réellement un creux ou juste un affichage.
                C&apos;est toute la différence entre une promo et une vraie affaire.
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
              Tous les parfums comparés
            </Link>
            <Link
              href="/sephora-vs-nocibe-vs-marionnaud"
              className="px-8 py-4 border border-white/20 text-white text-xs sm:text-sm font-bold tracking-widest uppercase hover:bg-white/5 transition-colors"
            >
              Quelle enseigne est la moins chère ?
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
