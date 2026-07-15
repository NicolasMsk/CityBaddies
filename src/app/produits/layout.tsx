import type { Metadata } from 'next';
import { Suspense } from 'react';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://citybaddies.com';

export const metadata: Metadata = {
  title: 'Tous les Parfums | Comparateur de Prix',
  description:
    'Comparez les prix de vos parfums entre Sephora, Nocibé et Marionnaud. Prix relevés six fois par jour, chaque contenance, avec historique.',
  alternates: {
    canonical: `${BASE_URL}/produits`,
  },
};

export default function ProduitsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
          <div className="animate-pulse text-neutral-500 text-sm uppercase tracking-widest">
            Chargement...
          </div>
        </div>
      }
    >
      {children}
    </Suspense>
  );
}
