/**
 * Script de test pour rechercher un produit chez un concurrent et recuperer le prix
 * AVEC selection precise du volume
 * 
 * Usage:
 *   npx tsx src/scripts/test-competitor-search.ts "Dior J'adore" "50 ml" sephora
 *   npx tsx src/scripts/test-competitor-search.ts "Chanel N5" "100 ml" nocibe
 *   npx tsx src/scripts/test-competitor-search.ts "Lancome La Vie Est Belle" "75 ml" sephora
 */

import { searchSephoraProduct } from '../lib/scraping/sephora-search';
import { searchNocibeProduct } from '../lib/scraping/nocibe-search';

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length < 3) {
    console.log(`
======================================================================
        RECHERCHE DE PRIX CHEZ UN CONCURRENT (avec volume)           
======================================================================
  Usage:                                                          
    npx tsx src/scripts/test-competitor-search.ts <produit> <volume> <site>
                                                                  
  Arguments:                                                      
    <produit>  Nom du produit (entre guillemets)     
    <volume>   Volume cible ex: "50 ml", "100 ml" (OBLIGATOIRE)
    <site>     Site concurrent: "sephora" ou "nocibe"             
                                                                  
  Exemples:                                                       
    npx tsx src/scripts/test-competitor-search.ts "Dior J'adore" "50 ml" sephora
    npx tsx src/scripts/test-competitor-search.ts "Chanel N5" "100 ml" nocibe
    npx tsx src/scripts/test-competitor-search.ts "Lancome La Vie Est Belle" "75 ml" sephora
======================================================================
    `);
    process.exit(1);
  }
  
  const productName = args[0];
  const volume = args[1];
  const competitor = args[2].toLowerCase();

  console.log(`
======================================================================
                    RECHERCHE CONCURRENT                       
======================================================================
  Produit: ${productName}
  Volume:  ${volume}
  Site:    ${competitor.toUpperCase()}
======================================================================
  `);
  
  const startTime = Date.now();
  
  try {
    let result;
    
    if (competitor === 'sephora') {
      result = await searchSephoraProduct(productName, volume);
    } else if (competitor === 'nocibe') {
      result = await searchNocibeProduct(productName, volume);
    } else {
      console.error(`Site concurrent invalide: ${competitor}`);
      console.error('   Sites supportes: sephora, nocibe');
      process.exit(1);
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    console.log(`\n${'='.repeat(66)}`);
    console.log(`                         RESULTAT`);
    console.log(`${'='.repeat(66)}\n`);
    
    if (result.found) {
      console.log(`Produit trouve sur ${competitor.toUpperCase()}!\n`);
      console.log(`   Nom:           ${result.productName || 'N/A'}`);
      console.log(`   Marque:        ${result.brand || 'N/A'}`);
      console.log(`   Volume:        ${result.volume || 'N/A'}`);
      console.log(`   Prix actuel:   ${result.currentPrice?.toFixed(2) || 'N/A'} EUR`);
      
      if (result.originalPrice && result.originalPrice !== result.currentPrice) {
        console.log(`   Prix original: ${result.originalPrice.toFixed(2)} EUR (barre)`);
        console.log(`   Reduction:     -${result.discountPercent || 0}%`);
      }
      
      console.log(`   En stock:      ${result.inStock ? 'Oui' : 'Non'}`);
      console.log(`   URL:           ${result.productUrl || 'N/A'}`);
      
      if (result.allVariants && result.allVariants.length > 0) {
        console.log(`\n   Toutes les variantes disponibles:`);
        for (const v of result.allVariants) {
          console.log(`     - ${v.volume}: ${v.price} EUR ${v.available ? '(dispo)' : '(indispo)'}`);
        }
      }
    } else {
      console.log(`Produit non trouve sur ${competitor.toUpperCase()}`);
      if (result.error) {
        console.log(`   Erreur: ${result.error}`);
      }
    }
    
    console.log(`\nDuree: ${duration}s`);
    console.log(`${'='.repeat(66)}\n`);
    
    // Retourner le resultat pour usage programmatique
    return result;
    
  } catch (error) {
    console.error('❌ Erreur lors de la recherche:', error);
    process.exit(1);
  }
}

main().catch(console.error);
