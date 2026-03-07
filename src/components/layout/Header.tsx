'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useRef } from 'react';
import { UserMenu } from '@/components/auth';
import { SearchBar } from '@/components/search';

// ══════════════════════════════════════════════════════════════════════
// Catégories de deals (avec sous-catégories)
// ══════════════════════════════════════════════════════════════════════

const dealCategories = [
  {
    slug: 'parfums',
    label: 'Parfums',
    subcategories: [
      { slug: 'eau-de-parfum', label: 'Eau de parfum' },
      { slug: 'eau-de-toilette', label: 'Eau de toilette' },
      { slug: 'brumes', label: 'Brumes' },
      { slug: 'coffrets-parfums', label: 'Coffrets' },
    ],
  },
];

// ══════════════════════════════════════════════════════════════════════
// Component
// ══════════════════════════════════════════════════════════════════════

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const [mobileDealOpen, setMobileDealOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>(dealCategories[0].slug);
  const megaTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openMega = () => {
    if (megaTimeout.current) clearTimeout(megaTimeout.current);
    setMegaOpen(true);
  };

  const closeMega = () => {
    megaTimeout.current = setTimeout(() => setMegaOpen(false), 200);
  };

  const activeCat = dealCategories.find((c) => c.slug === activeCategory) || dealCategories[0];

  return (
    <header className="sticky top-0 z-50 bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-white/5">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex items-center h-14 md:h-16">

          {/* ── Logo ── */}
          <Link href="/" className="shrink-0 mr-6">
            <Image
              src="/images/logo.png"
              alt="City Baddies"
              width={140}
              height={46}
              className="h-10 md:h-12 w-auto object-contain"
              priority
            />
          </Link>

          {/* ── Desktop Nav: 3 links only ── */}
          <nav className="hidden lg:flex items-center h-full gap-0">
            {/* DEALS — triggers mega menu */}
            <div
              className="relative h-full"
              onMouseEnter={openMega}
              onMouseLeave={closeMega}
            >
              <Link
                href="/produits"
                className={`h-full flex items-center gap-1.5 px-5 text-[11px] font-bold tracking-[0.15em] uppercase transition-colors border-b-2 ${
                  megaOpen
                    ? 'text-white border-[#9b1515]'
                    : 'text-neutral-400 border-transparent hover:text-white hover:border-[#9b1515]'
                }`}
              >
                Produits
                <svg className={`w-3 h-3 transition-transform duration-200 ${megaOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </Link>
            </div>

            {/* CODES PROMO */}
            <Link
              href="/codes-promo"
              className="h-full flex items-center px-5 text-[11px] font-bold tracking-[0.15em] uppercase text-neutral-400 hover:text-white transition-colors border-b-2 border-transparent hover:border-[#d4a855]"
            >
              Codes Promo
            </Link>

            {/* GUIDES D'ACHAT */}
            <Link
              href="/guides"
              className="h-full flex items-center px-5 text-[11px] font-bold tracking-[0.15em] uppercase text-neutral-400 hover:text-white transition-colors border-b-2 border-transparent hover:border-white/30"
            >
              Guides
            </Link>
          </nav>

          {/* ── Right side ── */}
          <div className="flex items-center gap-2 ml-auto">
            <div className="hidden md:block">
              <SearchBar placeholder="Rechercher..." />
            </div>
            <UserMenu />

            {/* Mobile burger */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden p-2 text-neutral-400 hover:text-white transition-colors"
              aria-label="Menu"
            >
              {mobileOpen ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* MEGA MENU — Deals + Categories (Desktop)                     */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {megaOpen && (
        <div
          className="hidden lg:block absolute left-0 right-0 top-full z-50 border-b border-white/10 bg-[#0a0a0a]/98 backdrop-blur-xl animate-fade-in"
          onMouseEnter={openMega}
          onMouseLeave={closeMega}
        >
          <div className="max-w-7xl mx-auto px-8 py-6">
            <div className="flex gap-0">
              {/* Left column: category tabs */}
              <div className="w-52 shrink-0 border-r border-white/5 pr-4 space-y-0.5">
                <Link
                  href="/produits"
                  onClick={() => setMegaOpen(false)}
                  className="block px-3 py-2 text-[10px] font-bold tracking-[0.2em] uppercase text-[#d4a855] hover:bg-white/5 transition-colors rounded-sm mb-2"
                >
                  Tous les produits →
                </Link>
                {dealCategories.map((cat) => (
                  <Link
                    key={cat.slug}
                    href={`/categories/${cat.slug}`}
                    onClick={() => setMegaOpen(false)}
                    onMouseEnter={() => setActiveCategory(cat.slug)}
                    className={`block w-full text-left px-3 py-2.5 text-xs tracking-wide rounded-sm transition-all ${
                      activeCategory === cat.slug
                        ? 'text-white bg-white/5 font-medium'
                        : 'text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.02] font-light'
                    }`}
                  >
                    {cat.label}
                  </Link>
                ))}
              </div>

              {/* Right column: subcategories grid */}
              <div className="flex-1 pl-8">
                <div className="flex items-center gap-3 mb-5">
                  <h3 className="text-xs font-bold tracking-[0.2em] uppercase text-white">
                    {activeCat.label}
                  </h3>
                  <span className="h-px flex-1 bg-white/5" />
                  <Link
                    href={`/categories/${activeCat.slug}`}
                    onClick={() => setMegaOpen(false)}
                    className="text-[10px] font-bold tracking-[0.15em] uppercase text-[#9b1515] hover:text-[#d4a855] transition-colors"
                  >
                    Voir tout →
                  </Link>
                </div>
                <div className="grid grid-cols-3 gap-x-8 gap-y-1">
                  {activeCat.subcategories.map((sub) => (
                    <Link
                      key={sub.slug}
                      href={`/produits?category=${activeCat.slug}&subcategory=${sub.slug}`}
                      onClick={() => setMegaOpen(false)}
                      className="group flex items-center gap-2 py-2.5 text-sm text-neutral-400 hover:text-white transition-colors"
                    >
                      <span className="w-1 h-1 rounded-full bg-neutral-700 group-hover:bg-[#d4a855] transition-colors" />
                      {sub.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* MOBILE MENU                                                   */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-white/5 bg-[#0a0a0a] animate-fade-in">
          <div className="px-4 py-4 space-y-1">
            {/* Search mobile */}
            <div className="mb-4">
              <SearchBar
                isMobile
                placeholder="Rechercher un produit..."
                onClose={() => setMobileOpen(false)}
              />
            </div>

            {/* DEALS — with accordion */}
            <div>
              <button
                onClick={() => setMobileDealOpen(!mobileDealOpen)}
                className="w-full flex items-center justify-between px-3 py-3.5 text-[11px] font-bold tracking-[0.2em] uppercase text-neutral-300 hover:text-white hover:bg-white/5 transition-all rounded-sm"
              >
                Produits
                <svg className={`w-4 h-4 transition-transform duration-200 ${mobileDealOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {mobileDealOpen && (
                <div className="ml-3 border-l border-white/10 pl-3 py-1 space-y-0.5">
                  <Link
                    href="/produits"
                    onClick={() => setMobileOpen(false)}
                    className="block px-3 py-2.5 text-[10px] font-bold tracking-[0.2em] uppercase text-[#d4a855] hover:bg-white/5 rounded-sm"
                  >
                    Tous les produits →
                  </Link>
                  {dealCategories.map((cat) => (
                    <Link
                      key={cat.slug}
                      href={`/categories/${cat.slug}`}
                      onClick={() => setMobileOpen(false)}
                      className="block px-3 py-2.5 text-sm font-light text-neutral-500 hover:text-white hover:bg-white/5 transition-colors rounded-sm"
                    >
                      {cat.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* CODES PROMO */}
            <Link
              href="/codes-promo"
              onClick={() => setMobileOpen(false)}
              className="block px-3 py-3.5 text-[11px] font-bold tracking-[0.2em] uppercase text-neutral-300 hover:text-white hover:bg-white/5 transition-all rounded-sm"
            >
              Codes Promo
            </Link>

            {/* GUIDES */}
            <Link
              href="/guides"
              onClick={() => setMobileOpen(false)}
              className="block px-3 py-3.5 text-[11px] font-bold tracking-[0.2em] uppercase text-neutral-300 hover:text-white hover:bg-white/5 transition-all rounded-sm"
            >
              Guides d&apos;achat
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
