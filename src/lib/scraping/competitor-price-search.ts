/**
 * =============================================================================
 * COMPETITOR-PRICE-SEARCH.TS - ORCHESTRATEUR DE RECHERCHE DE PRIX CONCURRENTS
 * =============================================================================
 * 
 * FONCTION : Orchestrer la recherche de prix sur différents sites concurrents
 *            en déléguant à des modules spécialisés par site
 * 
 * UTILISÉ PAR : enrich-competitor-prices.ts
 * 
 * ARCHITECTURE :
 *   - Ce fichier : orchestrateur, interface unifiée
 *   - sephora-search.ts : logique spécifique Sephora
 *   - nocibe-search.ts : logique spécifique Nocibé
 *   - marionnaud-search.ts : logique spécifique Marionnaud
 *   - search-utils.ts : fonctions partagées (browser, Serper, Vision LLM)
 * 
 * =============================================================================
 */

import 'dotenv/config';
import { CompetitorPriceResult, closeBrowser } from './search-utils';
import { searchSephoraPrice } from './sephora-search';
import { searchNocibePrice } from './nocibe-search';
import { searchMarionnaudPrice } from './marionnaud-search';

// Sites supportés
export const COMPETITOR_SITES = ['sephora', 'nocibe', 'marionnaud'] as const;
export type CompetitorSite = typeof COMPETITOR_SITES[number];

// Re-export pour compatibilité
export { CompetitorPriceResult, closeBrowser };

/**
 * Recherche le prix d'un produit sur un site concurrent spécifique
 */
export async function searchCompetitorPrice(
  searchQuery: string,
  site: CompetitorSite,
  targetVolume?: string
): Promise<CompetitorPriceResult> {
  switch (site) {
    case 'sephora':
      return searchSephoraPrice(searchQuery, targetVolume);
    case 'nocibe':
      return searchNocibePrice(searchQuery, targetVolume);
    case 'marionnaud':
      return searchMarionnaudPrice(searchQuery, targetVolume);
    default:
      return { found: false, site, error: `Site non supporté: ${site}` };
  }
}

/**
 * Recherche le prix sur tous les concurrents d'un coup
 */
export async function searchAllCompetitors(
  searchQuery: string,
  targetVolume?: string,
  excludeSite?: CompetitorSite
): Promise<Record<CompetitorSite, CompetitorPriceResult>> {
  const results: Partial<Record<CompetitorSite, CompetitorPriceResult>> = {};
  
  for (const site of COMPETITOR_SITES) {
    if (site === excludeSite) continue;
    
    results[site] = await searchCompetitorPrice(searchQuery, site, targetVolume);
    
    // Petit délai entre les recherches pour éviter le rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return results as Record<CompetitorSite, CompetitorPriceResult>;
}

// Pour les tests en standalone
if (require.main === module) {
  (async () => {
    const query = process.argv[2] || 'Lancôme Génifique Sérum 50ml';
    const siteOrAll = process.argv[3] || 'all';
    const targetVolume = process.argv[4]; // ex: "50ml"
    
    if (siteOrAll === 'all') {
      console.log(`Test sur TOUS les sites: "${query}"${targetVolume ? ` (volume: ${targetVolume})` : ''}\n`);
      
      const results = await searchAllCompetitors(query, targetVolume);
      
      console.log('\n' + '='.repeat(60));
      console.log('RÉSUMÉ:');
      console.log('='.repeat(60));
      for (const [site, result] of Object.entries(results)) {
        if (result.found) {
          console.log(`✅ ${site.toUpperCase()}: ${result.currentPrice}€ (${result.volume || '?'})`);
        } else {
          console.log(`❌ ${site.toUpperCase()}: ${result.error}`);
        }
      }
    } else {
      const site = siteOrAll as CompetitorSite;
      console.log(`Test: "${query}" sur ${site}${targetVolume ? ` (volume: ${targetVolume})` : ''}`);
      
      const result = await searchCompetitorPrice(query, site, targetVolume);
      console.log('\nRésultat:', JSON.stringify(result, null, 2));
    }
    
    await closeBrowser();
  })();
}
