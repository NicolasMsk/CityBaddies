import type { Metadata } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://citybaddies.com';

export const metadata: Metadata = {
  title: 'Contactez-nous | Support City Baddies',
  description: 'Une question sur un deal, une suggestion ou un partenariat ? Contactez l\'équipe City Baddies. Réponse garantie sous 24-48h.',
  keywords: [
    "contact city baddies",
    "support beauté",
    "partenariat cosmétique",
    "question deals",
  ],
  alternates: {
    canonical: `${BASE_URL}/contact`,
  },
  openGraph: {
    title: 'Contactez-nous | City Baddies',
    description: 'Une question ? Contactez l\'équipe City Baddies.',
    url: `${BASE_URL}/contact`,
    type: 'website',
  },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
