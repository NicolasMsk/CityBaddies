'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Search, X, Loader2, ArrowRight, Sparkles } from 'lucide-react';

interface SearchResult {
  id: string;
  title: string;
  brand: string | null;
  category: string | null;
  imageUrl: string | null;
  dealPrice: number;
  originalPrice: number;
  discountPercent: number;
  merchant: {
    name: string;
    slug: string;
  };
  volume: string | null;
}

interface SearchResponse {
  results: SearchResult[];
  brands: { name: string; slug: string }[];
  query: string;
  total: number;
}

interface CategoryItem {
  slug: string;
  label: string;
  keywords: string[]; // Mots clés supplémentaires pour la recherche
}

// Liste des catégories disponibles
const ALL_CATEGORIES: CategoryItem[] = [
  { slug: 'maquillage', label: 'Maquillage', keywords: ['makeup', 'teint', 'fond de teint', 'mascara', 'rouge à lèvres', 'fard', 'blush'] },
  { slug: 'soins-visage', label: 'Soins Visage', keywords: ['skincare', 'crème', 'sérum', 'nettoyant', 'masque', 'hydratant', 'anti-âge', 'peau'] },
  { slug: 'soins-corps', label: 'Soins Corps', keywords: ['body', 'corps', 'lotion', 'huile', 'gommage', 'hydratant'] },
  { slug: 'cheveux', label: 'Cheveux', keywords: ['hair', 'shampoing', 'shampooing', 'après-shampoing', 'masque capillaire', 'huile cheveux'] },
  { slug: 'parfums', label: 'Parfums', keywords: ['parfum', 'fragrance', 'eau de parfum', 'eau de toilette', 'cologne', 'senteur'] },
  { slug: 'ongles', label: 'Ongles', keywords: ['vernis', 'nail', 'manucure', 'gel', 'semi-permanent', 'nail art'] },
  { slug: 'accessoires', label: 'Accessoires', keywords: ['pinceau', 'éponge', 'trousse', 'miroir', 'outils'] },
];

// Hook pour debounce
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

interface SearchBarProps {
  className?: string;
  placeholder?: string;
  onClose?: () => void;
  isMobile?: boolean;
}

