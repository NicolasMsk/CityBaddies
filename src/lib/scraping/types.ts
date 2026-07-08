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

  // Traçabilité: URL de la page catégorie qui a produit ce résultat
  sourceUrl?: string;

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
