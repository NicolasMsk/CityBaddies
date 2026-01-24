// Configuration SEO centralisée pour City Baddies
// Ce fichier contient toutes les constantes SEO utilisées à travers le site

export const SEO_CONFIG = {
  siteName: 'City Baddies',
  siteUrl: process.env.NEXT_PUBLIC_BASE_URL || 'https://citybaddies.com',
  
  // Description par défaut
  defaultDescription: 'Découvrez les meilleures promos beauté jusqu\'à -70% sur Sephora et Nocibé. Maquillage, skincare, parfums - offres vérifiées quotidiennement.',
  
  // Mots-clés principaux
  primaryKeywords: [
    'bons plans beauté',
    'promo maquillage',
    'reduction sephora',
    'code promo nocibé',
    'deals cosmétiques',
  ],
  
  // Réseaux sociaux (à compléter)
  social: {
    instagram: '', // Ex: 'https://instagram.com/citybaddies'
    twitter: '',   // Ex: 'https://twitter.com/citybaddies'
    tiktok: '',    // Ex: 'https://tiktok.com/@citybaddies'
  },
  
  // Contact
  contact: {
    email: 'contact@citybaddies.com',
  },
  
  // Enseignes partenaires
  partners: ['Sephora', 'Nocibé'],
  
  // Couleurs de la marque (pour OG images, etc.)
  brandColors: {
    primary: '#d4a855',    // Or
    secondary: '#9b1515',  // Bordeaux
    background: '#0a0a0a', // Noir
  },
};

// Générateur de titre SEO
export function generateTitle(pageTitle?: string): string {
  if (!pageTitle) return `${SEO_CONFIG.siteName} | Bons Plans Beauté & Promos Maquillage`;
  return `${pageTitle} | ${SEO_CONFIG.siteName}`;
}

// Générateur de description avec mots-clés
export function generateDescription(customDesc: string, includeKeywords = true): string {
  if (!includeKeywords) return customDesc;
  return `${customDesc} Sephora, Nocibé - City Baddies.`;
}

// Schema Organization réutilisable
export const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SEO_CONFIG.siteName,
  url: SEO_CONFIG.siteUrl,
  logo: `${SEO_CONFIG.siteUrl}/images/logo.png`,
  description: "Plateforme communautaire de bons plans beauté. Découvrez les meilleures promotions sur le maquillage, skincare et parfums.",
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
      urlTemplate: `${SEO_CONFIG.siteUrl}/deals?search={search_term_string}`,
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
  isExpired: boolean;
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
      url: `${SEO_CONFIG.siteUrl}/deals/${deal.id}`,
      priceCurrency: "EUR",
      price: deal.dealPrice,
      priceValidUntil: deal.endDate ? new Date(deal.endDate).toISOString().split('T')[0] : undefined,
      availability: deal.isExpired ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
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
      url: `${SEO_CONFIG.siteUrl}/deals/${deal.id}`,
      name: deal.title,
    })),
  };
}
