import Image from 'next/image';
import { Sparkles, Shield, Users, Star } from 'lucide-react';
import NewsletterSection from '@/components/layout/NewsletterSection';
import type { Metadata } from 'next';
import JsonLd from '@/components/seo/JsonLd';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://citybaddies.com';

export const metadata: Metadata = {
  title: 'À Propos de City Baddies | Comparateur de Prix Parfums',
  description: 'Découvrez City Baddies : le comparateur de prix parfums qui relève les prix plusieurs fois par jour chez Sephora, Nocibé et Marionnaud, avec historique par contenance.',
  keywords: [
    "comparateur prix parfum",
    "historique prix parfum",
    "prix sephora nocibé marionnaud",
    "promotions parfum authentique",
    "city baddies concept",
  ],
  alternates: {
    canonical: `${BASE_URL}/about`,
  },
  openGraph: {
    title: 'À Propos de City Baddies | L\'Expert des Deals Beauté',
    description: 'Plus qu\'un comparateur, une équipe passionnée au service de votre budget parfum. Découvrez comment on relève et compare les prix.',
    url: `${BASE_URL}/about`,
    type: 'website',
  },
};

// JSON-LD : AboutPage + Organization uniquement.
// ⚠️ Pas de FAQPage ici : la page n'affiche AUCUNE FAQ visible, et Google exige
// que le schema FAQPage reflète un contenu affiché (sinon risque d'action manuelle).
const structuredData = {
  "@context": "https://schema.org",
  "@type": "AboutPage",
  "url": `${BASE_URL}/about`,
  "mainEntity": {
    "@type": "Organization",
    "name": "City Baddies",
    "url": BASE_URL,
    "logo": `${BASE_URL}/images/logo.png`,
    "sameAs": [
      // Handle unique partout : @city_baddies (aligné footer/layout)
      "https://www.tiktok.com/@city_baddies"
    ],
    "description": "Comparateur de prix parfums indépendant : relevés plusieurs fois par jour chez Sephora, Nocibé et Marionnaud, avec historique des prix par contenance."
  }
};

