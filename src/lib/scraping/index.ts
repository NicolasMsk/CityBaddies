/**
 * Module Scraping - Exports centralisés
 * Architecture Strategy Pattern
 */

// Types et interfaces
export * from './types';

// Moteur d'import (Strategy Pattern)
export { ImportEngine, importEngine } from './ImportEngine';

// Scrapers disponibles
export { NocibeScraper } from './nocibe';
export type { NocibeProduct, NocibeScrapingResult, NocibeConfig } from './nocibe';

export { SephoraScraper } from './sephora';
export type { SephoraProduct, SephoraScrapingResult, SephoraConfig } from './sephora';

export { MarionnaudScraper } from './marionnaud';
export type { MarionnaudProduct, MarionnaudScrapingResult, MarionnaudConfig } from './marionnaud';

// Recherche de prix concurrents (nouveau système modulaire)
export { searchCompetitorPrice, searchAllCompetitors, closeBrowser } from './competitor-price-search';
export type { CompetitorSite } from './competitor-price-search';
export type { CompetitorPriceResult } from './search-utils';

// Fonctions spécifiques par site (si besoin d'appeler directement)
export { searchSephoraPrice } from './sephora-search';
export { searchNocibePrice } from './nocibe-search';
export { searchMarionnaudPrice } from './marionnaud-search';
