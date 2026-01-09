import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import https from 'https';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const OUTPUT_FILE = path.join(process.cwd(), 'data', 'category-links.json');

interface CategoryLinks {
  sephora: string[];
  nocibe: string[];
  scrapedAt: string;
}

// ============================================
// VALIDATION & CLEANING FUNCTIONS
// ============================================

// Catégories City Baddies pertinentes
const CITY_BADDIES_CATEGORIES = {
  // Catégories principales
  sephora: [
    'maquillage',
    'parfum',
    'soin-visage',
    'corps-et-bain',
    'cheveux',
    'ongles',
  ],
  nocibe: [
    'maquillage',
    'parfum',
    'soin-visage',
    'soin-corps',
    'cheveux',
    'cosmetique-coreenne',
    'beaute-responsable',
  ]
};

// Catégories/mots-clés à EXCLURE
const EXCLUDED_KEYWORDS = [
  // Homme (sauf parfums homme qui sont dans /parfum/)
  'homme',
  // Maison & Lifestyle
  'maison',
  'lifestyle',
  'bougie',
  'candle',
  'diffuseur',
  'interieur',
  'linge',
  'decoration',
  // Enfants & Bébés
  'enfant',
  'bebe',
  'baby',
  'kids',
  // Institut & Services
  'institut',
  'spa',
  'massage',
  'epilation',
  // Saisonnier/Promo (pas des vraies catégories produits)
  'noel',
  'christmas',
  'calendrier-de-lavent',
  'advent',
  'black-friday',
  'cyber-monday',
  'singles-day',
  'soldes',
  'sale',
  'spring',
  'automne',
  'hiver',
  'ete',
  // Coffrets génériques (on garde les coffrets spécifiques)
  'idees-cadeaux',
  'gift',
  'ceremonie'
];

function isCityBaddiesRelevant(url: string, merchant: 'sephora' | 'nocibe'): boolean {
  const urlLower = url.toLowerCase();
  
  // Exclure si contient un mot-clé exclu
  for (const keyword of EXCLUDED_KEYWORDS) {
    if (urlLower.includes(keyword)) {
      return false;
    }
  }
  
  // Pour Sephora, vérifier que c'est une catégorie beauté
  if (merchant === 'sephora') {
    const validCategories = CITY_BADDIES_CATEGORIES.sephora;
    return validCategories.some(cat => urlLower.includes(cat));
  }
  
  // Pour Nocibé, vérifier que c'est une catégorie beauté
  if (merchant === 'nocibe') {
    const validCategories = CITY_BADDIES_CATEGORIES.nocibe;
    return validCategories.some(cat => urlLower.includes(cat));
  }
  
  return false;
}

function isValidSephoraCategory(url: string): boolean {
  // Must contain /shop/ and a category code like -c302/
  if (!url.includes('/shop/')) return false;
  if (!/-c\d+/.test(url)) return false;
  
  // Exclude URLs with filter parameters
  const excludePatterns = [
    '?prefn1=',
    '?prefv1=',
    '&prefn1=',
    '&prefv1=',
    '?srule=',
    '&srule=',
    'Brand=',
    'brand=',
    'promotions=',
    'Promotions=',
    '/gifts-',
    '/gift-',
    '/sets-',
    '/nouveautes-',
    '/trends-',
    '/best-',
    '/top-',
    '/selection-',
  ];
  
  for (const pattern of excludePatterns) {
    if (url.includes(pattern)) return false;
  }
  
  return true;
}

function isValidNocibeCategory(url: string): boolean {
  // Must be a category URL like /fr/c/something/code
  if (!url.includes('/fr/c/')) return false;
  
  // Must have at least a 2-digit code at the end
  const match = url.match(/\/(\d{2,})(?:\?|$|\/)/);
  if (!match) return false;
  
  // Exclude URLs with filter parameters
  const excludePatterns = [
    '?q=',
    '?brand=',
    '?price=',
    '?sort=',
    '&brand=',
    '&price=',
  ];
  
  for (const pattern of excludePatterns) {
    if (url.includes(pattern)) return false;
  }
  
  return true;
}

function cleanSephoraUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    // Remove all query parameters
    return `${urlObj.origin}${urlObj.pathname}`;
  } catch {
    return url;
  }
}

function cleanNocibeUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    // Remove all query parameters
    return `${urlObj.origin}${urlObj.pathname}`;
  } catch {
    return url;
  }
}

// ============================================
// SEPHORA SCRAPING
// ============================================

async function scrapeSephoraCategories(page: any): Promise<string[]> {
  console.log('Scraping Sephora categories...');
  
  await page.goto('https://www.sephora.fr', { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(2000);
  
  // Accept cookies if present
  try {
    const cookieButton = page.locator('button:has-text("Accepter")').first();
    if (await cookieButton.isVisible({ timeout: 3000 })) {
      await cookieButton.click();
      await page.waitForTimeout(1000);
    }
  } catch {
    // No cookie banner
  }
  
  // Hover over each main menu item to reveal submenus
  const mainMenuItems = page.locator('nav[aria-label="Main"] > ul > li');
  const menuCount = await mainMenuItems.count();
  
  const allLinks = new Set<string>();
  
  for (let i = 0; i < menuCount; i++) {
    try {
      const menuItem = mainMenuItems.nth(i);
      await menuItem.hover();
      await page.waitForTimeout(500);
      
      // Get all category links from the dropdown
      const dropdownLinks = page.locator('a[href*="/shop/"]');
      const linkCount = await dropdownLinks.count();
      
      for (let j = 0; j < linkCount; j++) {
        try {
          const href = await dropdownLinks.nth(j).getAttribute('href');
          if (href) {
            const fullUrl = href.startsWith('http') ? href : `https://www.sephora.fr${href}`;
            const cleanUrl = cleanSephoraUrl(fullUrl);
            
            if (isValidSephoraCategory(cleanUrl) && isCityBaddiesRelevant(cleanUrl, 'sephora')) {
              allLinks.add(cleanUrl);
            }
          }
        } catch {
          // Skip this link
        }
      }
    } catch {
      // Skip this menu item
    }
  }
  
  // Also try to get links from the page directly
  const pageLinks = page.locator('a[href*="/shop/"]');
  const pageLinkCount = await pageLinks.count();
  
  for (let i = 0; i < pageLinkCount; i++) {
    try {
      const href = await pageLinks.nth(i).getAttribute('href');
      if (href) {
        const fullUrl = href.startsWith('http') ? href : `https://www.sephora.fr${href}`;
        const cleanUrl = cleanSephoraUrl(fullUrl);
        
        if (isValidSephoraCategory(cleanUrl) && isCityBaddiesRelevant(cleanUrl, 'sephora')) {
          allLinks.add(cleanUrl);
        }
      }
    } catch {
      // Skip
    }
  }
  
  console.log(`Found ${allLinks.size} valid Sephora categories`);
  return Array.from(allLinks);
}

// ============================================
// NOCIBE SCRAPING (via HTTP request like Python)
// ============================================

async function fetchNocibeHtml(url: string = 'https://www.nocibe.fr'): Promise<string> {
  // Use native fetch with proper headers
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
      'Cache-Control': 'no-cache',
      'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
    },
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  
  return response.text();
}

// Extraire les liens de catégories d'un HTML Nocibé
function extractNocibeLinksFromHtml(htmlContent: string): Set<string> {
  const links = new Set<string>();
  const categoryPattern = /\/fr\/c\/[^"'\s?#]+\/\d+/g;
  const matches = htmlContent.match(categoryPattern) || [];
  
  for (const match of matches) {
    const fullUrl = `https://www.nocibe.fr${match}`;
    const cleanUrl = cleanNocibeUrl(fullUrl);
    
    if (isValidNocibeCategory(cleanUrl) && isCityBaddiesRelevant(cleanUrl, 'nocibe')) {
      links.add(cleanUrl);
    }
  }
  
  return links;
}

async function scrapeNocibeCategories(): Promise<string[]> {
  console.log('Scraping Nocibe categories via HTTP...');
  
  const allLinks = new Set<string>();
  
  // Pages principales à scraper pour trouver toutes les sous-catégories
  const mainPages = [
    'https://www.nocibe.fr',
    // Catégories principales
    'https://www.nocibe.fr/fr/c/maquillage/03',
    'https://www.nocibe.fr/fr/c/parfum/01',
    'https://www.nocibe.fr/fr/c/soin-visage/12',
    'https://www.nocibe.fr/fr/c/soin-corps/13',
    'https://www.nocibe.fr/fr/c/cheveux/14',
    // Sous-catégories maquillage
    'https://www.nocibe.fr/fr/c/maquillage/teint/0301',
    'https://www.nocibe.fr/fr/c/maquillage/levres/0302',
    'https://www.nocibe.fr/fr/c/maquillage/yeux/0303',
    'https://www.nocibe.fr/fr/c/maquillage/ongles/0304',
    'https://www.nocibe.fr/fr/c/maquillage/sourcils/0309',
    // Sous-catégories parfum
    'https://www.nocibe.fr/fr/c/parfum/parfum-femme/0101',
    'https://www.nocibe.fr/fr/c/parfum/parfum-homme/0102',
    // Sous-catégories soin visage
    'https://www.nocibe.fr/fr/c/soin-visage/nettoyage-de-visage/1201',
    'https://www.nocibe.fr/fr/c/soin-visage/soin-visage/1205',
    'https://www.nocibe.fr/fr/c/soin-visage/masques/1203',
    // Sous-catégories soin corps
    'https://www.nocibe.fr/fr/c/soin-corps/nettoyage-de-corps/1301',
    'https://www.nocibe.fr/fr/c/soin-corps/soin-corps/1302',
    // Sous-catégories cheveux
    'https://www.nocibe.fr/fr/c/cheveux/shampoing/1403',
    'https://www.nocibe.fr/fr/c/cheveux/soin-cheveux/1401',
    'https://www.nocibe.fr/fr/c/cheveux/produits-coiffants/1402',
  ];
  
  try {
    for (const pageUrl of mainPages) {
      console.log(`  Fetching: ${pageUrl}`);
      
      try {
        const htmlContent = await fetchNocibeHtml(pageUrl);
        const links = extractNocibeLinksFromHtml(htmlContent);
        
        links.forEach(link => allLinks.add(link));
        console.log(`    Found ${links.size} links (total: ${allLinks.size})`);
        
        // Petit délai entre les requêtes
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (e) {
        console.log(`    Error: ${e}`);
      }
    }
    
    // Scraper aussi les sous-catégories trouvées pour aller plus profond
    const subCategoriesToScrape = Array.from(allLinks).filter(url => {
      // Garder seulement les catégories de niveau 2 (ex: /maquillage/yeux/0303)
      const parts = url.split('/fr/c/')[1]?.split('/') || [];
      return parts.length === 3; // categorie/sous-categorie/code
    });
    
    console.log(`\n  Scraping ${subCategoriesToScrape.length} sub-categories for deeper links...`);
    
    for (const subUrl of subCategoriesToScrape.slice(0, 20)) { // Limiter à 20 pour éviter trop de requêtes
      try {
        const htmlContent = await fetchNocibeHtml(subUrl);
        const links = extractNocibeLinksFromHtml(htmlContent);
        
        const newLinks = Array.from(links).filter(l => !allLinks.has(l));
        if (newLinks.length > 0) {
          console.log(`    ${subUrl.split('/fr/c/')[1]} => +${newLinks.length} new`);
          newLinks.forEach(link => allLinks.add(link));
        }
        
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (e) {
        // Skip errors
      }
    }
    
    console.log(`\nFound ${allLinks.size} total valid Nocibe categories`);
    return Array.from(allLinks);
    
  } catch (error) {
    console.error('Error fetching Nocibe:', error);
    return [];
  }
}

// ============================================
// MAIN
// ============================================

// Mapper une URL vers sa catégorie City Baddies
function getCategoryFromUrl(url: string): string {
  const urlLower = url.toLowerCase();
  
  // Ordre de priorité pour éviter les faux positifs
  if (urlLower.includes('parfum-homme') || urlLower.includes('/homme/')) return 'parfums'; // Parfum homme reste parfum
  if (urlLower.includes('parfum')) return 'parfums';
  if (urlLower.includes('maquillage')) return 'maquillage';
  if (urlLower.includes('soin-visage') || urlLower.includes('skincare')) return 'soins-visage';
  if (urlLower.includes('soin-corps') || urlLower.includes('corps-et-bain')) return 'soins-corps';
  if (urlLower.includes('cheveux')) return 'cheveux';
  if (urlLower.includes('ongles')) return 'ongles';
  if (urlLower.includes('cosmetique-coreenne')) return 'soins-visage';
  if (urlLower.includes('beaute-responsable')) return 'soins-visage';
  
  return 'maquillage'; // Default
}

// Générer un nom lisible depuis l'URL
function getNameFromUrl(url: string, merchant: 'sephora' | 'nocibe'): string {
  let path = '';
  
  if (merchant === 'sephora') {
    // https://www.sephora.fr/shop/maquillage/teint/fonds-de-teint-c353/
    const match = url.match(/\/shop\/(.+?)-c\d+\/?$/);
    if (match) {
      path = match[1];
    }
  } else {
    // https://www.nocibe.fr/fr/c/maquillage/teint/anti-cerne/030101
    const match = url.match(/\/fr\/c\/(.+?)\/\d+\/?$/);
    if (match) {
      path = match[1];
    }
  }
  
  if (!path) return url;
  
  // Convertir "maquillage/teint/fonds-de-teint" en "Maquillage > Teint > Fonds de teint"
  return path
    .split('/')
    .map(part => part
      .replace(/-/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase())
    )
    .join(' > ');
}

// Insérer les liens dans la DB comme sources de scraping
async function insertSourcesIntoDb(
  links: string[], 
  merchantSlug: 'sephora' | 'nocibe'
): Promise<{ added: number; skipped: number }> {
  let added = 0;
  let skipped = 0;
  
  // Récupérer le merchant
  const merchant = await prisma.merchant.findFirst({ 
    where: { slug: merchantSlug } 
  });
  
  if (!merchant) {
    console.error(`❌ Merchant ${merchantSlug} non trouvé dans la DB`);
    return { added: 0, skipped: links.length };
  }
  
  for (const url of links) {
    const category = getCategoryFromUrl(url);
    const name = getNameFromUrl(url, merchantSlug);
    
    try {
      // Upsert: créer si n'existe pas, sinon ne rien faire
      const existing = await prisma.scrapingSource.findUnique({
        where: { url }
      });
      
      if (existing) {
        skipped++;
        continue;
      }
      
      await prisma.scrapingSource.create({
        data: {
          url,
          name,
          category,
          type: 'catalogue',
          priority: 3, // Priorité basse pour les catégories (les promos ont priorité 10)
          isActive: true,
          merchantId: merchant.id,
        }
      });
      
      added++;
    } catch (error) {
      // Probablement un doublon
      skipped++;
    }
  }
  
  return { added, skipped };
}

async function main() {
  console.log('Starting category link scraper...\n');
  
  const browser = await chromium.launch({ 
    headless: true,
    slowMo: 50 
  });
  
  try {
    // Sephora - Desktop viewport avec hover menu (Playwright)
    const sephoraContext = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const sephoraPage = await sephoraContext.newPage();
    const sephoraLinks = await scrapeSephoraCategories(sephoraPage);
    await sephoraContext.close();
    
    // Nocibe - Simple HTTP request (no Playwright needed)
    const nocibeLinks = await scrapeNocibeCategories();
    
    // Prepare output
    const output: CategoryLinks = {
      sephora: sephoraLinks.sort(),
      nocibe: nocibeLinks.sort(),
      scrapedAt: new Date().toISOString()
    };
    
    // Ensure data directory exists
    const dataDir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Save to file
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
    
    console.log('\n========================================');
    console.log('RESULTS:');
    console.log(`  Sephora: ${sephoraLinks.length} categories`);
    console.log(`  Nocibe: ${nocibeLinks.length} categories`);
    console.log(`  Saved to: ${OUTPUT_FILE}`);
    console.log('========================================\n');
    
    // Insert into database
    console.log('📥 Inserting sources into database...\n');
    
    const sephoraResult = await insertSourcesIntoDb(sephoraLinks, 'sephora');
    console.log(`  Sephora: ${sephoraResult.added} added, ${sephoraResult.skipped} skipped (already exist)`);
    
    const nocibeResult = await insertSourcesIntoDb(nocibeLinks, 'nocibe');
    console.log(`  Nocibé: ${nocibeResult.added} added, ${nocibeResult.skipped} skipped (already exist)`);
    
    console.log('\n✅ Done!\n');
    
  } catch (error) {
    console.error('Error during scraping:', error);
  } finally {
    await browser.close();
    await prisma.$disconnect();
  }
}

main().catch(console.error);
