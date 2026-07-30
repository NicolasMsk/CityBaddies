'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useRef } from 'react';
import { UserMenu } from '@/components/auth';
import { SearchBar } from '@/components/search';

// ══════════════════════════════════════════════════════════════════════
// Navigation — chaque lien mène à une page RÉELLE avec du contenu.
// ⚠️ Les anciennes sous-catégories (eau-de-toilette, brumes, coffrets…)
// pointaient vers des listes vides (subcategory absente en base) : ne pas
// les réintroduire sans vérifier la donnée.
// ══════════════════════════════════════════════════════════════════════

// Top maisons du mega menu — les plus cherchées. La liste complète (34) vit
// sur /marques ; on fige ici les valeurs sûres (le header est un client
// component, pas d'accès DB).
const megaBrands = [
  { slug: 'chanel', label: 'Chanel' },
  { slug: 'christian-dior', label: 'Dior' },
  { slug: 'lancome', label: 'Lancôme' },
  { slug: 'yves-saint-laurent', label: 'Yves Saint Laurent' },
  { slug: 'guerlain', label: 'Guerlain' },
  { slug: 'rabanne', label: 'Rabanne' },
  { slug: 'thierry-mugler', label: 'Mugler' },
  { slug: 'giorgio-armani', label: 'Giorgio Armani' },
  { slug: 'jean-paul-gaultier', label: 'Jean Paul Gaultier' },
  { slug: 'carolina-herrera', label: 'Carolina Herrera' },
];

const megaExplore = [
  { href: '/produits', label: 'Tous les parfums comparés' },
  { href: '/parfums-moins-de-50-euros', label: 'À moins de 50 €' },
  { href: '/sephora-vs-nocibe-vs-marionnaud', label: 'Le match des enseignes' },
  { href: '/observatoire-des-prix', label: 'Observatoire des prix' },
  { href: '/methodologie', label: 'Comment on relève les prix' },
];