export default function AboutPage() {
  return (
    <>
      <JsonLd id="structured-data" data={structuredData} />
      <div className="min-h-screen bg-[#0a0a0a] text-white selection:bg-[#d4a855] selection:text-black overflow-hidden relative">
      {/* Background Texture */}
      <div 
        className="fixed inset-0 opacity-[0.03] pointer-events-none z-0 mix-blend-overlay"
        style={{ backgroundImage: 'url(/images/grain.png)' }}
      />

      {/* Ambient Glow */}
      <div className="fixed top-0 left-0 w-[500px] h-[500px] bg-[#9b1515] opacity-[0.05] blur-[120px] rounded-full pointer-events-none" />
      <div className="fixed bottom-0 right-0 w-[500px] h-[500px] bg-[#d4a855] opacity-[0.05] blur-[120px] rounded-full pointer-events-none" />

      <main className="relative z-10 pt-32">
        <div className="max-w-6xl mx-auto px-6">
          
          {/* Hero Section */}
          <div className="text-center mb-32 animate-fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold tracking-[0.3em] uppercase text-[#d4a855] mb-10 hover:bg-white/10 transition-colors cursor-default">
              <Star className="w-3 h-3" />
              Manifesto
            </div>
            
            <h1 className="text-5xl md:text-8xl font-thin tracking-tighter mb-8 leading-[0.9] text-white">
              NO MORE <br/>
              <span className="italic font-normal text-white/40">GATEKEEPING</span>
            </h1>
            
            <p className="text-xl md:text-2xl text-neutral-400 font-light max-w-2xl mx-auto leading-relaxed">
              City Baddies n&apos;est pas un simple comparateur. <br />
              <span className="text-white">C&apos;est votre concierge privé pour le parfum au meilleur prix.</span>
            </p>
          </div>

          {/* Value Proposition */}
          <div className="grid md:grid-cols-2 gap-16 mb-32 items-center">
            <div className="space-y-8 order-2 md:order-1">
              <h2 className="text-4xl font-thin uppercase tracking-wide">L'Exigence</h2>
              <div className="space-y-6 text-neutral-400 font-light text-lg leading-relaxed">
                <p>
                  L&apos;industrie de la beauté cultive l&apos;opacité. Prix fluctuants, fausses promotions, exclusivités artificielles... Il est devenu complexe de distinguer l&apos;opportunité réelle du marketing agressif.
                </p>
                <p>
                  <span className="text-white font-medium">Nous rétablissons la vérité.</span>
                </p>
                <p>
                  Nos relevés tournent plusieurs fois par jour sur les fiches produit de Sephora, Nocibé et Marionnaud. On ne traque pas seulement les prix baissés : on archive chaque relevé, contenance par contenance, pour distinguer la vraie baisse du prix barré marketing.
                </p>
              </div>
            </div>
            
            {/* Visual Abstract Element */}
            <div className="relative order-1 md:order-2 group">
              <div className="absolute inset-0 bg-gradient-to-br from-[#d4a855] to-[#9b1515] opacity-20 blur-2xl rounded-full group-hover:opacity-30 transition-opacity duration-700" />
              <div className="relative aspect-square rounded-2xl border border-white/10 bg-[#0a0a0a] overflow-hidden">
                 <Image
                    src="/images/baddies_3.png"
                    alt="City Baddies Private Club"
                    fill
                    sizes="(max-width: 768px) 100vw, 600px"
                    className="object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700"
                 />
                 <div className="absolute inset-x-0 bottom-0 p-6 bg-gradient-to-t from-black/80 to-transparent flex flex-col items-center justify-end">
                    <div className="text-xs font-bold tracking-[0.2em] uppercase text-[#d4a855] mb-2">Club Privé</div>
                    <div className="w-12 h-px bg-white/30" />
                 </div>
              </div>
            </div>
          </div>

          {/* Three Pillars */}
          <div className="grid md:grid-cols-3 gap-px bg-white/10 border border-white/10 rounded-2xl overflow-hidden mb-32">
            {[
              {
                title: "Transparence Radicale",
                desc: "Nous auditons l'historique de chaque produit. Si une promotion est artificielle, elle est immédiatement disqualifiée de notre sélection.",
                icon: Shield
              },
              {
                title: "Sélection Curatée",
                desc: "L'élégance, c'est la transparence. Pour chaque parfum, on montre TOUTES les offres — la moins chère comme les autres — avec la date du relevé.",
                icon: Sparkles
              },
              {
                title: "Cercle d'Initiés",
                desc: "Rejoignez une communauté exigeante qui partage les codes d'accès aux ventes privées et les erreurs de prix avant qu'elles ne soient corrigées.",
                icon: Users
              }
            ].map((item, i) => (
              <div key={i} className="bg-[#0a0a0a] p-10 group hover:bg-[#111] transition-colors">
                <item.icon className="w-8 h-8 text-[#d4a855] mb-6 opacity-80 group-hover:opacity-100 transition-opacity" />
                <h3 className="text-lg font-bold uppercase tracking-widest mb-4 text-white">{item.title}</h3>
                <p className="text-neutral-500 font-light leading-relaxed group-hover:text-neutral-400 transition-colors">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>

          {/* New Editorial Section */}
          <div className="max-w-4xl mx-auto text-center mb-32">
             <h2 className="text-3xl md:text-4xl font-thin mb-8">Pourquoi <span className="italic font-normal font-serif text-[#d4a855]">City Baddies</span> ?</h2>
             <p className="text-neutral-400 mb-6 leading-relaxed text-lg font-light">
               Parce que le luxe ne devrait pas être une question de budget, mais de savoir-faire. 
               Nous croyons que l&apos;accès aux grands parfums est un droit, pas un privilège réservé à celles qui ne regardent pas les étiquettes.
             </p>
             <p className="text-neutral-400 leading-relaxed text-lg font-light">
               Notre standard est simple : <span className="text-white font-medium">si nous ne l&apos;achèterions pas pour nous-mêmes, vous ne le verrez pas ici.</span>
             </p>
          </div>

          {/* Detailed Process Section */}
          <div className="grid md:grid-cols-2 gap-16 mb-32 border-t border-white/5 pt-32">
            <div>
              <h2 className="text-3xl font-thin mb-8 uppercase tracking-wide">Le Protocole <br /><span className="font-serif text-[#d4a855] italic text-4xl normal-case">Intransigeant</span></h2>
              <p className="text-neutral-400 mb-6 font-light leading-relaxed">
                Chaque offre publiée sur City Baddies a survécu à un processus de sélection drastique. Sur 1000 promotions repérées, moins de 50 sont retenues.
              </p>
              <ul className="space-y-8 mt-12">
                <li className="flex items-start gap-6 group">
                  <span className="text-[#d4a855] font-serif italic text-2xl opacity-50 group-hover:opacity-100 transition-opacity">01.</span>
                  <div>
                    <strong className="text-white block mb-2 tracking-wide uppercase text-sm">Veille Quotidienne</strong>
                    <span className="text-neutral-500 text-sm leading-relaxed">Notre équipe surveille les catalogues des retailers officiels chaque jour pour repérer les baisses de prix avant qu&apos;elles ne soient annoncées au grand public.</span>
                  </div>
                </li>
                <li className="flex items-start gap-6 group">
                  <span className="text-[#d4a855] font-serif italic text-2xl opacity-50 group-hover:opacity-100 transition-opacity">02.</span>
                  <div>
                    <strong className="text-white block mb-2 tracking-wide uppercase text-sm">Audit de Véracité</strong>
                    <span className="text-neutral-500 text-sm leading-relaxed">Nous croisons le prix barré avec le prix moyen constaté sur les 30 derniers jours (conformité Omnibus) pour éviter les fausses promos gonflées artificiellement.</span>
                  </div>
                </li>
                <li className="flex items-start gap-6 group">
                  <span className="text-[#d4a855] font-serif italic text-2xl opacity-50 group-hover:opacity-100 transition-opacity">03.</span>
                  <div>
                    <strong className="text-white block mb-2 tracking-wide uppercase text-sm">Curation Humaine</strong>
                    <span className="text-neutral-500 text-sm leading-relaxed">Notre équipe valide chaque correspondance. Est-ce exactement le même parfum, la même concentration, la même contenance ? Un dérivé ou un flanker n&apos;est jamais compté comme l&apos;original.</span>
                  </div>
                </li>
              </ul>
            </div>
            
            <div className="relative">
              <div className="sticky top-32">
                <div className="relative bg-white/[0.02] border border-white/5 rounded-none md:rounded-2xl p-8 md:p-12 overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-[#d4a855]/5 rounded-full blur-[80px] pointer-events-none" />
                  
                  <h3 className="text-xl font-bold uppercase tracking-widest mb-8 text-white relative z-10">Nos <span className="text-[#9b1515]">Red Flags</span></h3>
                  <p className="text-neutral-400 mb-8 border-b border-white/5 pb-8 relative z-10 font-light text-sm">
                    Nous ne publierons <strong className="text-white">jamais</strong> :
                  </p>
                  <ul className="space-y-6 text-neutral-300 font-light relative z-10">
                    <li className="flex items-center gap-4 group">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#9b1515] group-hover:scale-150 transition-transform" />
                      <span className="group-hover:text-white transition-colors">Les produits dont la date de péremption est proche.</span>
                    </li>
                    <li className="flex items-center gap-4 group">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#9b1515] group-hover:scale-150 transition-transform" />
                      <span className="group-hover:text-white transition-colors">Les prix barrés fantaisistes qui n&apos;ont jamais été pratiqués (notre historique les démasque).</span>
                    </li>
                    <li className="flex items-center gap-4 group">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#9b1515] group-hover:scale-150 transition-transform" />
                      <span className="group-hover:text-white transition-colors">Le dropshipping ou les marques sans traçabilité.</span>
                    </li>
                    <li className="flex items-center gap-4 group">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#9b1515] group-hover:scale-150 transition-transform" />
                      <span className="group-hover:text-white transition-colors">Les réductions inférieures à 20% (sauf exception type Dyson/Rare Beauty).</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
          
          {/* Manifesto Final Statement */}
          <div className="text-center py-20 border-y border-white/5 mb-20 bg-gradient-to-b from-transparent to-white/[0.01]">
            <p className="text-2xl md:text-5xl font-serif text-white/90 leading-tight max-w-5xl mx-auto italic">
              &quot;Le luxe n&apos;est pas ce que vous payez, <br/> c&apos;est ce que vous <span className="text-[#d4a855] not-italic decoration-[#d4a855] underline decoration-1 underline-offset-4">découvrez</span>.&quot;
            </p>
          </div>

        </div>

        {/* Newsletter Integration */}
        <NewsletterSection />
      </main>
    </div>
    </>
  );
}
