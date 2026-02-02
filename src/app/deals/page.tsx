import type { Metadata } from 'next';
import prisma from '@/lib/prisma';
import Link from 'next/link';
import DealCard from '@/components/deals/DealCard';
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
  
  // Récupérer les deals paginés
  const [deals, totalDeals] = await Promise.all([
    prisma.deal.findMany({
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
      skip,
      take: DEALS_PER_PAGE,
    }),
    prisma.deal.count({
      where: {
        isActive: true,
        isExpired: false,
      },
    }),
  ]);

  const totalPages = Math.ceil(totalDeals / DEALS_PER_PAGE);

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
  
  const categories = categoriesRaw.map(c => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    icon: c.icon ?? undefined,
    description: c.description ?? undefined,
  }));

  return {
    deals,
    totalDeals,
    totalPages,
    currentPage: page,
    categories,
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
  
  const { deals, totalDeals, totalPages, currentPage, categories } = await getDealsData(page);

  return (
    <div className="min-h-screen py-8 bg-[#0a0a0a]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header SEO avec H1 et contenu éditorial */}
        <header className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Tous les Deals Beauté
            {page > 1 && <span className="text-white/50 text-2xl ml-2">- Page {page}</span>}
          </h1>
          <div className="text-white/70 space-y-3 max-w-3xl">
            <p>
              Bienvenue dans notre sélection complète de <strong>bons plans beauté</strong> ! 
              Chez City Baddies, on traque pour toi les meilleures <strong>promotions maquillage</strong>, 
              <strong> soins visage</strong>, <strong>parfums</strong> et <strong>cosmétiques</strong> chez 
              Sephora, Nocibé et Marionnaud. Chaque deal est vérifié quotidiennement pour te garantir 
              des réductions réelles allant jusqu&apos;à -70%.
            </p>
            {page === 1 && (
              <p className="text-white/50">
                Utilise les filtres ci-dessous pour affiner ta recherche par catégorie, marque, 
                enseigne ou fourchette de prix. {totalDeals} deals t&apos;attendent ! 💅
              </p>
            )}
          </div>
        </header>

        {/* Résultats */}
        <p className="text-white/40 text-sm mb-4">
          {totalDeals} résultat{totalDeals > 1 ? 's' : ''} 
          {totalPages > 1 && ` • Page ${currentPage} sur ${totalPages}`}
        </p>

        {deals.length > 0 ? (
          <>
            {/* Grille de deals */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {deals.map((deal) => (
                <DealCard key={deal.id} deal={deal as any} />
              ))}
            </div>

            {/* Pagination SSR avec vrais liens crawlables */}
            {totalPages > 1 && (
              <nav aria-label="Pagination des deals" className="flex items-center justify-center gap-2 mt-12">
                {/* Previous Link - VRAI LIEN CRAWLABLE */}
                {currentPage > 1 ? (
                  <Link
                    href={getPageUrl(currentPage - 1)}
                    className="flex items-center gap-1 px-4 py-2 rounded-xl transition-all bg-[#1a1a1a] text-white/60 hover:bg-[#7b0a0a]/20 hover:text-white border border-white/10"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Précédent
                  </Link>
                ) : (
                  <span className="flex items-center gap-1 px-4 py-2 rounded-xl bg-white/5 text-white/20 cursor-not-allowed">
                    <ChevronLeft className="h-4 w-4" />
                    Précédent
                  </span>
                )}

                {/* Page Numbers - VRAIS LIENS CRAWLABLES */}
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(pageNum => {
                      return (
                        pageNum === 1 ||
                        pageNum === totalPages ||
                        Math.abs(pageNum - currentPage) <= 2
                      );
                    })
                    .map((pageNum, index, array) => {
                      const prevPage = array[index - 1];
                      const showEllipsis = prevPage && pageNum - prevPage > 1;

                      return (
                        <div key={pageNum} className="flex items-center">
                          {showEllipsis && (
                            <span className="px-2 text-white/30">...</span>
                          )}
                          {pageNum === currentPage ? (
                            <span
                              aria-current="page"
                              className="w-10 h-10 rounded-xl font-medium flex items-center justify-center bg-[#7b0a0a] text-white"
                            >
                              {pageNum}
                            </span>
                          ) : (
                            <Link
                              href={getPageUrl(pageNum)}
                              className="w-10 h-10 rounded-xl font-medium flex items-center justify-center transition-all bg-[#1a1a1a] text-white/60 hover:bg-[#7b0a0a]/20 hover:text-white border border-white/10"
                            >
                              {pageNum}
                            </Link>
                          )}
                        </div>
                      );
                    })}
                </div>

                {/* Next Link - VRAI LIEN CRAWLABLE */}
                {currentPage < totalPages ? (
                  <Link
                    href={getPageUrl(currentPage + 1)}
                    className="flex items-center gap-1 px-4 py-2 rounded-xl transition-all bg-[#1a1a1a] text-white/60 hover:bg-[#7b0a0a]/20 hover:text-white border border-white/10"
                  >
                    Suivant
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                ) : (
                  <span className="flex items-center gap-1 px-4 py-2 rounded-xl bg-white/5 text-white/20 cursor-not-allowed">
                    Suivant
                    <ChevronRight className="h-4 w-4" />
                  </span>
                )}
              </nav>
            )}

            {/* Liens SEO supplémentaires pour le maillage interne */}
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
          </>
        ) : (
          <div className="text-center py-20">
            <Package className="h-16 w-16 text-[#7b0a0a]/50 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Aucun deal disponible</h2>
            <p className="text-white/40">
              Reviens plus tard, on cherche toujours de nouvelles pépites !
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
