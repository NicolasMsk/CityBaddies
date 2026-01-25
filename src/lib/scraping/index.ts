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

// Recherche de prix concurrents
export { searchNocibeProduct, compareWithNocibe } from './nocibe-search';
export type { NocibeSearchResult } from './nocibe-search';

export { searchSephoraProduct, compareWithSephora } from './sephora-search';
export type { SephoraSearchResult } from './sephora-search';

export { searchMarionnaudProduct, compareWithMarionnaud } from './marionnaud-search';
export type { MarionnaudSearchResult } from './marionnaud-search';
