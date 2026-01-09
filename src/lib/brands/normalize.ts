/**
 * Utilitaires pour normaliser les noms de marques
 * Gère les variantes, les majuscules et les alias
 */

// Mapping des alias vers le nom canonique
// Clé = alias (lowercase), Valeur = nom canonique
const BRAND_ALIASES: Record<string, string> = {
  // Yves Saint Laurent
  'ysl': 'Yves Saint Laurent',
  'yves st laurent': 'Yves Saint Laurent',
  'yves saint-laurent': 'Yves Saint Laurent',
  'saint laurent': 'Yves Saint Laurent',
  'saint laurent paris': 'Yves Saint Laurent',
  
  // Dolce & Gabbana
  'd&g': 'Dolce & Gabbana',
  'dolce gabbana': 'Dolce & Gabbana',
  'dolce and gabbana': 'Dolce & Gabbana',
  'dolce&gabbana': 'Dolce & Gabbana',
  
  // Lancôme
  'lancome': 'Lancôme',
  'lancôme paris': 'Lancôme',
  
  // L'Oréal
  'loreal': "L'Oréal",
  "l'oreal": "L'Oréal",
  'loreal paris': "L'Oréal Paris",
  "l'oreal paris": "L'Oréal Paris",
  "l'oréal": "L'Oréal",
  "l'oréal paris": "L'Oréal Paris",
  "l´oréal professionnel paris": "L'Oréal Professionnel",
  "l'oréal professionnel": "L'Oréal Professionnel",
  "loreal professionnel": "L'Oréal Professionnel",
  "l'oreal professionnel": "L'Oréal Professionnel",
  
  // Estée Lauder
  'estee lauder': 'Estée Lauder',
  'estée lauder companies': 'Estée Lauder',
  
  // Christian Dior
  'dior': 'Christian Dior',
  'christian dior parfums': 'Christian Dior',
  'parfums christian dior': 'Christian Dior',
  'dior beauty': 'Christian Dior',
  
  // Giorgio Armani
  'armani': 'Giorgio Armani',
  'armani beauty': 'Giorgio Armani',
  'emporio armani': 'Giorgio Armani',
  
  // Calvin Klein
  'ck': 'Calvin Klein',
  'calvin klein cosmetics': 'Calvin Klein',
  
  // Narciso Rodriguez
  'narciso': 'Narciso Rodriguez',
  
  // Guerlain
  'guerlain paris': 'Guerlain',
  
  // Chanel
  'chanel paris': 'Chanel',
  'chanel beauté': 'Chanel',
  
  // Hermès
  'hermes': 'Hermès',
  'hermès paris': 'Hermès',
  
  // Givenchy
  'givenchy beauty': 'Givenchy',
  'givenchy parfums': 'Givenchy',
  
  // Versace
  'versace parfums': 'Versace',
  'gianni versace': 'Versace',
  
  // Prada
  'prada beauty': 'Prada',
  'prada parfums': 'Prada',
  
  // Burberry
  'burberry beauty': 'Burberry',
  
  // Hugo Boss
  'boss': 'Hugo Boss',
  'hugo': 'Hugo Boss',
  'boss parfums': 'Hugo Boss',
  
  // Jean Paul Gaultier
  'jpg': 'Jean Paul Gaultier',
  'jean-paul gaultier': 'Jean Paul Gaultier',
  'gaultier': 'Jean Paul Gaultier',
  
  // Thierry Mugler / Mugler
  'mugler': 'Thierry Mugler',
  'thierry mugler parfums': 'Thierry Mugler',
  
  // Issey Miyake
  'miyake': 'Issey Miyake',
  
  // Kenzo
  'kenzo parfums': 'Kenzo',
  
  // Benefit
  'benefit cosmetics': 'Benefit',
  
  // MAC
  'mac cosmetics': 'MAC',
  'm.a.c': 'MAC',
  'm.a.c.': 'MAC',
  
  // NARS
  'nars cosmetics': 'NARS',
  
  // Urban Decay
  'urban decay cosmetics': 'Urban Decay',
  'ud': 'Urban Decay',
  
  // Too Faced
  'toofaced': 'Too Faced',
  'too faced cosmetics': 'Too Faced',
  
  // Clinique
  'clinique laboratories': 'Clinique',
  
  // La Mer
  'lamer': 'La Mer',
  'crème de la mer': 'La Mer',
  
  // Kiehl's
  'kiehls': "Kiehl's",
  "kiehl's since 1851": "Kiehl's",
  
  // Origins
  'origins natural resources': 'Origins',
  
  // Bobbi Brown
  'bobbi brown cosmetics': 'Bobbi Brown',
  
  // Clarins
  'clarins paris': 'Clarins',
  
  // Shiseido
  'shiseido ginza tokyo': 'Shiseido',
  
  // SK-II
  'sk2': 'SK-II',
  'skii': 'SK-II',
  'sk-2': 'SK-II',
  
  // Elizabeth Arden
  'arden': 'Elizabeth Arden',
  
  // Biotherm
  'biotherm homme': 'Biotherm',
  
  // Vichy
  'vichy laboratoires': 'Vichy',
  
  // La Roche-Posay
  'la roche posay': 'La Roche-Posay',
  'laroche-posay': 'La Roche-Posay',
  'laroche posay': 'La Roche-Posay',
  
  // Avène
  'avene': 'Avène',
  'eau thermale avène': 'Avène',
  
  // Bioderma
  'bioderma laboratoire': 'Bioderma',
  
  // Nuxe
  'nuxe paris': 'Nuxe',
  
  // Caudalie
  'caudalie paris': 'Caudalie',
  
  // Sephora Collection
  'sephora collection': 'Sephora Collection',
  'sephora': 'Sephora Collection',
  
  // NYX
  'nyx cosmetics': 'NYX',
  'nyx professional makeup': 'NYX',
  
  // Maybelline
  'maybelline new york': 'Maybelline',
  
  // Rimmel
  'rimmel london': 'Rimmel',
  
  // Revlon
  'revlon professional': 'Revlon',
  
  // Max Factor
  'maxfactor': 'Max Factor',
  
  // Kérastase
  'kerastase': 'Kérastase',
  'kérastase paris': 'Kérastase',
  
  // Redken
  'redken 5th avenue nyc': 'Redken',
  
  // Moroccanoil
  'moroccan oil': 'Moroccanoil',
  
  // Olaplex
  'olaplex inc': 'Olaplex',
  
  // Dyson
  'dyson hair': 'Dyson',
  
  // ghd
  'good hair day': 'ghd',
  
  // OPI
  'opi nail': 'OPI',
  'o.p.i': 'OPI',
  
  // Essie
  'essie nail': 'Essie',
  
  // Foreo
  'foreo sweden': 'Foreo',
  
  // Drunk Elephant
  'drunk elephant skincare': 'Drunk Elephant',
  
  // The Ordinary
  'ordinary': 'The Ordinary',
  'the ordinary.': 'The Ordinary',
  
  // CeraVe
  'cerave skincare': 'CeraVe',
  
  // Neutrogena
  'neutrogena dermatologics': 'Neutrogena',
  
  // Garnier
  'garnier paris': 'Garnier',
  
  // Nivea
  'nivea men': 'Nivea',
  'nivea visage': 'Nivea',
  
  // Dove
  'dove men+care': 'Dove',
  
  // Acqua di Parma
  'acqua di parma': 'Acqua di Parma',
  'adp': 'Acqua di Parma',
  
  // Tom Ford
  'tom ford beauty': 'Tom Ford',
  'tom ford private blend': 'Tom Ford',
  
  // Jo Malone
  'jo malone london': 'Jo Malone',
  
  // Byredo
  'byredo parfums': 'Byredo',
  
  // Diptyque
  'diptyque paris': 'Diptyque',
  
  // Le Labo
  'lelabo': 'Le Labo',
  
  // Maison Francis Kurkdjian
  'mfk': 'Maison Francis Kurkdjian',
  'francis kurkdjian': 'Maison Francis Kurkdjian',
  
  // Penhaligon's
  'penhaligons': "Penhaligon's",
  
  // Creed
  'creed parfums': 'Creed',
  
  // Parfums de Marly
  'marly': 'Parfums de Marly',
  'pdm': 'Parfums de Marly',
  
  // Initio
  'initio parfums': 'Initio',
  
  // Xerjoff
  'xerjoff sospiro': 'Xerjoff',
  
  // Amouage
  'amouage oman': 'Amouage',
  
  // Montale
  'montale paris': 'Montale',
  
  // Mancera
  'mancera paris': 'Mancera',
  
  // Boucheron
  'boucheron parfums': 'Boucheron',
  
  // Cartier
  'cartier parfums': 'Cartier',
  
  // Van Cleef & Arpels
  'van cleef': 'Van Cleef & Arpels',
  'van cleef and arpels': 'Van Cleef & Arpels',
  'vca': 'Van Cleef & Arpels',
  
  // Bulgari / Bvlgari
  'bulgari': 'Bvlgari',
  'bvlgari parfums': 'Bvlgari',
  
  // Tiffany & Co
  'tiffany': 'Tiffany & Co.',
  'tiffany and co': 'Tiffany & Co.',
};

