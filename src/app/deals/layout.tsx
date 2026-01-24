import { Suspense } from 'react';
import type { Metadata } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://citybaddies.com';

export const metadata: Metadata = {
  title: "Tous les Deals Beauté | Promos Maquillage & Skincare",
  description: "Parcourez tous les bons plans beauté du moment. Filtrez par catégorie, marque ou prix. Deals vérifiés quotidiennement sur Sephora et Nocibé.",
  keywords: [
    "deals beauté",
    "promotion maquillage",
    "soldes cosmétiques",
    "offres skincare",
    "réduction parfum",
    "bons plans sephora",
    "promo nocibé",
  ],
  alternates: {
    canonical: `${BASE_URL}/deals`,
  },
  openGraph: {
    title: "Tous les Deals Beauté | City Baddies",
    description: "Parcourez tous les bons plans beauté du moment avec des réductions jusqu'à -70%.",
    url: `${BASE_URL}/deals`,
    type: "website",
  },
};

export default function DealsLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-purple-500 border-t-transparent rounded-full" />
      </div>
    }>
      {children}
    </Suspense>
  );
}
