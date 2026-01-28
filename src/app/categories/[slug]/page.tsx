import prisma from '@/lib/prisma';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight } from 'lucide-react';
import DealCard from '@/components/deals/DealCard';
import { Deal } from '@/types';

export const dynamic = 'force-dynamic';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://citybaddies.com';

// Descriptions SEO enrichies par catégorie
const CATEGORY_CONTENT: Record<string, {
  heroTitle: string;
  heroDescription: string;
  seoDescription: string;
  keywords: string[];
  tips: string[];
}> = {
  'maquillage': {
    heroTitle: 'Les Meilleurs Deals Maquillage',
    heroDescription: 'Découvrez les promotions exceptionnelles sur vos produits de maquillage préférés. Fonds de teint, rouges à lèvres, mascaras et palettes des plus grandes marques à prix réduit.',
    seoDescription: 'Promotions maquillage jusqu\'à -70% : fonds de teint, rouges à lèvres, mascaras, palettes. MAC, Charlotte Tilbury, NARS, Urban Decay. Deals vérifiés quotidiennement.',
    keywords: ['maquillage pas cher', 'fond de teint promo', 'rouge à lèvres deal', 'mascara réduction', 'palette maquillage soldes'],
    tips: [
      'Les palettes de fards de grandes marques (Urban Decay, Huda Beauty) sont souvent soldées à -30% ou -40% juste avant la sortie d\'une nouvelle collection "hype". C\'est le moment idéal pour craquer.',
      'Pour les fonds de teint luxe (Dior, Estée Lauder), surveillez le prix au millilitre. Parfois, un flacon standard en promo est plus avantageux qu\'un coffret qui semble alléchant mais contient peu de produit.',
      'Les coffrets "valeur réelle" sont les vraies pépites du maquillage. Ils offrent souvent 3 ou 4 produits "full size" pour le prix de deux. Idéal pour se refaire une trousse complète à moindre coût.',
    ],
  },
  'soins-visage': {
    heroTitle: 'Deals Soins Visage & Skincare',
    heroDescription: 'Crèmes hydratantes, sérums anti-âge, nettoyants et masques des meilleures marques dermatologiques. Prenez soin de votre peau sans vous ruiner.',
    seoDescription: 'Promotions skincare et soins visage : La Roche-Posay, Caudalie, Estée Lauder, Lancôme. Crèmes, sérums, masques jusqu\'à -60%. Deals mis à jour chaque jour.',
    keywords: ['soin visage pas cher', 'crème hydratante promo', 'sérum anti-âge deal', 'skincare réduction', 'masque visage soldes'],
    tips: [
      'Dans la skincare, les sérums actifs (rétinol, vitamine C) sont les produits les plus chers. Privilégiez l\'achat de ces produits lors des "Beauty Days" ou soldes pour maximiser l\'économie réelle.',
      'Ne négligez pas les marques de parapharmacie (La Roche-Posay, CeraVe) qui offrent souvent des formats "familiaux" de 400ml ou plus. Le coût par utilisation devient dérisoire comparé aux marques de luxe.',
      'Les calendriers de l\'avent ou coffrets "routine complète" permettent de tester des routines de luxe (comme Lancôme ou Estée Lauder) pour une fraction du prix. Parfait pour savoir si la gamme vous convient avant d\'investir.',
    ],
  },
  'soins-corps': {
    heroTitle: 'Promotions Soins Corps',
    heroDescription: 'Laits corporels, huiles, gommages et soins minceur. Chouchoutez votre corps avec les meilleures marques à prix doux.',
    seoDescription: 'Deals soins corps : laits, huiles, gommages, soins minceur. Nuxe, Clarins, Rituals. Jusqu\'à -50% sur les soins corporels. Offres vérifiées.',
    keywords: ['soin corps pas cher', 'huile corps promo', 'gommage deal', 'lait corporel réduction', 'soin minceur soldes'],
    tips: [
      'Les huiles sèches (type Nuxe) sont des produits multi-fonctions (corps, visage, cheveux). En acheter une grande bouteille en promo remplace souvent trois produits distincts dans votre salle de bain.',
      'Pour les gommages et laits corps quotidens, visez les gros conditionnements (500ml et plus). Nocibé et Marionnaud font souvent des offres "2 pour le prix d\'1" sur ces catégories.',
      'Les coffrets soins corps sont souvent bradés juste après les fêtes (janvier) et la fête des mères (juin). C\'est le moment de faire votre stock pour l\'année.',
    ],
  },
  'cheveux': {
    heroTitle: 'Deals Soins Cheveux',
    heroDescription: 'Shampoings, après-shampoings, masques capillaires et soins sans rinçage. Des cheveux sublimes grâce aux meilleures promos.',
    seoDescription: 'Promotions cheveux : shampoings, masques, soins Kérastase, Olaplex, Moroccanoil. Jusqu\'à -40% sur les soins capillaires premium.',
    keywords: ['shampoing pas cher', 'masque cheveux promo', 'soin capillaire deal', 'après-shampoing réduction', 'Kérastase soldes'],
    tips: [
      'Les masques capillaires professionnels (Kérastase, L\'Oréal Pro) s\'achètent en pots de 500ml sur les sites spécialisés ou lors de grosses promos. C\'est 50% moins cher au litre que les petits pots.',
      'Méfiez-vous des shampoings de "luxe" vendus sans réduction. Attendez toujours une offre -25% ou -30%, car ce sont des produits à forte marge qui sont très régulièrement soldés.',
      'Les duos "Shampoing + Après-shampoing" sont souvent vendus en bundle promo. C\'est le meilleur moyen d\'avoir la gamme complète Olaplex ou Redken sans payer le prix fort.',
    ],
  },
  'parfums': {
    heroTitle: 'Les Meilleurs Deals Parfums',
    heroDescription: 'Eaux de parfum, eaux de toilette et coffrets parfumés des plus grandes maisons. Trouvez votre signature olfactive à prix réduit.',
    seoDescription: 'Promotions parfums : Chanel, Dior, YSL, Guerlain. Eaux de parfum et coffrets jusqu\'à -50%. Deals parfumerie vérifiés quotidiennement.',
    keywords: ['parfum pas cher', 'eau de parfum promo', 'coffret parfum deal', 'parfum femme réduction', 'parfum homme soldes'],
    tips: [
      'Attention au piège des 30ml : proportionnellement, ils sont hors de prix. Visez toujours les 100ml (ou plus) en promo pour un vrai rapport qualité-prix. Un flacon peut durer plus d\'un an.',
      'La différence de tenue entre Eau de Toilette et Eau de Parfum est réelle. Une EDP coûte plus cher à l\'achat mais vous en mettez moins. Sur la durée, c\'est souvent le meilleur investissement.',
      'Les coffrets de Noël (parfum + lait corps + miniature) sont souvent soldés à -50% dès janvier. C\'est l\'astuce ultime pour avoir votre parfum préféré à moitié prix avec des bonus.',
    ],
  },
  'ongles': {
    heroTitle: 'Deals Vernis & Nail Art',
    heroDescription: 'Vernis à ongles, gels UV, soins des ongles et accessoires nail art. Des ongles parfaits à petit prix.',
    seoDescription: 'Promotions vernis et nail art : OPI, Essie, Manucurist. Vernis, gels, soins ongles jusqu\'à -40%. Deals beauté des ongles.',
    keywords: ['vernis pas cher', 'gel UV promo', 'nail art deal', 'soin ongles réduction', 'OPI soldes'],
    tips: [
      'Pour varier les plaisirs sans se ruiner, les mini-kits OPI ou Essie sont géniaux. Ils permettent d\'avoir 4 couleurs tendances pour le prix d\'un grand flacon que vous ne finirez jamais.',
      'Une manucure qui dure commence par une bonne base et un bon top coat. Investissez dans du pro (Manucurist, OPI) en promo, et utilisez des vernis couleur plus abordables.',
      'Les lampes LED et kits semi-permanents sont souvent en vente flash. C\'est un investissement rentabilisé en 2 manucures "maison" comparé au prix en institut.',
    ],
  },
  'accessoires': {
    heroTitle: 'Accessoires Beauté en Promo',
    heroDescription: 'Pinceaux, éponges, trousses et miroirs. Tous les accessoires indispensables pour votre routine beauté.',
    seoDescription: 'Deals accessoires beauté : pinceaux, beauty blenders, trousses, miroirs. Jusqu\'à -60% sur les accessoires maquillage et soins.',
    keywords: ['pinceau maquillage pas cher', 'beauty blender promo', 'trousse beauté deal', 'miroir grossissant réduction'],
    tips: [
      'Un bon set de pinceaux (Zoeva, Real Techniques) dure des années. N\'achetez jamais de pinceaux à l\'unité au prix fort, les kits complets sont mathématiquement beaucoup plus rentables.',
      'Les éponges type Beauty Blender doivent être changées régulièrement pour l\'hygiène. Profitez des offres "Multipack" pour en acheter 2 ou 3 d\'un coup et réduire le coût unitaire.',
      'Les accessoires "tech" (brosses nettoyantes, miroirs LED) sont souvent fortement remisés pendant le Black Friday ou les French Days. C\'est le seul moment "intelligent" pour les acheter.',
    ],
  },
};

