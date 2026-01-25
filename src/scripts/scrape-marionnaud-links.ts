/**
 * Scrape les liens de catégories Marionnaud
 * Récupère toutes les URLs de sous-catégories exploitables
 */
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';

const OUTPUT_FILE = path.join(process.cwd(), 'data', 'category-links.json');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'fr-FR,fr;q=0.9',
};

// Catégories principales Marionnaud à explorer
const MAIN_CATEGORIES = [
  'https://www.marionnaud.fr/parfum',
  'https://www.marionnaud.fr/maquillage',
  'https://www.marionnaud.fr/soin-visage',
  'https://www.marionnaud.fr/soin-corps',
  'https://www.marionnaud.fr/cheveux',
  'https://www.marionnaud.fr/accessoires',
];

// Mots-clés à EXCLURE
const EXCLUDED_KEYWORDS = [
  'homme',
  'maison',
  'bougie',
  'diffuseur',
  'enfant',
  'bebe',
  'baby',
  'kids',
  'coffret-personnalise',
  'carte-cadeau',
  'e-carte',
  'services',
  'marques',
  'brand',
  'nouveautes',
  'best-sellers',
  'exclusivites',
  'idees-cadeaux',
  'noel',
  'calendrier',
  'advent',
];

// Catégories City Baddies pertinentes
const VALID_CATEGORIES = [
  'parfum',
  'maquillage',
  'soin-visage',
  'soin-corps',
  'cheveux',
  'accessoires',
  'anti-age',
  'anti-rides',
  'hydratant',
  'nettoyant',
  'demaquillant',
  'serum',
  'masque',
  'contour',
  'levres',
  'yeux',
  'teint',
  'fond-de-teint',
  'rouge-a-levres',
  'mascara',
  'blush',
  'poudre',
  'vernis',
  'parfum-femme',
  'eau-de-parfum',
  'eau-de-toilette',
  'shampoing',
  'apres-shampoing',
  'coloration',
  'coiffant',
  'solaire',
  'corps',
  'gommage',
  'epilation',
  'deodorant',
];

function isValidMarionnaudUrl(url: string): boolean {
  const urlLower = url.toLowerCase();
  
  // Doit être une URL Marionnaud
  if (!url.includes('marionnaud.fr')) return false;
  
  // Doit contenir /c/ (page catégorie) avec un code
  if (!url.match(/\/c\/[A-Z0-9]+$/i)) return false;
  
  // Exclure si contient un mot-clé exclu
  for (const keyword of EXCLUDED_KEYWORDS) {
    if (urlLower.includes(keyword)) {
      return false;
    }
  }
  
  // Vérifier qu'au moins une catégorie valide est présente
  return VALID_CATEGORIES.some(cat => urlLower.includes(cat));
}

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchPage(url: string): Promise<string | null> {
  try {
    console.log(`  Fetching: ${url}`);
    const response = await fetch(url, { headers: HEADERS });
    if (!response.ok) {
      console.log(`    ❌ Status ${response.status}`);
      return null;
    }
    return await response.text();
  } catch (error) {
    console.log(`    ❌ Error: ${error}`);
    return null;
  }
}

async function extractCategoryLinks(html: string, baseUrl: string): Promise<Set<string>> {
  const $ = cheerio.load(html);
  const links = new Set<string>();
  
  // Chercher tous les liens de catégories
  $('a[href*="/c/"]').each((_, el) => {
    let href = $(el).attr('href');
    if (!href) return;
    
    // Normaliser l'URL
    if (href.startsWith('/')) {
      href = 'https://www.marionnaud.fr' + href;
    }
    
    // Nettoyer les paramètres de requête
    href = href.split('?')[0];
    
    // Vérifier si c'est une URL valide
    if (isValidMarionnaudUrl(href)) {
      links.add(href);
    }
  });
  
  // Chercher aussi dans la navigation
  $('nav a[href*="/c/"], .navigation a[href*="/c/"], .category-nav a[href*="/c/"]').each((_, el) => {
    let href = $(el).attr('href');
    if (!href) return;
    
    if (href.startsWith('/')) {
      href = 'https://www.marionnaud.fr' + href;
    }
    href = href.split('?')[0];
    
    if (isValidMarionnaudUrl(href)) {
      links.add(href);
    }
  });
  
  return links;
}

async function scrapeMarionnaudLinks(): Promise<string[]> {
  const allLinks = new Set<string>();
  
  console.log('🔍 Scraping des liens de catégories Marionnaud...\n');
  
  // 1. Scraper la page d'accueil
  console.log('📄 Page d\'accueil...');
  const homepageHtml = await fetchPage('https://www.marionnaud.fr/');
  if (homepageHtml) {
    const homeLinks = await extractCategoryLinks(homepageHtml, 'https://www.marionnaud.fr');
    homeLinks.forEach(link => allLinks.add(link));
    console.log(`   → ${homeLinks.size} liens trouvés`);
  }
  await delay(1000);
  
  // 2. Scraper les pages principales de catégories
  for (const categoryUrl of MAIN_CATEGORIES) {
    console.log(`\n📂 Catégorie: ${categoryUrl}`);
    const html = await fetchPage(categoryUrl);
    if (html) {
      const categoryLinks = await extractCategoryLinks(html, categoryUrl);
      categoryLinks.forEach(link => allLinks.add(link));
      console.log(`   → ${categoryLinks.size} liens trouvés`);
    }
    await delay(1000);
  }
  
  // 3. Scraper les pages de sous-catégories trouvées (niveau 2)
  const level1Links = Array.from(allLinks);
  console.log(`\n🔄 Exploration niveau 2 (${level1Links.length} pages)...`);
  
  for (const link of level1Links.slice(0, 30)) { // Limiter pour éviter trop de requêtes
    const html = await fetchPage(link);
    if (html) {
      const subLinks = await extractCategoryLinks(html, link);
      const newLinks = Array.from(subLinks).filter(l => !allLinks.has(l));
      newLinks.forEach(l => allLinks.add(l));
      if (newLinks.length > 0) {
        console.log(`   → +${newLinks.length} nouveaux liens`);
      }
    }
    await delay(500);
  }
  
  // Trier et retourner
  const sortedLinks = Array.from(allLinks).sort();
  console.log(`\n✅ Total: ${sortedLinks.length} liens de catégories Marionnaud`);
  
  return sortedLinks;
}

async function updateCategoryLinksJson(marionnaudLinks: string[]): Promise<void> {
  let existingData: any = { sephora: [], nocibe: [], marionnaud: [], scrapedAt: '' };
  
  // Charger le fichier existant s'il existe
  if (fs.existsSync(OUTPUT_FILE)) {
    const content = fs.readFileSync(OUTPUT_FILE, 'utf-8');
    existingData = JSON.parse(content);
  }
  
  // Ajouter/mettre à jour les liens Marionnaud
  existingData.marionnaud = marionnaudLinks;
  existingData.scrapedAt = new Date().toISOString();
  
  // Écrire le fichier
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(existingData, null, 2));
  console.log(`\n💾 Fichier mis à jour: ${OUTPUT_FILE}`);
}

async function main() {
  try {
    const marionnaudLinks = await scrapeMarionnaudLinks();
    
    console.log('\n📋 Liens trouvés:');
    marionnaudLinks.forEach(link => console.log(`  - ${link}`));
    
    await updateCategoryLinksJson(marionnaudLinks);
    
    console.log('\n🎉 Terminé!');
  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  }
}

main();
