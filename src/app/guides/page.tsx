import prisma from '@/lib/prisma';
import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { BookOpen, Calendar, ArrowRight, Sparkles, Crown, Tag, Flame } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import NewsletterSection from '@/components/layout/NewsletterSection';

export const dynamic = 'force-dynamic';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://citybaddies.com';

export const metadata: Metadata = {
  title: 'Guides d\'Achat Beauté 2025 | Comparatifs & Avis Experts - City Baddies',
  description: 'Nos guides d\'achat beauté pour choisir les meilleurs produits maquillage, skincare et parfums. Comparatifs honnêtes, avis experts et bons plans vérifiés.',
  // ... (reste inchangé)
};

// Couleurs plus premium et "froides/classe"
const CATEGORY_STYLES: Record<string, string> = {
  'maquillage': 'text-pink-400 border-pink-400/20 bg-pink-500/10',
  'soins-visage': 'text-violet-400 border-violet-400/20 bg-violet-500/10',
  'soins-corps': 'text-amber-400 border-amber-400/20 bg-amber-500/10',
  'cheveux': 'text-emerald-400 border-emerald-400/20 bg-emerald-500/10',
  'parfums': 'text-indigo-400 border-indigo-400/20 bg-indigo-500/10',
  'ongles': 'text-rose-400 border-rose-400/20 bg-rose-500/10',
  'accessoires': 'text-cyan-400 border-cyan-400/20 bg-cyan-500/10',
  'default': 'text-[#d4a855] border-[#d4a855]/20 bg-[#d4a855]/10',
};

async function getGuides() {
  const guides = await prisma.buyingGuide.findMany({
    where: { status: 'PUBLISHED' },
    include: {
      products: {
        include: {
          deal: {
            include: {
              product: { include: { brandRef: true } }, // Optimisation payload
            },
          },
        },
        orderBy: { rank: 'asc' },
        take: 3,
      },
    },
    orderBy: { publishedAt: 'desc' },
  });
  return guides;
}

export default async function GuidesPage() {
  const guides = await getGuides();

  // Structured data - CollectionPage
  const collectionSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Guides d\'Achat Beauté - City Baddies',
    description: 'Collection de guides d\'achat beauté avec comparatifs et avis experts.',
    url: `${BASE_URL}/guides`,
    numberOfItems: guides.length,
    hasPart: guides.map((g) => ({
      '@type': 'Article',
      name: g.title,
      url: `${BASE_URL}/guides/${g.slug}`,
      datePublished: g.publishedAt?.toISOString(),
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionSchema) }}
      />

      {/* Hero Section Editorial */}
      <section className="relative pt-24 pb-20 md:pt-32 md:pb-24 overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-[#0a0a0a]" />
        
        {/* Abstract Background Shapes */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-full opacity-30 pointer-events-none">
          <div className="absolute top-10 left-10 w-96 h-96 bg-[#9b1515] rounded-full blur-[120px] mix-blend-screen opacity-20" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-[#d4a855] rounded-full blur-[120px] mix-blend-screen opacity-10" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-md mb-8">
            <Sparkles className="h-3.5 w-3.5 text-[#d4a855]" />
            <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-neutral-300">
              City Baddies Originals
            </span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-white mb-6 leading-[1.1]">
            THE BUYING <br className="md:hidden" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#d4a855] via-[#f0d68a] to-[#d4a855]">
              GUIDES
            </span>
          </h1>
          
          <p className="text-lg md:text-xl text-neutral-400 font-light max-w-2xl mx-auto leading-relaxed">
            Pas de blabla, que des pépites. Nos experts analysent le marché pour dénicher 
            la crème de la crème (littéralement).
          </p>
        </div>
      </section>

      {/* Guides Grid */}
      <section className="relative z-10 -mt-10 pb-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {guides.length === 0 ? (
          <div className="text-center py-20 bg-[#111] border border-white/5 rounded-2xl">
            <BookOpen className="h-16 w-16 text-neutral-700 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Coming Soon</h2>
            <p className="text-neutral-500">Nos experts sont en train de tester les produits...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {guides.map((guide, index) => {
              const catStyle = CATEGORY_STYLES[guide.category] || CATEGORY_STYLES['default'];
              const productCount = guide.products.length;
              const isNew = index === 0;

              return (
                <Link
                  key={guide.id}
                  href={`/guides/${guide.slug}`}
                  className="group relative flex flex-col h-full bg-[#111] hover:bg-[#161616] border border-white/5 hover:border-[#d4a855]/30 transition-all duration-500 rounded-xl overflow-hidden shadow-2xl hover:shadow-[0_0_30px_rgba(0,0,0,0.5)] hover:-translate-y-1"
                >
                  {/* Image Hero */}
                  <div className="relative aspect-[4/3] overflow-hidden">
                    {guide.heroImageUrl ? (
                      <Image
                        src={guide.heroImageUrl}
                        alt={guide.title}
                        fill
                        className="object-cover group-hover:scale-110 transition-transform duration-700 ease-in-out"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      />
                    ) : (
                      <div className="w-full h-full bg-neutral-900 flex items-center justify-center">
                        <BookOpen className="h-12 w-12 text-neutral-700" />
                      </div>
                    )}
                    
                    <div className="absolute inset-0 bg-gradient-to-t from-[#111] via-transparent to-transparent opacity-90" />
                    
                    {/* Tags overlay */}
                    <div className="absolute top-4 left-4 flex gap-2">
                       <span className={`px-2.5 py-1 text-[10px] font-bold tracking-widest uppercase rounded border ${catStyle}`}>
                          {guide.category}
                       </span>
                       {isNew && (
                         <span className="px-2.5 py-1 text-[10px] font-bold tracking-widest uppercase rounded bg-[#9b1515] text-white border border-[#9b1515] animate-pulse">
                           New
                         </span>
                       )}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex flex-col flex-1 p-6">
                    <h2 className="text-xl md:text-2xl font-bold text-white leading-tight mb-3 group-hover:text-[#d4a855] transition-colors">
                      {guide.title}
                    </h2>

                    <div className="flex items-center gap-3 mt-auto pt-6 border-t border-white/5">
                      {guide.products.length > 0 && (
                        <div className="flex -space-x-2">
                          {guide.products.slice(0, 3).map((gp) => (
                             <div key={gp.id} className="relative h-8 w-8 rounded-full border border-[#111] bg-white overflow-hidden">
                               {gp.deal.product.imageUrl && (
                                 <Image 
                                   src={gp.deal.product.imageUrl} 
                                   alt="" 
                                   fill 
                                   className="object-cover"
                                   sizes="32px"
                                 />
                               )}
                             </div>
                          ))}
                        </div>
                      )}
                      
                      <div className="flex flex-col ml-1">
                        <span className="text-xs font-medium text-white">
                          {productCount} produits
                        </span>
                        <span className="text-[10px] text-neutral-500">
                           {guide.publishedAt && formatDistanceToNow(new Date(guide.publishedAt), { addSuffix: true, locale: fr })}
                        </span>
                      </div>

                      <div className="ml-auto">
                        <span className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-white/5 text-[#d4a855] group-hover:bg-[#d4a855] group-hover:text-black transition-all duration-300">
                          <ArrowRight className="h-4 w-4" />
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <NewsletterSection />
    </>
  );
}
