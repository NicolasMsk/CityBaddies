// Configuration SEO centralisée pour City Baddies
// Ce fichier contient toutes les constantes SEO utilisées à travers le site

export const SEO_CONFIG = {
  siteName: 'City Baddies',
  siteUrl: process.env.NEXT_PUBLIC_BASE_URL || 'https://citybaddies.com',
  
  // Description par défaut
  defaultDescription: 'Comparez les prix de vos parfums entre Sephora, Nocibé et Marionnaud. Eau de parfum, eau de toilette, coffrets — historique des prix et vraies promos.',

  // Mots-clés principaux
  primaryKeywords: [
    'comparateur prix parfum',
    'parfum pas cher',
    'eau de parfum promo',
    'parfum sephora nocibé marionnaud',
    'fragrance luxe promotion',
  ],
  
  // Réseaux sociaux — garder ALIGNÉ avec le footer (handle unique : @city_baddies)
  social: {
    instagram: '', // pas de compte actif — ne rien inventer
    twitter: '',
    tiktok: 'https://www.tiktok.com/@city_baddies',
  },
  
  // Contact
  contact: {
    email: 'contact@citybaddies.com',
  },
  
  // Enseignes partenaires
  partners: ['Sephora', 'Nocibé', 'Marionnaud'],
  
  // Couleurs de la marque (pour OG images, etc.)
  brandColors: {
    primary: '#d4a855',    // Or
    secondary: '#9b1515',  // Bordeaux
    background: '#0a0a0a', // Noir
  },
};

// Générateur de titre SEO
export function generateTitle(pageTitle?: string): string {
  if (!pageTitle) return `${SEO_CONFIG.siteName} Parfums | Comparateur Prix Parfums`;
  return `${pageTitle} | ${SEO_CONFIG.siteName} Parfums`;
}

// Générateur de description avec mots-clés
export function generateDescription(customDesc: string, includeKeywords = true): string {
  if (!includeKeywords) return customDesc;
  return `${customDesc} Sephora, Nocibé, Marionnaud — City Baddies Parfums.`;
}

/**
 * Nom produit complet SANS doubler la marque.
 * product.name contient souvent déjà la marque ("Lancôme La Vie Est Belle…") :
 * préfixer aveuglément donne "Lancôme Lancôme La Vie Est Belle…" dans les
 * title/h1/schema. À utiliser PARTOUT où on compose marque + nom.
 */
export function fullProductName(brand: string | null | undefined, name: string): string {
  const b = (brand || '').trim();
  if (!b) return name;
  // Comparaison insensible aux accents : la base stocke "CHLOE" mais le nom
  // produit commence par "Chloé" — sans normalisation, on doublerait la marque.
  const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  return fold(name.trim()).startsWith(fold(b)) ? name.trim() : `${b} ${name.trim()}`;
}

// Schema Organization réutilisable
export const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SEO_CONFIG.siteName,
  url: SEO_CONFIG.siteUrl,
  logo: `${SEO_CONFIG.siteUrl}/images/logo.png`,
  description: "Comparateur de prix parfums entre Sephora, Nocibé et Marionnaud. Historique des prix, analyse des promos et alertes prix sur vos fragrances préférées.",
  email: SEO_CONFIG.contact.email,
  sameAs: Object.values(SEO_CONFIG.social).filter(Boolean),
  contactPoint: {
    "@type": "ContactPoint",
    email: SEO_CONFIG.contact.email,
    contactType: "customer service",
    availableLanguage: "French",
  },
};

// Schema WebSite avec SearchAction
export const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SEO_CONFIG.siteName,
  url: SEO_CONFIG.siteUrl,
  description: SEO_CONFIG.defaultDescription,
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${SEO_CONFIG.siteUrl}/produits?search={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
};

// Générateur de BreadcrumbList Schema
export function generateBreadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

// Générateur de Product Schema pour les deals
export function generateProductSchema(deal: {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  brand?: string;
  categoryName?: string;
  dealPrice: number;
  originalPrice: number;
  status: 'PENDING' | 'ACTIVE' | 'EXPIRED';
  merchantName?: string;
  endDate?: Date | null;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: deal.title,
    description: deal.description || `${deal.brand || ''} ${deal.categoryName || 'Beauté'}`.trim(),
    image: deal.imageUrl,
    brand: deal.brand ? {
      "@type": "Brand",
      name: deal.brand,
    } : undefined,
    category: deal.categoryName,
    sku: deal.id,
    offers: {
      "@type": "Offer",
      url: `${SEO_CONFIG.siteUrl}/produits/${deal.id}`,
      priceCurrency: "EUR",
      price: deal.dealPrice,
      priceValidUntil: deal.endDate ? new Date(deal.endDate).toISOString().split('T')[0] : undefined,
      availability: deal.status === 'EXPIRED' ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
      seller: deal.merchantName ? {
        "@type": "Organization",
        name: deal.merchantName,
      } : undefined,
    },
  };
}

// Générateur de ItemList Schema pour les collections de deals
export function generateItemListSchema(deals: { id: string; title: string; dealPrice: number }[], listName: string) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: listName,
    numberOfItems: deals.length,
    itemListElement: deals.map((deal, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: `${SEO_CONFIG.siteUrl}/produits/${deal.id}`,
      name: deal.title,
    })),
  };
}
