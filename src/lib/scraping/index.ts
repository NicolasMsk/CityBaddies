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
