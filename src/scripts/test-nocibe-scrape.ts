/**
 * Test simple de scraping Nocibé - juste récupérer les infos
 */

import { chromium } from 'playwright';

const URL = process.argv[2] || 'https://www.nocibe.fr/fr/p/3000048827';

async function main() {
  console.log('🚀 Test scraping Nocibé\n');
  console.log(`URL: ${URL}\n`);
  
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  
  try {
    // 1. Aller sur la page
    console.log('1️⃣ Navigation...');
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    console.log('   ✅ Page chargée\n');
    
    // 2. Attendre et fermer le cookie
    console.log('2️⃣ Fermeture cookie...');
    
    // Attendre que le bouton cookie apparaisse
    try {
      await page.waitForSelector('button[data-testid="uc-accept-all-button"]', { timeout: 5000 });
      await page.click('button[data-testid="uc-accept-all-button"]');
      // Attendre que le banner disparaisse
      await page.waitForSelector('#usercentrics-root[style*="display: none"], #usercentrics-root:not([data-created-at])', { timeout: 3000 }).catch(() => null);
      await page.waitForTimeout(1000);
      console.log('   ✅ Cookie fermé\n');
    } catch {
      console.log('   ℹ️ Pas de cookie banner\n');
    }
    
    // 3. Attendre le contenu
    await page.waitForSelector('.product-cockpit__variant', { timeout: 5000 }).catch(() => null);
    
    // 4. Extraire les infos de base
    console.log('3️⃣ Extraction des données de base...\n');
    
    // Titre
    const titre = await page.evaluate(() => {
      const brand = document.querySelector('span.brand-name__seo-only')?.textContent?.trim() || '';
      const line = document.querySelector('a.brand-line')?.textContent?.trim() || '';
      const name = document.querySelector('span.header-name')?.textContent?.trim() || '';
      return { brand, line, name, full: `${brand.split(' ')[0]} ${line} ${name}`.trim() };
    });
    
    console.log('   📝 TITRE:');
    console.log(`      ${titre.full}\n`);
    
    // Variantes
    const variantes = await page.evaluate(() => {
      const results: Array<{
        name: string;
        price: string;
        originalPrice: string | null;
        pricePerUnit: string;
        isSelected: boolean;
      }> = [];
      
      document.querySelectorAll('div[data-testid="RadioButton"]').forEach((el) => {
        const name = el.querySelector('.product-detail__variant-name')?.textContent?.trim() || '';
        const price = el.querySelector('[data-testid="price-type-discount-color"]')?.textContent?.trim() || '';
        const originalPrice = el.querySelector('[data-testid="price-type-strikethrough"]')?.textContent?.trim() || null;
        const pricePerUnit = el.querySelector('[data-testid="price-base-unit"] span')?.textContent?.trim() || '';
        const isSelected = el.querySelector('input[aria-checked="true"]') !== null;
        
        results.push({ name, price, originalPrice, pricePerUnit, isSelected });
      });
      
      return results;
    });
    
    console.log('   💰 VARIANTES:');
    for (const v of variantes) {
      const selected = v.isSelected ? '✓' : ' ';
      const promo = v.originalPrice ? ` (était ${v.originalPrice})` : '';
      console.log(`      [${selected}] ${v.name}: ${v.price}${promo} - ${v.pricePerUnit}`);
    }
    console.log('');
    
    // ============================================================
    // 5. MODALE DESCRIPTION (labels + classifications + description)
    // ============================================================
    console.log('4️⃣ Ouverture modale Description...');
    await page.click('button[data-testid="details"]');
    await page.waitForSelector('[data-testid="modal-dialog"]', { timeout: 3000 });
    await page.waitForTimeout(300);
    
    const descriptionData = await page.evaluate(() => {
      // Labels (dédupliqués)
      const labelsSet = new Set<string>();
      document.querySelectorAll('.product-label .product-label__name').forEach((el) => {
        const text = el.textContent?.trim();
        if (text) labelsSet.add(text);
      });
      const labels = Array.from(labelsSet);
      
      // Classifications
      const classifications: Record<string, string> = {};
      document.querySelectorAll('[data-testid="product-detail-info__classifications"] > div').forEach((el) => {
        const spans = el.querySelectorAll('span');
        if (spans.length >= 2) {
          classifications[spans[0].textContent?.trim() || ''] = spans[1].textContent?.trim() || '';
        }
      });
      
      // Description
      const description = document.querySelector('[data-testid="product-details-description"]')?.textContent?.trim() || '';
      
      return { labels, classifications, description };
    });
    
    // Fermer la modale
    await page.click('button[data-testid="modal-header-close"]');
    await page.waitForTimeout(300);
    
    console.log('   ✅ Modale Description fermée\n');
    
    console.log('   🏷️ LABELS:');
    for (const label of descriptionData.labels) {
      console.log(`      - ${label}`);
    }
    console.log('');
    
    console.log('   📋 CLASSIFICATIONS:');
    for (const [key, value] of Object.entries(descriptionData.classifications)) {
      console.log(`      ${key}: ${value}`);
    }
    console.log('');
    
    console.log('   📄 DESCRIPTION:');
    console.log(`      ${descriptionData.description.substring(0, 200)}...`);
    console.log('');
    
    // ============================================================
    // 6. MODALE CONSEILS D'UTILISATION
    // ============================================================
    console.log('5️⃣ Ouverture modale Conseils d\'utilisation...');
    await page.click('button[data-testid="application"]');
    await page.waitForSelector('[data-testid="modal-dialog"]', { timeout: 3000 });
    await page.waitForTimeout(300);
    
    const application = await page.evaluate(() => {
      return document.querySelector('[data-testid="application-panel-other-info"]')?.textContent?.trim() || '';
    });
    
    // Fermer la modale
    await page.click('button[data-testid="modal-header-close"]');
    await page.waitForTimeout(300);
    
    console.log('   ✅ Modale Conseils fermée\n');
    console.log('   💡 APPLICATION:');
    console.log(`      ${application.substring(0, 200)}...`);
    console.log('');
    
    // ============================================================
    // 7. MODALE INGRÉDIENTS
    // ============================================================
    console.log('6️⃣ Ouverture modale Ingrédients...');
    await page.click('button[data-testid="ingredients"]');
    await page.waitForSelector('[data-testid="modal-dialog"]', { timeout: 3000 });
    await page.waitForTimeout(300);
    
    const ingredients = await page.evaluate(() => {
      return document.querySelector('[data-testid="ingredients-panel-other-info"]')?.textContent?.trim() || '';
    });
    
    // Fermer la modale
    await page.click('button[data-testid="modal-header-close"]');
    await page.waitForTimeout(300);
    
    console.log('   ✅ Modale Ingrédients fermée\n');
    console.log('   🧪 INGRÉDIENTS:');
    console.log(`      ${ingredients.substring(0, 200)}...`);
    console.log('');
    
    // ============================================================
    // RÉSUMÉ FINAL
    // ============================================================
    console.log('=' .repeat(60));
    console.log('📦 RÉSUMÉ COMPLET:');
    console.log('=' .repeat(60));
    console.log(JSON.stringify({
      titre: titre.full,
      variantes,
      labels: descriptionData.labels,
      classifications: descriptionData.classifications,
      description: descriptionData.description,
      application,
      ingredients,
    }, null, 2));
    
    console.log('\n✅ Terminé!');
    
    // Pause pour voir
    await page.waitForTimeout(2000);
    
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
