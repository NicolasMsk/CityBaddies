'use client';

import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import DealCard from '@/components/deals/DealCard';
import DealFilters, { FilterState } from '@/components/deals/DealFilters';
import { ChevronLeft, ChevronRight, Package } from 'lucide-react';
import { Category } from '@/types';

interface SimpleMerchant { id: string; name: string; slug: string; }
interface SimpleBrand { name: string; slug: string; }

interface DealsPageClientProps {
  initialDeals: any[];
  categories: Category[];
  merchants: SimpleMerchant[];
  brands: SimpleBrand[];
  totalDeals: number;
  totalPages: number;
  currentPage: number;
}

const DEALS_PER_PAGE = 24;

const defaultFilters: FilterState = {
  categories: [],
  subcategories: [],
  subsubcategories: [],
  merchants: [],
  brands: [],
  tags: [],
  search: '',
  sortBy: 'createdAt',
  sortOrder: 'desc',
  hotOnly: false,
};

export default function DealsPageClient({
  initialDeals,
  categories,
  merchants,
  brands,
  totalDeals,
  totalPages,
  currentPage,
}: DealsPageClientProps) {
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [page, setPage] = useState(1);

  // Filtrer et trier les deals côté client
  const filteredDeals = useMemo(() => {
    let result = [...initialDeals];

    // Filtrer par catégorie
    if (filters.categories.length > 0) {
      result = result.filter(deal => 
        deal.product?.category && filters.categories.includes(deal.product.category.slug)
      );
    }

    // Filtrer par merchant
    if (filters.merchants.length > 0) {
      result = result.filter(deal => 
        deal.product?.merchant && filters.merchants.includes(deal.product.merchant.slug)
      );
    }

    // Filtrer par marque
    if (filters.brands.length > 0) {
      result = result.filter(deal => 
        deal.product?.brand && filters.brands.includes(deal.product.brand.toLowerCase().replace(/\s+/g, '-'))
      );
    }

    // Filtrer par tags
    if (filters.tags.length > 0) {
      result = result.filter(deal => {
        const dealTags = deal.tags?.split(',').map((t: string) => t.trim()) || [];
        return filters.tags.some(tag => dealTags.includes(tag));
      });
    }

    // Filtrer par recherche
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(deal => 
        deal.title?.toLowerCase().includes(searchLower) ||
        deal.product?.name?.toLowerCase().includes(searchLower) ||
        deal.product?.brand?.toLowerCase().includes(searchLower)
      );
    }

    // Filtrer par hot only
    if (filters.hotOnly) {
      result = result.filter(deal => deal.isHot);
    }

    // Filtrer par prix
    if (filters.minPrice !== undefined) {
      result = result.filter(deal => deal.dealPrice >= filters.minPrice!);
    }
    if (filters.maxPrice !== undefined) {
      result = result.filter(deal => deal.dealPrice <= filters.maxPrice!);
    }

    // Trier
    result.sort((a, b) => {
      let comparison = 0;
      switch (filters.sortBy) {
        case 'createdAt':
          comparison = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          break;
        case 'discountPercent':
          comparison = (b.discountPercent || 0) - (a.discountPercent || 0);
          break;
        case 'votes':
          comparison = (b.votes || 0) - (a.votes || 0);
          break;
        case 'dealPrice':
          comparison = (a.dealPrice || 0) - (b.dealPrice || 0);
          break;
        default:
          comparison = 0;
      }
      return filters.sortOrder === 'asc' ? -comparison : comparison;
    });

    return result;
  }, [initialDeals, filters]);

  // Pagination côté client
  const paginatedDeals = useMemo(() => {
    const start = (page - 1) * DEALS_PER_PAGE;
    return filteredDeals.slice(start, start + DEALS_PER_PAGE);
  }, [filteredDeals, page]);

  const clientTotalPages = Math.ceil(filteredDeals.length / DEALS_PER_PAGE);

  const handleFilterChange = useCallback((newFilters: FilterState) => {
    setFilters(newFilters);
    setPage(1); // Reset to page 1 when filters change
  }, []);

  return (
    <>
      {/* Filtres */}
      <DealFilters
        categories={categories}
        merchants={merchants}
        brands={brands}
        onFilterChange={handleFilterChange}
        currentFilters={filters}
      />

      {/* Résultats */}
      <p className="text-white/40 text-sm mb-4 mt-6">
        {filteredDeals.length} résultat{filteredDeals.length > 1 ? 's' : ''} 
        {clientTotalPages > 1 && ` • Page ${page} sur ${clientTotalPages}`}
      </p>

      {paginatedDeals.length > 0 ? (
        <>
          {/* Grille de deals */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {paginatedDeals.map((deal) => (
              <DealCard key={deal.id} deal={deal} />
            ))}
          </div>

          {/* Pagination */}
          {clientTotalPages > 1 && (
            <nav aria-label="Pagination des deals" className="flex items-center justify-center gap-2 mt-12">
              {/* Previous */}
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className={`flex items-center gap-1 px-4 py-2 rounded-xl transition-all ${
                  page === 1
                    ? 'bg-white/5 text-white/20 cursor-not-allowed'
                    : 'bg-[#1a1a1a] text-white/60 hover:bg-[#7b0a0a]/20 hover:text-white border border-white/10'
                }`}
              >
                <ChevronLeft className="h-4 w-4" />
                Précédent
              </button>

              {/* Page Numbers */}
              <div className="flex items-center gap-1">
                {Array.from({ length: clientTotalPages }, (_, i) => i + 1)
                  .filter(pageNum => {
                    return (
                      pageNum === 1 ||
                      pageNum === clientTotalPages ||
                      Math.abs(pageNum - page) <= 2
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
                          onClick={() => setPage(pageNum)}
                          className={`w-10 h-10 rounded-xl font-medium flex items-center justify-center transition-all ${
                            pageNum === page
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

              {/* Next */}
              <button
                onClick={() => setPage(p => Math.min(clientTotalPages, p + 1))}
                disabled={page === clientTotalPages}
                className={`flex items-center gap-1 px-4 py-2 rounded-xl transition-all ${
                  page === clientTotalPages
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
          <h2 className="text-xl font-semibold text-white mb-2">Aucun deal trouvé</h2>
          <p className="text-white/40">
            Essaie de modifier tes filtres pour trouver ce que tu cherches !
          </p>
        </div>
      )}
    </>
  );
}
