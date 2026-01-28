import prisma from '@/lib/prisma';
import CategoryCard from '@/components/categories/CategoryCard';
import type { Metadata } from 'next';

// Force dynamic - pas de pré-rendu au build
export const dynamic = 'force-dynamic';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://citybaddies.com';

export const metadata: Metadata = {
  title: "Catégories Beauté | Maquillage, Skincare, Parfums",
  description: "Explorez toutes les catégories beauté : maquillage, soins du visage, parfums, corps et cheveux. Trouvez les meilleurs deals par catégorie avec des réductions jusqu'à -70%.",
  keywords: [
    "catégories beauté",
    "maquillage deals",
    "skincare promotion",
    "parfum réduction",
    "soins visage pas cher",
    "cosmétiques promo",
  ],
  alternates: {
    canonical: `${BASE_URL}/categories`,
  },
  openGraph: {
    title: "Catégories Beauté | City Baddies",
    description: "Explorez toutes les catégories beauté et trouvez les meilleurs deals.",
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
              isExpired: false,
              score: { gte: 60 },
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

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold text-white mb-4">
            Catégories Beauté
          </h1>
          <p className="text-slate-400 max-w-2xl mx-auto">
            Explorez nos catégories pour trouver les meilleurs deals beauté
          </p>
        </div>

        {/* Categories Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {categories.map((category) => (
            <CategoryCard key={category.id} category={category as any} />
          ))}
        </div>

        {/* Empty State */}
        {categories.length === 0 && (
          <div className="text-center py-20">
            <p className="text-slate-400">
              Aucune catégorie avec des deals actifs pour le moment.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
