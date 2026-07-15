import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import prisma from '@/lib/prisma';
import type { Metadata } from 'next';
import { ArrowLeft, ArrowRight, Calendar, BookOpen, Tag, ExternalLink, Crown, Star, Sparkles, CheckCircle2, AlertCircle, ChevronDown, Flame, Info } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import NewsletterSection from '@/components/layout/NewsletterSection';

export const dynamic = 'force-dynamic';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://citybaddies.com';

// Styles des catégories (cohérent avec la page liste)
const CATEGORY_STYLES: Record<string, { text: string; bg: string; border: string }> = {
  'maquillage': { text: 'text-pink-400', bg: 'bg-pink-500/10', border: 'border-pink-500/20' },
  'soins-visage': { text: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
  'soins-corps': { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  'cheveux': { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  'parfums': { text: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' },
  'ongles': { text: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20' },
  'accessoires': { text: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20' },
  'default': { text: 'text-[#d4a855]', bg: 'bg-[#d4a855]/10', border: 'border-[#d4a855]/20' },
};

// Styles des rangs (1, 2, 3)
const RANK_STYLES: Record<number, { border: string; badge: string; shadow: string; title: string; text: string }> = {
  1: { 
    border: 'border-[#d4a855]', 
    badge: 'bg-[#d4a855] text-black shadow-[0_0_20px_rgba(212,168,85,0.4)]', 
    shadow: 'shadow-[0_0_80px_-20px_rgba(212,168,85,0.25)]',
    title: 'L\'INCONTOURNABLE',
    text: 'text-[#d4a855]'
  },
  2: { 
    border: 'border-neutral-500', 
    badge: 'bg-neutral-200 text-black', 
    shadow: 'shadow-[0_0_60px_-20px_rgba(255,255,255,0.1)]',
    title: 'CHOIX DE LA RÉDACTION',
    text: 'text-neutral-300'
  },
  3: { 
    border: 'border-amber-700/50', 
    badge: 'bg-amber-800 text-amber-100', 
    shadow: 'shadow-[0_0_60px_-20px_rgba(180,83,9,0.15)]',
    title: 'VALEUR SÛRE',
    text: 'text-amber-500'
  },
};

// ============================================================================
// METADATA
// ============================================================================

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const guide = await prisma.buyingGuide.findUnique({
    where: { slug },
    select: { title: true, metaTitle: true, metaDescription: true, heroImageUrl: true, targetKeywords: true },
  });

  if (!guide) return { title: 'Guide non trouvé', robots: { index: false, follow: false } };

  return {
    title: guide.metaTitle || `${guide.title} | City Baddies`,
    description: guide.metaDescription || `Guide d'achat : ${guide.title}`,
    alternates: { canonical: `${BASE_URL}/guides/${slug}` },
    openGraph: {
      title: guide.metaTitle || guide.title,
      description: guide.metaDescription || `Guide d'achat : ${guide.title}`,
      url: `${BASE_URL}/guides/${slug}`,
      type: 'article',
      images: guide.heroImageUrl ? [{ url: guide.heroImageUrl, width: 1200, height: 630 }] : undefined,
    },
  };
}

// ============================================================================
// DATA FETCHING
// ============================================================================

async function getGuide(slug: string) {
  return prisma.buyingGuide.findUnique({
    where: { slug, status: 'PUBLISHED' },
    include: {
      products: {
        include: {
          deal: {
            include: {
              merchant: true,
              product: {
                include: { brandRef: true, category: true },
              },
            },
          },
        },
        orderBy: { rank: 'asc' },
      },
    },
  });
}

async function getRelatedGuides(category: string, currentSlug: string) {
  return prisma.buyingGuide.findMany({
    where: { status: 'PUBLISHED', category, slug: { not: currentSlug } },
    orderBy: { publishedAt: 'desc' },
    take: 3,
    include: { products: { take: 3, include: { deal: { include: { product: true } } } } }
  });
}

// ============================================================================
// COMPONENT
// ============================================================================

export default async function GuideDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = await getGuide(slug);

  if (!guide) notFound();

  const relatedGuides = await getRelatedGuides(guide.category, guide.slug);
  const catStyle = CATEGORY_STYLES[guide.category] || CATEGORY_STYLES['default'];
  const faq = (guide.faq as { question: string; answer: string }[] | null) || [];
  const criteria = (guide.criteria as string[] | null) || [];

  // Schema SEO
  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: guide.title,
    description: guide.metaDescription,
    image: guide.heroImageUrl,
    datePublished: guide.publishedAt?.toISOString(),
    dateModified: (guide.updatedAt || guide.publishedAt)?.toISOString(),
    author: { '@type': 'Organization', name: 'City Baddies', url: BASE_URL },
    mainEntityOfPage: `${BASE_URL}/guides/${guide.slug}`,
  };

  // FAQPage : la FAQ est VISIBLE plus bas dans la page → le schema doit refléter
  // le contenu affiché (guideline Google : pas de FAQPage sans FAQ visible, et
  // inversement une FAQ visible mérite son schema).
  const faqSchema = faq.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map(f => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  } : null;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      {faqSchema && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      )}

      {/* Hero Immersif */}
      <section className="relative min-h-[70vh] flex items-center justify-center overflow-hidden">
        {/* Background Image with Parallax-like fix */}
        <div className="absolute inset-0 z-0">
          {guide.heroImageUrl ? (
            <Image
              src={guide.heroImageUrl}
              alt={guide.title}
              fill
              className="object-cover opacity-60"
              priority
              unoptimized
            />
          ) : (
             <div className="w-full h-full bg-neutral-900" />
          )}
          {/* Heavy Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/60 to-transparent" />
          <div className="absolute inset-0 bg-black/20" /> {/* Darken overall */}
        </div>

        <div className="relative z-10 max-w-5xl mx-auto px-4 text-center mt-20">
          <Link 
            href="/guides" 
            className="inline-flex items-center gap-2 text-sm text-neutral-300 hover:text-white transition-colors mb-8 group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Retour aux guides
          </Link>

          <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border mb-8 backdrop-blur-xl ${catStyle.bg} ${catStyle.border} ${catStyle.text} shadow-[0_0_20px_rgba(0,0,0,0.5)]`}>
            <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">{guide.category}</span>
          </div>

          <h1 className="text-5xl md:text-7xl lg:text-8xl font-black text-white leading-[1.05] mb-8 tracking-tighter uppercase italic">
            <span className="bg-clip-text text-transparent bg-gradient-to-b from-white via-white to-white/60">
              {guide.title}
            </span>
          </h1>

          <div className="flex flex-wrap items-center justify-center gap-8 text-neutral-400 text-[10px] font-black uppercase tracking-[0.2em]">
            <span className="flex items-center gap-2">
              <span className="text-[#d4a855]">Dernière mise à jour</span>
              <span className="text-white">
                {guide.publishedAt && formatDistanceToNow(new Date(guide.publishedAt), { addSuffix: true, locale: fr })}
              </span>
            </span>
            <div className="w-1 h-1 rounded-full bg-neutral-800" />
            <span className="flex items-center gap-2">
              <span className="text-[#d4a855]">Sélection</span>
              <span className="text-white">{guide.products.length} Produits Experts</span>
            </span>
          </div>
        </div>
      </section>

      {/* Contenu Principal */}
      <section className="relative z-10 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
        
        {/* Intro */}
        <div className="prose prose-invert prose-lg max-w-none mb-16 first-letter:text-5xl first-letter:font-bold first-letter:text-[#d4a855] first-letter:mr-3 first-letter:float-left">
          <div dangerouslySetInnerHTML={{ __html: guide.introduction }} />
        </div>

        {/* Le Classement */}
        <div className="space-y-16 md:space-y-32 mb-24">
          <div className="flex flex-col items-center text-center gap-4 mb-16">
             <div className="w-px h-16 bg-gradient-to-b from-transparent to-[#d4a855]" />
             <h2 className="text-4xl md:text-5xl font-black text-white tracking-tighter uppercase italic">
                LE <span className="text-[#d4a855]">PALMARÈS</span> EDITO
             </h2>
             <p className="text-neutral-500 text-xs font-black uppercase tracking-[0.3em]">Analysé. Testé. Approuvé.</p>
          </div>

          {guide.products.map((item, index) => {
             const rank = item.rank;
             const isTop3 = rank <= 3;
             const style = RANK_STYLES[rank] || { border: 'border-white/10', badge: 'bg-neutral-800 text-white', shadow: '', title: '', text: 'text-neutral-400' };
             const product = item.deal.product;

             return (
               <div 
                 key={item.id} 
                 id={`product-${rank}`}
                 className={`relative group rounded-3xl bg-[#0d0d0d] overflow-hidden ${isTop3 ? style.shadow : 'border border-white/5'} transition-all duration-700 hover:translate-y-[-4px]`}
               >
                 {/* Premium Glass/Border Effect */}
                 {isTop3 && (
                   <div className={`absolute inset-0 rounded-3xl border-2 ${style.border} pointer-events-none z-20 opacity-40`} />
                 )}

                 <div className="grid md:grid-cols-2 gap-0">
                    {/* Image Section - Refined with spotlight */}
                    <div className="relative min-h-[350px] md:min-h-[450px] bg-neutral-100 flex items-center justify-center group/img overflow-hidden">
                       {/* Subtle Spotlight Gradient */}
                       <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.8)_0%,rgba(240,240,240,1)_100%)] opacity-30" />
                       
                       {item.deal.imageUrl && (
                         <div className="relative w-[80%] h-[80%] transition-transform duration-700 group-hover/img:scale-105">
                           <Image 
                             src={item.deal.imageUrl} 
                             alt={product.name}
                             fill
                             className="object-contain"
                             sizes="(max-width: 768px) 100vw, 50vw"
                             unoptimized
                           />
                         </div>
                       )}
                       
                       {/* Floating Rank Badge */}
                       <div className="absolute top-6 left-6 z-30">
                          <div className={`flex items-center justify-center w-14 h-14 rounded-full font-black text-2xl shadow-xl backdrop-blur-md ${rank === 1 ? 'bg-[#d4a855] text-black' : 'bg-black/90 text-white border border-white/20'}`}>
                            {rank}
                          </div>
                          {isTop3 && (
                            <div className={`mt-3 px-3 py-1 text-[9px] font-black uppercase tracking-[0.2em] rounded-sm ${style.badge} inline-block`}>
                              {style.title}
                            </div>
                          )}
                       </div>

                       {/* Hover Overlay */}
                       <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/5 transition-colors duration-500" />
                    </div>

                    {/* Content Section - High-end Typography */}
                    <div className="p-8 md:p-12 flex flex-col justify-center">
                       <div className="mb-8">
                         <div className="flex items-center gap-3 mb-3">
                           <span className="text-xs font-black text-neutral-500 uppercase tracking-[0.3em]">
                             {product.brandRef?.name || product.brand || 'Marque'}
                           </span>
                           <div className="h-[1px] flex-1 bg-white/10" />
                         </div>
                         
                         <h3 className="text-2xl md:text-4xl font-black text-white leading-tight mb-4 tracking-tight">
                           {product.name}
                         </h3>

                         {item.rating && (
                            <div className="flex items-center gap-4 mb-6">
                              <div className="flex flex-col">
                                <span className="text-[10px] font-black text-[#d4a855] uppercase tracking-[0.2em] mb-1">Score Edito</span>
                                <div className="flex items-baseline gap-1">
                                  <span className="text-2xl font-black text-white">{item.rating}</span>
                                  <span className="text-[10px] font-bold text-neutral-600">/ 5</span>
                                </div>
                              </div>
                              <div className="h-8 w-px bg-white/10" />
                              <div className="flex flex-col">
                                <span className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] mb-1">Status</span>
                                <span className="text-[11px] font-bold text-white uppercase tracking-wider">
                                  {item.rating >= 4.5 ? 'Exceptionnel' : item.rating >= 4 ? 'Excellent' : 'Validé'}
                                </span>
                              </div>
                            </div>
                         )}
                       </div>

                       {/* Mini Review - Better readability */}
                       {item.miniReview && (
                         <div className="mb-8 text-neutral-400 leading-relaxed text-[15px] font-medium italic border-l-2 border-[#d4a855]/30 pl-6 py-1">
                           <div dangerouslySetInnerHTML={{ __html: item.miniReview }} />
                         </div>
                       )}

                       {/* Editorial Sniplets (Pros/Cons) */}
                       <div className="grid grid-cols-1 gap-8 mb-10">
                          {item.pros && (
                            <div className="space-y-4">
                              <div className="flex items-center gap-3">
                                <div className="h-[2px] w-4 bg-emerald-500/40" />
                                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em]">Points Forts</span>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {item.pros.split('|').filter(Boolean).map((pro, i) => (
                                  <span key={i} className="px-3 py-1.5 rounded-lg bg-emerald-500/5 border border-emerald-500/10 text-emerald-100/70 text-xs font-medium">
                                    {pro.trim()}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {item.cons && (
                            <div className="space-y-4">
                              <div className="flex items-center gap-3">
                                <div className="h-[2px] w-4 bg-rose-500/40" />
                                <span className="text-[10px] font-black text-rose-400 uppercase tracking-[0.2em]">À considérer</span>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {item.cons.split('|').filter(Boolean).map((con, i) => (
                                  <span key={i} className="px-3 py-1.5 rounded-lg bg-rose-500/5 border border-rose-500/10 text-rose-100/70 text-xs font-medium">
                                    {con.trim()}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                       </div>

                       {/* Pricing & CTA */}
                       <div className="mt-auto pt-8 border-t border-white/5 flex items-center justify-between gap-6">
                          <div className="flex flex-col">
                             <div className="flex items-baseline gap-3">
                               <span className="text-3xl font-black text-white tracking-tight">{item.deal.dealPrice}€</span>
                               {item.deal.originalPrice && item.deal.originalPrice > item.deal.dealPrice && (
                                 <span className="text-sm text-neutral-600 line-through font-medium">{item.deal.originalPrice}€</span>
                               )}
                             </div>
                             <span className="text-[10px] font-bold text-[#d4a855] uppercase tracking-widest mt-1">Meilleure offre actuelle</span>
                          </div>
                          
                          <a 
                            href={item.deal.productUrl ? `/api/redirect?url=${encodeURIComponent(item.deal.productUrl)}` : `/produits?search=${encodeURIComponent(item.deal.product?.name || item.deal.title || '')}`}
                            target="_blank"
                            rel="nofollow sponsored noopener noreferrer" 
                            className={`group/btn relative px-8 py-4 rounded-full font-black text-[12px] uppercase tracking-[0.1em] transition-all duration-500 flex items-center gap-3 overflow-hidden ${rank === 1 ? 'bg-[#d4a855] text-black shadow-[0_10px_30px_-10px_rgba(212,168,85,0.3)]' : 'bg-white text-black hover:shadow-xl'}`}
                          >
                             <span className="relative z-10 transition-transform duration-500 group-hover/btn:translate-x-[-2px]">Voir l&apos;offre</span>
                             <ArrowRight className="w-4 h-4 relative z-10 transition-transform duration-500 group-hover/btn:translate-x-[2px]" />
                             
                             {/* Gloss effect on hover */}
                             <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover/btn:animate-[shimmer_1.5s_infinite]" />
                          </a>
                       </div>
                    </div>
                 </div>
               </div>
             );
          })}
        </div>

        {/* Criteria Section */}
        {criteria.length > 0 && (
          <div className="relative rounded-3xl p-1 md:p-[1px] bg-gradient-to-br from-[#d4a855]/20 to-transparent mb-16 overflow-hidden">
            <div className="bg-[#0d0d0d] rounded-[calc(1.5rem-1px)] p-10 md:p-14">
              <div className="flex flex-col mb-12">
                  <div className="h-1 w-12 bg-[#d4a855] mb-6" />
                  <h3 className="text-3xl font-black text-white mb-2 tracking-tight uppercase italic">Protocoles de Test</h3>
                  <p className="text-neutral-500 text-[10px] font-black uppercase tracking-[0.3em]">Notre expertise à votre service</p>
              </div>
              
              <div className="grid md:grid-cols-2 gap-x-16 gap-y-8">
                {criteria.map((c, i) => (
                  <div key={i} className="flex items-start gap-5 group">
                    <span className="text-xl font-black text-[#d4a855]/20 group-hover:text-[#d4a855]/40 transition-colors duration-500 italic">
                      0{i + 1}
                    </span>
                    <span className="text-neutral-400 text-sm leading-relaxed font-medium pt-1">{c}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* FAQ */}
        {faq.length > 0 && (
          <div className="mb-24">
             <div className="text-center mb-12">
                <h3 className="text-3xl font-black text-white mb-2 tracking-tight uppercase">Questions Fréquentes</h3>
                <div className="w-12 h-1 bg-[#d4a855] mx-auto" />
             </div>
             
             <div className="space-y-3">
               {faq.map((item, i) => (
                 <details key={i} className="group bg-[#0d0d0d] border border-white/5 rounded-2xl transition-all duration-300 open:ring-1 open:ring-[#d4a855]/30">
                   <summary className="flex items-center justify-between p-7 cursor-pointer list-none">
                     <span className="font-bold text-neutral-300 group-open:text-[#d4a855] transition-colors tracking-tight">{item.question}</span>
                     <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-open:rotate-180 transition-transform duration-500">
                        <ChevronDown className="w-4 h-4 text-[#d4a855]" />
                     </div>
                   </summary>
                   <div className="px-7 pb-7 text-neutral-400 leading-relaxed text-[15px] border-t border-white/5 pt-6 animate-in fade-in slide-in-from-top-2 duration-500">
                     {item.answer}
                   </div>
                 </details>
               ))}
             </div>
          </div>
        )}

      </section>

      {/* Related Guides */}
      {/* Affiliate Disclosure */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <p className="text-[9px] text-neutral-600 tracking-wide text-center">
          Les liens vers les produits sont des liens partenaires. En achetant via ces liens, vous soutenez notre travail éditorial sans surcoût pour vous. <a href="/legal#mentions" className="underline hover:text-neutral-400 transition-colors">En savoir plus</a>
        </p>
      </div>

      {relatedGuides.length > 0 && (
        <section className="border-t border-white/5 py-24 bg-[#0a0a0a]">
           <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <h3 className="text-3xl md:text-4xl font-black text-white mb-12 text-center tracking-tight">
                CONTINUER LA LECTURE
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {relatedGuides.map((g) => (
                  <Link 
                    key={g.slug} 
                    href={`/guides/${g.slug}`}
                    className="group relative h-full bg-[#111] hover:bg-[#161616] border border-white/5 rounded-xl overflow-hidden transition-all hover:-translate-y-1 block"
                  >
                     <div className="relative aspect-video">
                        {g.heroImageUrl ? (
                          <Image src={g.heroImageUrl} alt={g.title} fill className="object-cover group-hover:scale-105 transition-transform duration-500" unoptimized />
                        ) : (
                          <div className="w-full h-full bg-neutral-800" />
                        )}
                        <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors" />
                     </div>
                     <div className="p-6">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[#d4a855] mb-2 block">
                          {g.category}
                        </span>
                        <h4 className="text-lg font-bold text-white group-hover:text-[#d4a855] transition-colors leading-tight">
                          {g.title}
                        </h4>
                     </div>
                  </Link>
                ))}
              </div>
           </div>
        </section>
      )}

      <NewsletterSection />
    </>
  );
}
