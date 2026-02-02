import { PrismaClient } from '@prisma/client';
import { chromium } from 'playwright';

const prisma = new PrismaClient();

async function main() {
  // URL de test
  const url = 'https://www.marionnaud.fr/parfum/parfum-mixte/produit-complementaire/matin-lutens-dans-le-bleu-qui-petille-lait-pour-le-corps-serge-lutens/p/BP_102534521';
  
  console.log('🔍 Test Marionnaud scraping');
  console.log('🔗 URL:', url);

  // Lancer le navigateur
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    console.log('\n📄 Chargement de la page...');
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Gérer les cookies
    try {
      const cookieButton = await page.waitForSelector('#onetrust-accept-btn-handler', { timeout: 5000 });
      if (cookieButton) {
        console.log('🍪 Acceptation des cookies...');
        await cookieButton.click();
        await page.waitForTimeout(1000);
      }
    } catch {
      console.log('Pas de popup cookies');
    }

    // Attendre que le contenu se charge
    await page.waitForSelector('.product-details-title__text', { timeout: 10000 }).catch(() => null);

    // Extraire les données
    const data = await page.evaluate(() => {
      // Titre
      const brand = document.querySelector('e2-product-details-brand-link .product-details-brand-link__text-link span')?.textContent?.trim();
      const range = document.querySelector('.product-details-range-name')?.textContent?.trim();
      const name = document.querySelector('.product-details-title__text')?.textContent?.trim();
      
      // Prix
      const currentPrice = document.querySelector('.price__default-value')?.textContent?.trim();
      const originalPrice = document.querySelector('.price__was')?.textContent?.trim();
      const pricePerUnit = document.querySelector('.price-per-unit__value')?.textContent?.trim();
      
      // Variante
      const variant = document.querySelector('.product-carousel-variant__selected-option')?.textContent?.trim();
      
      // Promo
      const promoBadge = document.querySelector('.promotion-badge')?.textContent?.trim();
      const promoDuration = document.querySelector('e2-promotion-duration span')?.textContent?.trim();
      
      // Description
      const descriptionElements = document.querySelectorAll('e2-product-information .product-information__text');
      let description = '';
      descriptionElements.forEach((el, i) => {
        if (i < 2) { // Les 2 premiers paragraphes
          description += el.textContent?.trim() + '\n\n';
        }
      });
      
      // Conseils d'utilisation
      const usageElement = document.querySelector('e2-product-uses .product-information__text');
      const usage = usageElement?.textContent?.trim();
      
      // Ingrédients
      const ingredientsElement = document.querySelector('e2-product-ingredients .product-information__text');
      const ingredients = ingredientsElement?.textContent?.trim();
      
      // Numéro d'article
      const articleNumber = document.querySelector('.product-details-article-number')?.textContent?.replace('Numéro d\'article', '')?.trim();
      
      return {
        brand,
        range,
        name,
        fullTitle: `${brand || ''} ${range || ''} ${name || ''}`.trim(),
        currentPrice,
        originalPrice,
        pricePerUnit,
        variant,
        promoBadge,
        promoDuration,
        description: description.trim(),
        usage,
        ingredients,
        articleNumber,
      };
    });

    console.log('\n📋 DONNÉES EXTRAITES:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🏷️  Marque:', data.brand);
    console.log('📦 Gamme:', data.range);
    console.log('📝 Nom:', data.name);
    console.log('🎯 Titre complet:', data.fullTitle);
    console.log('');
    console.log('💰 Prix actuel:', data.currentPrice);
    console.log('💸 Prix barré:', data.originalPrice);
    console.log('📊 Prix/unité:', data.pricePerUnit);
    console.log('📐 Variante:', data.variant);
    console.log('');
    console.log('🔥 Promo:', data.promoBadge);
    console.log('📅 Durée promo:', data.promoDuration);
    console.log('🔢 Numéro article:', data.articleNumber);
    console.log('');
    console.log('📖 Description:', data.description?.substring(0, 200) + '...');
    console.log('');
    console.log('💆 Conseils:', data.usage?.substring(0, 150) + '...');
    console.log('');
    console.log('🧪 Ingrédients:', data.ingredients?.substring(0, 150) + '...');

    // Screenshot pour debug
    await page.screenshot({ path: 'debug-marionnaud.png', fullPage: false });
    console.log('\n📸 Screenshot sauvegardé: debug-marionnaud.png');

    // Garder le navigateur ouvert pour inspection
    console.log('\n⏸️  Navigateur ouvert 30s pour inspection...');
    await page.waitForTimeout(30000);

  } catch (error) {
    console.error('❌ Erreur:', error);
  } finally {
    await browser.close();
    await prisma.$disconnect();
  }
}

main();
