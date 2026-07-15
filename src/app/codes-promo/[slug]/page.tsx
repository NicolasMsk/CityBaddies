import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { getPromoPage, getPromoCodesByMerchantSlug, getAllPromoPages } from '@/lib/promo-queries';

interface Props {
  params: Promise<{ slug: string }>;
}

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://citybaddies.com';

export async function generateStaticParams() {
  const pages = await getAllPromoPages();
  return pages.map((page) => ({ slug: page.canonicalSlug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPromoPage(slug);
  
  if (!page) {
    return {
      title: 'Page introuvable | City Baddies',
      robots: { index: false, follow: false },
    };
  }

  return {
    title: page.metaTitle || `Codes Promo ${page.heroTitle} | City Baddies`,
    description: page.metaDescription || page.introduction?.substring(0, 155),
    alternates: { canonical: `${BASE_URL}/codes-promo/${slug}` },
    openGraph: {
      title: page.metaTitle || page.heroTitle || undefined,
      description: page.metaDescription || page.introduction?.substring(0, 155) || undefined,
      url: `${BASE_URL}/codes-promo/${slug}`,
    },
  };
}

export const dynamic = 'force-dynamic';

export default async function PromoCodeMerchantPage({ params }: Props) {
  const { slug } = await params;
  const page = await getPromoPage(slug);
  
  if (!page) {
    notFound();
  }

  // Cast des champs Json Prisma
  const merchantAdvantages = page.merchantAdvantages as { icon?: string; title: string; text: string }[] | null;
  const howToUse = page.howToUse as { step: number; title: string; description: string }[] | null;
  const tips = page.tips as { title: string; content: string }[] | null;
  const faq = page.faq as { question: string; answer: string }[] | null;

  const promoCodes = await getPromoCodesByMerchantSlug(slug);

  const merchantName = page.merchant?.name || slug.charAt(0).toUpperCase() + slug.slice(1);
  const realCodeCount = promoCodes.length;

  // JSON-LD structured data for SEO
  const faqJsonLd = faq && faq.length > 0 ? {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faq.map(item => ({
      "@type": "Question",
      "name": item.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": item.answer,
      }
    }))
  } : null;

  const pageJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": page.metaTitle || `Codes Promo ${merchantName}`,
    "description": page.metaDescription || '',
    "url": `${BASE_URL}/codes-promo/${slug}`,
    "mainEntity": {
      "@type": "ItemList",
      "numberOfItems": realCodeCount,
      "itemListElement": promoCodes.map((code, i) => ({
        "@type": "ListItem",
        "position": i + 1,
        "item": {
          "@type": "Offer",
          "name": code.title,
          "description": code.description || '',
          "priceCurrency": "EUR",
          ...(code.expiresAt ? { "validThrough": new Date(code.expiresAt).toISOString().split('T')[0] } : {}),
          "seller": {
            "@type": "Organization",
            "name": merchantName,
          }
        }
      }))
    }
  };

  return (
    <>
    {faqJsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />}
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(pageJsonLd) }} />
    <div className="min-h-screen bg-[#0a0a0a] selection:bg-[#d4a855] selection:text-black">
      {/* Ambient Glows */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#9b1515] rounded-full blur-[120px] opacity-[0.05]" />
        <div className="absolute bottom-1/4 left-1/3 w-80 h-80 bg-[#d4a855] rounded-full blur-[100px] opacity-[0.03]" />
      </div>

      {/* Hero Section */}
      <section className="relative z-10 pt-28 pb-16 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Breadcrumb */}
          <Link
            href="/codes-promo"
            className="inline-flex items-center gap-2 text-xs font-bold tracking-[0.2em] uppercase text-neutral-600 hover:text-[#d4a855] transition-colors mb-12 group"
          >
            ← Retour aux codes
          </Link>

          <div className="max-w-4xl animate-fade-in">
            <div className="flex items-center gap-3 mb-8">
              <span className="h-[1px] w-12 bg-[#d4a855]" />
              <span className="text-[#d4a855] text-xs font-bold tracking-[0.2em] uppercase">
                Codes Promo
              </span>
            </div>

            <div className="flex items-center gap-6 mb-8">
              {page.merchant?.logoUrl && (
                <div className="relative w-16 h-16 md:w-20 md:h-20 flex-shrink-0 rounded-xl bg-white/[0.05] border border-white/10 overflow-hidden p-2">
                  <Image
                    src={page.merchant.logoUrl}
                    alt={`Logo ${merchantName}`}
                    fill
                    className="object-contain p-1"
                  />
                </div>
              )}
              <h1 className="text-5xl md:text-7xl lg:text-8xl font-serif text-white leading-[0.85] tracking-tight">
                <span className="block italic font-light opacity-90">{merchantName}</span>
              </h1>
            </div>

            {page.heroSubtitle && (
              <p className="text-xl md:text-2xl text-neutral-400 font-light max-w-xl border-l border-white/20 pl-6 mb-10">
                {page.heroSubtitle}
              </p>
            )}

            {/* Stats Row */}
            <div className="flex flex-wrap items-center gap-8 mt-8 border-l border-white/10 pl-8">
              {realCodeCount > 0 && (
                <div>
                  <div className="text-3xl font-serif text-white mb-1">{realCodeCount}</div>
                  <div className="text-xs text-[#d4a855] uppercase tracking-widest">
                    Code{realCodeCount > 1 ? 's' : ''} actif{realCodeCount > 1 ? 's' : ''}
                  </div>
                </div>
              )}
              {page.bestCurrentDiscount && (
                <div>
                  <div className="text-3xl font-serif text-white mb-1">-{page.bestCurrentDiscount}%</div>
                  <div className="text-xs text-neutral-500 uppercase tracking-widest">Meilleure réduction</div>
                </div>
              )}
              {page.averageDiscount && (
                <div>
                  <div className="text-3xl font-serif text-white mb-1">~{page.averageDiscount.toFixed(0)}%</div>
                  <div className="text-xs text-neutral-500 uppercase tracking-widest">Réduction moy.</div>
                </div>
              )}
              {page.lastVerifiedAt && (
                <div>
                  <div className="text-lg font-serif text-white mb-1">
                    {new Date(page.lastVerifiedAt).toLocaleDateString('fr-FR')}
                  </div>
                  <div className="text-xs text-neutral-500 uppercase tracking-widest">Dernière vérif.</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-24">

        {/* Introduction */}
        {page.introduction && (
          <section className="max-w-4xl">
            <div
              className="text-xl text-neutral-400 font-light leading-relaxed prose prose-invert prose-p:text-neutral-400 prose-p:font-light max-w-none"
              dangerouslySetInnerHTML={{ __html: page.introduction }}
            />
          </section>
        )}

        {/* Active Promo Codes */}
        <section>
          <div className="flex items-center gap-4 mb-4">
            <span className="h-px w-8 bg-[#d4a855]" />
            <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-[#d4a855]">
              Offres Actives
            </span>
          </div>
          <h2 className="text-4xl md:text-5xl font-thin text-white tracking-tight leading-none mb-12">
            CODES <span className="italic font-normal text-[#d4a855]">PROMO</span>
          </h2>

          {promoCodes.length === 0 ? (
            <div className="text-center py-20 bg-white/[0.02] rounded-none border border-white/5">
              <span className="block text-4xl font-serif text-white/20 mb-4">0</span>
              <p className="text-neutral-400 font-light uppercase tracking-widest text-xs">Aucun code promo disponible</p>
              <p className="text-neutral-600 text-[10px] mt-2 tracking-wide uppercase">Revenez bientôt</p>
            </div>
          ) : (
            <div className="space-y-4">
              {promoCodes.map((code) => (
                <div
                  key={code.id}
                  className="group relative bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all duration-500 rounded-sm"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8 p-8 md:p-10">
                    {/* Left: Info */}
                    <div className="flex-1 space-y-4">
                      <div className="flex flex-wrap items-end gap-3 mb-2">
                        {code.isVerified && (
                           <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-[0.2em] border-b border-emerald-500/30 pb-0.5">
                             Vérifié
                           </span>
                        )}
                        {code.isExclusive && (
                           <span className="text-[10px] font-bold text-[#d4a855] uppercase tracking-[0.2em] border-b border-[#d4a855]/30 pb-0.5">
                             Exclusif
                           </span>
                        )}
                        <h3 className="text-xl md:text-2xl font-light text-white tracking-wide leading-tight">
                          {code.title}
                        </h3>
                      </div>

                      {code.description && (
                        <p className="text-neutral-400 font-light leading-relaxed max-w-2xl text-sm">{code.description}</p>
                      )}

                      {/* Conditions Pills */}
                      <div className="flex flex-wrap gap-x-6 gap-y-2 text-[10px] tracking-[0.15em] uppercase text-neutral-500 pt-2">
                        {code.minimumPurchase && (
                          <span className="flex items-center gap-2">
                            <span className="w-1 h-1 bg-neutral-700 rounded-full"></span>
                            Min. {code.minimumPurchase}€
                          </span>
                        )}
                        {code.expiresAt && (
                          <span className="flex items-center gap-2 text-[#9b1515]">
                            <span className="w-1 h-1 bg-[#9b1515] rounded-full"></span>
                            Expire le {new Date(code.expiresAt).toLocaleDateString('fr-FR')}
                          </span>
                        )}
                        {code.isNewCustomerOnly && (
                          <span className="flex items-center gap-2">
                            <span className="w-1 h-1 bg-neutral-700 rounded-full"></span>
                            Nouveaux clients
                          </span>
                        )}
                      </div>

                      {/* Applicable To + Conditions détaillées */}
                      {(code.applicableTo || code.conditions) && (
                        <div className="mt-3 space-y-1.5">
                          {code.applicableTo && (
                            <p className="text-xs text-neutral-400 font-light">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-600 mr-2">Valable sur</span>
                              {code.applicableTo}
                            </p>
                          )}
                          {code.conditions && (
                            <p className="text-[11px] text-neutral-500/70 font-light leading-relaxed">
                              {code.conditions}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Stats */}
                      <div className="flex items-center gap-6 text-[10px] text-white/20 uppercase tracking-widest pt-2 border-t border-white/5 mt-4">
                        {code.successRate !== null && (
                          <span>{code.successRate}% succès</span>
                        )}
                        <span>{code.views} vues</span>
                        <span>{code.votes} avis</span>
                      </div>
                    </div>

                    {/* Right: Code Box */}
                    <div className="flex flex-col items-center gap-0 lg:min-w-[220px]">
                      <div className="w-full bg-[#0a0a0a] border border-white/10 px-8 py-5 text-center relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#d4a855]/50 to-transparent opacity-50"></div>
                        <p className="text-[10px] text-[#d4a855] mb-2 font-bold tracking-[0.3em] uppercase opacity-70">
                          Code
                        </p>
                        <p className="text-xl font-mono text-white tracking-widest select-all">
                          {code.code}
                        </p>
                      </div>
                      <button className="w-full py-4 bg-white hover:bg-[#d4a855] text-black transition-colors duration-300">
                        <span className="text-[10px] font-bold tracking-[0.3em] uppercase">
                          Copier
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Merchant Description */}
        {page.merchantDescription && (
          <section>
            <div className="flex items-center gap-4 mb-4">
              <span className="h-px w-8 bg-[#9b1515]" />
              <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-[#9b1515]">
                À Propos
              </span>
            </div>
            <h2 className="text-4xl md:text-5xl font-thin text-white tracking-tight leading-none mb-8">
              {merchantName.toUpperCase()}
            </h2>
            <div
              className="max-w-4xl text-neutral-400 text-lg font-light leading-relaxed prose prose-invert prose-p:text-neutral-400 prose-p:font-light max-w-none"
              dangerouslySetInnerHTML={{ __html: page.merchantDescription }}
            />
          </section>
        )}

        {/* Merchant Advantages */}
        {merchantAdvantages && merchantAdvantages.length > 0 && (
          <section>
            <div className="flex items-center gap-4 mb-4">
              <span className="h-px w-8 bg-[#d4a855]" />
              <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-[#d4a855]">
                Avantages
              </span>
            </div>
            <h2 className="text-3xl md:text-4xl font-thin text-white tracking-tight mb-10">
              POURQUOI <span className="italic font-normal text-[#d4a855]">{merchantName.toUpperCase()}</span> ?
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-px bg-white/10 border border-white/10 rounded-none overflow-hidden">
              {merchantAdvantages.map((advantage, i) => (
                <div key={i} className="bg-[#0a0a0a] p-10 group hover:bg-[#111] transition-colors">
                  <span className="text-4xl font-serif text-white/5 mb-6 block group-hover:text-[#d4a855]/20 transition-colors">
                    0{i + 1}
                  </span>
                  <h3 className="text-xs font-bold uppercase tracking-[0.2em] mb-4 text-white">
                    {advantage.title}
                  </h3>
                  <p className="text-neutral-500 font-light leading-relaxed text-sm group-hover:text-neutral-400 transition-colors">
                    {advantage.text}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* How To Use */}
        {(howToUse && howToUse.length > 0) ? (
          <section>
            <div className="flex items-center gap-4 mb-4">
              <span className="h-px w-8 bg-[#9b1515]" />
              <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-[#9b1515]">
                Tutoriel
              </span>
            </div>
            <h2 className="text-3xl md:text-4xl font-thin text-white tracking-tight mb-12">
              COMMENT <span className="italic font-normal text-white">UTILISER</span> UN CODE
            </h2>

            <div className="space-y-0 border-l border-white/10 ml-4 md:ml-0 md:border-l-0">
                {howToUse.map((step, i) => (
                  <div key={i} className="group relative pl-8 md:pl-0 pb-12 last:pb-0 md:pb-0">
                    {/* Mobile Timeline Dot */}
                    <span className="absolute left-[-5px] top-2 w-2.5 h-2.5 bg-[#0a0a0a] border border-white/20 rounded-full md:hidden group-hover:border-[#d4a855] group-hover:bg-[#d4a855] transition-colors" />
                    
                    <div className="md:grid md:grid-cols-[100px_1fr] md:gap-10 md:items-start p-0 md:p-8 md:border-b md:border-white/5 md:hover:bg-white/[0.02] transition-colors">
                      <span className="text-3xl md:text-5xl font-serif text-white/10 group-hover:text-[#d4a855] transition-colors block mb-4 md:mb-0">
                        0{i + 1}
                      </span>
                      <div>
                        <h4 className="text-sm font-bold text-white mb-3 uppercase tracking-[0.15em]">
                          {step.title}
                        </h4>
                        <p className="text-neutral-500 font-light leading-relaxed text-sm max-w-2xl group-hover:text-neutral-400 transition-colors">
                          {step.description}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </section>
        ) : (page.howToUseHtml && (
           <section>
            <div className="flex items-center gap-4 mb-4">
              <span className="h-px w-8 bg-[#9b1515]" />
              <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-[#9b1515]">
                Tutoriel
              </span>
            </div>
            <h2 className="text-3xl md:text-4xl font-thin text-white tracking-tight mb-10">
              COMMENT <span className="italic font-normal text-white">UTILISER</span> UN CODE
            </h2>
             <div
                className="prose prose-invert prose-lg max-w-4xl prose-p:text-neutral-400 prose-p:font-light prose-headings:font-thin prose-headings:tracking-wide prose-a:text-[#d4a855]"
                dangerouslySetInnerHTML={{ __html: page.howToUseHtml }}
              />
           </section>
        ))}

        {/* Tips */}
        {tips && tips.length > 0 && (
          <section>
            <div className="flex items-center gap-4 mb-4">
              <span className="h-px w-8 bg-[#d4a855]" />
              <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-[#d4a855]">
                Insider
              </span>
            </div>
            <h2 className="text-3xl md:text-4xl font-thin text-white tracking-tight mb-10">
              ASTUCES <span className="italic font-normal text-[#d4a855]">D&apos;INITIÉS</span>
            </h2>
            <div className="grid md:grid-cols-2 gap-px bg-white/10 border border-white/10 rounded-none overflow-hidden">
              {tips.map((tip, i) => (
                <div key={i} className="bg-[#0a0a0a] p-10 group hover:bg-[#111] transition-colors">
                  <div className="flex items-start gap-6">
                    <span className="text-[#d4a855] font-serif text-xl italic opacity-50">#</span>
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-[0.2em] mb-3 text-white">
                        {tip.title}
                      </h3>
                      <p className="text-neutral-500 font-light leading-relaxed text-sm group-hover:text-neutral-400 transition-colors">
                        {tip.content}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Best Time To Shop */}
        {page.bestTimeToShop && (
          <section className="max-w-4xl">
            <div className="flex items-center gap-4 mb-4">
              <span className="h-px w-8 bg-[#9b1515]" />
              <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-[#9b1515]">
                Timing
              </span>
            </div>
            <h2 className="text-3xl md:text-4xl font-thin text-white tracking-tight mb-8">
              MEILLEURS <span className="italic font-normal text-white">MOMENTS</span>
            </h2>
            <div className="bg-[#0a0a0a] border border-white/10 p-10 md:p-12 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-5">
                 <span className="text-9xl font-serif text-white">24h</span>
              </div>
              <div className="relative z-10">
                <p className="text-neutral-400 font-light leading-relaxed whitespace-pre-line text-lg max-w-2xl">
                  {page.bestTimeToShop}
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Shipping, Return, Loyalty */}
        {(page.shippingInfo || page.returnPolicy || page.loyaltyProgram) && (
          <section>
            <div className="flex items-center gap-4 mb-4">
              <span className="h-px w-8 bg-[#d4a855]" />
              <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-[#d4a855]">
                Infos Pratiques
              </span>
            </div>
            <h2 className="text-3xl md:text-4xl font-thin text-white tracking-tight mb-10">
              CE QU&apos;IL FAUT <span className="italic font-normal text-[#d4a855]">SAVOIR</span>
            </h2>
            <div className="grid md:grid-cols-3 gap-px bg-white/10 border border-white/10 rounded-none overflow-hidden">
              {page.shippingInfo && (
                <div className="bg-[#0a0a0a] p-10 group hover:bg-[#111] transition-colors">
                  <h3 className="text-xs font-bold uppercase tracking-[0.2em] mb-4 text-white border-b border-white/5 pb-4 inline-block">
                    Livraison
                  </h3>
                  <div
                    className="text-neutral-500 font-light leading-relaxed text-sm group-hover:text-neutral-400 transition-colors prose prose-invert prose-sm prose-p:text-neutral-500 max-w-none"
                    dangerouslySetInnerHTML={{ __html: page.shippingInfo }}
                  />
                </div>
              )}
              {page.returnPolicy && (
                <div className="bg-[#0a0a0a] p-10 group hover:bg-[#111] transition-colors">
                  <h3 className="text-xs font-bold uppercase tracking-[0.2em] mb-4 text-white border-b border-white/5 pb-4 inline-block">
                    Retours
                  </h3>
                  <div
                    className="text-neutral-500 font-light leading-relaxed text-sm group-hover:text-neutral-400 transition-colors prose prose-invert prose-sm prose-p:text-neutral-500 max-w-none"
                    dangerouslySetInnerHTML={{ __html: page.returnPolicy }}
                  />
                </div>
              )}
              {page.loyaltyProgram && (
                <div className="bg-[#0a0a0a] p-10 group hover:bg-[#111] transition-colors">
                  <h3 className="text-xs font-bold uppercase tracking-[0.2em] mb-4 text-white border-b border-white/5 pb-4 inline-block">
                    Fidélité
                  </h3>
                  <div
                    className="text-neutral-500 font-light leading-relaxed text-sm group-hover:text-neutral-400 transition-colors prose prose-invert prose-sm prose-p:text-neutral-500 max-w-none"
                    dangerouslySetInnerHTML={{ __html: page.loyaltyProgram }}
                  />
                </div>
              )}
            </div>
          </section>
        )}

        {/* FAQ */}
        {faq && faq.length > 0 && (
          <section>
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-light text-white mb-4 tracking-tight">
                QUESTIONS <span className="font-semibold text-[#d4a855]">FRÉQUENTES</span>
              </h2>
              <p className="text-neutral-500 text-sm tracking-widest uppercase">
                Tout ce que tu dois savoir sur {merchantName}
              </p>
            </div>
            <div className="max-w-3xl mx-auto space-y-4">
              {faq.map((item, i) => (
                <div key={i} className="group border border-white/10 bg-white/5 rounded-none overflow-hidden transition-all hover:bg-white/10">
                  <details className="group [&_summary::-webkit-details-marker]:hidden">
                    <summary className="flex items-center justify-between p-6 cursor-pointer text-white">
                      <span className="text-lg font-light tracking-wide">{item.question}</span>
                      <span className="text-[#d4a855] text-2xl font-light transition-transform duration-300 group-open:rotate-45">+</span>
                    </summary>
                    <div className="px-6 pb-6 text-neutral-400 font-light leading-relaxed border-t border-white/5 pt-4">
                      {item.answer}
                    </div>
                  </details>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Conclusion */}
        {page.conclusion && (
          <section className="max-w-4xl mx-auto text-center py-12 border-t border-white/5">
            <div
              className="text-xl md:text-2xl font-light italic text-neutral-400 leading-relaxed prose prose-invert prose-p:text-neutral-400 prose-p:font-light prose-p:italic max-w-none"
              dangerouslySetInnerHTML={{ __html: page.conclusion }}
            />
          </section>
        )}

        {/* Related Merchants */}
        {page.relatedMerchants && (
          <section className="border-t border-white/5 pt-16">
            <div className="flex items-center gap-4 mb-8">
              <span className="h-px w-8 bg-neutral-600" />
              <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-neutral-400">
                Voir Aussi
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {page.relatedMerchants.split(',').map((slug: string) => (
                <Link
                  key={slug.trim()}
                  href={`/codes-promo/${slug.trim()}`}
                  className="group inline-flex items-center gap-2 px-6 py-4 bg-white/[0.02] border border-white/5 text-neutral-400 text-xs font-bold tracking-[0.2em] uppercase hover:bg-white/[0.05] hover:text-[#d4a855] hover:border-[#d4a855]/20 transition-all"
                >
                  {slug.trim().charAt(0).toUpperCase() + slug.trim().slice(1)}
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
    </>
  );
}
