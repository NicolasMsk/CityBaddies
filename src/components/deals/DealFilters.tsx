'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Category } from '@/types';
import { SortAsc, X, ChevronDown, Flame, Tag, Store, Check, Search, SlidersHorizontal, Euro } from 'lucide-react';
import CategoryIcon from '@/components/ui/CategoryIcon';

interface SimpleMerchant { id: string; name: string; slug: string; }
interface SimpleBrand { name: string; slug: string; }

interface DealFiltersProps {
  categories: Category[];
  merchants: SimpleMerchant[];
  brands: SimpleBrand[];
  onFilterChange: (filters: FilterState) => void;
  currentFilters: FilterState;
}

export interface FilterState {
  categories: string[];
  subcategories: string[];
  subsubcategories: string[];
  merchants: string[];
  brands: string[];
  tags: string[];
  minPrice?: number;
  maxPrice?: number;
  search: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  hotOnly: boolean;
}

const SORT_OPTIONS = [
  { value: 'createdAt', label: 'Plus récents' },
  { value: 'discountPercent', label: 'Meilleure réduction' },
  { value: 'votes', label: 'Plus populaires' },
  { value: 'dealPrice', label: 'Prix' },
];

// Tags disponibles pour filtrer (alignés avec scoring.ts)
const TAG_OPTIONS = [
  { value: 'DEAL_EXCEPTIONNEL', label: '� Deal Exceptionnel' },
  { value: 'TOP_DEAL', label: '⭐ Top Deal' },
  { value: 'LUXE', label: '💎 Luxe' },
  { value: 'PROMO_FLASH', label: '� -50% et plus' },
  { value: 'TENDANCE', label: '📈 Tendance' },
  { value: 'PRIX_IMBATTABLE', label: '💰 Prix Imbattable' },
  { value: 'IDEE_CADEAU', label: '🎁 Idée Cadeau' },
];

const SUBCATEGORIES: Record<string, { slug: string; name: string }[]> = {
  'maquillage': [{ slug: 'teint', name: 'Teint' }, { slug: 'yeux', name: 'Yeux' }, { slug: 'levres', name: 'Lèvres' }, { slug: 'sourcils', name: 'Sourcils' }, { slug: 'palettes', name: 'Palettes' }],
  'soins-visage': [{ slug: 'nettoyants', name: 'Nettoyants' }, { slug: 'serums', name: 'Sérums' }, { slug: 'cremes', name: 'Crèmes' }, { slug: 'masques', name: 'Masques' }, { slug: 'contour-yeux', name: 'Contour des yeux' }],
  'cheveux': [{ slug: 'shampoings', name: 'Shampoings' }, { slug: 'apres-shampoings', name: 'Après-shampoings' }, { slug: 'masques-capillaires', name: 'Masques' }, { slug: 'huiles', name: 'Huiles' }, { slug: 'coiffants', name: 'Coiffants' }],
  'parfums': [{ slug: 'eau-de-parfum', name: 'Eau de parfum' }, { slug: 'eau-de-toilette', name: 'Eau de toilette' }, { slug: 'brumes', name: 'Brumes' }, { slug: 'coffrets-parfums', name: 'Coffrets' }],
  'soins-corps': [{ slug: 'hydratants', name: 'Hydratants' }, { slug: 'gommages', name: 'Gommages' }, { slug: 'huiles', name: 'Huiles' }, { slug: 'solaires', name: 'Solaires' }, { slug: 'douche', name: 'Douche' }, { slug: 'deodorants', name: 'Déodorants' }],
  'ongles': [{ slug: 'vernis', name: 'Vernis' }, { slug: 'semi-permanent', name: 'Semi-permanent' }, { slug: 'faux-ongles', name: 'Faux ongles' }, { slug: 'soins-ongles', name: 'Soins' }],
};