// Génération des métadonnées dynamiques
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const category = await prisma.category.findUnique({
    where: { slug },
  });

  if (!category) {
    return {
      title: 'Catégorie non trouvée',
    };
  }

  const content = CATEGORY_CONTENT[slug] || {
    seoDescription: `Découvrez les meilleurs deals ${category.name} avec des réductions jusqu'à -70%.`,
    keywords: [`${category.name} pas cher`, `${category.name} promo`],
  };

  return {
    title: `Deals ${category.name} | Promotions jusqu'à -70%`,
    description: content.seoDescription,
    keywords: content.keywords,
    alternates: {
      canonical: `${BASE_URL}/categories/${slug}`,
    },
    openGraph: {
      title: `Deals ${category.name} | City Baddies`,
      description: content.seoDescription,
      url: `${BASE_URL}/categories/${slug}`,
      type: 'website',
    },
  };
}

// Récupérer les deals de la catégorie
async function getCategoryDeals(slug: string) {
  const category = await prisma.category.findUnique({
    where: { slug },
  });

  if (!category) return null;

  // Récupérer les deals de cette catégorie
  const rawDeals = await (prisma.deal as any).findMany({
    where: {
      isExpired: false,
      score: { gte: 50 },
      product: {
        categoryId: category.id,
      },
    },
    include: {
      product: {
        include: {
          brandRef: true,
          merchant: true,
          category: true,
        },
      },
    },
    orderBy: {
      score: 'desc',
    },
  });

  // Transformer les données pour correspondre au type Deal
  const deals: Deal[] = rawDeals.map((d: any) => ({
    id: d.id,
    product: {
      id: d.product.id,
      name: d.product.name,
      slug: d.product.slug,
      imageUrl: d.product.imageUrl,
      brand: d.product.brandRef?.name || d.product.brand,
      category: d.product.category,
      merchant: d.product.merchant,
      productUrl: d.product.productUrl,
      currentPrice: d.dealPrice,
    },
    title: d.title || d.product.name,
    refinedTitle: d.refinedTitle,
    dealPrice: d.dealPrice,
    originalPrice: d.originalPrice,
    discountPercent: d.discountPercent,
    discountAmount: d.originalPrice - d.dealPrice,
    volume: d.volume,
    volumeValue: d.volumeValue,
    volumeUnit: d.volumeUnit,
    pricePerUnit: d.pricePerUnit,
    score: d.score,
    tags: d.tags,
    promoCode: d.promoCode,
    startDate: d.startDate?.toISOString() || new Date().toISOString(),
    endDate: d.endDate?.toISOString(),
    isHot: d.isHot || false,
    isExpired: d.isExpired || false,
    votes: d.votes || 0,
    views: d.views || 0,
    createdAt: d.createdAt?.toISOString() || new Date().toISOString(),
  }));

  return { category, deals };
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getCategoryDeals(slug);

  if (!data) {
    notFound();
  }

  const { category, deals } = data;
  const topDeals = deals.slice(0, 6);
  const content = CATEGORY_CONTENT[slug];

  // Compter les deals actifs
  const totalDeals = deals.length;

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Hero Section */}
        <div className="relative mb-16 pt-10 pb-8 border-b border-white/5">
          <div className="relative z-10">
            <div className="flex items-center gap-2 text-bordeaux-400 mb-6">
              <span className="text-xs font-semibold uppercase tracking-[0.2em]">Catégorie</span>
            </div>
            <h1 className="text-5xl md:text-6xl font-light text-white mb-6 tracking-tight">
              {content?.heroTitle || `Deals ${category.name}`}
            </h1>
            <p className="text-xl text-slate-400 max-w-2xl font-light leading-relaxed">
              {content?.heroDescription || `Découvrez les meilleures promotions ${category.name} du moment.`}
            </p>
          </div>
        </div>

        {/* Top Deals Section */}
        {topDeals.length > 0 && (
          <section className="mb-20">
            <div className="flex items-end justify-between mb-8 border-b border-white/5 pb-4">
              <h2 className="text-3xl font-light text-white">
                Top Deals
              </h2>
              <Link 
                href={`/deals?category=${slug}`}
                className="text-white hover:text-bordeaux-400 transition-colors flex items-center gap-2 text-sm font-medium uppercase tracking-wider"
              >
                Voir tout
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {topDeals.map((deal) => (
                <DealCard key={deal.id} deal={deal} />
              ))}
            </div>
          </section>
        )}

        {/* Tips Section */}
        {content?.tips && content.tips.length > 0 && (
          <section className="mb-20 bg-[#1a1a1a]/50 p-8 md:p-12">
            <h2 className="text-2xl font-light text-white mb-8 border-l-2 border-bordeaux-500 pl-4">
              Conseils d'expert
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
              {content.tips.map((tip, index) => (
                <div key={index} className="space-y-3">
                  <span className="text-bordeaux-500 font-serif italic text-4xl opacity-50">0{index + 1}</span>
                  <p className="text-slate-300 text-sm leading-relaxed font-light">{tip}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* CTA Section */}
        <section className="text-center py-24 border-t border-white/5">
          <h2 className="text-3xl font-light text-white mb-6">
            Plus de deals {category.name}
          </h2>
          <p className="text-slate-400 mb-10 max-w-2xl mx-auto font-light leading-relaxed">
            Nous comparons quotidiennement les offres de Sephora, Nocibé et Marionnaud pour vous garantir les meilleurs prix sur vos produits {category.name.toLowerCase()} favoris.
          </p>
          <Link
            href={`/deals?category=${slug}`}
            className="inline-flex items-center gap-3 px-8 py-3 bg-white text-black text-sm font-bold uppercase tracking-wider hover:bg-slate-200 transition-colors"
          >
            Voir les {totalDeals} offres
            <ArrowRight className="h-4 w-4" />
          </Link>
        </section>

        {/* SEO Text */}
        <section className="mt-20 prose prose-invert prose-lg max-w-none prose-headings:font-light prose-headings:text-white prose-p:text-slate-400 prose-p:font-light prose-a:text-white">
          <h2 className="!text-2xl mb-6">
            Acheter {category.name} moins cher
          </h2>
          <p className="leading-relaxed">
            City Baddies compare chaque jour les prix des produits {category.name.toLowerCase()} chez les principales enseignes beauté françaises. 
            Notre algorithme détecte automatiquement les promotions et calcule le meilleur rapport qualité-prix.
          </p>
          <p className="leading-relaxed mt-4">
            Les deals sont mis à jour en temps réel. Inscrivez-vous à notre newsletter pour ne manquer aucune offre exclusive.
          </p>
        </section>

      </div>
    </div>
  );
}
