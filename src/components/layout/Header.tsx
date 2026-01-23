'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { Menu, X, ChevronDown } from 'lucide-react';
import { UserMenu } from '@/components/auth';
import { SearchBar } from '@/components/search';

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
    label: 'Visage',
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
    label: 'Corps',
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
  const [openMobileCategory, setOpenMobileCategory] = useState<string | null>(null);

  const toggleMobileCategory = (slug: string) => {
    setOpenMobileCategory(openMobileCategory === slug ? null : slug);
  };

  return (
    <header className="bg-[#0a0a0a]/95 backdrop-blur-xl sticky top-0 z-50 border-b border-white/5">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex items-center h-16 md:h-20">
          
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
          <nav className="hidden lg:flex items-center gap-1 ml-4 h-full">
            {/* Tous les deals */}
            <Link
              href="/deals"
              className="px-2 xl:px-4 h-full flex items-center text-[10px] font-bold tracking-[0.1em] uppercase text-neutral-400 hover:text-white transition-colors border-b-2 border-transparent hover:border-[#9b1515]"
            >
              Deals
            </Link>

            {/* Catégories avec dropdown */}
            {categories.map((category) => (
              <div key={category.slug} className="relative group h-full flex items-center">
                <Link
                  href={`/deals?category=${category.slug}`}
                  className="flex items-center gap-1 px-2 xl:px-4 h-full text-[10px] font-bold tracking-[0.1em] uppercase text-neutral-400 hover:text-white transition-colors border-b-2 border-transparent group-hover:border-[#9b1515]"
                >
                  {category.label}
                  <ChevronDown className="h-3 w-3 opacity-50 group-hover:opacity-100 transition-opacity" />
                </Link>
                
                {/* Dropdown menu */}
                <div className="absolute top-full left-0 pt-0 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                  <div className="bg-[#0a0a0a] border border-white/10 shadow-2xl min-w-[200px] p-2">
                    {/* Voir tout */}
                    <Link
                      href={`/deals?category=${category.slug}`}
                      className="block px-4 py-3 text-[10px] font-bold tracking-[0.15em] uppercase text-[#d4a855] hover:bg-white/5 transition-colors"
                    >
                      Voir tout {category.label}
                    </Link>
                    <div className="border-t border-white/5 my-1" />
                    {/* Sous-catégories */}
                    {category.subcategories.map((sub) => (
                      <Link
                        key={sub.slug}
                        href={`/deals?category=${category.slug}&subcategory=${sub.slug}`}
                        className="block px-4 py-2 text-xs text-neutral-400 hover:text-white hover:bg-white/5 transition-colors font-light tracking-wide"
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
          <div className="flex items-center gap-3 ml-auto">
            {/* Search avec autocomplete */}
            <div className="hidden md:block">
              <SearchBar placeholder="Rechercher..." />
            </div>

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
            {/* Search Bar - Mobile avec autocomplete */}
            <div className="mb-6">
              <SearchBar 
                isMobile 
                placeholder="Rechercher un produit..." 
                onClose={() => setIsMenuOpen(false)}
              />
            </div>

            {/* Navigation Links - Mobile avec accordéon */}
            <nav className="flex flex-col gap-1">
              {/* Tous les deals */}
              <Link
                href="/deals"
                onClick={() => setIsMenuOpen(false)}
                className="px-4 py-4 text-[12px] font-bold tracking-[0.2em] uppercase text-neutral-400 hover:text-white hover:bg-white/5 transition-all border-l-2 border-transparent hover:border-[#9b1515]"
              >
                Tous les deals
              </Link>

              {/* Catégories avec sous-menus */}
              {categories.map((category) => (
                <div key={category.slug}>
                  {/* Titre catégorie */}
                  <button
                    onClick={() => toggleMobileCategory(category.slug)}
                    className="w-full flex items-center justify-between px-4 py-4 text-[12px] font-bold tracking-[0.2em] uppercase text-neutral-400 hover:text-white hover:bg-white/5 transition-all border-l-2 border-transparent hover:border-[#9b1515]"
                  >
                    {category.label}
                    <ChevronDown 
                      className={`h-4 w-4 transition-transform ${openMobileCategory === category.slug ? 'rotate-180' : ''}`} 
                    />
                  </button>
                  
                  {/* Sous-catégories */}
                  {openMobileCategory === category.slug && (
                    <div className="ml-4 border-l border-white/10 pl-4 py-2 space-y-1 bg-white/[0.02]">
                      <Link
                        href={`/deals?category=${category.slug}`}
                        onClick={() => setIsMenuOpen(false)}
                        className="block px-3 py-3 text-xs text-[#d4a855] font-bold tracking-wider hover:bg-white/5 uppercase"
                      >
                        Voir tout
                      </Link>
                      {category.subcategories.map((sub) => (
                        <Link
                          key={sub.slug}
                          href={`/deals?category=${category.slug}&subcategory=${sub.slug}`}
                          onClick={() => setIsMenuOpen(false)}
                          className="block px-3 py-3 text-sm font-light text-neutral-500 hover:text-white hover:bg-white/5 transition-colors"
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