// Marques avec casse spécifique à préserver
const BRAND_CASE_MAP: Record<string, string> = {
  'mac': 'MAC',
  'nars': 'NARS',
  'nyx': 'NYX',
  'opi': 'OPI',
  'ghd': 'ghd',
  'sk-ii': 'SK-II',
  'cerave': 'CeraVe',
  'byredo': 'Byredo',
  'foreo': 'Foreo',
};

/**
 * Génère un slug à partir d'un nom
 */
export function generateBrandSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Supprime les accents
    .replace(/[^a-z0-9]+/g, '-')     // Remplace les caractères spéciaux par des tirets
    .replace(/^-+|-+$/g, '')         // Supprime les tirets en début/fin
    .replace(/-+/g, '-');            // Supprime les tirets multiples
}

/**
 * Normalise un nom de marque
 * - Vérifie les alias connus
 * - Applique la casse correcte
 * - Nettoie les espaces
 */
export function normalizeBrandName(rawBrand: string | null | undefined): string | null {
  if (!rawBrand || rawBrand.trim() === '') {
    return null;
  }
  
  // Nettoyer le nom
  let brand = rawBrand.trim();
  
  // Supprimer les caractères indésirables
  brand = brand.replace(/®|™|©/g, '').trim();
  
  // Vérifier les alias (en lowercase)
  const brandLower = brand.toLowerCase();
  
  if (BRAND_ALIASES[brandLower]) {
    return BRAND_ALIASES[brandLower];
  }
  
  // Vérifier si c'est une marque avec casse spéciale
  if (BRAND_CASE_MAP[brandLower]) {
    return BRAND_CASE_MAP[brandLower];
  }
  
  // Vérifier si une partie du nom correspond à un alias
  for (const [alias, canonical] of Object.entries(BRAND_ALIASES)) {
    if (brandLower.includes(alias) || alias.includes(brandLower)) {
      // Ne matcher que si c'est vraiment proche
      if (Math.abs(brandLower.length - alias.length) <= 3) {
        return canonical;
      }
    }
  }
  
  // Sinon, appliquer le Title Case standard
  return toTitleCase(brand);
}