export default function SearchBar({ 
  className = '', 
  placeholder = 'Rechercher un produit ou une marque...',
  onClose,
  isMobile = false,
}: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [brands, setBrands] = useState<{ name: string; slug: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const debouncedQuery = useDebounce(query, 300);

  // Filtrer les catégories qui matchent la recherche
  const matchingCategories = useMemo(() => {
    if (query.trim().length < 2) return [];
    
    const searchLower = query.toLowerCase().trim();
    return ALL_CATEGORIES.filter(cat => {
      // Match sur le label
      if (cat.label.toLowerCase().includes(searchLower)) return true;
      // Match sur le slug
      if (cat.slug.toLowerCase().includes(searchLower)) return true;
      // Match sur les keywords
      return cat.keywords.some(kw => kw.toLowerCase().includes(searchLower));
    }).slice(0, 3); // Max 3 catégories
  }, [query]);

  // Recherche API
  const performSearch = useCallback(async (searchQuery: string) => {
    if (searchQuery.trim().length < 2) {
      setResults([]);
      setBrands([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}&limit=5`);
      if (res.ok) {
        const data: SearchResponse = await res.json();
        setResults(data.results);
        setBrands(data.brands);
        setIsOpen(true);
      }
    } catch (error) {
      console.error('Search error:', error);
      // Ouvrir quand même si on a des catégories qui matchent
      setIsOpen(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Effet pour la recherche debounced
  useEffect(() => {
    performSearch(debouncedQuery);
  }, [debouncedQuery, performSearch]);

  // Fermer le dropdown quand on clique dehors
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Navigation clavier
  const handleKeyDown = (e: React.KeyboardEvent) => {
    const totalItems = matchingCategories.length + brands.length + results.length;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev < totalItems - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : totalItems - 1));
        break;
      case 'Enter':
        e.preventDefault();
        // Ordre: Catégories -> Marques -> Deals
        if (selectedIndex >= 0 && selectedIndex < matchingCategories.length) {
          // Sélectionner une catégorie
          window.location.href = `/deals?category=${matchingCategories[selectedIndex].slug}`;
        } else if (selectedIndex >= matchingCategories.length && selectedIndex < matchingCategories.length + brands.length) {
          // Sélectionner une marque
          const brandIndex = selectedIndex - matchingCategories.length;
          window.location.href = `/deals?search=${encodeURIComponent(brands[brandIndex].name)}`;
        } else if (selectedIndex >= matchingCategories.length + brands.length && selectedIndex < totalItems) {
          // Sélectionner un deal
          const dealIndex = selectedIndex - matchingCategories.length - brands.length;
          window.location.href = `/deals/${results[dealIndex].id}`;
        } else if (query.trim()) {
          // Aller à la page de résultats
          window.location.href = `/deals?search=${encodeURIComponent(query)}`;
        }
        break;
      case 'Escape':
        setIsOpen(false);
        inputRef.current?.blur();
        break;
    }
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setBrands([]);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleResultClick = () => {
    setIsOpen(false);
    onClose?.();
  };

  const handleViewAll = () => {
    if (query.trim()) {
      window.location.href = `/deals?search=${encodeURIComponent(query)}`;
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Input */}
      <div className="relative">
        <Search className={`absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 ${isMobile ? 'text-neutral-500' : 'text-neutral-400'}`} />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => (results.length > 0 || matchingCategories.length > 0 || brands.length > 0) && setIsOpen(true)}
          placeholder={placeholder}
          className={`
            ${isMobile 
              ? 'w-full pl-12 pr-10 py-4 bg-white/5 border border-white/10 rounded-none' 
              : 'w-40 lg:w-56 pl-10 pr-8 py-2.5 bg-[#1a1a1a] border border-white/10 rounded-none hover:border-white/20'
            }
            text-xs lg:text-sm text-white placeholder-neutral-500 font-light tracking-wide
            focus:outline-none focus:border-[#d4a855] focus:bg-black
            transition-all duration-300
          `}
        />
        {/* Loading / Clear button */}
        <div className="absolute right-4 top-1/2 -translate-y-1/2">
          {isLoading ? (
            <Loader2 className="h-4 w-4 text-[#d4a855] animate-spin" />
          ) : query && (
            <button
              onClick={handleClear}
              className="p-1 text-neutral-500 hover:text-white transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Dropdown Results */}
      {isOpen && (results.length > 0 || brands.length > 0 || matchingCategories.length > 0) && (
        <div className={`
          absolute top-full left-0 right-0 mt-2 
          bg-[#0a0a0a] border border-white/10 shadow-2xl 
          overflow-hidden z-50
          ${isMobile ? '' : 'min-w-[320px] lg:min-w-[400px]'}
        `}>
          {/* Catégories suggérées */}
          {matchingCategories.length > 0 && (
            <div className="p-3 border-b border-white/5">
              <p className="px-2 py-1 text-[10px] font-bold tracking-[0.2em] text-[#d4a855] uppercase">
                Catégories
              </p>
              {matchingCategories.map((cat, index) => (
                <Link
                  key={cat.slug}
                  href={`/deals?category=${cat.slug}`}
                  onClick={handleResultClick}
                  className={`
                    flex items-center gap-3 px-3 py-3 text-sm
                    ${selectedIndex === index 
                      ? 'bg-white/10 text-white' 
                      : 'text-neutral-300 hover:bg-white/5'
                    }
                    transition-colors
                  `}
                >
                  <Sparkles className="h-4 w-4 text-[#d4a855]" />
                  <span className="font-medium">{cat.label}</span>
                  <span className="text-neutral-500 text-xs ml-auto">→ Voir les deals</span>
                </Link>
              ))}
            </div>
          )}

          {/* Marques suggérées */}
          {brands.length > 0 && (
            <div className="p-3 border-b border-white/5">
              <p className="px-2 py-1 text-[10px] font-bold tracking-[0.2em] text-neutral-500 uppercase">
                Marques
              </p>
              {brands.map((brand, index) => (
                <Link
                  key={brand.slug}
                  href={`/deals?search=${encodeURIComponent(brand.name)}`}
                  onClick={handleResultClick}
                  className={`
                    flex items-center gap-2 px-3 py-3 text-sm
                    ${selectedIndex === matchingCategories.length + index 
                      ? 'bg-white/10 text-white' 
                      : 'text-neutral-300 hover:bg-white/5'
                    }
                    transition-colors
                  `}
                >
                  <span className="text-[#9b1515] font-medium">{brand.name}</span>
                  <span className="text-neutral-500 text-xs ml-auto">→ Voir tous les deals</span>
                </Link>
              ))}
            </div>
          )}

          {/* Deals */}
          {results.length > 0 && (
            <div className="p-3">
              <p className="px-2 py-1 text-[10px] font-bold tracking-[0.2em] text-neutral-500 uppercase">
                Deals
              </p>
              {results.map((result, index) => (
                <Link
                  key={result.id}
                  href={`/deals/${result.id}`}
                  onClick={handleResultClick}
                  className={`
                    flex items-center gap-3 p-2
                    ${selectedIndex === matchingCategories.length + brands.length + index 
                      ? 'bg-white/10' 
                      : 'hover:bg-white/5'
                    }
                    transition-colors
                  `}
                >
                  {/* Image */}
                  <div className="relative w-12 h-12 bg-white/5 overflow-hidden flex-shrink-0">
                    {result.imageUrl ? (
                      <Image
                        src={result.imageUrl}
                        alt={result.title}
                        fill
                        className="object-contain p-1"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-neutral-600">
                        <Search className="h-5 w-5" />
                      </div>
                    )}
                  </div>
                  
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">
                      {result.title}
                    </p>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-[#9b1515] font-medium">
                        -{result.discountPercent}%
                      </span>
                      <span className="text-white font-medium">
                        {result.dealPrice.toFixed(2)}€
                      </span>
                      <span className="text-neutral-500 line-through">
                        {result.originalPrice.toFixed(2)}€
                      </span>
                    </div>
                    <p className="text-xs text-neutral-500 truncate">
                      {result.brand && `${result.brand} • `}{result.merchant.name}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Voir tous les résultats */}
          {query.trim().length >= 2 && (
            <button
              onClick={handleViewAll}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white/5 text-sm text-neutral-300 hover:text-white hover:bg-white/10 transition-colors border-t border-white/5"
            >
              Voir tous les résultats pour "{query}"
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {/* Message si aucun résultat */}
      {isOpen && query.length >= 2 && !isLoading && results.length === 0 && brands.length === 0 && matchingCategories.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-[#0a0a0a] border border-white/10 shadow-2xl overflow-hidden z-50 p-6">
          <p className="text-sm text-neutral-400 text-center">
            Aucun résultat pour "<span className="text-white">{query}</span>"
          </p>
          <p className="text-xs text-neutral-600 text-center mt-2">
            Essayez avec un autre terme de recherche
          </p>
        </div>
      )}
    </div>
  );
}
