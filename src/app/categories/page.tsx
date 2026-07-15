import prisma from '@/lib/prisma';
import CategoryCard from '@/components/categories/CategoryCard';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, Sparkles } from 'lucide-react';

// Force dynamic - pas de pré-rendu au build
export const dynamic = 'force-dynamic';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://citybaddies.com';

// Images statiques par défaut (fallback si pas d'image en BDD)
const CATEGORY_IMAGES: Record<string, string> = {
  'maquillage': '/images/maquillage.png',
  'soins-visage': '/images/soins-visage.png',
  'soins-corps': '/images/soins-corps.png',
  'cheveux': '/images/cheveux.png',
  'parfums': '/images/parfum.png',
  'ongles': '/images/ongles.png',
  'accessoires': '/images/accessoires.png',
};

// Descriptions courtes par catégorie pour affichage sur la page
const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  'maquillage': 'Fonds de teint, rouges à lèvres, mascaras et palettes des plus grandes marques à prix réduit.',
  'soins-visage': 'Sérums, crèmes hydratantes, nettoyants et masques pour une peau éclatante.',
  'soins-corps': 'Laits corporels, huiles sèches, gommages et soins hydratants pour tout le corps.',
  'cheveux': 'Shampoings, masques, soins sans rinçage et traitements capillaires professionnels.',
  'parfums': 'Eaux de parfum, eaux de toilette et coffrets des plus grandes maisons de parfumerie.',
  'ongles': 'Vernis, gels UV, soins des ongles et accessoires nail art.',
  'accessoires': 'Pinceaux, éponges, trousses et outils indispensables pour votre routine beauté.',
};

// Metadata recentrées parfums : ne promettre QUE ce que le site propose
// (les catégories maquillage/soins existent en base mais n'ont aucune offre).
export const metadata: Metadata = {
  title: "Catégories | Parfums comparés - City Baddies",
  description: "Explorez les catégories suivies par City Baddies : parfums comparés entre Sephora, Nocibé et Marionnaud, prix relevés six fois par jour avec historique.",
  keywords: [
    "parfum réduction",
    "comparateur prix parfum",
    "parfum pas cher",
    "prix parfum sephora nocibé marionnaud",
  ],
  alternates: {
    canonical: `${BASE_URL}/categories`,
  },
  openGraph: {
    title: "Catégories | City Baddies",
    description: "Parfums comparés entre Sephora, Nocibé et Marionnaud.",
    url: `${BASE_URL}/categories`,
    type: "website",
  },
};

async function getCategories() {
  // Récupérer les catégories avec le nombre de deals actifs
  const categoriesWithDeals = await prisma.category.findMany({
    include: {
      products: {
        include: {
          deals: {
            where: {
              status: 'ACTIVE',
            },
          },
        },
      },
    },
  });

  // Calculer le nombre de deals actifs par catégorie et filtrer celles sans deals
  return categoriesWithDeals
    .map((cat: any) => {
      const dealCount = cat.products.reduce((acc: number, prod: any) => acc + prod.deals.length, 0);
      return {
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        imageUrl: cat.imageUrl,
        _count: { deals: dealCount },
      };
    })
    .filter((cat: any) => cat._count.deals > 0) // Ne garder que les catégories avec des deals
    .sort((a: any, b: any) => b._count.deals - a._count.deals); // Trier par nombre de deals
}

