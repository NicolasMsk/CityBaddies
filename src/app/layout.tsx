import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import { AuthProvider } from "@/components/auth";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "City Baddies | Curated Beauty Deals",
  description: "Une sélection pointue des meilleures offres beauté. Maquillage, skincare, parfums - toujours au meilleur prix.",
  keywords: ["beauté", "maquillage", "cosmétiques", "deals", "promotion", "soins", "skincare", "city baddies"],
  openGraph: {
    title: "City Baddies | Curated Beauty Deals",
    description: "Une sélection pointue des meilleures offres beauté",
    type: "website",
    locale: "fr_FR",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
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

