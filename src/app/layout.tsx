import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { AuthProvider } from "@/components/auth";
import Script from "next/script";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://citybaddies.com';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#0a0a0a',
};

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "City Baddies | Bons Plans Beauté & Promos Maquillage",
    template: "%s | City Baddies",
  },
  description: "Découvrez les meilleures promos beauté jusqu'à -70% sur Sephora et Nocibé. Maquillage, skincare, parfums de luxe - offres vérifiées quotidiennement.",
  keywords: [
    "bons plans beauté",
    "promo maquillage",
    "reduction sephora",
    "code promo nocibé",
    "deals cosmétiques",
    "soldes parfum",
    "skincare pas cher",
    "maquillage luxe promotion",
    "city baddies",
    "comparateur prix beauté",
    "offres beauté",
    "code reduction cosmetique",
    "promotion sephora",
    "vente flash nocibé",
    "bon plan maquillage",
    "réduction parfum femme",
    "promo soins visage",
    "deal beauté luxe",
    "prix barré cosmétique",
  ],
  authors: [{ name: "City Baddies" }],
  creator: "City Baddies",
  publisher: "City Baddies",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: BASE_URL,
  },
  openGraph: {
    title: "City Baddies | Bons Plans Beauté & Promos Maquillage",
    description: "Les meilleures promos beauté jusqu'à -70%. Maquillage, skincare, parfums - offres vérifiées quotidiennement.",
    type: "website",
    locale: "fr_FR",
    url: BASE_URL,
    siteName: "City Baddies",
  },
  twitter: {
    card: "summary_large_image",
    title: "City Baddies | Bons Plans Beauté",
    description: "Les meilleures promos beauté jusqu'à -70%. Offres vérifiées quotidiennement.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    // Ajouter les codes de vérification une fois obtenus
    // google: 'votre-code-google',
    // yandex: 'votre-code-yandex',
  },
};

// Schema.org JSON-LD pour l'organisation
const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "City Baddies",
  url: BASE_URL,
  logo: `${BASE_URL}/images/logo.png`,
  description: "Plateforme communautaire de bons plans beauté. Découvrez les meilleures promotions sur le maquillage, skincare et parfums.",
  sameAs: [
    // Ajouter les liens réseaux sociaux
    // "https://www.instagram.com/citybaddies",
    // "https://www.tiktok.com/@citybaddies",
  ],
  contactPoint: {
    "@type": "ContactPoint",
    email: "citybaddies068@gmail.com",
    contactType: "customer service",
    availableLanguage: "French",
  },
};

// Schema.org JSON-LD pour le site web
const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "City Baddies",
  url: BASE_URL,
  description: "Les meilleures promos beauté jusqu'à -70%",
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${BASE_URL}/deals?search={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" href="/images/logo.png" />
        <Script
          id="organization-schema"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <Script
          id="website-schema"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
      </head>
      <body className={`${inter.variable} font-sans antialiased bg-[#0a0a0a] text-neutral-100 min-h-screen flex flex-col`}>
        <AuthProvider>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}

