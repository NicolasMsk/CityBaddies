import { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { getAllPromoPages, stripHtml } from '@/lib/promo-queries';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://citybaddies.com';

// Mois courant dans le title — jamais de date codée en dur (un title « Février »
// affiché en juillet ruine la crédibilité fraîcheur en SERP).
const moisCourant = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(new Date());
const moisTitre = moisCourant.charAt(0).toUpperCase() + moisCourant.slice(1);

export const metadata: Metadata = {
  title: `Codes Promo Beauté — ${moisTitre} | City Baddies`,
  description: 'Tous les codes promo et bons de réduction beauté valides : Sephora, Nocibé, Marionnaud. Réductions vérifiées par la communauté.',
  alternates: { canonical: `${BASE_URL}/codes-promo` },
  openGraph: {
    title: 'Codes Promo Beauté — City Baddies',
    description: 'Tous les codes promo beauté valides du moment',
    url: `${BASE_URL}/codes-promo`,
  },
};

export const dynamic = 'force-dynamic';

export default async function CodesPromoPage() {
  const promoPages = await getAllPromoPages();

  return (
    <div className="min-h-screen bg-[#0a0a0a] selection:bg-[#d4a855] selection:text-black">
      {/* Ambient Glows */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-[#9b1515] rounded-full blur-[120px] opacity-[0.04]" />
        <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-[#d4a855] rounded-full blur-[100px] opacity-[0.03]" />
      </div>

      {/* Hero Section */}
      <section className="relative z-10 pt-32 pb-20 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl animate-fade-in">
            <div className="flex items-center gap-3 mb-8">
              <span className="h-[1px] w-12 bg-[#d4a855]" />
              <span className="text-[#d4a855] text-xs font-bold tracking-[0.2em] uppercase">
                Codes Promo
              </span>
            </div>

            <h1 className="text-5xl md:text-7xl lg:text-8xl font-serif text-white leading-[0.85] tracking-tight mb-8">
              <span className="block italic font-light opacity-90">Tes codes</span>
              <span className="block font-medium">Beauté.</span>
            </h1>

            <p className="text-xl md:text-2xl text-neutral-400 font-light max-w-xl border-l border-white/20 pl-6">
              Réductions vérifiées sur les plus grandes enseignes.
              <span className="text-white/50 text-base block mt-2">
                Mis à jour quotidiennement par la communauté.
              </span>
            </p>
          </div>
        </div>
      </section>

      {/* Merchants Grid */}
      <section className="relative z-10 py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {promoPages.length === 0 ? (
            <div className="text-center py-24 border border-white/5 bg-white/[0.02] rounded-2xl">
              <span className="block text-6xl font-serif text-white/10 mb-6">0</span>
              <p className="text-neutral-400 text-lg font-light tracking-wide uppercase">
                Aucune offre disponible
              </p>
              <p className="text-neutral-600 mt-2 text-sm font-light">
                Revenez plus tard.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-end justify-between mb-12">
                <div>
                  <div className="flex items-center gap-4 mb-4">
                    <span className="h-px w-8 bg-[#9b1515]" />
                    <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-[#9b1515]">
                      Par Enseigne
                    </span>
                  </div>
                  <h2 className="text-4xl md:text-5xl font-thin text-white tracking-tight leading-none">
                    {promoPages.length} {promoPages.length > 1 ? 'ENSEIGNES' : 'ENSEIGNE'}{' '}
                    <span className="italic font-normal text-[#d4a855]">DISPONIBLES</span>
                  </h2>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {promoPages.map((page) => {
                  const realCodeCount = page.merchant?._count?.promoCodes ?? 0;
                  const merchantName = page.merchant?.name || page.canonicalSlug.charAt(0).toUpperCase() + page.canonicalSlug.slice(1);
                  const logoUrl = page.merchant?.logoUrl;

                  return (
                  <Link
                    key={page.id}
                    href={`/codes-promo/${page.canonicalSlug}`}
                    className="group bg-white/[0.03] border border-white/10 rounded-2xl hover:bg-white/[0.06] transition-all duration-500 relative overflow-hidden"
                  >
                    <div className="flex flex-col md:flex-row">
                      {/* Logo Section */}
                      <div className="flex items-center justify-center p-8 md:p-12 md:w-64 md:border-r border-b md:border-b-0 border-white/5 bg-white rounded-tl-2xl md:rounded-bl-2xl md:rounded-tr-none">
                        {logoUrl ? (
                          <Image
                            src={logoUrl}
                            alt={merchantName}
                            width={120}
                            height={120}
                            className="object-contain group-hover:scale-105 transition-transform duration-500"
                            unoptimized
                          />
                        ) : (
                          <span className="text-4xl font-serif text-white/20 uppercase tracking-widest">
                            {merchantName.charAt(0)}
                          </span>
                        )}
                      </div>

                      {/* Content Section */}
                      <div className="flex-1 p-8 md:p-10">
                        <h3 className="text-3xl font-light text-white tracking-wide uppercase mb-2 group-hover:text-[#d4a855] transition-colors">
                          {merchantName}
                        </h3>

                        {page.heroSubtitle && (
                          <p className="text-sm text-neutral-500 font-light mb-6 leading-relaxed">
                            {page.heroSubtitle}
                          </p>
                        )}

                        {/* Stats Row */}
                        <div className="flex items-center gap-8 mb-6">
                          {realCodeCount > 0 && (
                            <div>
                              <p className="text-3xl font-serif text-white">
                                {realCodeCount}
                              </p>
                              <p className="text-[10px] text-neutral-500 uppercase tracking-widest">
                                Code{realCodeCount > 1 ? 's' : ''} actif{realCodeCount > 1 ? 's' : ''}
                              </p>
                            </div>
                          )}

                          {page.bestCurrentDiscount && (
                            <div className="border-l border-white/10 pl-8">
                              <p className="text-3xl font-serif text-[#d4a855]">
                                -{page.bestCurrentDiscount}%
                              </p>
                              <p className="text-[10px] text-neutral-500 uppercase tracking-widest">
                                Meilleure promo
                              </p>
                            </div>
                          )}

                          {page.averageDiscount && (
                            <div className="border-l border-white/10 pl-8 hidden md:block">
                              <p className="text-3xl font-serif text-neutral-400">
                                ~{page.averageDiscount.toFixed(0)}%
                              </p>
                              <p className="text-[10px] text-neutral-500 uppercase tracking-widest">
                                Moy.
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Introduction Preview — stripped of HTML */}
                        {page.introduction && (
                          <p className="text-neutral-500 text-sm font-light line-clamp-2 mb-6 leading-relaxed max-w-2xl">
                            {stripHtml(page.introduction).substring(0, 180)}...
                          </p>
                        )}

                        {/* Footer */}
                        <div className="flex items-center justify-between pt-6 border-t border-white/5">
                          {page.lastVerifiedAt && (
                            <p className="text-[10px] text-neutral-600 flex items-center gap-2 uppercase tracking-widest font-medium">
                              <span className="inline-block w-1.5 h-1.5 bg-emerald-500 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                              Vérifié
                            </p>
                          )}

                          <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-white/40 group-hover:text-[#d4a855] transition-colors border-b border-transparent group-hover:border-[#d4a855]/50 pb-0.5">
                            Voir l'enseigne
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </section>

      {/* SEO Footer - How It Works */}
      <section className="relative z-10 py-24 border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-light text-white mb-4 tracking-tight">
              COMMENT <span className="font-semibold text-[#d4a855]">ÇA MARCHE</span>
            </h2>
            <p className="text-neutral-500 text-sm tracking-widest uppercase">
              Profite des codes promo beauté en toute simplicité
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-px bg-white/10 border border-white/10 rounded-2xl overflow-hidden">
            <div className="bg-[#0a0a0a] p-10 group hover:bg-[#111] transition-colors relative overflow-hidden">
              <span className="text-6xl font-serif text-white/5 absolute top-4 right-4 group-hover:text-[#d4a855]/10 transition-colors">01</span>
              <h3 className="text-lg font-bold uppercase tracking-widest mb-4 text-white pt-8">
                Codes Vérifiés
              </h3>
              <p className="text-neutral-500 font-light leading-relaxed group-hover:text-neutral-400 transition-colors relative z-10">
                Tous nos codes sont testés régulièrement par la communauté pour garantir qu&apos;ils fonctionnent.
              </p>
            </div>
            <div className="bg-[#0a0a0a] p-10 group hover:bg-[#111] transition-colors relative overflow-hidden">
              <span className="text-6xl font-serif text-white/5 absolute top-4 right-4 group-hover:text-[#d4a855]/10 transition-colors">02</span>
              <h3 className="text-lg font-bold uppercase tracking-widest mb-4 text-white pt-8">
                Mise à Jour Quotidienne
              </h3>
              <p className="text-neutral-500 font-light leading-relaxed group-hover:text-neutral-400 transition-colors relative z-10">
                Nouveaux codes ajoutés chaque jour, codes expirés automatiquement retirés de nos listes.
              </p>
            </div>
            <div className="bg-[#0a0a0a] p-10 group hover:bg-[#111] transition-colors relative overflow-hidden">
              <span className="text-6xl font-serif text-white/5 absolute top-4 right-4 group-hover:text-[#d4a855]/10 transition-colors">03</span>
              <h3 className="text-lg font-bold uppercase tracking-widest mb-4 text-white pt-8">
                Meilleurs Deals
              </h3>
              <p className="text-neutral-500 font-light leading-relaxed group-hover:text-neutral-400 transition-colors relative z-10">
                Comparez les réductions et trouvez les meilleures offres sur vos marques préférées.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