// ══════════════════════════════════════════════════════════════════════
// Component
// ══════════════════════════════════════════════════════════════════════

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const [mobileParfumsOpen, setMobileParfumsOpen] = useState(false);
  const [mobileMarquesOpen, setMobileMarquesOpen] = useState(false);
  const megaTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openMega = () => {
    if (megaTimeout.current) clearTimeout(megaTimeout.current);
    setMegaOpen(true);
  };

  const closeMega = () => {
    megaTimeout.current = setTimeout(() => setMegaOpen(false), 200);
  };

  const closeAllMobile = () => {
    setMobileOpen(false);
    setMobileParfumsOpen(false);
    setMobileMarquesOpen(false);
  };

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

          {/* ── Desktop Nav ── */}
          <nav className="hidden lg:flex items-center h-full gap-0">
            {/* PARFUMS — mega menu */}
            <div
              className="relative h-full"
              onMouseEnter={openMega}
              onMouseLeave={closeMega}
            >
              <Link
                href="/produits"
                className={`h-full flex items-center gap-1.5 px-5 text-[11px] font-bold tracking-[0.15em] uppercase transition-colors border-b-2 ${
                  megaOpen
                    ? 'text-white border-[#d4a855]'
                    : 'text-neutral-400 border-transparent hover:text-white hover:border-[#d4a855]'
                }`}
              >
                Parfums
                <svg className={`w-3 h-3 transition-transform duration-200 ${megaOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </Link>
            </div>

            {/* MARQUES */}
            <Link
              href="/marques"
              className="h-full flex items-center px-5 text-[11px] font-bold tracking-[0.15em] uppercase text-neutral-400 hover:text-white transition-colors border-b-2 border-transparent hover:border-[#d4a855]"
            >
              Marques
            </Link>

            {/* CODES PROMO */}
            <Link
              href="/codes-promo"
              className="h-full flex items-center px-5 text-[11px] font-bold tracking-[0.15em] uppercase text-neutral-400 hover:text-white transition-colors border-b-2 border-transparent hover:border-[#d4a855]"
            >
              Codes Promo
            </Link>

            {/* GUIDES */}
            <Link
              href="/guides"
              className="h-full flex items-center px-5 text-[11px] font-bold tracking-[0.15em] uppercase text-neutral-400 hover:text-white transition-colors border-b-2 border-transparent hover:border-[#d4a855]"
            >
              Guides
            </Link>
          </nav>

          {/* ── Right side ── */}
          <div className="flex items-center gap-2 ml-auto">
            <div className="hidden md:block">
              <SearchBar placeholder="Chercher un parfum, une marque…" />
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
      {/* MEGA MENU — Parfums (Desktop)                                  */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {megaOpen && (
        <div
          className="hidden lg:block absolute left-0 right-0 top-full z-50 border-b border-white/10 bg-[#0a0a0a]/98 backdrop-blur-xl animate-fade-in"
          onMouseEnter={openMega}
          onMouseLeave={closeMega}
        >
          <div className="max-w-6xl mx-auto px-8 py-8">
            <div className="grid grid-cols-12 gap-10">

              {/* Explorer */}
              <div className="col-span-4">
                <h3 className="text-[10px] font-bold tracking-[0.25em] uppercase text-[#d4a855] mb-5">
                  Explorer
                </h3>
                <div className="space-y-0.5">
                  {megaExplore.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMegaOpen(false)}
                      className="group flex items-center gap-2.5 py-2.5 text-sm font-light text-neutral-400 hover:text-white transition-colors"
                    >
                      <span className="w-1 h-1 rounded-full bg-neutral-700 group-hover:bg-[#d4a855] transition-colors" />
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>

              {/* Par marque */}
              <div className="col-span-5 border-l border-white/5 pl-10">
                <div className="flex items-center gap-3 mb-5">
                  <h3 className="text-[10px] font-bold tracking-[0.25em] uppercase text-[#d4a855]">
                    Par marque
                  </h3>
                  <span className="h-px flex-1 bg-white/5" />
                  <Link
                    href="/marques"
                    onClick={() => setMegaOpen(false)}
                    className="text-[10px] font-bold tracking-[0.15em] uppercase text-neutral-500 hover:text-[#d4a855] transition-colors"
                  >
                    Les 30+ maisons →
                  </Link>
                </div>
                <div className="grid grid-cols-2 gap-x-8 gap-y-0.5">
                  {megaBrands.map((b) => (
                    <Link
                      key={b.slug}
                      href={`/marques/${b.slug}`}
                      onClick={() => setMegaOpen(false)}
                      className="py-2 font-serif text-sm text-neutral-400 hover:text-white transition-colors"
                    >
                      {b.label}
                    </Link>
                  ))}
                </div>
              </div>

              {/* La promesse — rappel de la méthode, pas un slogan creux */}
              <div className="col-span-3 border-l border-white/5 pl-10 flex flex-col justify-between">
                <div>
                  <p className="font-serif italic text-lg text-white/85 leading-snug mb-4">
                    «&nbsp;Le vrai prix,<br />pas le fake.&nbsp;»
                  </p>
                  <p className="font-mono text-[10px] text-neutral-500 leading-relaxed tracking-wide">
                    Prix relevés 6×/jour chez Sephora, Nocibé et Marionnaud — chaque contenance, avec historique.
                  </p>
                </div>
                <Link
                  href="/produits"
                  onClick={() => setMegaOpen(false)}
                  className="mt-6 inline-flex items-center justify-center px-5 py-3 bg-white text-black text-[10px] font-bold tracking-[0.2em] uppercase hover:bg-neutral-200 transition-colors"
                >
                  Comparer maintenant
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* MOBILE MENU                                                    */}
      {/* ══════════════════════════════════════════════════════════════ */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-white/5 bg-[#0a0a0a] animate-fade-in max-h-[calc(100vh-3.5rem)] overflow-y-auto">
          <div className="px-4 py-4 space-y-1">
            {/* Search mobile */}
            <div className="mb-4">
              <SearchBar
                isMobile
                placeholder="Chercher un parfum, une marque…"
                onClose={closeAllMobile}
              />
            </div>

            {/* PARFUMS — accordion */}
            <div>
              <button
                onClick={() => setMobileParfumsOpen(!mobileParfumsOpen)}
                className="w-full flex items-center justify-between px-3 py-3.5 text-[11px] font-bold tracking-[0.2em] uppercase text-neutral-300 hover:text-white hover:bg-white/5 transition-all rounded-sm"
              >
                Parfums
                <svg className={`w-4 h-4 transition-transform duration-200 ${mobileParfumsOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {mobileParfumsOpen && (
                <div className="ml-3 border-l border-white/10 pl-3 py-1 space-y-0.5">
                  {megaExplore.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={closeAllMobile}
                      className="block px-3 py-2.5 text-sm font-light text-neutral-500 hover:text-white hover:bg-white/5 transition-colors rounded-sm"
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* MARQUES — accordion */}
            <div>
              <button
                onClick={() => setMobileMarquesOpen(!mobileMarquesOpen)}
                className="w-full flex items-center justify-between px-3 py-3.5 text-[11px] font-bold tracking-[0.2em] uppercase text-neutral-300 hover:text-white hover:bg-white/5 transition-all rounded-sm"
              >
                Marques
                <svg className={`w-4 h-4 transition-transform duration-200 ${mobileMarquesOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {mobileMarquesOpen && (
                <div className="ml-3 border-l border-white/10 pl-3 py-1 space-y-0.5">
                  {megaBrands.slice(0, 6).map((b) => (
                    <Link
                      key={b.slug}
                      href={`/marques/${b.slug}`}
                      onClick={closeAllMobile}
                      className="block px-3 py-2.5 font-serif text-sm text-neutral-500 hover:text-white hover:bg-white/5 transition-colors rounded-sm"
                    >
                      {b.label}
                    </Link>
                  ))}
                  <Link
                    href="/marques"
                    onClick={closeAllMobile}
                    className="block px-3 py-2.5 text-[10px] font-bold tracking-[0.2em] uppercase text-[#d4a855] hover:bg-white/5 rounded-sm"
                  >
                    Toutes les marques →
                  </Link>
                </div>
              )}
            </div>

            {/* CODES PROMO */}
            <Link
              href="/codes-promo"
              onClick={closeAllMobile}
              className="block px-3 py-3.5 text-[11px] font-bold tracking-[0.2em] uppercase text-neutral-300 hover:text-white hover:bg-white/5 transition-all rounded-sm"
            >
              Codes Promo
            </Link>

            {/* GUIDES */}
            <Link
              href="/guides"
              onClick={closeAllMobile}
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
