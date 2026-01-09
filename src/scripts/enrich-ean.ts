/**
 * Script robuste pour enrichir les produits avec les codes EAN d'OpenBeautyFacts
 * 
 * Stratégie de matching:
 * 1. Normalisation agressive des noms (accents, ponctuation, volumes)
 * 2. Extraction des tokens clés (marque, gamme, volume)
 * 3. Scoring multi-critères avec pondération
 * 4. Filtrage strict pour éviter les faux positifs
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';

const prisma = new PrismaClient();

const OBF_CSV_URL = 'https://static.openbeautyfacts.org/data/en.openbeautyfacts.org.products.csv.gz';
const CACHE_FILE = path.join(process.cwd(), 'data', 'openbeautyfacts-cache.json');

interface OBFProduct {
  code: string;
  product_name: string;
  brands: string;
  quantity: string;
}

interface ProductCache {
  [brand: string]: OBFProduct[];
}

// ============================================================================
// NORMALISATION
// ============================================================================

/**
 * Normalise une chaîne de caractères (accents, casse, ponctuation)
 */
function normalizeText(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Accents
    .replace(/[''`]/g, ' ')          // Apostrophes
    .replace(/[&+]/g, ' et ')        // & → et
    .replace(/[^a-z0-9]/g, ' ')      // Tout le reste → espace
    .replace(/\s+/g, ' ')            // Multi-espaces
    .trim();
}

/**
 * Extrait le volume d'un nom de produit (ex: "100ml", "50 ml", "1.7 oz")
 */
function extractVolume(str: string): { volume: number | null; unit: string | null; cleaned: string } {
  const volumeRegex = /(\d+(?:[.,]\d+)?)\s*(ml|l|oz|fl\.?\s*oz|g)\b/gi;
  let volume: number | null = null;
  let unit: string | null = null;
  let cleaned = str;
  
  const match = volumeRegex.exec(str);
  if (match) {
    volume = parseFloat(match[1].replace(',', '.'));
    unit = match[2].toLowerCase().replace(/\s/g, '').replace('fl.oz', 'oz').replace('floz', 'oz');
    cleaned = str.replace(volumeRegex, ' ').replace(/\s+/g, ' ').trim();
    
    // Convertir en ml pour comparaison
    if (unit === 'l') {
      volume *= 1000;
      unit = 'ml';
    } else if (unit === 'oz') {
      volume *= 29.5735;
      unit = 'ml';
    }
  }
  
  return { volume, unit, cleaned };
}

/**
 * Extrait les mots-clés importants d'un nom de produit
 */
function extractKeywords(name: string): Set<string> {
  const normalized = normalizeText(name);
  const words = normalized.split(' ').filter(w => w.length > 1);
  
  // Filtrer les mots vides
  const stopWords = new Set([
    'de', 'du', 'la', 'le', 'les', 'un', 'une', 'des', 'et', 'ou', 'pour',
    'avec', 'sans', 'the', 'a', 'an', 'and', 'or', 'for', 'with', 'by',
    'new', 'nouveau', 'nouvelle', 'edition', 'limited', 'coffret', 'set'
  ]);
  
  return new Set(words.filter(w => !stopWords.has(w) && w.length > 2));
}

/**
 * Normalise un nom de marque avec des alias connus
 */
const BRAND_ALIASES: Record<string, string[]> = {
  'yves saint laurent': ['ysl', 'saint laurent'],
  'jean paul gaultier': ['jpg', 'gaultier'],
  'dolce gabbana': ['d g', 'dolce et gabbana'],
  'lancome': ['lancôme'],
  'loreal': ['l oreal', 'loreal paris'],
  'estee lauder': ['estee lauder'],
  'dior': ['christian dior', 'parfums dior'],
  'chanel': ['coco chanel'],
  'armani': ['giorgio armani', 'emporio armani'],
  'paco rabanne': ['rabanne'],
  'carolina herrera': ['herrera', 'ch'],
  'givenchy': ['parfums givenchy'],
  'guerlain': ['maison guerlain'],
  'hermes': ['hermes paris'],
  'kiehls': ['kiehl s'],
  'kerastase': ['kerastase paris'],
  'mac': ['mac cosmetics', 'm a c'],
  'mugler': ['thierry mugler'],
  'viktor rolf': ['viktor et rolf'],
  'boss': ['hugo boss'],
  'versace': ['gianni versace'],
  'valentino': ['maison valentino'],
  'nina ricci': ['ricci'],
  'azzaro': ['loris azzaro'],
  'issey miyake': ['miyake'],
  'narciso rodriguez': ['narciso'],
  'benefit': ['benefit cosmetics'],
  'too faced': ['toofaced'],
  'urban decay': ['urbandecay'],
  'fenty': ['fenty beauty'],
  'nars': ['nars cosmetics'],
  'charlotte tilbury': ['charlottetilbury'],
  'patrick ta': ['patrick ta beauty'],
  'rare beauty': ['rarebeauty'],
  'haus labs': ['hauslabs', 'haus laboratories'],
  'merit': ['merit beauty'],
  'kosas': ['kosas cosmetics'],
  'tower 28': ['tower28'],
  'aboutyou': ['about you'],
  'sol de janeiro': ['soldejaneiro'],
  'tatcha': ['tatcha skincare'],
  'drunk elephant': ['drunkelephant'],
  'the ordinary': ['theordinary', 'ordinary'],
  'cerave': ['cerave skincare'],
  'la roche posay': ['laroche posay', 'la roche-posay'],
  'bioderma': ['bioderma france'],
  'avene': ['eau thermale avene'],
  'vichy': ['vichy laboratoires'],
  'caudalie': ['caudalie paris'],
  'nuxe': ['nuxe paris'],
  'sephora collection': ['sephora'],
  'make up for ever': ['mufe', 'makeup forever'],
  'bareminerals': ['bare minerals'],
  'it cosmetics': ['itcosmetics'],
  'tarte': ['tarte cosmetics'],
  'becca': ['becca cosmetics'],
  'hourglass': ['hourglass cosmetics'],
  'pat mcgrath': ['pat mcgrath labs'],
  'natasha denona': ['natashadenona'],
};

function normalizeBrand(brand: string): string[] {
  const normalized = normalizeText(brand);
  const variants = [normalized];
  
  // Chercher les alias correspondants
  for (const [main, aliases] of Object.entries(BRAND_ALIASES)) {
    const allVariants = [main, ...aliases];
    if (allVariants.some(v => normalized.includes(v) || v.includes(normalized))) {
      variants.push(main, ...aliases);
    }
  }
  
  return [...new Set(variants.map(v => normalizeText(v)))];
}

// ============================================================================
// SCORING
// ============================================================================

interface MatchScore {
  total: number;
  brandScore: number;
  nameScore: number;
  volumeScore: number;
  keywordScore: number;
}

/**
 * Calcule un score de matching entre un produit DB et un produit OBF
 */
function calculateMatchScore(
  dbName: string,
  dbBrand: string,
  obfProduct: OBFProduct
): MatchScore {
  // 1. Score de marque (0-30 points)
  const dbBrandNorm = normalizeText(dbBrand);
  const obfBrandNorm = normalizeText(obfProduct.brands.split(',')[0]);
  const dbBrandVariants = normalizeBrand(dbBrand);
  
  let brandScore = 0;
  if (dbBrandNorm === obfBrandNorm) {
    brandScore = 30;
  } else if (dbBrandVariants.includes(obfBrandNorm) || normalizeBrand(obfProduct.brands).includes(dbBrandNorm)) {
    brandScore = 25;
  } else if (dbBrandNorm.includes(obfBrandNorm) || obfBrandNorm.includes(dbBrandNorm)) {
    brandScore = 20;
  }
  
  // Si la marque ne match pas du tout, retourner 0
  if (brandScore === 0) {
    return { total: 0, brandScore: 0, nameScore: 0, volumeScore: 0, keywordScore: 0 };
  }
  
  // 2. Score de volume (0-20 points)
  const dbVolume = extractVolume(dbName);
  const obfVolume = extractVolume(obfProduct.quantity || obfProduct.product_name);
  
  let volumeScore = 0;
  if (dbVolume.volume && obfVolume.volume) {
    const diff = Math.abs(dbVolume.volume - obfVolume.volume);
    const tolerance = Math.max(dbVolume.volume, obfVolume.volume) * 0.1; // 10% tolérance
    
    if (diff <= tolerance) {
      volumeScore = 20;
    } else if (diff <= tolerance * 2) {
      volumeScore = 10;
    }
  } else if (!dbVolume.volume && !obfVolume.volume) {
    volumeScore = 10; // Pas de volume dans les deux = neutre
  }
  
  // 3. Score de mots-clés (0-30 points)
  const dbKeywords = extractKeywords(dbVolume.cleaned);
  const obfKeywords = extractKeywords(obfProduct.product_name);
  
  const intersection = new Set([...dbKeywords].filter(x => obfKeywords.has(x)));
  const union = new Set([...dbKeywords, ...obfKeywords]);
  
  const jaccardScore = union.size > 0 ? intersection.size / union.size : 0;
  const keywordScore = Math.round(jaccardScore * 30);
  
  // 4. Score de nom exact/partiel (0-20 points)
  const dbNameClean = normalizeText(dbVolume.cleaned);
  const obfNameClean = normalizeText(obfProduct.product_name);
  
  let nameScore = 0;
  if (dbNameClean === obfNameClean) {
    nameScore = 20;
  } else if (dbNameClean.includes(obfNameClean) || obfNameClean.includes(dbNameClean)) {
    const shorter = Math.min(dbNameClean.length, obfNameClean.length);
    const longer = Math.max(dbNameClean.length, obfNameClean.length);
    nameScore = Math.round((shorter / longer) * 15);
  }
  
  const total = brandScore + volumeScore + keywordScore + nameScore;
  
  return { total, brandScore, nameScore, volumeScore, keywordScore };
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Vérifie si un produit OBF est valide (pas de caractères exotiques)
 */
function isValidOBFProduct(obf: OBFProduct): boolean {
  const name = obf.product_name;
  
  // Exclure les langues non-latines
  if (/[\u0400-\u04FF]/.test(name)) return false; // Cyrillique
  if (/[\u4E00-\u9FFF]/.test(name)) return false; // Chinois
  if (/[\u3040-\u30FF]/.test(name)) return false; // Japonais
  if (/[\uAC00-\uD7AF]/.test(name)) return false; // Coréen
  if (/[\u0600-\u06FF]/.test(name)) return false; // Arabe
  if (/[\u0590-\u05FF]/.test(name)) return false; // Hébreu
  
  // Nom trop court
  if (name.length < 3) return false;
  
  // Code EAN valide (8-14 chiffres)
  if (!/^\d{8,14}$/.test(obf.code)) return false;
  
  return true;
}

/**
 * Validation additionnelle du match - TRÈS STRICT
 */
function validateMatch(
  dbName: string,
  dbBrand: string,
  obfProduct: OBFProduct,
  score: MatchScore
): boolean {
  // Score minimum élevé
  if (score.total < 55) return false;
  
  // La marque doit obligatoirement matcher
  if (score.brandScore < 20) return false;
  
  // Normaliser les noms pour comparaison
  const dbNorm = normalizeText(dbName);
  const obfNorm = normalizeText(obfProduct.product_name);
  
  // Exclure la marque des comparaisons
  const brandNorm = normalizeText(dbBrand);
  const brandWords = new Set(brandNorm.split(' '));
  
  // Extraire les mots significatifs (sans la marque)
  const dbWords = dbNorm.split(' ').filter(w => w.length > 2 && !brandWords.has(w));
  const obfWords = obfNorm.split(' ').filter(w => w.length > 2 && !brandWords.has(w));
  
  // Liste des noms de parfums/produits distinctifs qui doivent matcher exactement
  const distinctiveNames = new Set([
    // Parfums iconiques
    'shalimar', 'opium', 'coco', 'mademoiselle', 'libre', 'chance', 'allure',
    'homme', 'nuit', 'bleu', 'noir', 'rouge', 'rose', 'gold', 'goddess',
    'interdit', 'irresistible', 'fahrenheit', 'sauvage', 'dune', 'poison',
    'alien', 'angel', 'flower', 'kenzo', 'boss', 'bottled', 'guilty',
    'scandal', 'phantom', 'invictus', 'olympea', 'lady', 'million',
    'petite', 'robe', 'belle', 'vie', 'baccarat', 'mon', 'guerlain',
    // Soins distinctifs
    'abeille', 'royale', 'orchidee', 'imperiale', 'absolue', 'regenerie',
    'advancedr', 'genifique', 'visionnaire', 'renergie', 'capture', 'prestige',
    'hydra', 'essentiel', 'moisture', 'surge', 'dramatically', 'different',
  ]);
  
  // Trouver les mots distinctifs dans chaque nom
  const dbDistinctive = dbWords.filter(w => distinctiveNames.has(w));
  const obfDistinctive = obfWords.filter(w => distinctiveNames.has(w));
  
  // Si les deux ont des mots distinctifs, ils doivent matcher
  if (dbDistinctive.length > 0 && obfDistinctive.length > 0) {
    const commonDistinctive = dbDistinctive.filter(w => obfDistinctive.includes(w));
    // Si aucun mot distinctif en commun, c'est un faux positif
    if (commonDistinctive.length === 0) {
      return false;
    }
  }
  
  // Au moins 2 mots en commun (hors marque) OU score très élevé
  const commonWords = dbWords.filter(w => obfWords.includes(w));
  if (commonWords.length < 2 && score.total < 80) {
    return false;
  }
  
  // Vérification des numéros de produit (No.4 vs No.5, etc.)
  const dbNumbers = dbName.match(/\d+/g) || [];
  const obfNumbers = obfProduct.product_name.match(/\d+/g) || [];
  
  if (dbNumbers.length > 0 && obfNumbers.length > 0) {
    const dbNumSet = new Set(dbNumbers);
    const obfNumSet = new Set(obfNumbers);
    const hasCommonNumber = [...dbNumSet].some(n => obfNumSet.has(n));
    
    if (!hasCommonNumber && score.total < 85) {
      return false;
    }
  }
  
  return true;
}

// ============================================================================
// DATA LOADING
// ============================================================================

async function downloadAndParseOBF(): Promise<ProductCache> {
  console.log('📥 Téléchargement d\'OpenBeautyFacts...');
  
  const response = await fetch(OBF_CSV_URL);
  if (!response.ok) throw new Error(`Erreur: ${response.status}`);
  
  const buffer = await response.arrayBuffer();
  const decompressed = zlib.gunzipSync(Buffer.from(buffer));
  
  console.log('📊 Parsing du CSV...');
  
  const cache: ProductCache = {};
  const lines = decompressed.toString('utf-8').split('\n');
  
  const header = lines[0].split('\t');
  const cols = {
    code: header.indexOf('code'),
    name: header.indexOf('product_name'),
    brands: header.indexOf('brands'),
    quantity: header.indexOf('quantity'),
  };
  
  let count = 0;
  
  for (let i = 1; i < lines.length; i++) {
    const fields = lines[i].split('\t');
    if (fields.length < Math.max(...Object.values(cols))) continue;
    
    const product: OBFProduct = {
      code: fields[cols.code]?.trim() || '',
      product_name: fields[cols.name]?.trim() || '',
      brands: fields[cols.brands]?.trim() || '',
      quantity: fields[cols.quantity]?.trim() || '',
    };
    
    if (!product.code || !product.product_name || !product.brands) continue;
    if (!isValidOBFProduct(product)) continue;
    
    const brandKey = normalizeText(product.brands.split(',')[0]);
    if (!cache[brandKey]) cache[brandKey] = [];
    cache[brandKey].push(product);
    count++;
  }
  
  console.log(`✅ ${count} produits valides chargés`);
  console.log(`   ${Object.keys(cache).length} marques distinctes`);
  
  return cache;
}

function loadCache(): ProductCache | null {
  if (fs.existsSync(CACHE_FILE)) {
    console.log('📂 Chargement du cache local...');
    return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
  }
  return null;
}

async function saveCache(cache: ProductCache): Promise<void> {
  const dir = path.dirname(CACHE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache));
  console.log(`💾 Cache sauvegardé`);
}

// ============================================================================
// MATCHING PRINCIPAL
// ============================================================================

function findBestMatch(
  dbName: string,
  dbBrand: string,
  cache: ProductCache
): { ean: string; score: MatchScore; matchedName: string } | null {
  const brandVariants = normalizeBrand(dbBrand);
  
  // Collecter les candidats de toutes les variantes de marque
  let candidates: OBFProduct[] = [];
  
  for (const variant of brandVariants) {
    if (cache[variant]) {
      candidates.push(...cache[variant]);
    }
  }
  
  // Chercher aussi par préfixe de marque
  const dbBrandNorm = normalizeText(dbBrand);
  for (const [brand, products] of Object.entries(cache)) {
    if (brand.startsWith(dbBrandNorm) || dbBrandNorm.startsWith(brand)) {
      candidates.push(...products);
    }
  }
  
  // Dédupliquer par code EAN
  const seen = new Set<string>();
  candidates = candidates.filter(c => {
    if (seen.has(c.code)) return false;
    seen.add(c.code);
    return true;
  });
  
  if (candidates.length === 0) return null;
  
  // Scorer tous les candidats
  let best: { ean: string; score: MatchScore; matchedName: string } | null = null;
  
  for (const candidate of candidates) {
    const score = calculateMatchScore(dbName, dbBrand, candidate);
    
    if (validateMatch(dbName, dbBrand, candidate, score)) {
      if (!best || score.total > best.score.total) {
        best = {
          ean: candidate.code,
          score,
          matchedName: `${candidate.brands} - ${candidate.product_name}`,
        };
      }
    }
  }
  
  return best;
}

// ============================================================================
// MAIN
// ============================================================================

async function enrichProducts(): Promise<void> {
  let cache = loadCache();
  
  if (!cache) {
    cache = await downloadAndParseOBF();
    await saveCache(cache);
  }
  
  // Récupérer TOUS les produits pour les re-matcher
  const products = await prisma.$queryRaw<Array<{
    id: string;
    name: string;
    brand: string | null;
  }>>`SELECT id, name, brand FROM Product WHERE brand IS NOT NULL`;
  
  console.log(`\n🔍 ${products.length} produits à analyser\n`);
  
  let matched = 0;
  let notFound = 0;
  const results: Array<{ name: string; brand: string; ean: string; score: number; obfName: string }> = [];
  
  for (const product of products) {
    const brand = product.brand!;
    const match = findBestMatch(product.name, brand, cache);
    
    if (match) {
      results.push({
        name: product.name,
        brand,
        ean: match.ean,
        score: match.score.total,
        obfName: match.matchedName,
      });
      matched++;
    } else {
      notFound++;
    }
  }
  
  // Trier par score décroissant et afficher
  results.sort((a, b) => b.score - a.score);
  
  console.log('\n📋 MATCHES TROUVÉS (triés par confiance):\n');
  console.log('='.repeat(100));
  
  for (const r of results) {
    console.log(`[${r.score}/100] ${r.brand} - ${r.name}`);
    console.log(`         → EAN: ${r.ean}`);
    console.log(`         → OBF: ${r.obfName}`);
    console.log('-'.repeat(100));
  }
  
  // Demander confirmation avant d'écrire en DB
  console.log(`\n📊 RÉSUMÉ:`);
  console.log(`   ✅ ${matched} matches trouvés`);
  console.log(`   ❌ ${notFound} sans match`);
  console.log(`   📈 Taux: ${Math.round(matched / products.length * 100)}%`);
  
  // Écrire en DB uniquement les scores >= 60
  const toSave = results.filter(r => r.score >= 60);
  console.log(`\n💾 Sauvegarde de ${toSave.length} EAN (score >= 60)...`);
  
  for (const r of toSave) {
    const product = products.find(p => p.name === r.name && p.brand === r.brand);
    if (product) {
      await prisma.$executeRaw`UPDATE Product SET ean = ${r.ean} WHERE id = ${product.id}`;
    }
  }
  
  console.log('✅ Terminé!');
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  
  if (args[0] === 'download') {
    const cache = await downloadAndParseOBF();
    await saveCache(cache);
  } else if (args[0] === 'search' && args[1]) {
    const cache = loadCache();
    if (!cache) {
      console.log('Cache non trouvé. Lancez: npx tsx src/scripts/enrich-ean.ts download');
      return;
    }
    
    const query = args.slice(1).join(' ');
    console.log(`\n🔍 Recherche: "${query}"\n`);
    
    const results: Array<{ product: OBFProduct; score: number }> = [];
    for (const products of Object.values(cache)) {
      for (const product of products) {
        const keywords = extractKeywords(query);
        const productKeywords = extractKeywords(`${product.brands} ${product.product_name}`);
        const intersection = [...keywords].filter(k => productKeywords.has(k));
        const score = intersection.length / Math.max(keywords.size, 1);
        if (score > 0.3) results.push({ product, score });
      }
    }
    
    results.sort((a, b) => b.score - a.score);
    for (const { product, score } of results.slice(0, 10)) {
      console.log(`[${Math.round(score * 100)}%] ${product.brands} - ${product.product_name}`);
      console.log(`        EAN: ${product.code} | Qty: ${product.quantity}`);
    }
  } else {
    await enrichProducts();
  }
  
  await prisma.$disconnect();
}

main().catch(console.error);
