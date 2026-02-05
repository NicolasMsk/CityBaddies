import type { Metadata } from 'next';
import prisma from '@/lib/prisma';
import Link from 'next/link';
import DealCard from '@/components/deals/DealCard';
import DealsPageClient from './DealsPageClient';
import { ChevronLeft, ChevronRight, Package } from 'lucide-react';

// Force dynamic rendering pour avoir des données fraîches
export const dynamic = 'force-dynamic';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://citybaddies.com';
const DEALS_PER_PAGE = 24;

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

// Génération dynamique des métadonnées SEO
export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const params = await searchParams;
  const page = typeof params.page === 'string' ? parseInt(params.page, 10) : 1;
  
  const baseTitle = 'Tous les Deals Beauté | Promos Maquillage, Skincare & Parfums';
  const baseDescription = 'Découvrez tous les bons plans beauté du moment : maquillage, soins visage, parfums et plus encore. Jusqu\'à -70% sur Sephora, Nocibé et Marionnaud.';
  
  // Page 1 = indexable, pages suivantes = noindex pour éviter duplicate content
  const shouldIndex = page === 1;
  
  return {
    title: page > 1 ? `${baseTitle} - Page ${page}` : baseTitle,
    description: baseDescription,
    keywords: [
      'deals beauté',
      'bons plans maquillage',
      'promo skincare',
      'réduction parfum',
      'soldes cosmétiques',
      'offres sephora',
      'promo nocibé',
      'deals marionnaud',
    ],
    robots: shouldIndex 
      ? { index: true, follow: true } 
      : { index: false, follow: true }, // noindex pages 2+ mais follow les liens
    alternates: {
      canonical: page === 1 ? `${BASE_URL}/deals` : `${BASE_URL}/deals?page=${page}`,
    },
    openGraph: {
      title: 'Tous les Deals Beauté | City Baddies',
      description: 'Les meilleures promos beauté jusqu\'à -70%.',
      url: `${BASE_URL}/deals`,
      type: 'website',
    },
  };
}

// Récupérer les données avec pagination SSR
async function getDealsData(page: number) {
  const skip = (page - 1) * DEALS_PER_PAGE;
  
  // Récupérer les deals paginés + catégories + merchants + brands
  const [deals, totalDeals, categoriesRaw, merchantsRaw, brandsRaw] = await Promise.all([
    prisma.deal.findMany({
      where: {
        status: 'ACTIVE',
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
      skip,
      take: DEALS_PER_PAGE,
    }),
    prisma.deal.count({
      where: {
        status: 'ACTIVE',
      },
    }),
    // Catégories avec des deals actifs
    prisma.category.findMany({
      where: {
        products: {
          some: {
            deals: {
              some: {
                status: 'ACTIVE',
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    }),
    // Merchants avec des deals actifs
    prisma.merchant.findMany({
      where: {
        products: {
          some: {
            deals: {
              some: {
                status: 'ACTIVE',
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    }),
    // Brands uniques avec des deals actifs
    prisma.deal.findMany({
      where: {
        status: 'ACTIVE',
      },
      select: {
        product: {
          select: {
            brand: true,
          },
        },
      },
      distinct: ['productId'],
    }),
  ]);

  const totalPages = Math.ceil(totalDeals / DEALS_PER_PAGE);
  
  const categories = categoriesRaw.map(c => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    icon: c.icon ?? undefined,
    description: c.description ?? undefined,
  }));

  const merchants = merchantsRaw.map(m => ({
    id: String(m.id),
    name: m.name,
    slug: m.slug,
  }));

  // Extraire les marques uniques et les trier
  const uniqueBrands = [...new Set(brandsRaw.map(d => d.product.brand).filter((b): b is string => Boolean(b)))].sort();
  const brands = uniqueBrands.map(b => ({
    name: b,
    slug: b.toLowerCase().replace(/\s+/g, '-'),
  }));

  return {
    deals,
    totalDeals,
    totalPages,
    currentPage: page,
    categories,
    merchants,
    brands,
  };
}

// Générer l'URL de pagination
function getPageUrl(page: number): string {
  if (page === 1) return '/deals';
  return `/deals?page=${page}`;
}

export default async function DealsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = typeof params.page === 'string' ? Math.max(1, parseInt(params.page, 10)) : 1;
  
  const { deals, totalDeals, totalPages, currentPage, categories, merchants, brands } = await getDealsData(page);

  // Sérialiser les deals pour le client (dates -> strings)
  const serializedDeals = deals.map(deal => ({
    ...deal,
    createdAt: deal.createdAt.toISOString(),
    updatedAt: deal.updatedAt.toISOString(),
    lastSeenAt: deal.lastSeenAt?.toISOString() || null,
    product: {
      ...deal.product,
      createdAt: deal.product.createdAt.toISOString(),
      updatedAt: deal.product.updatedAt.toISOString(),
    },
  }));

  return (
    <div className="min-h-screen py-8 bg-[#0a0a0a]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header SEO avec H1 et contenu éditorial */}
        <header className="mb-20 text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold tracking-[0.3em] uppercase text-[#d4a855] mb-8 hover:bg-white/10 transition-colors cursor-default">
            <span className="w-1.5 h-1.5 rounded-full bg-[#d4a855]"></span>
            {totalDeals} Pépites Trouvées
          </div>

          <h1 className="text-5xl md:text-7xl font-thin tracking-tighter mb-8 text-white uppercase leading-[0.9]">
            Tous les <br/>
            <span className="font-normal italic text-white/40">Bons Plans</span>
          </h1>

          <div className="text-neutral-400 font-light text-lg md:text-xl leading-relaxed max-w-2xl mx-auto">
            <p className="mb-4">
              La collection complète de nos trouvailles chez <span className="text-white">Sephora, Nocibé et Marionnaud</span>.
            </p>
            <p className="text-base text-neutral-500">
              Chaque offre est vérifiée quotidiennement par notre équipe pour garantir sa validité.
              {page === 1 && ` Utilise les filtres pour affiner ta recherche.`}
            </p>
          </div>
        </header>

        {/* Composant client avec filtres interactifs */}
        <DealsPageClient
          initialDeals={serializedDeals}
          categories={categories}
          merchants={merchants}
          brands={brands}
          totalDeals={totalDeals}
          totalPages={totalPages}
          currentPage={currentPage}
        />

        {/* Liens SEO pour le maillage interne */}
        <div className="mt-16 border-t border-white/10 pt-8">
          <h2 className="text-xl font-semibold text-white mb-4">Explorer par catégorie</h2>
          <div className="flex flex-wrap gap-3">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/categories/${category.slug}`}
                className="px-4 py-2 rounded-full bg-[#1a1a1a] text-white/70 hover:bg-[#7b0a0a]/20 hover:text-white border border-white/10 transition-all"
              >
                {category.name}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
