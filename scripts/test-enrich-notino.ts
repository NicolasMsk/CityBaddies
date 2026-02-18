/**
 * Script de test pour l'enrichissement Notino
 * 
 * Usage:
 *   npx tsx scripts/test-enrich-notino.ts "https://www.notino.fr/..."
 * 
 * Extrait la description et les ingrédients d'une page produit Notino
 */

import { chromium } from 'playwright';

interface ScrapedEnrichData {
  brand: string;
  name: string;
  fullTitle: string;
  description: string;
  ingredients: string;
  properties: Record<string, string>;
  variants: string[];  // Juste les tailles: "150 ml", "100 ml", etc.
}

async function scrapeNotinoEnrichment(url: string): Promise<ScrapedEnrichData | null> {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('TEST ENRICHISSEMENT NOTINO');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const browser = await chromium.launch({
    headless: false,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
    ],
  });

  try {
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      locale: 'fr-FR',
      viewport: { width: 1920, height: 1080 },
    });

    const page = await context.newPage();

    console.log(`📄 URL: ${url}\n`);
    console.log('→ Navigation...');
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Attendre le titre de la page
    await page.waitForSelector('h1[data-testid="pd-header-title"]', { timeout: 25000 });
    console.log('✓ Page chargée');

    // Fermer le popup cookies Usercentrics (comme dans validate-deals-notino.ts)
    console.log('→ Gestion cookies Usercentrics...');
    await new Promise(r => setTimeout(r, 2000));
    await page.evaluate(() => {
      if (typeof (window as any).UC_UI !== 'undefined') {
        (window as any).UC_UI.acceptAllConsents();
        (window as any).UC_UI.closeCMP();
      }
      const aside = document.querySelector('#usercentrics-cmp-ui');
      if (aside) aside.remove();
    }).catch(() => {});
    await new Promise(r => setTimeout(r, 1500));
    console.log('✓ Cookies gérés\n');

    // ===== TITRE (brand + name + subtitle) =====
    console.log('→ Extraction titre...');
    const titleData = await page.evaluate(() => {
      const titleEl = document.querySelector('h1[data-testid="pd-header-title"]');
      if (!titleEl) return { brand: '', name: '', subtitle: '' };

      // Marque = lien <a> dans le h1
      const brandLink = titleEl.querySelector('a');
      const brand = brandLink?.textContent?.trim() || '';

      // Nom produit = span juste après le lien (ex: "Whitening Mint")
      // Subtitle = span suivant (ex: "dentifrice effet blancheur")
      let name = '';
      let subtitle = '';
      const topSpans = titleEl.querySelectorAll(':scope > span');
      for (const topSpan of topSpans) {
        // Chercher les spans qui ne sont pas le lien brand
        const innerSpans = topSpan.querySelectorAll('span');
        for (const span of innerSpans) {
          const text = span.textContent?.trim() || '';
          if (!text || span.querySelector('a') || span.closest('a')) continue;
          if (!name) name = text;
        }
        // Le span de niveau top qui n'a pas de spans enfants = subtitle
        if (topSpan.classList.length > 0 && !topSpan.querySelector('a') && topSpan.querySelectorAll('span').length === 0) {
          subtitle = topSpan.textContent?.trim() || '';
        }
      }

      return { brand, name, subtitle };
    });

    const fullTitle = [titleData.brand, titleData.name, titleData.subtitle]
      .filter(Boolean)
      .join(' ')
      .trim();
    console.log(`✓ Marque: ${titleData.brand}`);
    console.log(`✓ Nom: ${titleData.name}`);
    console.log(`✓ Titre complet: ${fullTitle}\n`);

    // ===== VARIANTES (tailles uniquement via .pd-variant-label) =====
    console.log('→ Extraction variantes...');
    const variants: string[] = await page.evaluate(() => {
      const labels = document.querySelectorAll('.pd-variant-label');
      const results: string[] = [];
      for (const label of labels) {
        const text = label.textContent?.replace(/\u00a0/g, ' ')?.trim() || '';
        if (text && !results.includes(text)) {
          results.push(text);
        }
      }
      return results;
    });

    // Si aucune variante, chercher le volume dans #pdSelectedVariant
    if (variants.length === 0) {
      const singleVolume = await page.evaluate(() => {
        const selectedArea = document.querySelector('#pdSelectedVariant');
        if (!selectedArea) return null;
        const spans = selectedArea.querySelectorAll('span');
        for (const span of spans) {
          const text = span.textContent?.trim() || '';
          if (/^\d+(?:[,.]\d+)?\s*(ml|g|l|cl|oz|kg)$/i.test(text)) {
            return text;
          }
        }
        return null;
      });
      if (singleVolume) variants.push(singleVolume);
    }

    console.log(`✓ ${variants.length} variante(s): ${variants.join(', ') || 'aucune'}\n`);

    // Scroll vers le bas pour charger les onglets
    console.log('→ Scroll vers les onglets...');
    await page.evaluate(() => {
      const tabAnchor = document.querySelector('#tabAnchor');
      if (tabAnchor) {
        tabAnchor.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
    await page.waitForTimeout(1500);

    // Cliquer sur l'onglet Description s'il n'est pas ouvert
    console.log('→ Ouverture onglet Description...');
    try {
      const descriptionTab = await page.$('h2[aria-controls="description-tab"]');
      if (descriptionTab) {
        const isExpanded = await descriptionTab.getAttribute('aria-expanded');
        if (isExpanded !== 'true') {
          await descriptionTab.click();
          await page.waitForTimeout(1000);
        }
      }
    } catch (error) {
      console.log('⚠️ Erreur ouverture onglet Description:', error);
    }

    // Extraire la description
    console.log('→ Extraction description...');
    const description = await page.evaluate(() => {
      const descWrapper = document.querySelector('#pd-description-text[data-testid="pd-description-text"]');
      if (!descWrapper) return '';

      // Clone pour ne pas modifier le DOM
      const clone = descWrapper.cloneNode(true) as HTMLElement;
      
      // Supprimer les éléments inutiles
      clone.querySelectorAll('style, script, img').forEach(el => el.remove());
      
      // Récupérer le texte HTML structuré
      let text = clone.innerHTML || '';
      
      // Convertir les balises HTML en texte lisible
      text = text
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<\/li>/gi, '\n')
        .replace(/<li>/gi, '- ')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/\n\s*\n/g, '\n')
        .replace(/[ \t]+/g, ' ')
        .trim();
      
      return text;
    });

    console.log(`✓ Description extraite (${description.length} caractères)\n`);

    // Extraire le tableau de propriétés (ex: Effet → blanchissant)
    console.log('→ Extraction propriétés...');
    const properties = await page.evaluate(() => {
      const props: Record<string, string> = {};
      const tables = document.querySelectorAll('#pd-description-wrapper table');
      for (const table of tables) {
        const rows = table.querySelectorAll('tr');
        for (const row of rows) {
          const cells = row.querySelectorAll('td');
          if (cells.length >= 2) {
            const key = cells[0].textContent?.trim() || '';
            const value = cells[1].textContent?.trim() || '';
            if (key && value) {
              props[key] = value;
            }
          }
        }
      }
      return props;
    });

    const propsCount = Object.keys(properties).length;
    console.log(`✓ ${propsCount} propriété(s) extraite(s)\n`);

    // Cliquer sur l'onglet Composition
    console.log('→ Ouverture onglet Composition...');
    try {
      // Scroller d'abord vers l'onglet pour le rendre visible
      await page.evaluate(() => {
        const tabs = document.querySelectorAll('h2[aria-controls]');
        for (const tab of tabs) {
          if (tab.getAttribute('aria-controls') === 'composition-tab') {
            tab.scrollIntoView({ behavior: 'smooth', block: 'center' });
            break;
          }
        }
      });
      await page.waitForTimeout(800);

      const compositionTab = await page.$('h2[aria-controls="composition-tab"]');
      if (compositionTab) {
        const isExpanded = await compositionTab.getAttribute('aria-expanded');
        if (isExpanded !== 'true') {
          await compositionTab.click({ force: true });
          await page.waitForTimeout(1500);
        }
      }
    } catch (error) {
      console.log('⚠️ Erreur ouverture onglet Composition:', error);
    }

    // Extraire les ingrédients
    console.log('→ Extraction ingrédients...');
    const ingredients = await page.evaluate(() => {
      const compositionWrapper = document.querySelector('#pd-composition-wrapper[data-testid="pd-composition-wrapper"]');
      if (!compositionWrapper) return '';

      // Chercher la liste d'ingrédients dans .ttmat1a
      const ingredientsList = compositionWrapper.querySelector('.ttmat1a');
      if (!ingredientsList) return '';

      // Récupérer tous les paragraphes
      const paragraphs = ingredientsList.querySelectorAll('p');
      let inciList = '';

      for (const p of paragraphs) {
        const text = p.textContent?.trim() || '';
        // Ignorer le disclaimer sur les changements d'ingrédients
        if (text.toLowerCase().includes('fabricant est responsable')) continue;
        if (text.length === 0) continue;
        if (inciList) inciList += ' ';
        inciList += text;
      }

      // Nettoyer les espaces multiples
      inciList = inciList.replace(/\s+/g, ' ').trim();
      
      return inciList;
    });

    console.log(`✓ Ingrédients extraits (${ingredients.length} caractères)\n`);

    const result: ScrapedEnrichData = {
      brand: titleData.brand,
      name: titleData.name,
      fullTitle,
      description,
      ingredients,
      properties,
      variants,
    };

    // Afficher les résultats
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('RÉSULTATS EXTRACTION');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log(`🏷️  MARQUE: ${result.brand}`);
    console.log(`📦 NOM: ${result.name}`);
    console.log(`📋 TITRE COMPLET: ${result.fullTitle}\n`);

    if (result.variants.length > 0) {
      console.log('📐 VARIANTES DISPONIBLES:');
      console.log('─'.repeat(60));
      for (const v of result.variants) {
        console.log(`  • ${v}`);
      }
      console.log('');
    }

    if (Object.keys(result.properties).length > 0) {
      console.log('📋 PROPRIÉTÉS:');
      console.log('─'.repeat(60));
      for (const [key, value] of Object.entries(result.properties)) {
        console.log(`  ${key}: ${value}`);
      }
      console.log('');
    }

    console.log('📝 DESCRIPTION:');
    console.log('─'.repeat(60));
    if (result.description) {
      console.log(result.description.substring(0, 800));
      if (result.description.length > 800) {
        console.log(`\n... (${result.description.length - 800} caractères restants)`);
      }
    } else {
      console.log('❌ Aucune description trouvée');
    }

    console.log('\n\n🧪 INGRÉDIENTS (INCI):');
    console.log('─'.repeat(60));
    if (result.ingredients) {
      console.log(result.ingredients.substring(0, 500));
      if (result.ingredients.length > 500) {
        console.log(`\n... (${result.ingredients.length - 500} caractères restants)`);
      }
    } else {
      console.log('❌ Aucun ingrédient trouvé');
    }

    console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('STATUT:');
    console.log(`  Titre:       ${result.fullTitle ? '✅' : '❌'}`);
    console.log(`  Variantes:   ${result.variants.length > 0 ? '✅' : '⚠️  aucune'} (${result.variants.length})`);
    console.log(`  Propriétés:  ${Object.keys(result.properties).length > 0 ? '✅' : '⚠️  aucune'}`);
    console.log(`  Description: ${result.description ? '✅' : '❌'}`);
    console.log(`  Ingrédients: ${result.ingredients ? '✅' : '❌'}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    await context.close();
    return result;

  } catch (error) {
    console.error('\n❌ Erreur:', error);
    return null;
  } finally {
    await browser.close();
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const url = process.argv[2];

  if (!url) {
    console.error('Usage: npx tsx scripts/test-enrich-notino.ts "https://www.notino.fr/..."');
    process.exit(1);
  }

  if (!url.includes('notino.fr')) {
    console.error('❌ L\'URL doit être un produit Notino (notino.fr)');
    process.exit(1);
  }

  await scrapeNotinoEnrichment(url);
}

main().catch(console.error);
