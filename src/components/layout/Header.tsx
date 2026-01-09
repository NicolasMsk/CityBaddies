'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { Search, Menu, X, Heart, ChevronDown } from 'lucide-react';
import { UserMenu } from '@/components/auth';

// Structure des catégories avec sous-catégories
const categories = [
  {
    slug: 'maquillage',
    label: 'Maquillage',
    subcategories: [
      { slug: 'teint', label: 'Teint' },
      { slug: 'yeux', label: 'Yeux' },
      { slug: 'levres', label: 'Lèvres' },
      { slug: 'sourcils', label: 'Sourcils' },
      { slug: 'palettes', label: 'Palettes' },
    ]
  },
  {
    slug: 'soins-visage',
    label: 'Soins visage',
    subcategories: [
      { slug: 'nettoyants', label: 'Nettoyants' },
      { slug: 'serums', label: 'Sérums' },
      { slug: 'cremes', label: 'Crèmes' },
      { slug: 'masques', label: 'Masques' },
      { slug: 'contour-yeux', label: 'Contour des yeux' },
    ]
  },
  {
    slug: 'soins-corps',
    label: 'Soins corps',
    subcategories: [
      { slug: 'hydratants', label: 'Hydratants' },
      { slug: 'gommages', label: 'Gommages' },
      { slug: 'huiles', label: 'Huiles' },
      { slug: 'solaires', label: 'Solaires' },
      { slug: 'douche', label: 'Douche & Bain' },
    ]
  },
  {
    slug: 'cheveux',
    label: 'Cheveux',
    subcategories: [
      { slug: 'shampoings', label: 'Shampoings' },
      { slug: 'apres-shampoings', label: 'Après-shampoings' },
      { slug: 'masques-capillaires', label: 'Masques' },
      { slug: 'huiles', label: 'Huiles' },
      { slug: 'coiffants', label: 'Coiffants' },
    ]
  },
  {
    slug: 'parfums',
    label: 'Parfums',
    subcategories: [
      { slug: 'eau-de-parfum', label: 'Eau de parfum' },
      { slug: 'eau-de-toilette', label: 'Eau de toilette' },
      { slug: 'brumes', label: 'Brumes' },
      { slug: 'coffrets-parfums', label: 'Coffrets' },
    ]
  },
  {
    slug: 'ongles',
    label: 'Ongles',
    subcategories: [
      { slug: 'vernis', label: 'Vernis' },
      { slug: 'semi-permanent', label: 'Semi-permanent' },
      { slug: 'faux-ongles', label: 'Faux ongles' },
      { slug: 'soins-ongles', label: 'Soins' },
      { slug: 'nail-art', label: 'Nail art' },
    ]
  },
  {
    slug: 'accessoires',
    label: 'Accessoires',
    subcategories: [
      { slug: 'pinceaux', label: 'Pinceaux' },
      { slug: 'eponges', label: 'Éponges' },
      { slug: 'trousses', label: 'Trousses' },
      { slug: 'miroirs', label: 'Miroirs' },
    ]
  },
];

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [openMobileCategory, setOpenMobileCategory] = useState<string | null>(null);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.location.href = `/deals?search=${encodeURIComponent(searchQuery)}`;
    }
  };

  const toggleMobileCategory = (slug: string) => {
    setOpenMobileCategory(openMobileCategory === slug ? null : slug);
  };

  return (
    <header className="bg-[#0a0a0a]/95 backdrop-blur-xl sticky top-0 z-50 border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          
          {/* Logo City Baddies */}
          <Link href="/" className="flex items-center group shrink-0">
            <Image
              src="/images/logo.png"
              alt="City Baddies"
              width={180}
              height={60}
              className="h-14 md:h-16 w-auto object-contain"
              priority
            />
          </Link>

          {/* Navigation - Desktop avec dropdowns */}
          <nav className="hidden lg:flex items-center gap-1 ml-8">
            {/* Tous les deals */}
            <Link
              href="/deals"
              className="px-3 py-2 text-xs font-medium text-neutral-400 hover:text-white transition-colors whitespace-nowrap"
            >
              Tous les deals
            </Link>

            {/* Catégories avec dropdown */}
            {categories.map((category) => (
              <div key={category.slug} className="relative group">
                <Link
                  href={`/deals?category=${category.slug}`}
                  className="flex items-center gap-1 px-3 py-2 text-xs font-medium text-neutral-400 hover:text-white transition-colors whitespace-nowrap"
                >
                  {category.label}
                  <ChevronDown className="h-3 w-3 opacity-50 group-hover:opacity-100 transition-opacity" />
                </Link>
                
                {/* Dropdown menu */}
                <div className="absolute top-full left-0 pt-2 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                  <div className="bg-[#151515] border border-white/10 rounded-xl shadow-xl py-2 min-w-[180px]">
                    {/* Voir tout */}
                    <Link
                      href={`/deals?category=${category.slug}`}
                      className="block px-4 py-2 text-xs text-[#9b1515] hover:bg-white/5 font-medium"
                    >
                      Voir tout {category.label}
                    </Link>
                    <div className="border-t border-white/5 my-1" />
                    {/* Sous-catégories */}
                    {category.subcategories.map((sub) => (
                      <Link
                        key={sub.slug}
                        href={`/deals?category=${category.slug}&subcategory=${sub.slug}`}
                        className="block px-4 py-2 text-xs text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
                      >
                        {sub.label}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-3">
            {/* Search */}
            <form onSubmit={handleSearch} className="hidden md:block">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher..."
                  className="w-48 lg:w-64 pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-full text-sm text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-[#7b0a0a]/50 focus:border-[#7b0a0a] transition-all"
                />
              </div>
            </form>

            {/* User Menu */}
            <UserMenu />

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="lg:hidden p-2.5 text-neutral-400 hover:text-white"
            >
              {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="lg:hidden py-6 border-t border-white/5 animate-fade-in">
            {/* Search Bar - Mobile */}
            <form onSubmit={handleSearch} className="mb-6">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher un produit..."
                  className="w-full pl-11 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-[#7b0a0a]/50"
                />
              </div>
            </form>

            {/* Navigation Links - Mobile avec accordéon */}
            <nav className="flex flex-col gap-1">
              {/* Tous les deals */}
              <Link
                href="/deals"
                onClick={() => setIsMenuOpen(false)}
                className="px-4 py-3 text-neutral-400 hover:text-white hover:bg-white/5 rounded-xl transition-all font-medium"
              >
                Tous les deals
              </Link>

              {/* Catégories avec sous-menus */}
              {categories.map((category) => (
                <div key={category.slug}>
                  {/* Titre catégorie */}
                  <button
                    onClick={() => toggleMobileCategory(category.slug)}
                    className="w-full flex items-center justify-between px-4 py-3 text-neutral-400 hover:text-white hover:bg-white/5 rounded-xl transition-all font-medium"
                  >
                    {category.label}
                    <ChevronDown 
                      className={`h-4 w-4 transition-transform ${openMobileCategory === category.slug ? 'rotate-180' : ''}`} 
                    />
                  </button>
                  
                  {/* Sous-catégories */}
                  {openMobileCategory === category.slug && (
                    <div className="ml-4 border-l border-white/10 pl-4 py-2 space-y-1">
                      <Link
                        href={`/deals?category=${category.slug}`}
                        onClick={() => setIsMenuOpen(false)}
                        className="block px-3 py-2 text-sm text-[#9b1515] hover:bg-white/5 rounded-lg font-medium"
                      >
                        Voir tout
                      </Link>
                      {category.subcategories.map((sub) => (
                        <Link
                          key={sub.slug}
                          href={`/deals?category=${category.slug}&subcategory=${sub.slug}`}
                          onClick={() => setIsMenuOpen(false)}
                          className="block px-3 py-2 text-sm text-neutral-500 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                        >
                          {sub.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