// Sous-sous-catégories par sous-catégorie
const SUBSUBCATEGORIES: Record<string, { slug: string; name: string }[]> = {
  // Maquillage > Teint
  'teint': [{ slug: 'fond-de-teint', name: 'Fond de teint' }, { slug: 'correcteur', name: 'Correcteur' }, { slug: 'poudre', name: 'Poudre' }, { slug: 'blush', name: 'Blush' }, { slug: 'bronzer', name: 'Bronzer' }, { slug: 'highlighter', name: 'Highlighter' }, { slug: 'primer', name: 'Primer' }],
  // Maquillage > Yeux
  'yeux': [{ slug: 'mascara', name: 'Mascara' }, { slug: 'eyeliner', name: 'Eyeliner' }, { slug: 'fard-paupieres', name: 'Fard à paupières' }, { slug: 'crayon-yeux', name: 'Crayon yeux' }, { slug: 'faux-cils', name: 'Faux cils' }],
  // Maquillage > Lèvres
  'levres': [{ slug: 'rouge-a-levres', name: 'Rouge à lèvres' }, { slug: 'gloss', name: 'Gloss' }, { slug: 'crayon-levres', name: 'Crayon lèvres' }, { slug: 'baume-levres', name: 'Baume lèvres' }],
  // Maquillage > Sourcils
  'sourcils': [{ slug: 'crayon-sourcils', name: 'Crayon sourcils' }, { slug: 'gel-sourcils', name: 'Gel sourcils' }, { slug: 'poudre-sourcils', name: 'Poudre sourcils' }, { slug: 'pomade-sourcils', name: 'Pomade sourcils' }],
  // Maquillage > Palettes
  'palettes': [{ slug: 'palette-yeux', name: 'Palette yeux' }, { slug: 'palette-teint', name: 'Palette teint' }, { slug: 'palette-levres', name: 'Palette lèvres' }],
  // Soins visage > Nettoyants
  'nettoyants': [{ slug: 'gel-nettoyant', name: 'Gel nettoyant' }, { slug: 'mousse-nettoyante', name: 'Mousse nettoyante' }, { slug: 'huile-demaquillante', name: 'Huile démaquillante' }, { slug: 'eau-micellaire', name: 'Eau micellaire' }, { slug: 'lait-demaquillant', name: 'Lait démaquillant' }],
  // Soins visage > Sérums
  'serums': [{ slug: 'serum-hydratant', name: 'Sérum hydratant' }, { slug: 'serum-anti-age', name: 'Sérum anti-âge' }, { slug: 'serum-eclat', name: 'Sérum éclat' }, { slug: 'serum-anti-imperfections', name: 'Sérum anti-imperfections' }],
  // Soins visage > Crèmes
  'cremes': [{ slug: 'creme-hydratante', name: 'Crème hydratante' }, { slug: 'creme-anti-age', name: 'Crème anti-âge' }, { slug: 'creme-nuit', name: 'Crème de nuit' }, { slug: 'creme-teintee', name: 'Crème teintée' }],
  // Soins visage > Masques
  'masques': [{ slug: 'masque-hydratant', name: 'Masque hydratant' }, { slug: 'masque-purifiant', name: 'Masque purifiant' }, { slug: 'masque-eclat', name: 'Masque éclat' }, { slug: 'peel', name: 'Peel' }],
  // Soins visage > Contour yeux
  'contour-yeux': [{ slug: 'creme-contour', name: 'Crème contour' }, { slug: 'serum-yeux', name: 'Sérum yeux' }, { slug: 'patch-yeux', name: 'Patch yeux' }],
  // Cheveux > Shampoings
  'shampoings': [{ slug: 'shampoing-hydratant', name: 'Shampoing hydratant' }, { slug: 'shampoing-volume', name: 'Shampoing volume' }, { slug: 'shampoing-lissant', name: 'Shampoing lissant' }, { slug: 'shampoing-colore', name: 'Shampoing coloré' }, { slug: 'shampoing-sec', name: 'Shampoing sec' }, { slug: 'shampoing-antipelliculaire', name: 'Shampoing antipelliculaire' }],
  // Cheveux > Après-shampoings
  'apres-shampoings': [{ slug: 'apres-shampoing-hydratant', name: 'Après-shampoing hydratant' }, { slug: 'apres-shampoing-demelant', name: 'Après-shampoing démêlant' }, { slug: 'apres-shampoing-reparateur', name: 'Après-shampoing réparateur' }],
  // Cheveux > Masques capillaires
  'masques-capillaires': [{ slug: 'masque-nourrissant', name: 'Masque nourrissant' }, { slug: 'masque-reparateur', name: 'Masque réparateur' }, { slug: 'masque-hydratant', name: 'Masque hydratant' }],
  // Cheveux > Huiles
  'huiles': [{ slug: 'huile-nourrissante', name: 'Huile nourrissante' }, { slug: 'huile-seche', name: 'Huile sèche' }, { slug: 'serum-pointes', name: 'Sérum pointes' }],
  // Cheveux > Coiffants
  'coiffants': [{ slug: 'laque', name: 'Laque' }, { slug: 'mousse-coiffante', name: 'Mousse coiffante' }, { slug: 'gel', name: 'Gel' }, { slug: 'cire', name: 'Cire' }, { slug: 'spray-texturisant', name: 'Spray texturisant' }],
  // Parfums
  'eau-de-parfum': [{ slug: 'edp-femme', name: 'EDP Femme' }, { slug: 'edp-homme', name: 'EDP Homme' }, { slug: 'edp-mixte', name: 'EDP Mixte' }],
  'eau-de-toilette': [{ slug: 'edt-femme', name: 'EDT Femme' }, { slug: 'edt-homme', name: 'EDT Homme' }, { slug: 'edt-mixte', name: 'EDT Mixte' }],
  'brumes': [{ slug: 'brume-corps', name: 'Brume corps' }, { slug: 'brume-cheveux', name: 'Brume cheveux' }],
  'coffrets-parfums': [{ slug: 'coffret-edp', name: 'Coffret EDP' }, { slug: 'coffret-miniatures', name: 'Coffret miniatures' }],
  // Soins corps
  'hydratants': [{ slug: 'lait-corps', name: 'Lait corps' }, { slug: 'creme-corps', name: 'Crème corps' }, { slug: 'beurre-corps', name: 'Beurre corps' }],
  'gommages': [{ slug: 'gommage-corps', name: 'Gommage corps' }, { slug: 'gommage-pieds', name: 'Gommage pieds' }, { slug: 'gommage-mains', name: 'Gommage mains' }],
  'solaires': [{ slug: 'protection-solaire', name: 'Protection solaire' }, { slug: 'autobronzant', name: 'Autobronzant' }, { slug: 'apres-soleil', name: 'Après-soleil' }],
  'douche': [{ slug: 'gel-douche', name: 'Gel douche' }, { slug: 'huile-douche', name: 'Huile douche' }, { slug: 'savon', name: 'Savon' }],
  'deodorants': [{ slug: 'deo-spray', name: 'Déo spray' }, { slug: 'deo-roll-on', name: 'Déo roll-on' }, { slug: 'deo-stick', name: 'Déo stick' }],
  // Ongles
  'vernis': [{ slug: 'vernis-classique', name: 'Vernis classique' }, { slug: 'vernis-longue-tenue', name: 'Vernis longue tenue' }],
  'semi-permanent': [{ slug: 'gel-uv', name: 'Gel UV' }, { slug: 'vernis-semi', name: 'Vernis semi' }],
  'faux-ongles': [{ slug: 'capsules', name: 'Capsules' }, { slug: 'press-on', name: 'Press-on' }],
  'soins-ongles': [{ slug: 'base-coat', name: 'Base coat' }, { slug: 'top-coat', name: 'Top coat' }, { slug: 'huile-cuticules', name: 'Huile cuticules' }],
};

