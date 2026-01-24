import { Sparkles, Shield, Users, Star } from 'lucide-react';
import NewsletterSection from '@/components/layout/NewsletterSection';
import type { Metadata } from 'next';
import Script from 'next/script';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://citybaddies.com';

export const metadata: Metadata = {
  title: 'Manifesto | Notre Mission Beauté',
  description: 'City Baddies - Plus qu\'un comparateur de prix beauté, un club privé. Découvrez notre mission : transparence totale sur les prix, deals curatés et communauté de passionnées.',
  keywords: [
    "city baddies manifesto",
    "comparateur beauté",
    "bons plans communauté",
    "transparence prix cosmétiques",
    "club beauté",
  ],
  alternates: {
    canonical: `${BASE_URL}/about`,
  },
  openGraph: {
    title: 'Manifesto | City Baddies',
    description: 'Plus qu\'un comparateur, un club privé. Découvrez notre mission.',
    url: `${BASE_URL}/about`,
    type: 'website',
  },
};

// FAQ Schema pour les rich snippets Google
const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Qu'est-ce que City Baddies ?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "City Baddies est une plateforme communautaire de bons plans beauté. Notre algorithme scanne Sephora, Nocibé et d'autres sites 24/7 pour trouver les meilleures promotions sur le maquillage, skincare et parfums.",
      },
    },
    {
      "@type": "Question",
      name: "Comment City Baddies trouve les meilleurs deals ?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Nous utilisons un algorithme qui analyse les prix en temps réel sur les sites partenaires comme Sephora et Nocibé. Nous vérifions l'historique des prix pour s'assurer que les promotions sont réelles et pas des faux rabais.",
      },
    },
    {
      "@type": "Question",
      name: "Est-ce que City Baddies est gratuit ?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Oui, City Baddies est 100% gratuit. Nous ne vendons rien directement, nous redirigeons vers les sites officiels des enseignes partenaires.",
      },
    },
    {
      "@type": "Question",
      name: "Comment savoir si un deal est vraiment intéressant ?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Chaque deal affiche le pourcentage de réduction réel calculé sur l'historique des prix. Nous n'affichons que les offres avec au moins 20% de réduction vérifiée.",
      },
    },
  ],
};

export default function AboutPage() {
  return (
    <>
      <Script
        id="faq-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
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
              City Baddies, c&apos;est ta meilleure amie qui te dit <br />
              <span className="text-white">« Girl, attends, je l&apos;ai vu moins cher ailleurs ».</span>
            </p>
          </div>

          {/* Value Proposition */}
          <div className="grid md:grid-cols-2 gap-16 mb-32 items-center">
            <div className="space-y-8 order-2 md:order-1">
              <h2 className="text-4xl font-thin uppercase tracking-wide">La Mission</h2>
              <div className="space-y-6 text-neutral-400 font-light text-lg leading-relaxed">
                <p>
                  Le marché de la beauté est opaque. Les prix changent constamment, les &quot;promos&quot; sont souvent gonflées, et les vraies pépites sont cachées.
                </p>
                <p>
                  <span className="text-white font-medium">On change les règles.</span>
                </p>
                <p>
                  Notre algorithme scanne Sephora, Nocibé, LookFantastic et des dizaines d&apos;autres sites 24/7. Nous traquons les baisses de prix, les erreurs d&apos;affichage et les codes secrets.
                </p>
              </div>
            </div>
            
            {/* Visual Abstract Element */}
            <div className="relative order-1 md:order-2 group">
              <div className="absolute inset-0 bg-gradient-to-br from-[#d4a855] to-[#9b1515] opacity-20 blur-2xl rounded-full group-hover:opacity-30 transition-opacity duration-700" />
              <div className="relative aspect-square rounded-2xl border border-white/10 bg-[#0a0a0a]/50 backdrop-blur-sm p-8 flex flex-col justify-center items-center text-center">
                 <div className="text-6xl mb-6 grayscale group-hover:grayscale-0 transition-all duration-500">💸</div>
                 <div className="text-xs font-bold tracking-[0.2em] uppercase text-[#d4a855]">Smart Shopping Club</div>
              </div>
            </div>
          </div>

          {/* Three Pillars */}
          <div className="grid md:grid-cols-3 gap-px bg-white/10 border border-white/10 rounded-2xl overflow-hidden mb-32">
            {[
              {
                title: "Transparence Totale",
                desc: "Historique des prix vérifié. Si une promo est fausse, on te le dit.",
                icon: Shield
              },
              {
                title: "Curated Deals",
                desc: "Pas de spam. Uniquement les offres qui valent vraiment le coup (> 20%).",
                icon: Sparkles
              },
              {
                title: "Communauté",
                desc: "Les meilleures offres sont partagées entre nous avant de disparaître.",
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

        </div>

        {/* Newsletter Integration */}
        <NewsletterSection />
      </main>
    </div>
    </>
  );
}
