'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Category } from '@/types';
import { SortAsc, X, ChevronDown, Flame, Tag, Store, Check, Search, SlidersHorizontal, Euro } from 'lucide-react';
import CategoryIcon from '@/components/ui/CategoryIcon';

interface SimpleMerchant { id: string; name: string; slug: string; }

interface DealFiltersProps {
  categories: Category[];
  merchants: SimpleMerchant[];
  onFilterChange: (filters: FilterState) => void;
  currentFilters: FilterState;
}

export interface FilterState {
  categories: string[];
  subcategories: string[];
  subsubcategories: string[];
  merchants: string[];
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
    default: 'bg-[#7b0a0a]/20 text-[#ff6b6b] border-[#7b0a0a]/30',
    hot: 'bg-gradient-to-r from-orange-500/20 to-red-500/20 text-orange-400 border-orange-500/30',
    price: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border ${variants[variant]}`}>
      {label}
      <button onClick={onRemove} className="hover:bg-white/10 rounded-full p-0.5 transition-colors"><X className="h-3 w-3" /></button>
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
      <button onClick={() => setIsOpen(!isOpen)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all w-full md:w-auto min-w-[180px] border ${values.length > 0 ? 'bg-[#7b0a0a]/20 border-[#7b0a0a]/50 text-[#ff6b6b]' : 'bg-[#1a1a1a] border-white/10 text-white/60 hover:bg-[#252525] hover:border-[#7b0a0a]/30'}`}>
        <Icon className="h-4 w-4 flex-shrink-0" />
        <span className="flex-1 text-left text-sm truncate">{values.length === 0 ? placeholder : values.length === 1 ? selectedLabels[0] : `${values.length} sélectionnés`}</span>
        {values.length > 0 && <span className="bg-[#7b0a0a] text-white text-xs px-1.5 py-0.5 rounded-full min-w-[20px] text-center">{values.length}</span>}
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-full min-w-[250px] bg-[#1a1a1a] border border-white/10 rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="p-2 border-b border-white/10"><button onClick={() => onChange([])} className="text-xs text-[#ff6b6b] hover:text-white transition-colors">Tout effacer</button></div>
          <div className="p-1 max-h-64 overflow-y-auto">
            {options.map((option) => {
              const isSelected = values.includes(option.value);
              return (
                <button key={option.value} onClick={() => toggleValue(option.value)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${isSelected ? 'bg-[#7b0a0a]/30 text-[#ff6b6b]' : 'text-white/60 hover:bg-white/5'}`}>
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-[#7b0a0a] border-[#7b0a0a]' : 'border-white/30 hover:border-[#7b0a0a]/50'}`}>{isSelected && <Check className="h-3 w-3 text-white" />}</div>
                  {option.icon && <CategoryIcon name={option.icon} size={16} className="text-[#9b1515]/60" />}
                  <span className="text-sm flex-1">{option.label}</span>
                  {option.count !== undefined && <span className="text-xs text-white/30">{option.count}</span>}
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
      <button onClick={() => setIsOpen(!isOpen)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1a1a1a] border border-white/10 text-white/60 hover:bg-[#252525] hover:border-[#7b0a0a]/30 transition-all min-w-[160px]">
        <Icon className="h-4 w-4 flex-shrink-0" />
        <span className="flex-1 text-left text-sm">{selectedOption?.label}</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-full min-w-[180px] bg-[#1a1a1a] border border-white/10 rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="p-1">
            {options.map((option) => (
              <button key={option.value} onClick={() => { onChange(option.value); setIsOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${value === option.value ? 'bg-[#7b0a0a]/30 text-[#ff6b6b]' : 'text-white/60 hover:bg-white/5'}`}>
                <span className="text-sm">{option.label}</span>
              </button>
            ))}
          </div>
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
  const priceLabel = hasPrice ? `${minPrice ?? 0}€ - ${maxPrice ?? '∞'}€` : 'Prix';
  return (
    <div ref={dropdownRef} className="relative">
      <button onClick={() => setIsOpen(!isOpen)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all min-w-[140px] border ${hasPrice ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'bg-[#1a1a1a] border-white/10 text-white/60 hover:bg-[#252525] hover:border-[#7b0a0a]/30'}`}>
        <Euro className="h-4 w-4 flex-shrink-0" />
        <span className="text-sm">{priceLabel}</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-[280px] bg-[#1a1a1a] border border-white/10 rounded-xl shadow-xl z-50 p-4">
          <p className="text-sm text-white/60 mb-3">Fourchette de prix</p>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="text-xs text-white/40 mb-1 block">Min</label>
              <input type="number" placeholder="0" value={minPrice ?? ''} onChange={(e) => onMinChange(e.target.value ? Number(e.target.value) : undefined)} className="w-full px-3 py-2 bg-[#252525] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#7b0a0a]/50" />
            </div>
            <span className="text-white/40 mt-5">—</span>
            <div className="flex-1">
              <label className="text-xs text-white/40 mb-1 block">Max</label>
              <input type="number" placeholder="∞" value={maxPrice ?? ''} onChange={(e) => onMaxChange(e.target.value ? Number(e.target.value) : undefined)} className="w-full px-3 py-2 bg-[#252525] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-[#7b0a0a]/50" />
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            {[20, 50, 100].map((price) => (<button key={price} onClick={() => onMaxChange(price)} className="px-3 py-1.5 text-xs bg-[#252525] hover:bg-[#7b0a0a]/20 border border-white/10 hover:border-[#7b0a0a]/30 rounded-lg text-white/60 hover:text-[#ff6b6b] transition-colors">&lt; {price}€</button>))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DealFilters({ categories, merchants, onFilterChange, currentFilters }: DealFiltersProps) {
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
    onFilterChange({ categories: [], subcategories: [], subsubcategories: [], merchants: [], tags: [], minPrice: undefined, maxPrice: undefined, search: '', sortBy: 'createdAt', sortOrder: 'desc', hotOnly: false });
  };

  const activeFilterCount = currentFilters.categories.length + currentFilters.subcategories.length + currentFilters.subsubcategories.length + currentFilters.merchants.length + currentFilters.tags.length + (currentFilters.minPrice !== undefined ? 1 : 0) + (currentFilters.maxPrice !== undefined ? 1 : 0) + (currentFilters.hotOnly ? 1 : 0) + (currentFilters.search ? 1 : 0);

  const categoryOptions = categories.map((cat) => ({ value: cat.slug, label: cat.name, icon: cat.icon || 'Circle', count: cat._count?.products || 0 }));
  const subcategoryOptions = currentFilters.categories.flatMap(cat => (SUBCATEGORIES[cat] || []).map(sub => ({ value: sub.slug, label: sub.name })));
  const subsubcategoryOptions = currentFilters.subcategories.flatMap(sub => (SUBSUBCATEGORIES[sub] || []).map(subsub => ({ value: subsub.slug, label: subsub.name })));
  const merchantOptions = merchants.map((m) => ({ value: m.slug, label: m.name }));
  const tagOptions = TAG_OPTIONS.map(t => ({ value: t.value, label: t.label }));

  const getActiveFilterChips = () => {
    const chips: { key: string; label: string; onRemove: () => void; variant: 'default' | 'hot' | 'price' }[] = [];
    if (currentFilters.hotOnly) chips.push({ key: 'hot', label: '🔥 Hot deals', onRemove: () => handleChange('hotOnly', false), variant: 'hot' });
    currentFilters.categories.forEach(cat => { const catObj = categories.find(c => c.slug === cat); chips.push({ key: `cat-${cat}`, label: catObj?.name || cat, onRemove: () => handleChange('categories', currentFilters.categories.filter(c => c !== cat)), variant: 'default' }); });
    currentFilters.subcategories.forEach(sub => { const subObj = subcategoryOptions.find(s => s.value === sub); chips.push({ key: `sub-${sub}`, label: subObj?.label || sub, onRemove: () => handleChange('subcategories', currentFilters.subcategories.filter(s => s !== sub)), variant: 'default' }); });
    currentFilters.subsubcategories.forEach(subsub => { const subsubObj = subsubcategoryOptions.find(s => s.value === subsub); chips.push({ key: `subsub-${subsub}`, label: subsubObj?.label || subsub, onRemove: () => handleChange('subsubcategories', currentFilters.subsubcategories.filter(s => s !== subsub)), variant: 'default' }); });
    currentFilters.merchants.forEach(merchant => { const merchantObj = merchants.find(m => m.slug === merchant); chips.push({ key: `merchant-${merchant}`, label: merchantObj?.name || merchant, onRemove: () => handleChange('merchants', currentFilters.merchants.filter(m => m !== merchant)), variant: 'default' }); });
    currentFilters.tags.forEach(tag => { const tagObj = TAG_OPTIONS.find(t => t.value === tag); chips.push({ key: `tag-${tag}`, label: tagObj?.label || tag, onRemove: () => handleChange('tags', currentFilters.tags.filter(t => t !== tag)), variant: 'default' }); });
    if (currentFilters.minPrice !== undefined || currentFilters.maxPrice !== undefined) chips.push({ key: 'price', label: `${currentFilters.minPrice ?? 0}€ - ${currentFilters.maxPrice ?? '∞'}€`, onRemove: () => onFilterChange({ ...currentFilters, minPrice: undefined, maxPrice: undefined }), variant: 'price' });
    if (currentFilters.search) chips.push({ key: 'search', label: `"${currentFilters.search}"`, onRemove: () => { setSearchValue(''); handleChange('search', ''); }, variant: 'default' });
    return chips;
  };

  const filterChips = getActiveFilterChips();

  return (
    <div className="space-y-4 mb-6">
      <div className="bg-[#1a1a1a] rounded-2xl border border-white/10 p-4">
        <button onClick={() => setIsOpen(!isOpen)} className="flex items-center justify-between w-full md:hidden">
          <div className="flex items-center gap-2 text-white">
            <SlidersHorizontal className="h-5 w-5" />
            <span className="font-medium">Filtres</span>
            {activeFilterCount > 0 && <span className="bg-[#7b0a0a] text-white text-xs px-2 py-0.5 rounded-full">{activeFilterCount}</span>}
          </div>
          <ChevronDown className={`h-5 w-5 text-[#9b1515] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        <div className={`${isOpen ? 'block' : 'hidden'} md:block mt-4 md:mt-0 space-y-4`}>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-white/40" />
            <input type="text" placeholder="Rechercher un produit, une marque..." value={searchValue} onChange={(e) => setSearchValue(e.target.value)} className="w-full pl-12 pr-4 py-3 bg-[#252525] border border-white/10 rounded-xl text-white placeholder-white/40 focus:outline-none focus:border-[#7b0a0a]/50 transition-colors" />
            {searchValue && <button onClick={() => setSearchValue('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"><X className="h-5 w-5" /></button>}
          </div>

          <div className="flex flex-col md:flex-row md:items-center gap-3 flex-wrap">
            <button onClick={() => handleChange('hotOnly', !currentFilters.hotOnly)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all font-medium ${currentFilters.hotOnly ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg shadow-orange-500/25' : 'bg-[#252525] border border-white/10 text-white/60 hover:bg-orange-500/20 hover:border-orange-500/30 hover:text-orange-400'}`}>
              <Flame className={`h-4 w-4 ${currentFilters.hotOnly ? 'animate-pulse' : ''}`} />
              Hot deals
            </button>

            <MultiSelectDropdown icon={Tag} values={currentFilters.categories} options={categoryOptions} onChange={(values) => handleChange('categories', values)} placeholder="Catégories" />

            {subcategoryOptions.length > 0 && <MultiSelectDropdown icon={Tag} values={currentFilters.subcategories} options={subcategoryOptions} onChange={(values) => handleChange('subcategories', values)} placeholder="Sous-catégories" />}

            {subsubcategoryOptions.length > 0 && <MultiSelectDropdown icon={Tag} values={currentFilters.subsubcategories} options={subsubcategoryOptions} onChange={(values) => handleChange('subsubcategories', values)} placeholder="Type de produit" />}

            <MultiSelectDropdown icon={Store} values={currentFilters.merchants} options={merchantOptions} onChange={(values) => handleChange('merchants', values)} placeholder="Marchands" />

            <MultiSelectDropdown icon={Tag} values={currentFilters.tags} options={tagOptions} onChange={(values) => handleChange('tags', values)} placeholder="Tags" />

            <PriceRangeInput minPrice={currentFilters.minPrice} maxPrice={currentFilters.maxPrice} onMinChange={(value) => handleChange('minPrice', value)} onMaxChange={(value) => handleChange('maxPrice', value)} />

            <div className="flex-1" />

            <SingleSelectDropdown icon={SortAsc} value={currentFilters.sortBy} options={SORT_OPTIONS} onChange={(val) => handleChange('sortBy', val)} />

            <button onClick={() => handleChange('sortOrder', currentFilters.sortOrder === 'asc' ? 'desc' : 'asc')} className="flex items-center gap-1 px-3 py-2.5 bg-[#252525] border border-white/10 rounded-xl text-white/60 hover:bg-[#7b0a0a]/20 hover:border-[#7b0a0a]/30 hover:text-[#ff6b6b] transition-all" title={currentFilters.sortOrder === 'asc' ? 'Croissant' : 'Décroissant'}>
              <span className="text-lg">{currentFilters.sortOrder === 'asc' ? '↑' : '↓'}</span>
            </button>
          </div>
        </div>
      </div>

      {filterChips.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-white/40">Filtres actifs :</span>
          {filterChips.map((chip) => <FilterChip key={chip.key} label={chip.label} onRemove={chip.onRemove} variant={chip.variant} />)}
          <button onClick={clearFilters} className="text-sm text-[#ff6b6b] hover:text-white transition-colors ml-2">Tout effacer</button>
        </div>
      )}
    </div>
  );
}