function FilterChip({ label, onRemove, variant = 'default' }: { label: string; onRemove: () => void; variant?: 'default' | 'hot' | 'price'; }) {
  const variants = {
    default: 'bg-white/5 text-white border-white/10 hover:border-[#d4a855] hover:text-[#d4a855]',
    hot: 'bg-[#9b1515]/10 text-[#9b1515] border-[#9b1515]/20 hover:border-[#9b1515]',
    price: 'bg-[#d4a855]/10 text-[#d4a855] border-[#d4a855]/20 hover:border-[#d4a855]',
  };
  return (
    <span className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-bold tracking-widest uppercase border transition-colors ${variants[variant]}`}>
      {label}
      <button onClick={onRemove} className="hover:text-white transition-colors group">
        <X className="h-3 w-3 group-hover:scale-110 transition-transform" />
      </button>
    </span>
  );
}

function MultiSelectDropdown({ icon: Icon, values, options, onChange, placeholder }: { icon: React.ElementType; values: string[]; options: { value: string; label: string; icon?: string; count?: number }[]; onChange: (values: string[]) => void; placeholder: string; }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) { if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setIsOpen(false); }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const toggleValue = (value: string) => values.includes(value) ? onChange(values.filter(v => v !== value)) : onChange([...values, value]);
  const selectedLabels = values.map(v => options.find(o => o.value === v)?.label).filter(Boolean);
  
  return (
    <div ref={dropdownRef} className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className={`
          flex items-center gap-3 px-6 py-4 transition-all w-full md:w-auto min-w-[200px] border-b-2
          text-xs font-bold tracking-widest uppercase
          ${values.length > 0 
            ? 'bg-[#0a0a0a] border-[#d4a855] text-white' 
            : 'bg-transparent border-white/10 text-neutral-400 hover:text-white hover:border-white/30'
          }
        `}
      >
        <span className="flex-1 text-left truncate">
          {values.length === 0 ? placeholder : values.length === 1 ? selectedLabels[0] : `${values.length} SÉLECTIONNÉS`}
        </span>
        <ChevronDown className={`h-3 w-3 transition-transform duration-300 ${isOpen ? 'rotate-180 text-[#d4a855]' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-0 w-full min-w-[280px] bg-[#0a0a0a] border border-white/10 border-t-0 shadow-2xl z-50">
          <div className="p-3 border-b border-white/5 flex justify-end">
            <button onClick={() => onChange([])} className="text-[10px] font-bold tracking-widest uppercase text-neutral-500 hover:text-[#9b1515] transition-colors">
              Effacer
            </button>
          </div>
          <div className="max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
            {options.map((option) => {
              const isSelected = values.includes(option.value);
              return (
                <button 
                  key={option.value} 
                  onClick={() => toggleValue(option.value)} 
                  className={`
                    w-full flex items-center gap-4 px-6 py-4 text-left transition-colors border-l-2
                    ${isSelected 
                      ? 'bg-white/5 border-[#d4a855] text-white' 
                      : 'border-transparent text-neutral-400 hover:bg-white/[0.02] hover:text-white'
                    }
                  `}
                >
                  <div className={`
                    w-4 h-4 border flex items-center justify-center transition-colors
                    ${isSelected ? 'bg-[#d4a855] border-[#d4a855]' : 'border-neutral-700'}
                  `}>
                    {isSelected && <Check className="h-3 w-3 text-black" />}
                  </div>
                  <span className="text-xs font-medium tracking-wide flex-1 uppercase">{option.label}</span>
                  {option.count !== undefined && <span className="text-[10px] text-neutral-600">{option.count}</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function SingleSelectDropdown({ icon: Icon, value, options, onChange }: { icon: React.ElementType; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void; }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) { if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setIsOpen(false); }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const selectedOption = options.find(o => o.value === value);
  
  return (
    <div ref={dropdownRef} className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className="flex items-center gap-3 px-6 py-4 bg-transparent border-b-2 border-white/10 text-neutral-400 hover:text-white hover:border-white/30 transition-all min-w-[200px] text-xs font-bold tracking-widest uppercase"
      >
        <span className="flex-1 text-left">{selectedOption?.label}</span>
        <ChevronDown className={`h-3 w-3 transition-transform duration-300 ${isOpen ? 'rotate-180 text-[#d4a855]' : ''}`} />
      </button>
      
      {isOpen && (
        <div className="absolute top-full left-0 mt-0 w-full min-w-[200px] bg-[#0a0a0a] border border-white/10 border-t-0 shadow-2xl z-50">
          {options.map((option) => (
            <button 
              key={option.value} 
              onClick={() => { onChange(option.value); setIsOpen(false); }} 
              className={`
                w-full flex items-center gap-3 px-6 py-4 text-left transition-colors border-l-2
                ${value === option.value 
                  ? 'bg-white/5 border-[#d4a855] text-[#d4a855]' 
                  : 'border-transparent text-neutral-400 hover:bg-white/[0.02] hover:text-white'
                }
              `}
            >
              <span className="text-xs font-medium tracking-wide uppercase">{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PriceRangeInput({ minPrice, maxPrice, onMinChange, onMaxChange }: { minPrice?: number; maxPrice?: number; onMinChange: (value?: number) => void; onMaxChange: (value?: number) => void; }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) { if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setIsOpen(false); }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const hasPrice = minPrice !== undefined || maxPrice !== undefined;
  const priceLabel = hasPrice ? `${minPrice ?? 0}€ - ${maxPrice ?? '∞'}€` : 'PRIX';
  
  return (
    <div ref={dropdownRef} className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className={`
          flex items-center gap-3 px-6 py-4 transition-all min-w-[160px] border-b-2 text-xs font-bold tracking-widest uppercase
          ${hasPrice 
            ? 'bg-[#0a0a0a] border-[#d4a855] text-[#d4a855]' 
            : 'bg-transparent border-white/10 text-neutral-400 hover:text-white hover:border-white/30'
          }
        `}
      >
        <span className="flex-1 text-left">{priceLabel}</span>
        <ChevronDown className={`h-3 w-3 transition-transform duration-300 ${isOpen ? 'rotate-180 text-[#d4a855]' : ''}`} />
      </button>
      
      {isOpen && (
        <div className="absolute top-full left-0 mt-0 w-[300px] bg-[#0a0a0a] border border-white/10 border-t-0 shadow-2xl z-50 p-6">
          <p className="text-[10px] font-bold tracking-widest text-[#d4a855] uppercase mb-4">Budget</p>
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1">
              <label className="text-[10px] text-neutral-500 uppercase tracking-wide mb-2 block">Min</label>
              <div className="relative">
                <input 
                  type="number" 
                  placeholder="0" 
                  value={minPrice ?? ''} 
                  onChange={(e) => onMinChange(e.target.value ? Number(e.target.value) : undefined)} 
                  className="w-full pl-3 pr-8 py-3 bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-[#d4a855]" 
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 text-xs">€</span>
              </div>
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-neutral-500 uppercase tracking-wide mb-2 block">Max</label>
              <div className="relative">
                <input 
                  type="number" 
                  placeholder="∞" 
                  value={maxPrice ?? ''} 
                  onChange={(e) => onMaxChange(e.target.value ? Number(e.target.value) : undefined)} 
                  className="w-full pl-3 pr-8 py-3 bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-[#d4a855]" 
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 text-xs">€</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {[20, 50, 100].map((price) => (
              <button 
                key={price} 
                onClick={() => onMaxChange(price)} 
                className="flex-1 py-2 text-[10px] font-bold tracking-wide uppercase bg-white/5 hover:bg-[#d4a855] text-neutral-400 hover:text-black transition-colors"
              >
                &lt; {price}€
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DealFilters({ categories, merchants, brands, onFilterChange, currentFilters }: DealFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState(currentFilters.search || '');

  useEffect(() => { setSearchValue(currentFilters.search || ''); }, [currentFilters.search]);

  useEffect(() => {
    const timer = setTimeout(() => { if (searchValue !== currentFilters.search) onFilterChange({ ...currentFilters, search: searchValue }); }, 300);
    return () => clearTimeout(timer);
  }, [searchValue, currentFilters, onFilterChange]);

  const handleChange = useCallback((key: keyof FilterState, value: unknown) => {
    if (key === 'categories') {
      const newCategories = value as string[];
      const validSubcategories = currentFilters.subcategories.filter(sub => newCategories.some((cat: string) => SUBCATEGORIES[cat]?.some(s => s.slug === sub)));
      const validSubsubcategories = currentFilters.subsubcategories.filter(subsub => validSubcategories.some(sub => SUBSUBCATEGORIES[sub]?.some(s => s.slug === subsub)));
      onFilterChange({ ...currentFilters, categories: newCategories, subcategories: validSubcategories, subsubcategories: validSubsubcategories });
    } else if (key === 'subcategories') {
      const newSubcategories = value as string[];
      const validSubsubcategories = currentFilters.subsubcategories.filter(subsub => newSubcategories.some(sub => SUBSUBCATEGORIES[sub]?.some(s => s.slug === subsub)));
      onFilterChange({ ...currentFilters, subcategories: newSubcategories, subsubcategories: validSubsubcategories });
    } else {
      onFilterChange({ ...currentFilters, [key]: value } as FilterState);
    }
  }, [currentFilters, onFilterChange]);

  const clearFilters = () => {
    setSearchValue('');
    onFilterChange({ categories: [], subcategories: [], subsubcategories: [], merchants: [], brands: [], tags: [], minPrice: undefined, maxPrice: undefined, search: '', sortBy: 'createdAt', sortOrder: 'desc', hotOnly: false });
  };

  const activeFilterCount = currentFilters.categories.length + currentFilters.subcategories.length + currentFilters.subsubcategories.length + currentFilters.merchants.length + currentFilters.brands.length + currentFilters.tags.length + (currentFilters.minPrice !== undefined ? 1 : 0) + (currentFilters.maxPrice !== undefined ? 1 : 0) + (currentFilters.hotOnly ? 1 : 0) + (currentFilters.search ? 1 : 0);

  const categoryOptions = categories.map((cat) => ({ value: cat.slug, label: cat.name, icon: cat.icon || 'Circle', count: cat._count?.products || 0 }));
  const subcategoryOptions = currentFilters.categories.flatMap(cat => (SUBCATEGORIES[cat] || []).map(sub => ({ value: sub.slug, label: sub.name })));
  const subsubcategoryOptions = currentFilters.subcategories.flatMap(sub => (SUBSUBCATEGORIES[sub] || []).map(subsub => ({ value: subsub.slug, label: subsub.name })));
  const merchantOptions = merchants.map((m) => ({ value: m.slug, label: m.name }));
  const brandOptions = brands.map((b) => ({ value: b.name, label: b.name }));
  const tagOptions = TAG_OPTIONS.map(t => ({ value: t.value, label: t.label }));

  const getActiveFilterChips = () => {
    const chips: { key: string; label: string; onRemove: () => void; variant: 'default' | 'hot' | 'price' }[] = [];
    if (currentFilters.hotOnly) chips.push({ key: 'hot', label: '🔥 Hot deals', onRemove: () => handleChange('hotOnly', false), variant: 'hot' });
    currentFilters.categories.forEach(cat => { const catObj = categories.find(c => c.slug === cat); chips.push({ key: `cat-${cat}`, label: catObj?.name || cat, onRemove: () => handleChange('categories', currentFilters.categories.filter(c => c !== cat)), variant: 'default' }); });
    currentFilters.subcategories.forEach(sub => { const subObj = subcategoryOptions.find(s => s.value === sub); chips.push({ key: `sub-${sub}`, label: subObj?.label || sub, onRemove: () => handleChange('subcategories', currentFilters.subcategories.filter(s => s !== sub)), variant: 'default' }); });
    currentFilters.subsubcategories.forEach(subsub => { const subsubObj = subsubcategoryOptions.find(s => s.value === subsub); chips.push({ key: `subsub-${subsub}`, label: subsubObj?.label || subsub, onRemove: () => handleChange('subsubcategories', currentFilters.subsubcategories.filter(s => s !== subsub)), variant: 'default' }); });
    currentFilters.merchants.forEach(merchant => { const merchantObj = merchants.find(m => m.slug === merchant); chips.push({ key: `merchant-${merchant}`, label: merchantObj?.name || merchant, onRemove: () => handleChange('merchants', currentFilters.merchants.filter(m => m !== merchant)), variant: 'default' }); });
    currentFilters.brands.forEach(brand => { chips.push({ key: `brand-${brand}`, label: brand, onRemove: () => handleChange('brands', currentFilters.brands.filter(b => b !== brand)), variant: 'default' }); });
    currentFilters.tags.forEach(tag => { const tagObj = TAG_OPTIONS.find(t => t.value === tag); chips.push({ key: `tag-${tag}`, label: tagObj?.label || tag, onRemove: () => handleChange('tags', currentFilters.tags.filter(t => t !== tag)), variant: 'default' }); });
    if (currentFilters.minPrice !== undefined || currentFilters.maxPrice !== undefined) chips.push({ key: 'price', label: `${currentFilters.minPrice ?? 0}€ - ${currentFilters.maxPrice ?? '∞'}€`, onRemove: () => onFilterChange({ ...currentFilters, minPrice: undefined, maxPrice: undefined }), variant: 'price' });
    if (currentFilters.search) chips.push({ key: 'search', label: `"${currentFilters.search}"`, onRemove: () => { setSearchValue(''); handleChange('search', ''); }, variant: 'default' });
    return chips;
  };

  const filterChips = getActiveFilterChips();

  return (
    <div className="space-y-4 mb-24">
      {/* Mobile Toggle */}
      <div className="md:hidden">
        <button 
          onClick={() => setIsOpen(!isOpen)} 
          className="w-full flex items-center justify-between px-6 py-4 bg-[#0a0a0a] border border-white/10 text-white"
        >
          <div className="flex items-center gap-4">
            <SlidersHorizontal className="h-4 w-4 text-[#d4a855]" />
            <span className="text-xs font-bold tracking-widest uppercase">Filtres</span>
            {activeFilterCount > 0 && (
              <span className="bg-[#9b1515] text-white text-[10px] font-bold px-2 py-0.5 min-w-[20px] text-center">
                {activeFilterCount}
              </span>
            )}
          </div>
          <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      <div className={`${isOpen ? 'block' : 'hidden'} md:block transition-all duration-300`}>
        {/* Main Filter Bar */}
        <div className="bg-[#0a0a0a] border border-white/10 p-2 overflow-x-auto">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-2 lg:gap-8 min-w-max lg:min-w-0 px-4">
            
            {/* Search Input */}
             <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-4 text-[#d4a855]" />
              <input
                type="text"
                placeholder="RECHERCHER DANS LES OFFRES..."
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                className="w-full pl-8 pr-4 py-4 bg-transparent border-b-2 border-white/10 text-xs font-bold tracking-widest text-white placeholder-neutral-500 focus:outline-none focus:border-[#d4a855] uppercase transition-colors"
              />
              {searchValue && (
                <button
                  onClick={() => { setSearchValue(''); handleChange('search', ''); }}
                  className="absolute right-0 top-1/2 -translate-y-1/2 p-1 text-neutral-500 hover:text-white transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Separator */}
            <div className="hidden lg:block w-px h-8 bg-white/10" />

            {/* Filters Row */}
            <div className="flex flex-wrap items-center gap-2 lg:gap-4">
              <MultiSelectDropdown
                icon={CategoryIcon}
                values={currentFilters.categories}
                options={categoryOptions}
                onChange={(v) => handleChange('categories', v)}
                placeholder="CATÉGORIES"
              />

              {(currentFilters.categories.length > 0 || currentFilters.subcategories.length > 0) && (
                <MultiSelectDropdown
                  icon={CategoryIcon}
                  values={currentFilters.subcategories}
                  options={subcategoryOptions}
                  onChange={(v) => handleChange('subcategories', v)}
                  placeholder="SOUS-CATÉGORIES"
                />
              )}

              {(currentFilters.subcategories.length > 0 || currentFilters.subsubcategories.length > 0) && (
                <MultiSelectDropdown
                  icon={CategoryIcon}
                  values={currentFilters.subsubcategories}
                  options={subsubcategoryOptions}
                  onChange={(v) => handleChange('subsubcategories', v)}
                  placeholder="TYPE"
                />
              )}

              <MultiSelectDropdown
                icon={Store}
                values={currentFilters.merchants}
                options={merchantOptions}
                onChange={(v) => handleChange('merchants', v)}
                placeholder="MARCHANDS"
              />

              <MultiSelectDropdown
                icon={Tag}
                values={currentFilters.brands}
                options={brandOptions}
                onChange={(v) => handleChange('brands', v)}
                placeholder="MARQUES"
              />

              <MultiSelectDropdown
                icon={Tag}
                values={currentFilters.tags}
                options={tagOptions}
                onChange={(v) => handleChange('tags', v)}
                placeholder="TAGS"
              />

              <PriceRangeInput
                minPrice={currentFilters.minPrice}
                maxPrice={currentFilters.maxPrice}
                onMinChange={(v) => handleChange('minPrice', v)}
                onMaxChange={(v) => handleChange('maxPrice', v)}
              />
            </div>
          </div>
          
          {/* Secondary Row (Sort & Toggles) */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-8 pt-6 border-t border-white/5 px-4">
             <div className="flex items-center gap-4 w-full sm:w-auto">
               <label className="flex items-center gap-3 cursor-pointer group select-none">
                 <div className={`
                    w-10 h-5 rounded-full relative transition-colors duration-300 
                    ${currentFilters.hotOnly ? 'bg-[#9b1515]' : 'bg-white/10 group-hover:bg-white/20'}
                 `}>
                   <div className={`
                      absolute top-1 left-1 w-3 h-3 rounded-full bg-white transition-transform duration-300
                      ${currentFilters.hotOnly ? 'translate-x-5' : 'translate-x-0'}
                   `} />
                 </div>
                 <div className="flex items-center gap-2">
                   <Flame className={`h-4 w-4 ${currentFilters.hotOnly ? 'text-[#9b1515] fill-[#9b1515]' : 'text-neutral-500'}`} />
                   <span className={`text-[10px] font-bold tracking-widest uppercase ${currentFilters.hotOnly ? 'text-white' : 'text-neutral-500'}`}>
                     Hot Deals Only
                   </span>
                 </div>
                 <input
                   type="checkbox"
                   checked={currentFilters.hotOnly}
                   onChange={(e) => handleChange('hotOnly', e.target.checked)}
                   className="hidden"
                 />
               </label>
             </div>

             <div className="flex items-center gap-4 w-full sm:w-auto justify-end">
               <span className="text-[10px] font-bold tracking-widest text-neutral-500 uppercase">Trier par:</span>
               <SingleSelectDropdown
                 icon={SortAsc}
                 value={currentFilters.sortBy}
                 options={SORT_OPTIONS}
                 onChange={(v) => handleChange('sortBy', v)}
               />
               <button
                 onClick={() => handleChange('sortOrder', currentFilters.sortOrder === 'asc' ? 'desc' : 'asc')}
                 className="p-3 border border-white/10 hover:border-white/30 text-neutral-400 hover:text-white transition-colors group"
                 title={currentFilters.sortOrder === 'asc' ? 'Croissant' : 'Décroissant'}
               >
                 <SortAsc className={`h-4 w-4 transition-transform duration-300 ${currentFilters.sortOrder === 'desc' ? 'rotate-180' : ''} group-hover:scale-110`} />
               </button>
             </div>
          </div>
        </div>
      </div>

      {/* Active Filters */}
      {filterChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 animate-fade-in px-2">
          <span className="text-[10px] font-bold tracking-widest text-neutral-500 uppercase mr-2">Filtres actifs:</span>
          {filterChips.map((chip) => (
            <FilterChip
              key={chip.key}
              label={chip.label}
              onRemove={chip.onRemove}
              variant={chip.variant}
            />
          ))}
          <button
            onClick={clearFilters}
            className="text-[10px] font-bold tracking-widest text-[#9b1515] hover:text-red-400 uppercase ml-4 transition-colors border-b border-transparent hover:border-red-400"
          >
            Tout effacer
          </button>
        </div>
      )}
    </div>
  );
}