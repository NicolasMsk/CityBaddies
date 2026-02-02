/**
 * Test simple de scraping Sephora - récupération des infos produit enrichies
 * Usage: npx tsx src/scripts/test-sephora-scrape.ts [URL]
 */

import { chromium } from 'playwright';

const URL = process.argv[2] || 'https://www.sephora.fr/p/masque-capillaire-sans-rincage---edition-limitee-future-society-P1000210886.html';

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🧴 Test scraping Sephora');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`URL: ${URL}\n`);
  
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  try {
    // 1. Navigation
    console.log('1. Navigation...');
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    console.log('   Page chargee\n');
    
    // 2. Cookies - Sephora utilise plusieurs systèmes
    console.log('2. Gestion cookies...');
    try {
      // Attendre que le popup apparaisse
      await page.waitForTimeout(2000);
      
      // Essayer plusieurs sélecteurs pour le bouton cookies
      const cookieSelectors = [
        '#footer_tc_privacy_button_3',            // Sephora TC Privacy
        'button.tc-privacy-button[title="Tout accepter"]', // TC Privacy par titre
        '.tc-privacy-button',                     // TC Privacy générique
        '#onetrust-accept-btn-handler',           // OneTrust classique
        '#onetrust-accept-all-handler',           // OneTrust "Tout accepter"
        'button:has-text("Tout accepter")',       // Texte direct
        'button:has-text("TOUT ACCEPTER")',       // Texte majuscules
        'button:has-text("Accepter")',            // Texte simple
        '.onetrust-accept-btn-handler',           // Classe OneTrust
        '[data-testid="accept-all"]',             // Data attribute
        '#didomi-notice-agree-button',            // Didomi
        '.didomi-continue-without-agreeing',      // Didomi alt
      ];
      
      for (const selector of cookieSelectors) {
        try {
          const btn = await page.$(selector);
          if (btn) {
            await btn.click();
            console.log(`   Cookies acceptes (${selector})`);
            await page.waitForTimeout(1000);
            break;
          }
        } catch {
          // Continuer avec le prochain sélecteur
        }
      }
      
      // Vérifier si le banner est toujours là et forcer la fermeture
      const bannerStillVisible = await page.$('#onetrust-consent-sdk, .onetrust-pc-dark-filter');
      if (bannerStillVisible) {
        // Forcer la suppression du banner via JS
        await page.evaluate(() => {
          const banner = document.querySelector('#onetrust-consent-sdk');
          if (banner) banner.remove();
          const overlay = document.querySelector('.onetrust-pc-dark-filter');
          if (overlay) overlay.remove();
          document.body.style.overflow = 'auto';
        });
        console.log('   Banner cookies supprime par JS');
      }
      
      console.log('');
    } catch {
      console.log('   Pas de popup cookies\n');
    }
    
    // 3. Attendre le contenu
    await page.waitForSelector('.product-title-heading', { timeout: 10000 });
    await page.waitForTimeout(1500);
    
    // 4. Extraction des donnees de base
    console.log('3. Extraction des donnees de base...\n');
    
    const baseData = await page.evaluate(() => {
      // Marque
      const brand = document.querySelector('.brand-name')?.textContent?.trim() || '';
      
      // Nom produit
      const name = document.querySelector('.product-name')?.textContent?.trim() || '';
      
      // Note et avis
      const rating = document.querySelector('[itemprop="ratingValue"]')?.textContent?.trim() || '';
      const reviewCount = document.querySelector('[itemprop="reviewCount"]')?.getAttribute('content') || '';
      
      // Prix
      const currentPrice = document.querySelector('.price-sales')?.textContent?.trim()?.replace(/\s+/g, ' ') || '';
      const originalPrice = document.querySelector('.price-standard')?.textContent?.trim() || '';
      const discount = document.querySelector('.original-price-discount')?.textContent?.trim() || '';
      
      // Volume/Variante
      const variant = document.querySelector('.variation-title')?.textContent?.trim() || '';
      
      // SKU
      const sku = document.querySelector('#masterid')?.textContent?.trim() || '';
      const masterId = document.querySelector('#masterid')?.getAttribute('data-masterid') || '';
      
      // Image
      const imageUrl = document.querySelector('meta[itemprop="image"]')?.getAttribute('content') || '';
      
      // Flag promo
      const promoFlag = document.querySelector('.text-flag-label')?.textContent?.trim() || '';
      
      // Disponibilite
      const availability = document.querySelector('.availability-status')?.textContent?.trim() || '';
      
      return {
        brand,
        name,
        fullTitle: `${brand} - ${name}`.trim(),
        rating,
        reviewCount,
        currentPrice,
        originalPrice,
        discount,
        variant,
        sku,
        masterId,
        imageUrl,
        promoFlag,
        availability,
      };
    });
    
    console.log('   MARQUE:', baseData.brand);
    console.log('   NOM:', baseData.name);
    console.log('   NOTE:', baseData.rating, `(${baseData.reviewCount} avis)`);
    console.log('   PRIX:', baseData.currentPrice);
    console.log('   PRIX BARRE:', baseData.originalPrice);
    console.log('   REDUCTION:', baseData.discount);
    console.log('   VARIANTE:', baseData.variant);
    console.log('   SKU:', baseData.sku);
    console.log('   MASTER ID:', baseData.masterId);
    console.log('   PROMO:', baseData.promoFlag);
    console.log('   DISPO:', baseData.availability);
    console.log('');
    
    // 5. Cliquer sur "Lire la suite" pour charger tout le contenu dans le DOM
    console.log('4. Clic sur "Lire la suite" pour charger le contenu...\n');
    
    try {
      // Chercher le bouton "Lire la suite" ou "En savoir plus"
      const readMoreBtn = await page.$('.read-more-pdp-description, .morelink-product-description, a.morelink');
      if (readMoreBtn) {
        await readMoreBtn.click();
        await page.waitForTimeout(800);
        console.log('   Bouton "Lire la suite" clique\n');
      } else {
        // Sinon cliquer sur l'onglet Description
        const descTab = await page.$('#tab-description, li.pdp-description');
        if (descTab) {
          await descTab.click();
          await page.waitForTimeout(800);
          console.log('   Onglet Description clique\n');
        }
      }
    } catch (e) {
      console.log('   Pas de bouton "Lire la suite" trouve\n');
    }
    
    // Attendre que le contenu soit charge
    await page.waitForSelector('#product-infos-content', { timeout: 5000 }).catch(() => null);
    
    // 6. Extraction de toutes les infos produit (tout est maintenant dans le DOM)
    console.log('5. Extraction de toutes les infos produit...\n');
    
    const productInfo = await page.evaluate(() => {
      // === DESCRIPTION ===
      const descContainer = document.querySelector('#product-infos-content .pdp-description .description-content');
      
      // Labels depuis les badges images
      const labelImages = descContainer?.querySelectorAll('img[src*="badge"]') || [];
      const labels: string[] = [];
      labelImages.forEach(img => {
        const src = img.getAttribute('src') || '';
        if (src.includes('clean')) labels.push('Clean');
        if (src.includes('vegan')) labels.push('Vegan');
        if (src.includes('cruelty')) labels.push('Cruelty Free');
        if (src.includes('natural')) labels.push('Natural');
        if (src.includes('bio')) labels.push('Bio');
      });
      
      // SKU
      const sku = descContainer?.querySelector('.skuid')?.textContent?.trim() || '';
      
      // Description texte (sans les infos GPSR et images)
      let description = '';
      if (descContainer) {
        const clone = descContainer.cloneNode(true) as HTMLElement;
        clone.querySelectorAll('img, .gpsr-supplier-infos, style, script').forEach(el => el.remove());
        description = clone.textContent?.trim()?.replace(/\s+/g, ' ') || '';
      }
      
      // === CONSEILS D'UTILISATION (application) ===
      const tipsContainer = document.querySelector('#product-infos-content .pdp-tips .tips-content');
      const application = tipsContainer?.textContent?.trim()?.replace(/\s+/g, ' ') || '';
      
      // === RESULTATS DES TESTS ===
      const testResultsContainer = document.querySelector('#product-infos-content .pdp-test-results .test-results-content');
      const testResults = testResultsContainer?.textContent?.trim()?.replace(/\s+/g, ' ') || '';
      
      // === PLUS D'INFORMATIONS ===
      const moreInfosContainer = document.querySelector('#product-infos-content .pdp-more-infos .more-infos-content');
      const moreInfos = moreInfosContainer?.textContent?.trim()?.replace(/\s+/g, ' ') || '';
      
      // === INGREDIENTS ===
      const ingredientsContainer = document.querySelector('#product-infos-content .pdp-ingredients .ingredients-content');
      let ingredients = ingredientsContainer?.textContent?.trim()?.replace(/\s+/g, ' ') || '';
      // Nettoyer le disclaimer final
      ingredients = ingredients.replace(/Cette liste d'ingrédients peut faire l'objet.*$/i, '').trim();
      
      return {
        description,
        application,
        testResults,
        moreInfos,
        ingredients,
        labels,
        sku,
      };
    });
    
    console.log('   SKU:', productInfo.sku);
    console.log('   LABELS:', productInfo.labels.length > 0 ? productInfo.labels.join(', ') : 'Aucun');
    console.log('');
    console.log('   DESCRIPTION:');
    console.log(`   ${productInfo.description.substring(0, 400)}...`);
    console.log('');
    console.log('   CONSEILS D\'UTILISATION:');
    console.log(`   ${productInfo.application.substring(0, 300)}...`);
    console.log('');
    console.log('   RESULTATS DES TESTS:');
    console.log(`   ${productInfo.testResults.substring(0, 200)}...`);
    console.log('');
    console.log('   PLUS D\'INFOS:');
    console.log(`   ${productInfo.moreInfos}`);
    console.log('');
    console.log('   INGREDIENTS:');
    console.log(`   ${productInfo.ingredients.substring(0, 300)}...`);
    console.log('');
    
    // 7. Donnees tc_vars (analytics Sephora - contient beaucoup d'infos)
    console.log('6. Extraction donnees analytics (tc_vars)...\n');
    
    const tcVars = await page.evaluate(() => {
      // @ts-ignore - tc_vars est une variable globale Sephora
      const vars = (window as any).tc_vars || {};
      return {
        product_pid: vars.product_pid,
        product_trademark: vars.product_trademark,
        product_brand: vars.product_brand,
        product_breadcrumb_label: vars.product_breadcrumb_label,
        product_price_ati: vars.product_price_ati,
        product_old_price_ati: vars.product_old_price_ati,
        product_discount_ati: vars.product_discount_ati,
        product_range: vars.product_range,
        product_nature: vars.product_nature,
        product_section: vars.product_section,
        product_target: vars.product_target,
        product_rating: vars.product_rating,
        product_num_rating: vars.product_num_rating,
        product_sku: vars.product_sku,
        product_sku_name: vars.product_sku_name,
        product_promotion: vars.product_promotion,
      };
    });
    
    console.log('   TC_VARS (Analytics):');
    console.log('   - PID:', tcVars.product_pid);
    console.log('   - SKU:', tcVars.product_sku);
    console.log('   - SKU Name:', tcVars.product_sku_name);
    console.log('   - Marque:', tcVars.product_trademark || tcVars.product_brand);
    console.log('   - Categorie:', tcVars.product_breadcrumb_label);
    console.log('   - Prix TTC:', tcVars.product_price_ati, 'EUR');
    console.log('   - Prix barre:', tcVars.product_old_price_ati, 'EUR');
    console.log('   - Reduction:', tcVars.product_discount_ati, 'EUR');
    console.log('   - Gamme:', tcVars.product_range);
    console.log('   - Nature:', tcVars.product_nature);
    console.log('   - Section:', tcVars.product_section);
    console.log('   - Cible:', tcVars.product_target);
    console.log('   - Note:', tcVars.product_rating);
    console.log('   - Nb avis:', tcVars.product_num_rating);
    console.log('   - Promo:', tcVars.product_promotion);
    console.log('');
    
    // Resume final
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('RESUME FINAL');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('Titre:', baseData.fullTitle);
    console.log('SKU:', productInfo.sku || baseData.sku);
    console.log('Variante:', baseData.variant);
    console.log('Prix:', baseData.currentPrice);
    console.log('Prix barre:', baseData.originalPrice, baseData.discount);
    console.log('Note:', baseData.rating, '/ 5');
    console.log('Avis:', baseData.reviewCount);
    console.log('Labels:', productInfo.labels.join(', ') || 'Aucun');
    console.log('Categorie:', tcVars.product_breadcrumb_label);
    console.log('');
    console.log('Description:', productInfo.description.substring(0, 200) + '...');
    console.log('Application:', productInfo.application.substring(0, 150) + '...');
    console.log('Ingredients:', productInfo.ingredients.substring(0, 150) + '...');
    console.log('');
    
    // Screenshot
    await page.screenshot({ path: 'debug-sephora.png', fullPage: false });
    console.log('Screenshot: debug-sephora.png');
    
    // Garder ouvert pour inspection
    console.log('\nNavigateur ouvert 20s pour inspection...');
    await page.waitForTimeout(20000);
    
  } catch (error) {
    console.error('Erreur:', error);
    await page.screenshot({ path: 'error-sephora.png', fullPage: false });
  } finally {
    await browser.close();
  }
}

main();
