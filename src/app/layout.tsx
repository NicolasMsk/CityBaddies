import type { Metadata, Viewport } from "next";
import { Bodoni_Moda, Manrope, Spline_Sans_Mono } from "next/font/google";
import "./globals.css";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { AuthProvider } from "@/components/auth";
import GoogleAnalytics from "@/components/analytics/GoogleAnalytics";
import CookieConsent from "@/components/analytics/CookieConsent";
import JsonLd from "@/components/seo/JsonLd";

// Système typographique City Baddies — choisi, pas hérité :
// - Bodoni Moda (didone) : le langage typographique historique de la mode et de
//   la parfumerie (titres). Optique variable, italiques réelles.
// - Manrope : grotesque sobre pour le texte courant.
// - Spline Sans Mono : chiffres/prix/données — codes de la mesure, pas du code.
const display = Bodoni_Moda({
  variable: "--font-display",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

const body = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
});

const mono = Spline_Sans_Mono({
  variable: "--font-data",
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
    default: "City Baddies Parfums | Comparateur Prix Parfums — Sephora, Nocibé, Marionnaud",
    template: "%s | City Baddies Parfums",
  },
  description: "Comparez les prix de vos parfums préférés entre Sephora, Nocibé et Marionnaud. Eau de parfum, eau de toilette, coffrets — prix vérifiés quotidiennement, historique des prix et vraies promos démasquées.",
  keywords: [
    "parfum pas cher",
    "comparateur prix parfum",
    "eau de parfum promo",
    "parfum femme pas cher",
    "parfum homme pas cher",
    "reduction parfum sephora",
    "code promo nocibé parfum",
    "promo marionnaud parfum",
    "parfumerie en ligne",
    "fragrance luxe promotion",
    "city baddies parfums",
    "eau de toilette soldes",
    "coffret parfum promo",
    "parfum de marque moins cher",
    "comparateur sephora nocibé marionnaud",
    "historique prix parfum",
    "meilleur prix parfum",
    "bon plan parfum luxe",
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
    title: "City Baddies Parfums | Comparateur Prix Parfums en France",
    description: "Comparez les prix de vos parfums entre Sephora, Nocibé et Marionnaud. Historique des prix, vraies promos et fausses réductions démasquées.",
    type: "website",
    locale: "fr_FR",
    url: BASE_URL,
    siteName: "City Baddies",
  },
  twitter: {
    card: "summary_large_image",
    title: "City Baddies Parfums | Comparateur Prix Parfums",
    description: "Comparez les prix parfums entre Sephora, Nocibé et Marionnaud. Vraies promos démasquées.",
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
    google: process.env.NEXT_PUBLIC_GSC_VERIFICATION || '',
  },
};

// Schema.org JSON-LD pour l'organisation
const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "City Baddies",
  url: BASE_URL,
  logo: `${BASE_URL}/images/logo.png`,
  description: "Comparateur de prix parfums entre Sephora, Nocibé et Marionnaud. Historique des prix, analyse des vraies promos et alertes prix.",
  sameAs: [
    // Handle unique partout : @city_baddies (aligné footer/about)
    "https://www.tiktok.com/@city_baddies",
  ],
  contactPoint: {
    "@type": "ContactPoint",
    email: "contact@citybaddies.com",
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
  description: "Comparateur de prix parfums — Sephora, Nocibé, Marionnaud",
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${BASE_URL}/produits?search={search_term_string}`,
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
    <html lang="fr" style={{ backgroundColor: '#0a0a0a' }}>
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        {/* JSON-LD natif (PAS next/script) : doit être dans le HTML initial
            pour les crawlers sans JS — voir src/components/seo/JsonLd.tsx */}
        <JsonLd id="organization-schema" data={organizationSchema} />
        <JsonLd id="website-schema" data={websiteSchema} />
      </head>
      <body className={`${display.variable} ${body.variable} ${mono.variable} font-sans antialiased bg-[#0a0a0a] text-neutral-100 min-h-screen flex flex-col`}>
        <GoogleAnalytics />
        <CookieConsent />
        <AuthProvider>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}

