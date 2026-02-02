import type { Metadata } from 'next';
import { Suspense } from 'react';
import prisma from '@/lib/prisma';
import DealsClientPage from './DealsClientPage';
import DealCardSkeleton from '@/components/deals/DealCardSkeleton';

// Force dynamic rendering pour avoir des données fraîches
export const dynamic = 'force-dynamic';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://citybaddies.com';

// Métadonnées SEO statiques pour la page /deals
export const metadata: Metadata = {
  title: 'Tous les Deals Beauté | Promos Maquillage, Skincare & Parfums',
  description: 'Découvrez tous les bons plans beauté du moment : maquillage, soins visage, parfums et plus encore. Jusqu\'à -70% sur Sephora, Nocibé et Marionnaud. Deals vérifiés et mis à jour quotidiennement.',
  keywords: [
    'deals beauté',
    'bons plans maquillage',
    'promo skincare',
    'réduction parfum',
    'soldes cosmétiques',
    'offres sephora',
    'promo nocibé',
    'deals marionnaud',
    'maquillage pas cher',
    'soins visage promotion',
  ],
  alternates: {
    canonical: `${BASE_URL}/deals`,
  },
  openGraph: {
    title: 'Tous les Deals Beauté | City Baddies',
    description: 'Les meilleures promos beauté jusqu\'à -70%. Maquillage, skincare, parfums - offres vérifiées quotidiennement.',
    url: `${BASE_URL}/deals`,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tous les Deals Beauté | City Baddies',
    description: 'Les meilleures promos beauté jusqu\'à -70%.',
  },
};

// Récupérer les données initiales côté serveur
async function getInitialData() {
  // Récupérer TOUS les deals actifs pour le SEO
  const deals = await prisma.deal.findMany({
    where: {
      isActive: true,
      isExpired: false,
    },
    include: {
      product: {
        include: {
          category: true,
          merchant: true,
        },
      },
    },
    orderBy: [
      { createdAt: 'desc' },
    ],
    // Pas de take: pour charger tous les deals
  });

  // Le total = nombre de deals retournés
  const totalDeals = deals.length;

  // Récupérer les catégories avec des deals actifs
  const categoriesRaw = await prisma.category.findMany({
    where: {
      products: {
        some: {
          deals: {
            some: {
              isActive: true,
              isExpired: false,
            },
          },
        },
      },
    },
    orderBy: { name: 'asc' },
  });
  
  // Transformer pour correspondre au type Category (null -> undefined)
  const categories = categoriesRaw.map(c => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    icon: c.icon ?? undefined,
    description: c.description ?? undefined,
  }));

  // Récupérer les marchands
  const merchants = await prisma.merchant.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
    },
    orderBy: { name: 'asc' },
  });

  // Récupérer les marques distinctes
  const brandsRaw = await prisma.product.findMany({
    where: {
      brand: { not: null },
      deals: {
        some: {
          isActive: true,
          isExpired: false,
        },
      },
    },
    select: {
      brand: true,
    },
    distinct: ['brand'],
    orderBy: { brand: 'asc' },
  });

  const brands = brandsRaw
    .filter((b): b is { brand: string } => b.brand !== null)
    .map(b => ({
      name: b.brand,
      slug: b.brand.toLowerCase().replace(/\s+/g, '-'),
    }));

  return {
    deals,
    totalDeals,
    categories,
    merchants,
    brands,
  };
}

// Skeleton de chargement pour Suspense
function DealsLoadingSkeleton() {
  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: 12 }).map((_, i) => (
        <DealCardSkeleton key={i} />
      ))}
    </div>
  );
}

export default async function DealsPage() {
  const { deals, totalDeals, categories, merchants, brands } = await getInitialData();

  return (
    <div className="min-h-screen py-8 bg-[#0a0a0a]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header SEO avec H1 et contenu éditorial */}
        <header className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Tous les Deals Beauté
          </h1>
          <div className="text-white/70 space-y-3 max-w-3xl">
            <p>
              Bienvenue dans notre sélection complète de <strong>bons plans beauté</strong> ! 
              Chez City Baddies, on traque pour toi les meilleures <strong>promotions maquillage</strong>, 
              <strong> soins visage</strong>, <strong>parfums</strong> et <strong>cosmétiques</strong> chez 
              Sephora, Nocibé et Marionnaud. Chaque deal est vérifié quotidiennement pour te garantir 
              des réductions réelles allant jusqu&apos;à -70%.
            </p>
            <p className="text-white/50">
              Utilise les filtres ci-dessous pour affiner ta recherche par catégorie, marque, 
              enseigne ou fourchette de prix. Tu peux aussi trier par pourcentage de réduction 
              ou par date pour ne rien rater des dernières pépites. {totalDeals} deals t&apos;attendent ! 💅
            </p>
          </div>
        </header>

        {/* Client Component avec les filtres et deals */}
        <Suspense fallback={<DealsLoadingSkeleton />}>
          <DealsClientPage
            initialDeals={deals as any}
            initialCategories={categories}
            initialMerchants={merchants}
            initialBrands={brands}
            initialTotal={totalDeals}
          />
        </Suspense>
      </div>
    </div>
  );
}
