/**
 * Types et interfaces pour le système de scraping
 * Architecture Strategy Pattern
 */

// ============================================
// PRODUIT STANDARDISÉ
// ============================================

/**
 * Produit standardisé retourné par tous les scrapers
 * C'est le contrat commun entre les scrapers et l'ImportEngine
 */
export interface ScrapedProduct {
  // Identifiants
  name: string;
  brand: string;
  productUrl: string;
  sku?: string;

  // Prix
  currentPrice: number;
  originalPrice: number;
  discountPercent: number;

  // Médias
  imageUrl: string;

  // Caractéristiques
  volume?: string;          // "50ml", "100ml", etc.
  category: string;         // Slug catégorie (ex: "parfums")

  // Métadonnées optionnelles
  rating?: number;
  reviewCount?: number;
  description?: string;

  // Flags runtime (ajoutés par l'engine)
  isTrending?: boolean;
}

// ============================================
// RÉSULTATS ET CONFIGURATION
// ============================================

export interface ScrapingResult {
  success: boolean;
  products: ScrapedProduct[];
  errors: string[];
  duration: number;
}

export interface ScraperConfig {
  headless: boolean;
  timeout: number;
  delayBetweenRequests: number;
}

export const DEFAULT_SCRAPER_CONFIG: ScraperConfig = {
  headless: true,
  timeout: 30000,
  delayBetweenRequests: 2000,
};

// ============================================
// INTERFACE SCRAPER - STRATEGY PATTERN
// ============================================

/**
 * Interface Scraper - Strategy Pattern
 * Tous les scrapers doivent implémenter cette interface
 */
export interface Scraper {
  /** Identifiant unique du scraper (ex: "nocibe", "sephora") */
  readonly merchantSlug: string;

  /** Initialiser le scraper (browser, connexion, etc.) */
  init(): Promise<void>;

  /** Fermer proprement les ressources */
  close(): Promise<void>;

  /**
   * Scraper une page catégorie/promo
   * @param url URL de la page à scraper
   * @param maxProducts Nombre max de produits à récupérer
   * @returns Résultat standardisé avec produits ScrapedProduct
   */
  scrape(url: string, maxProducts?: number): Promise<ScrapingResult>;
}

// ============================================
// TYPES POUR L'ENGINE
// ============================================

/**
 * Statistiques d'import pour le rapport final
 */
export interface ImportStats {
  scraped: number;
  withVolume: number;
  existing: number;
  updated: number;
  created: number;
  priceChanges: number;
  errors: Array<{ product: string; error: string }>;
  duration: number;
}

/**
 * Options de l'ImportEngine
 */
export interface ImportEngineOptions {
  /** Taille des batches pour les updates parallèles */
  batchSize?: number;
  /** Réduction minimum pour créer un Deal (défaut: 5%) */
  minDiscountPercent?: number;
  /** Nombre max de produits à importer (défaut: illimité) */
  maxProducts?: number;
  /** Mode verbose pour les logs */
  verbose?: boolean;
}

// ============================================
// LEGACY - COMPATIBILITÉ
// ============================================

export interface ScrapingConfig {
  headless: boolean;
  timeout: number;
  retries: number;
  delayBetweenRequests: number;
}

export const DEFAULT_CONFIG: ScrapingConfig = {
  headless: true,
  timeout: 30000,
  retries: 3,
  delayBetweenRequests: 2000,
};

export const BEAUTY_CATEGORIES: Record<string, string[]> = {
  'Maquillage': ['maquillage', 'fond de teint', 'mascara', 'rouge', 'levres', 'fard', 'eyeliner', 'blush', 'poudre', 'concealer', 'highlighter'],
  'Soins visage': ['creme', 'serum', 'nettoyant', 'masque', 'soin', 'hydratant', 'anti-age', 'contour', 'exfoliant', 'tonique'],
  'Cheveux': ['shampoing', 'shampooing', 'apres-shampoing', 'masque capillaire', 'huile', 'seche-cheveux', 'lisseur', 'brushing', 'coloration'],
  'Parfums': ['parfum', 'eau de toilette', 'eau de parfum', 'cologne', 'brume', 'coffret parfum'],
  'Ongles': ['vernis', 'nail', 'manucure', 'ongle', 'gel', 'semi-permanent'],
  'Bijoux': ['boucle', 'collier', 'bracelet', 'bague', 'bijou'],
  'Blanchiment dentaire': ['blanchiment', 'dentaire', 'dentifrice', 'strips', 'sourire'],
};

export function detectCategory(productName: string): string {
  const nameLower = productName.toLowerCase();
  for (const [category, keywords] of Object.entries(BEAUTY_CATEGORIES)) {
    if (keywords.some(keyword => nameLower.includes(keyword))) {
      return category;
    }
  }
  return 'Maquillage';
}