export default async function CategoriesPage() {
  const categories = await getCategories();
  const totalDeals = categories.reduce((acc, cat) => acc + cat._count.deals, 0);

  return (
    <div className="min-h-screen py-16 bg-[#0a0a0a]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header Esthétique */}
        <div className="text-center mb-20">
          <span className="text-[#d4a855] text-xs md:text-sm uppercase tracking-[0.3em] font-semibold mb-4 block animate-in fade-in slide-in-from-bottom-3 duration-700">
            Par catégorie
          </span>
          <h1 className="text-5xl md:text-7xl font-bold text-white tracking-tight mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
            Trouve ton <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-white to-slate-400">obsession</span>
          </h1>
          
          <div className="max-w-2xl mx-auto text-slate-400 text-sm leading-relaxed opacity-0 animate-in fade-in slide-in-from-bottom-5 duration-700 delay-200 fill-mode-forwards">
            {/* Copy neutre : ne cite QUE ce qui existe réellement (le site est
                100% parfums — d'autres catégories pourront revenir plus tard). */}
            <p>
              <span className="text-white font-medium">{totalDeals} offres suivies</span> chez Sephora,
              Nocibé et Marionnaud — prix relevés six fois par jour, comparés à taille égale.
            </p>
          </div>
        </div>

        {/* Grille Esthétique */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 mb-32">
          {categories.map((category, index) => {
             // Priorité : Image catégorie BDD > Image statique locale > Fallback dégradé
             const bgImage = category.imageUrl || CATEGORY_IMAGES[category.slug];
             
             return (
              <Link 
                key={category.id} 
                href={`/categories/${category.slug}`}
                className="group relative block aspect-[3/4] overflow-hidden rounded-xl bg-neutral-900 border border-white/5 transition-all duration-500 hover:shadow-[0_0_40px_-10px_rgba(212,168,85,0.3)]"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                {/* Background Image */}
                {bgImage ? (
                  <div className="absolute inset-0">
                    <img 
                      src={bgImage} 
                      alt={category.name}
                      className="w-full h-full object-cover transition-transform duration-[1.5s] ease-out group-hover:scale-110 opacity-70 group-hover:opacity-60"
                    />
                    <div className="absolute inset-0 bg-neutral-900/20 group-hover:bg-neutral-900/10 transition-colors duration-500" />
                  </div>
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-neutral-800 to-neutral-900 transition-transform duration-[1.5s] ease-out group-hover:scale-110" />
                )}
                
                {/* Overlay Gradient Premium */}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent opacity-90 group-hover:opacity-80 transition-opacity duration-500" />

                {/* Content */}
                <div className="absolute inset-0 p-8 flex flex-col justify-end items-center text-center">
                  
                  <div className="transform translate-y-4 group-hover:translate-y-0 transition-transform duration-500 ease-out w-full flex flex-col items-center">
                    
                    {/* Decorative Line Top */}
                    <div className="h-px w-0 bg-[#d4a855]/50 mb-4 group-hover:w-16 transition-all duration-700 ease-out" />

                    <h2 className="text-3xl md:text-4xl font-bold text-white mb-2 tracking-wide font-serif">
                      {category.name}
                    </h2>
                    
                    <p className="text-sm text-slate-300 mb-6 opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-100 max-w-[80%] line-clamp-2 leading-relaxed">
                      {CATEGORY_DESCRIPTIONS[category.slug]}
                    </p>

                    <div className="flex items-center gap-3 px-4 py-2 rounded-full border border-white/10 bg-black/20 backdrop-blur-sm group-hover:border-[#d4a855]/50 group-hover:bg-[#d4a855]/10 transition-all duration-300">
                      <span className="text-[#d4a855] font-medium text-sm uppercase tracking-wider">
                        Découvrir
                      </span>
                      <span className="text-white/60 text-xs border-l border-white/20 pl-3 ml-1">
                        {category._count.deals} offres
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Guide d'achat SEO (Style Minimal) */}
        {categories.length > 0 && (
          <section className="border-t border-white/[0.06] pt-24 max-w-5xl mx-auto">
            {/* Guide recentré parfums : les anciens blocs skincare/maquillage/cheveux
                promettaient des catégories sans aucune offre (site 100% parfums). */}
            <div className="text-center mb-16">
              <span className="text-[#d4a855] text-xs uppercase tracking-widest font-medium block mb-3">Guide</span>
              <h2 className="text-3xl font-bold text-white">
                Bien choisir son parfum
              </h2>
            </div>

            <div className="grid md:grid-cols-2 gap-8 md:gap-12">
              <div className="space-y-4">
                <h3 className="text-xl text-white font-medium flex items-center gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#d4a855]" />
                  Pour trouver son parfum signature
                </h3>
                <p className="text-slate-400 leading-relaxed pl-4 border-l border-white/10 ml-[3px]">
                  Commencez par un <strong className="text-white font-normal">petit format</strong> (20 ou 30 ml)
                  pour tester le parfum sur votre peau plusieurs jours. Une eau de parfum tient mieux
                  qu&apos;une eau de toilette — mais coûte plus cher : à vous de choisir votre équilibre.
                </p>
              </div>

              <div className="space-y-4">
                <h3 className="text-xl text-white font-medium flex items-center gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#d4a855]" />
                  Pour payer le bon prix
                </h3>
                <p className="text-slate-400 leading-relaxed pl-4 border-l border-white/10 ml-[3px]">
                  Comparez toujours <strong className="text-white font-normal">à contenance identique</strong> entre
                  les enseignes, et vérifiez l&apos;historique de prix sur la fiche : un prix barré permanent
                  n&apos;est pas une promo. Le prix au millilitre départage les formats.
                </p>
              </div>

              <div className="space-y-4">
                <h3 className="text-xl text-white font-medium flex items-center gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#d4a855]" />
                  Pour un budget maîtrisé
                </h3>
                <p className="text-slate-400 leading-relaxed pl-4 border-l border-white/10 ml-[3px]">
                  Notre sélection de <Link href="/parfums-moins-de-50-euros" className="text-white font-normal underline decoration-white/30 underline-offset-4 hover:decoration-white">parfums à moins de 50&nbsp;€</Link>{' '}
                  ne référence que des flacons de 20 ml et plus, vendus par les enseignes officielles —
                  jamais de miniatures piège ni de revendeurs douteux.
                </p>
              </div>

              <div className="space-y-4">
                <h3 className="text-xl text-white font-medium flex items-center gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#d4a855]" />
                  Pour choisir la bonne enseigne
                </h3>
                <p className="text-slate-400 leading-relaxed pl-4 border-l border-white/10 ml-[3px]">
                  Aucune enseigne n&apos;est toujours la moins chère. Notre page{' '}
                  <Link href="/sephora-vs-nocibe-vs-marionnaud" className="text-white font-normal underline decoration-white/30 underline-offset-4 hover:decoration-white">Sephora vs Nocibé vs Marionnaud</Link>{' '}
                  compte les victoires de chacune en continu, à taille égale.
                </p>
              </div>
            </div>

            <div className="mt-20 pt-8 border-t border-dashed border-white/10 text-center">
              <p className="text-slate-500 text-sm">
                Prix relevés six fois par jour sur les fiches produit de Sephora, Nocibé et Marionnaud.
              </p>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