/**
 * Convertit en Title Case intelligent
 */
function toTitleCase(str: string): string {
  // Mots à garder en minuscule (articles, prépositions)
  const lowercaseWords = ['de', 'du', 'des', 'la', 'le', 'les', 'et', 'or', 'and', 'the', 'of', 'for', 'by'];
  
  // Mots à garder en majuscule
  const uppercaseWords = ['usa', 'uk', 'nyc', 'paris', 'london', 'tokyo'];
  
  return str
    .toLowerCase()
    .split(' ')
    .map((word, index) => {
      // Premier mot toujours en majuscule
      if (index === 0) {
        return capitalizeFirst(word);
      }
      
      // Vérifier les mots spéciaux
      if (lowercaseWords.includes(word)) {
        return word;
      }
      
      if (uppercaseWords.includes(word)) {
        return word.toUpperCase();
      }
      
      return capitalizeFirst(word);
    })
    .join(' ');
}

/**
 * Met la première lettre en majuscule
 */
function capitalizeFirst(word: string): string {
  if (!word) return word;
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/**
 * Trouve les marques similaires (pour suggestions/déduplication)
 */
export function findSimilarBrands(brandName: string, existingBrands: string[]): string[] {
  const normalized = normalizeBrandName(brandName);
  if (!normalized) return [];
  
  const normalizedLower = normalized.toLowerCase();
  
  return existingBrands.filter(brand => {
    const existingLower = brand.toLowerCase();
    
    // Match exact
    if (existingLower === normalizedLower) return true;
    
    // L'un contient l'autre
    if (existingLower.includes(normalizedLower) || normalizedLower.includes(existingLower)) {
      return true;
    }
    
    // Distance de Levenshtein simple (pour les fautes de frappe)
    if (levenshteinDistance(existingLower, normalizedLower) <= 2) {
      return true;
    }
    
    return false;
  });
}

/**
 * Distance de Levenshtein (édition minimale)
 */
function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Retourne tous les alias connus pour une marque
 */
export function getBrandAliases(canonicalName: string): string[] {
  const aliases: string[] = [];
  const canonicalLower = canonicalName.toLowerCase();
  
  for (const [alias, canonical] of Object.entries(BRAND_ALIASES)) {
    if (canonical.toLowerCase() === canonicalLower) {
      aliases.push(alias);
    }
  }
  
  return aliases;
}

/**
 * Exporte les constantes pour usage externe
 */
export const KNOWN_BRAND_ALIASES = BRAND_ALIASES;
export const KNOWN_BRAND_CASES = BRAND_CASE_MAP;
