'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import DealCard from '@/components/deals/DealCard';
import DealCardSkeleton from '@/components/deals/DealCardSkeleton';
import DealFilters, { FilterState } from '@/components/deals/DealFilters';
import { Deal, Category } from '@/types';
import { Loader2, Package, ChevronLeft, ChevronRight } from 'lucide-react';

interface Merchant {
  id: string;
  name: string;
  slug: string;
}

interface Brand {
  name: string;
  slug: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// Helper pour parser les arrays depuis l'URL
const parseArrayParam = (param: string | null): string[] => {
  if (!param) return [];
  return param.split(',').filter(Boolean);
};

export default function DealsPage() {
  const searchParams = useSearchParams();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 12,
    total: 0,
    totalPages: 0,
  });
  
  // Initialiser les filtres depuis l'URL
  const getFiltersFromURL = useCallback(() => {
    const categoriesFromUrl = parseArrayParam(searchParams.get('categories'));
    const subcategoriesFromUrl = parseArrayParam(searchParams.get('subcategories'));
    const subsubcategoriesFromUrl = parseArrayParam(searchParams.get('subsubcategories'));
    const merchantsFromUrl = parseArrayParam(searchParams.get('merchants'));
    const brandsFromUrl = parseArrayParam(searchParams.get('brands'));
    const tagsFromUrl = parseArrayParam(searchParams.get('tags'));
    
    return {
      categories: categoriesFromUrl.length > 0 ? categoriesFromUrl : 
                  (searchParams.get('category') ? [searchParams.get('category')!] : []),
      subcategories: subcategoriesFromUrl.length > 0 ? subcategoriesFromUrl :
                     (searchParams.get('subcategory') ? [searchParams.get('subcategory')!] : []),
      subsubcategories: subsubcategoriesFromUrl,
      merchants: merchantsFromUrl.length > 0 ? merchantsFromUrl :
                 (searchParams.get('merchant') ? [searchParams.get('merchant')!] : []),
      brands: brandsFromUrl,
      tags: tagsFromUrl,
      minPrice: searchParams.get('minPrice') ? parseFloat(searchParams.get('minPrice')!) : undefined,
      maxPrice: searchParams.get('maxPrice') ? parseFloat(searchParams.get('maxPrice')!) : undefined,
      search: searchParams.get('search') || '',
      sortBy: searchParams.get('sortBy') || 'createdAt',
      sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc',
      hotOnly: searchParams.get('hotOnly') === 'true',
    };
  }, [searchParams]);

  // Lire la page depuis l'URL
  const getPageFromURL = useCallback(() => {
    const pageParam = searchParams.get('page');
    return pageParam ? parseInt(pageParam, 10) : 1;
  }, [searchParams]);

  const [filters, setFilters] = useState<FilterState>(getFiltersFromURL);

  // Synchroniser les filtres et la page avec l'URL quand elle change
  useEffect(() => {
    setFilters(getFiltersFromURL());
    setPagination(prev => ({ ...prev, page: getPageFromURL() }));
  }, [searchParams, getFiltersFromURL, getPageFromURL]);

  // Charger les catégories et marchands
  useEffect(() => {
    async function loadFilters() {
      const [catRes, merchantRes, brandsRes] = await Promise.all([
        fetch('/api/categories'),
        fetch('/api/merchants'),
        fetch('/api/brands'),
      ]);
      
      if (catRes.ok) {
        const cats = await catRes.json();
        setCategories(cats);
      }
      
      if (merchantRes.ok) {
        const merchants = await merchantRes.json();
        setMerchants(merchants);
      }
      
      if (brandsRes.ok) {
        const brands = await brandsRes.json();
        setBrands(brands);
      }
    }
    
    loadFilters();
  }, []);

  // Charger les deals
  useEffect(() => {
    async function loadDeals() {
      setLoading(true);
      
      const params = new URLSearchParams();
      
      // Multi-filtres
      if (filters.categories.length > 0) params.set('categories', filters.categories.join(','));
      if (filters.subcategories.length > 0) params.set('subcategories', filters.subcategories.join(','));
      if (filters.subsubcategories.length > 0) params.set('subsubcategories', filters.subsubcategories.join(','));
      if (filters.merchants.length > 0) params.set('merchants', filters.merchants.join(','));
      if (filters.brands.length > 0) params.set('brands', filters.brands.join(','));
      if (filters.tags.length > 0) params.set('tags', filters.tags.join(','));
      
      // Prix
      if (filters.minPrice !== undefined) params.set('minPrice', filters.minPrice.toString());
      if (filters.maxPrice !== undefined) params.set('maxPrice', filters.maxPrice.toString());
      
      // Autres filtres
      if (filters.search) params.set('search', filters.search);
      if (filters.sortBy) params.set('sortBy', filters.sortBy);
      if (filters.sortOrder) params.set('sortOrder', filters.sortOrder);
      if (filters.hotOnly) params.set('hotOnly', 'true');
      
      params.set('page', pagination.page.toString());
      params.set('limit', '12');
      
      try {
        const res = await fetch(`/api/deals?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setDeals(data.deals);
          setPagination(data.pagination);
        }
      } catch (error) {
        console.error('Error loading deals:', error);
      } finally {
        setLoading(false);
      }
    }
    
    loadDeals();
  }, [filters, pagination.page]);

  const handleFilterChange = (newFilters: FilterState) => {
    setFilters(newFilters);
    setPagination(prev => ({ ...prev, page: 1 }));
    
    // Mettre à jour l'URL
    const params = new URLSearchParams();
    if (newFilters.categories.length > 0) params.set('categories', newFilters.categories.join(','));
    if (newFilters.subcategories.length > 0) params.set('subcategories', newFilters.subcategories.join(','));
    if (newFilters.subsubcategories.length > 0) params.set('subsubcategories', newFilters.subsubcategories.join(','));
    if (newFilters.merchants.length > 0) params.set('merchants', newFilters.merchants.join(','));
    if (newFilters.brands.length > 0) params.set('brands', newFilters.brands.join(','));
    if (newFilters.tags.length > 0) params.set('tags', newFilters.tags.join(','));
    if (newFilters.minPrice !== undefined) params.set('minPrice', newFilters.minPrice.toString());
    if (newFilters.maxPrice !== undefined) params.set('maxPrice', newFilters.maxPrice.toString());
    if (newFilters.search) params.set('search', newFilters.search);
    if (newFilters.sortBy !== 'createdAt') params.set('sortBy', newFilters.sortBy);
    if (newFilters.sortOrder !== 'desc') params.set('sortOrder', newFilters.sortOrder);
    if (newFilters.hotOnly) params.set('hotOnly', 'true');
    
    const queryString = params.toString();
    window.history.replaceState({}, '', `/deals${queryString ? `?${queryString}` : ''}`);
  };

  // Générer l'URL pour une page donnée (SEO-friendly)
  const getPageUrl = useCallback((page: number): string => {
    const params = new URLSearchParams();
    if (filters.categories.length > 0) params.set('categories', filters.categories.join(','));
    if (filters.subcategories.length > 0) params.set('subcategories', filters.subcategories.join(','));
    if (filters.subsubcategories.length > 0) params.set('subsubcategories', filters.subsubcategories.join(','));
    if (filters.merchants.length > 0) params.set('merchants', filters.merchants.join(','));
    if (filters.brands.length > 0) params.set('brands', filters.brands.join(','));
    if (filters.tags.length > 0) params.set('tags', filters.tags.join(','));
    if (filters.minPrice !== undefined) params.set('minPrice', filters.minPrice.toString());
    if (filters.maxPrice !== undefined) params.set('maxPrice', filters.maxPrice.toString());
    if (filters.search) params.set('search', filters.search);
    if (filters.sortBy !== 'createdAt') params.set('sortBy', filters.sortBy);
    if (filters.sortOrder !== 'desc') params.set('sortOrder', filters.sortOrder);
    if (filters.hotOnly) params.set('hotOnly', 'true');
    if (page > 1) params.set('page', page.toString());
    
    const queryString = params.toString();
    return `/deals${queryString ? `?${queryString}` : ''}`;
  }, [filters]);

  const handlePageChange = (newPage: number) => {
    // Mettre à jour l'URL avec le nouveau numéro de page
    const url = getPageUrl(newPage);
    window.history.pushState({}, '', url);
    setPagination(prev => ({ ...prev, page: newPage }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Titre dynamique
  const getPageTitle = () => {
    if (filters.hotOnly) return '🔥 Hot Deals';
    if (filters.categories.length === 1) {
      const cat = categories.find(c => c.slug === filters.categories[0]);
      return cat?.name || 'Deals';
    }
    return 'Tous les deals';
  };

  return (
    <div className="min-h-screen py-8 bg-[#0a0a0a]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">{getPageTitle()}</h1>
          <p className="text-white/50">
            {filters.search 
              ? `Résultats pour "${filters.search}"`
              : pagination.total > 0 
                ? `${pagination.total} deal${pagination.total > 1 ? 's' : ''} dénichés pour toi 💅`
                : 'Les vrais bons plans beauté, pas les fausses promos'}
          </p>
        </div>

        {/* Filters */}
        <DealFilters
          categories={categories}
          merchants={merchants}
          brands={brands}
          onFilterChange={handleFilterChange}
          currentFilters={filters}
        />

        {/* Results */}
        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <DealCardSkeleton key={i} />
            ))}
          </div>
        ) : deals.length > 0 ? (
          <>
            {/* Results count */}
            <p className="text-white/40 text-sm mb-4">
              {pagination.total} résultat{pagination.total > 1 ? 's' : ''} 
              {pagination.totalPages > 1 && ` • Page ${pagination.page} sur ${pagination.totalPages}`}
            </p>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {deals.map((deal) => (
                <DealCard key={deal.id} deal={deal} />
              ))}
            </div>

            {/* Pagination SEO-friendly avec vrais liens */}
            {pagination.totalPages > 1 && (
              <nav aria-label="Pagination des deals" className="flex items-center justify-center gap-2 mt-12">
                {/* Previous Link */}
                {pagination.page > 1 ? (
                  <Link
                    href={getPageUrl(pagination.page - 1)}
                    onClick={(e) => { e.preventDefault(); handlePageChange(pagination.page - 1); }}
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

                {/* Page Numbers as Links */}
                <div className="flex items-center gap-1">
                  {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                    .filter(page => {
                      // Show first, last, current, and pages around current
                      return (
                        page === 1 ||
                        page === pagination.totalPages ||
                        Math.abs(page - pagination.page) <= 2
                      );
                    })
                    .map((page, index, array) => {
                      // Add ellipsis if there's a gap
                      const prevPage = array[index - 1];
                      const showEllipsis = prevPage && page - prevPage > 1;

                      return (
                        <div key={page} className="flex items-center">
                          {showEllipsis && (
                            <span className="px-2 text-white/30">...</span>
                          )}
                          {page === pagination.page ? (
                            <span
                              aria-current="page"
                              className="w-10 h-10 rounded-xl font-medium flex items-center justify-center bg-[#7b0a0a] text-white"
                            >
                              {page}
                            </span>
                          ) : (
                            <Link
                              href={getPageUrl(page)}
                              onClick={(e) => { e.preventDefault(); handlePageChange(page); }}
                              className="w-10 h-10 rounded-xl font-medium flex items-center justify-center transition-all bg-[#1a1a1a] text-white/60 hover:bg-[#7b0a0a]/20 hover:text-white border border-white/10"
                            >
                              {page}
                            </Link>
                          )}
                        </div>
                      );
                    })}
                </div>

                {/* Next Link */}
                {pagination.page < pagination.totalPages ? (
                  <Link
                    href={getPageUrl(pagination.page + 1)}
                    onClick={(e) => { e.preventDefault(); handlePageChange(pagination.page + 1); }}
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
          </>
        ) : (
          <div className="text-center py-20">
            <Package className="h-16 w-16 text-[#7b0a0a]/50 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-white mb-2">Rien trouvé cette fois 😢</h2>
            <p className="text-white/40">
              Change tes filtres ou reviens plus tard, on cherche toujours !
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
