import type { Metadata } from 'next';
import Link from 'next/link';
import prisma from '@/lib/prisma';
import JsonLd from '@/components/seo/JsonLd';

// ISR : page mise en cache et régénérée toutes les 3600s (stats globales).
// Le force-dynamic historique imposait des requêtes DB à CHAQUE visite (TTFB/CWV).
export const revalidate = 3600;

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://citybaddies.com';

export const metadata: Metadata = {
  title: 'Méthodologie — Comment on relève les prix',
  description:
    'Comment City Baddies relève les prix des parfums chez Sephora, Nocibé et Marionnaud : fréquence des relevés, archivage daté, comparaison à taille égale, indépendance.',
  alternates: { canonical: `${BASE_URL}/methodologie` },
  openGraph: {
    title: 'Méthodologie City Baddies — Comment on relève les prix',
    description: 'Fréquence des relevés, archivage daté, comparaison à taille égale, indépendance.',
    url: `${BASE_URL}/methodologie`,
    type: 'website',
  },
};

async function getStats() {
  const [products, variants, releves, merchants] = await Promise.all([
    prisma.product.count({ where: { deals: { some: { status: 'ACTIVE', type: 'tracked' } } } }),
    prisma.deal.count({ where: { status: 'ACTIVE', type: 'tracked' } }),
    prisma.priceHistory.count(),
    prisma.merchant.count(),
  ]);
  return { products, variants, releves, merchants };
}

export default async function MethodologiePage() {
  const stats = await getStats();
  const today = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());

  const pageSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Méthodologie — Comment City Baddies relève les prix',
    url: `${BASE_URL}/methodologie`,
    description:
      'Méthodologie de relevé de prix de City Baddies : six relevés par jour sur les fiches produit publiques de Sephora, Nocibé et Marionnaud, archivés et datés, comparés à taille égale.',
    publisher: { '@type': 'Organization', name: 'City Baddies', url: BASE_URL },
  };

  return (
    <>
      <JsonLd id="methodologie-schema" data={pageSchema} />
      <div className="min-h-screen bg-[#0a0a0a] pt-28 pb-24">
        <div className="max-w-3xl mx-auto px-6">
          {/* Header */}
          <div className="mb-14">
            <div className="flex items-center gap-3 mb-6">
              <span className="h-[1px] w-12 bg-[#d4a855]" />
              <span className="text-[#d4a855] text-xs font-bold tracking-[0.2em] uppercase">Méthodologie</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-serif text-white leading-tight mb-6">
              Comment on relève <span className="italic font-light">les prix</span>
            </h1>
            <p className="font-mono text-xs text-neutral-500 tracking-wide">
              {stats.products} parfums · {stats.variants} offres suivies · {stats.releves.toLocaleString('fr-FR')} relevés archivés — au {today}
            </p>
          </div>

          {/* Corps — server-rendered, citable */}
          <div className="space-y-12 text-neutral-300 font-light leading-relaxed">
            <section>
              <h2 className="text-xl text-white font-medium mb-4">1. Six relevés par jour, sur les fiches publiques</h2>
              <p>
                Chaque matin, puis cinq autres fois dans la journée, nous relevons les prix affichés sur les fiches produit
                publiques de <strong className="text-white font-medium">Sephora.fr, Nocibé.fr et Marionnaud.fr</strong>.
                Nous relevons chaque contenance séparément (30&nbsp;ml, 50&nbsp;ml, 100&nbsp;ml…), car un « à partir de »
                ne dit rien du format que vous achetez réellement.
              </p>
            </section>

            <section>
              <h2 className="text-xl text-white font-medium mb-4">2. Chaque relevé est daté et archivé</h2>
              <p>
                Un prix barré ne prouve rien. Un historique, si. Chaque relevé est horodaté et conservé : c&apos;est ce qui
                nous permet d&apos;afficher l&apos;évolution du prix d&apos;un parfum sur plusieurs mois, et de dire si un
                «&nbsp;-30&nbsp;%&nbsp;» est une vraie baisse ou un prix barré marketing. Sur chaque fiche, la mention
                «&nbsp;relevé il y a X&nbsp;h&nbsp;» indique la fraîcheur exacte de chaque offre.
              </p>
            </section>

            <section>
              <h2 className="text-xl text-white font-medium mb-4">3. Comparaison à taille égale uniquement</h2>
              <p>
                Comparer un 30&nbsp;ml Nocibé à un 100&nbsp;ml Sephora n&apos;a aucun sens. Nos comparaisons se font
                toujours <strong className="text-white font-medium">à contenance identique</strong>, identifiée par le
                code-barres (EAN) du produit quand il est disponible — la garantie que c&apos;est bien le même flacon,
                pas un dérivé ou un coffret.
              </p>
            </section>

            <section>
              <h2 className="text-xl text-white font-medium mb-4">4. Toutes les offres, pas seulement les bonnes</h2>
              <p>
                Nous affichons toutes les offres relevées, y compris les moins intéressantes. Si une enseigne est plus
                chère, ça se voit. Si une «&nbsp;promo&nbsp;» n&apos;en est pas une, l&apos;historique le montre. Nous ne
                vendons rien : l&apos;achat se fait sur le site officiel du marchand.
              </p>
            </section>

            <section>
              <h2 className="text-xl text-white font-medium mb-4">5. Indépendance et rémunération</h2>
              <p>
                City Baddies est gratuit et indépendant. Nous percevons une commission d&apos;affiliation quand vous
                achetez via nos liens, sans surcoût pour vous. Cette commission n&apos;influence ni l&apos;ordre
                d&apos;affichage des offres (toujours trié du prix le plus bas au plus haut), ni nos relevés.
              </p>
            </section>

            <section className="border-t border-white/10 pt-8">
              <h2 className="text-xl text-white font-medium mb-4">Limites connues</h2>
              <p className="text-neutral-400">
                Les prix peuvent changer entre deux relevés — la date affichée sur chaque offre fait foi. Certaines
                références n&apos;existent pas chez les trois enseignes ; nous n&apos;inventons jamais une correspondance
                approximative (un dérivé ou flanker n&apos;est pas le même parfum).
              </p>
            </section>
          </div>

          {/* CTA */}
          <div className="mt-16 pt-8 border-t border-white/10 flex flex-wrap gap-4">
            <Link
              href="/produits"
              className="px-8 py-4 bg-white text-black text-sm font-bold tracking-widest uppercase hover:bg-neutral-200 transition-colors"
            >
              Voir les comparaisons
            </Link>
            <Link
              href="/about"
              className="px-8 py-4 border border-white/20 text-white text-sm font-bold tracking-widest uppercase hover:bg-white/5 transition-colors"
            >
              Qui sommes-nous
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
