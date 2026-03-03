'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import DealCard from '@/components/deals/DealCard';
import DealFilters, { FilterState } from '@/components/deals/DealFilters';
import { ChevronLeft, ChevronRight, Package } from 'lucide-react';
import { Category } from '@/types';

interface SimpleMerchant { id: string; name: string; slug: string; }
interface SimpleBrand { name: string; slug: string; }

interface ProduitsPageClientProps {
  initialDeals: any[];
  categories: Category[];
  merchants: SimpleMerchant[];
  brands: SimpleBrand[];
  totalProducts: number;
  totalPages: number;
  currentPage: number;
  initialFilters: {
    categories?: string[];
    subcategories?: string[];
    subsubcategories?: string[];
    merchants?: string[];
    brands?: string[];
    tags?: string[];
    search?: string;
    sortBy?: string;
    sortOrder?: string;
    hotOnly?: boolean;
    minPrice?: number;
    maxPrice?: number;
  };
}

// Construire l'URL avec les filtres actifs
function buildUrl(filters: FilterState, page?: number): string {
  const params = new URLSearchParams();

  if (page && page > 1) params.set('page', String(page));
  if (filters.categories.length > 0) params.set('category', filters.categories.join(','));
  if (filters.subcategories.length > 0) params.set('subcategory', filters.subcategories.join(','));
  if (filters.subsubcategories.length > 0) params.set('subsubcategory', filters.subsubcategories.join(','));
  if (filters.merchants.length > 0) params.set('merchant', filters.merchants.join(','));
  if (filters.brands.length > 0) params.set('brand', filters.brands.join(','));
  if (filters.tags.length > 0) params.set('tag', filters.tags.join(','));
  if (filters.search) params.set('search', filters.search);
  if (filters.sortBy && filters.sortBy !== 'score') params.set('sortBy', filters.sortBy);
  if (filters.sortOrder && filters.sortOrder !== 'desc') params.set('sortOrder', filters.sortOrder);
  if (filters.hotOnly) params.set('hot', 'true');
  if (filters.minPrice !== undefined) params.set('minPrice', String(filters.minPrice));
  if (filters.maxPrice !== undefined) params.set('maxPrice', String(filters.maxPrice));

  const qs = params.toString();
  return qs ? `/produits?${qs}` : '/produits';
}

export default function ProduitsPageClient({
  initialDeals,
  categories,
  merchants,
  brands,
  totalProducts,
  totalPages,
  currentPage,
  initialFilters,
}: ProduitsPageClientProps) {
  const router = useRouter();

  const currentFilters: FilterState = {
    categories: initialFilters.categories || [],
    subcategories: initialFilters.subcategories || [],
    subsubcategories: initialFilters.subsubcategories || [],
    merchants: initialFilters.merchants || [],
    brands: initialFilters.brands || [],
    tags: initialFilters.tags || [],
    search: initialFilters.search || '',
    sortBy: initialFilters.sortBy || 'score',
    sortOrder: (initialFilters.sortOrder as 'asc' | 'desc') || 'desc',
    hotOnly: initialFilters.hotOnly || false,
    minPrice: initialFilters.minPrice,
    maxPrice: initialFilters.maxPrice,
  };

  const handleFilterChange = useCallback((newFilters: FilterState) => {
    const url = buildUrl(newFilters, 1);
    router.push(url);
  }, [router]);

  const handlePageChange = useCallback((newPage: number) => {
    const url = buildUrl(currentFilters, newPage);
    router.push(url);
  }, [router, currentFilters]);

  return (
    <>
      {/* Filtres */}
      <DealFilters
        categories={categories}
        merchants={merchants}
        brands={brands}
        onFilterChange={handleFilterChange}
        currentFilters={currentFilters}
      />

      {/* Résultats */}
      <p className="text-white/40 text-sm mb-4 mt-6">
        {totalProducts} produit{totalProducts > 1 ? 's' : ''}
        {totalPages > 1 && ` • Page ${currentPage} sur ${totalPages}`}
      </p>

      {initialDeals.length > 0 ? (
        <>
          {/* Grille de produits */}
          <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
            {initialDeals.map((deal) => (
              <DealCard key={deal.id} deal={deal} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <nav aria-label="Pagination des produits" className="flex items-center justify-center gap-2 mt-12">
              <button
                onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className={`flex items-center gap-1 px-4 py-2 rounded-xl transition-all ${
                  currentPage === 1
                    ? 'bg-white/5 text-white/20 cursor-not-allowed'
                    : 'bg-[#1a1a1a] text-white/60 hover:bg-[#7b0a0a]/20 hover:text-white border border-white/10'
                }`}
              >
                <ChevronLeft className="h-4 w-4" />
                Précédent
              </button>

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
                        <button
                          onClick={() => handlePageChange(pageNum)}
                          className={`w-10 h-10 rounded-xl font-medium flex items-center justify-center transition-all ${
                            pageNum === currentPage
                              ? 'bg-[#7b0a0a] text-white'
                              : 'bg-[#1a1a1a] text-white/60 hover:bg-[#7b0a0a]/20 hover:text-white border border-white/10'
                          }`}
                        >
                          {pageNum}
                        </button>
                      </div>
                    );
                  })}
              </div>

              <button
                onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className={`flex items-center gap-1 px-4 py-2 rounded-xl transition-all ${
                  currentPage === totalPages
                    ? 'bg-white/5 text-white/20 cursor-not-allowed'
                    : 'bg-[#1a1a1a] text-white/60 hover:bg-[#7b0a0a]/20 hover:text-white border border-white/10'
                }`}
              >
                Suivant
                <ChevronRight className="h-4 w-4" />
              </button>
            </nav>
          )}
        </>
      ) : (
        <div className="text-center py-20">
          <Package className="h-16 w-16 text-[#7b0a0a]/50 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Aucun produit trouvé</h2>
          <p className="text-white/40">
            Essaie de modifier tes filtres pour trouver ce que tu cherches !
          </p>
        </div>
      )}
    </>
  );
}
