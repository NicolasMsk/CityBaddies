import OpenAI from 'openai';

// Lazy initialization pour éviter erreur au build
let _client: OpenAI | null = null;
const getClient = () => {
  if (!_client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not defined');
    }
    _client = new OpenAI({ apiKey });
  }
  return _client;
};

interface Subcategory {
  name: string;
  keywords: string[];
}

interface Category {
  name: string;
  subcategories: Record<string, Subcategory>;
  defaultSubcategory: string;
  keywords: string[];
}

// Sous-sous-catégories détaillées pour chaque sous-catégorie
export const SUBSUBCATEGORIES: Record<string, Record<string, { name: string; keywords: string[] }>> = {
  // MAQUILLAGE
  'teint': {
    'fond-de-teint': { name: 'Fond de teint', keywords: ['fond de teint', 'foundation'] },
    'correcteur': { name: 'Correcteur', keywords: ['correcteur', 'concealer', 'anti-cernes'] },
    'poudre': { name: 'Poudre', keywords: ['poudre', 'powder', 'setting'] },
    'blush': { name: 'Blush', keywords: ['blush', 'fard a joues'] },
    'bronzer': { name: 'Bronzer', keywords: ['bronzer', 'terre de soleil', 'bronzing'] },
    'highlighter': { name: 'Highlighter', keywords: ['highlighter', 'illuminateur', 'enlumineur'] },
    'primer': { name: 'Primer', keywords: ['primer', 'base', 'pore'] },
  },
  'yeux': {
    'mascara': { name: 'Mascara', keywords: ['mascara'] },
    'eyeliner': { name: 'Eyeliner', keywords: ['eyeliner', 'eye-liner', 'liner'] },
    'fard-paupieres': { name: 'Fard à paupières', keywords: ['fard', 'ombre', 'eyeshadow'] },
    'crayon-yeux': { name: 'Crayon yeux', keywords: ['crayon yeux', 'khol', 'kajal'] },
    'faux-cils': { name: 'Faux cils', keywords: ['faux cils', 'cils'] },
  },
  'levres': {
    'rouge-a-levres': { name: 'Rouge à lèvres', keywords: ['rouge a levres', 'lipstick', 'rouge'] },
    'gloss': { name: 'Gloss', keywords: ['gloss', 'brillant'] },
    'crayon-levres': { name: 'Crayon lèvres', keywords: ['crayon levres', 'lip liner'] },
    'baume-levres': { name: 'Baume lèvres', keywords: ['baume', 'lip balm'] },
  },
  'sourcils': {
    'crayon-sourcils': { name: 'Crayon sourcils', keywords: ['crayon sourcils', 'brow pencil'] },
    'gel-sourcils': { name: 'Gel sourcils', keywords: ['gel sourcils', 'brow gel'] },
    'poudre-sourcils': { name: 'Poudre sourcils', keywords: ['poudre sourcils', 'brow powder'] },
    'pomade-sourcils': { name: 'Pomade sourcils', keywords: ['pomade', 'brow pomade'] },
  },
  'palettes': {
    'palette-yeux': { name: 'Palette yeux', keywords: ['palette yeux', 'eyeshadow palette'] },
    'palette-teint': { name: 'Palette teint', keywords: ['palette teint', 'contour palette'] },
    'palette-levres': { name: 'Palette lèvres', keywords: ['palette levres', 'lip palette'] },
  },
  
  // SOINS VISAGE
  'nettoyants': {
    'gel-nettoyant': { name: 'Gel nettoyant', keywords: ['gel nettoyant', 'cleansing gel'] },
    'mousse-nettoyante': { name: 'Mousse nettoyante', keywords: ['mousse', 'foam'] },
    'huile-demaquillante': { name: 'Huile démaquillante', keywords: ['huile demaquillante', 'cleansing oil'] },
    'eau-micellaire': { name: 'Eau micellaire', keywords: ['eau micellaire', 'micellar'] },
    'lait-demaquillant': { name: 'Lait démaquillant', keywords: ['lait demaquillant', 'cleansing milk'] },
  },
  'serums': {
    'serum-hydratant': { name: 'Sérum hydratant', keywords: ['serum hydratant', 'hydrating serum', 'acide hyaluronique'] },
    'serum-anti-age': { name: 'Sérum anti-âge', keywords: ['anti-age', 'retinol', 'rides'] },
    'serum-eclat': { name: 'Sérum éclat', keywords: ['eclat', 'vitamine c', 'brightening'] },
    'serum-anti-imperfections': { name: 'Sérum anti-imperfections', keywords: ['imperfections', 'acne', 'boutons', 'niacinamide'] },
  },
  'cremes': {
    'creme-hydratante': { name: 'Crème hydratante', keywords: ['creme hydratante', 'moisturizer', 'hydratation'] },
    'creme-anti-age': { name: 'Crème anti-âge', keywords: ['anti-age', 'anti-rides', 'fermeté'] },
    'creme-nuit': { name: 'Crème de nuit', keywords: ['nuit', 'night cream'] },
    'creme-teintee': { name: 'Crème teintée', keywords: ['teintee', 'tinted', 'bb cream', 'cc cream'] },
  },
  'masques': {
    'masque-hydratant': { name: 'Masque hydratant', keywords: ['masque hydratant', 'hydrating mask'] },
    'masque-purifiant': { name: 'Masque purifiant', keywords: ['purifiant', 'argile', 'clay', 'detox'] },
    'masque-eclat': { name: 'Masque éclat', keywords: ['eclat', 'glow', 'illuminating'] },
    'peel': { name: 'Peel', keywords: ['peel', 'exfoliant', 'acide'] },
  },
  'contour-yeux': {
    'creme-contour': { name: 'Crème contour', keywords: ['creme contour', 'eye cream'] },
    'serum-yeux': { name: 'Sérum yeux', keywords: ['serum yeux', 'eye serum'] },
    'patch-yeux': { name: 'Patch yeux', keywords: ['patch', 'eye patch'] },
  },
  
  // CHEVEUX
  'shampoings': {
    'shampoing-hydratant': { name: 'Shampoing hydratant', keywords: ['hydratant', 'hydrating', 'nutrition'] },
    'shampoing-volume': { name: 'Shampoing volume', keywords: ['volume', 'volumizing'] },
    'shampoing-lissant': { name: 'Shampoing lissant', keywords: ['lissant', 'smoothing', 'anti-frisottis'] },
    'shampoing-colore': { name: 'Shampoing coloré', keywords: ['colore', 'color protect', 'cheveux colores'] },
    'shampoing-sec': { name: 'Shampoing sec', keywords: ['sec', 'dry shampoo'] },
    'shampoing-antipelliculaire': { name: 'Shampoing antipelliculaire', keywords: ['antipelliculaire', 'pellicules', 'dandruff'] },
  },
  'apres-shampoings': {
    'apres-shampoing-hydratant': { name: 'Après-shampoing hydratant', keywords: ['hydratant', 'hydrating'] },
    'apres-shampoing-demelant': { name: 'Après-shampoing démêlant', keywords: ['demelant', 'detangling'] },
    'apres-shampoing-reparateur': { name: 'Après-shampoing réparateur', keywords: ['reparateur', 'repair', 'damage'] },
  },
  'masques-capillaires': {
    'masque-nourrissant': { name: 'Masque nourrissant', keywords: ['nourrissant', 'nourishing', 'nutrition'] },
    'masque-reparateur': { name: 'Masque réparateur', keywords: ['reparateur', 'repair', 'reconstruct'] },
    'masque-hydratant': { name: 'Masque hydratant', keywords: ['hydratant', 'moisture'] },
  },
  'huiles': {
    'huile-nourrissante': { name: 'Huile nourrissante', keywords: ['nourrissante', 'nourishing'] },
    'huile-seche': { name: 'Huile sèche', keywords: ['seche', 'dry oil'] },
    'serum-pointes': { name: 'Sérum pointes', keywords: ['pointes', 'ends', 'split'] },
  },
  'coiffants': {
    'laque': { name: 'Laque', keywords: ['laque', 'hairspray'] },
    'mousse-coiffante': { name: 'Mousse coiffante', keywords: ['mousse', 'foam'] },
    'gel': { name: 'Gel', keywords: ['gel'] },
    'cire': { name: 'Cire', keywords: ['cire', 'wax'] },
    'spray-texturisant': { name: 'Spray texturisant', keywords: ['texturisant', 'texture', 'salt spray'] },
  },
  
  // PARFUMS
  'eau-de-parfum': {
    'edp-femme': { name: 'EDP Femme', keywords: ['femme', 'woman', 'pour elle'] },
    'edp-homme': { name: 'EDP Homme', keywords: ['homme', 'man', 'pour lui'] },
    'edp-mixte': { name: 'EDP Mixte', keywords: ['mixte', 'unisex'] },
  },
  'eau-de-toilette': {
    'edt-femme': { name: 'EDT Femme', keywords: ['femme', 'woman'] },
    'edt-homme': { name: 'EDT Homme', keywords: ['homme', 'man'] },
    'edt-mixte': { name: 'EDT Mixte', keywords: ['mixte', 'unisex'] },
  },
  'brumes': {
    'brume-corps': { name: 'Brume corps', keywords: ['corps', 'body'] },
    'brume-cheveux': { name: 'Brume cheveux', keywords: ['cheveux', 'hair'] },
  },
  'coffrets-parfums': {
    'coffret-edp': { name: 'Coffret EDP', keywords: ['coffret', 'set', 'gift'] },
    'coffret-miniatures': { name: 'Coffret miniatures', keywords: ['miniature', 'discovery', 'travel'] },
  },
  
  // SOINS CORPS
  'hydratants': {
    'lait-corps': { name: 'Lait corps', keywords: ['lait', 'lotion', 'body milk'] },
    'creme-corps': { name: 'Crème corps', keywords: ['creme corps', 'body cream'] },
    'beurre-corps': { name: 'Beurre corps', keywords: ['beurre', 'butter'] },
  },
  'gommages': {
    'gommage-corps': { name: 'Gommage corps', keywords: ['gommage', 'scrub', 'exfoliant'] },
    'gommage-pieds': { name: 'Gommage pieds', keywords: ['pieds', 'feet'] },
    'gommage-mains': { name: 'Gommage mains', keywords: ['mains', 'hands'] },
  },
  'solaires': {
    'protection-solaire': { name: 'Protection solaire', keywords: ['protection', 'spf', 'ecran'] },
    'autobronzant': { name: 'Autobronzant', keywords: ['autobronzant', 'self-tan'] },
    'apres-soleil': { name: 'Après-soleil', keywords: ['apres-soleil', 'after sun'] },
  },
  'douche': {
    'gel-douche': { name: 'Gel douche', keywords: ['gel douche', 'shower gel'] },
    'huile-douche': { name: 'Huile douche', keywords: ['huile douche', 'shower oil'] },
    'savon': { name: 'Savon', keywords: ['savon', 'soap'] },
  },
  'deodorants': {
    'deo-spray': { name: 'Déo spray', keywords: ['spray', 'aerosol'] },
    'deo-roll-on': { name: 'Déo roll-on', keywords: ['roll-on', 'bille'] },
    'deo-stick': { name: 'Déo stick', keywords: ['stick'] },
  },
  
  // ONGLES
  'vernis': {
    'vernis-classique': { name: 'Vernis classique', keywords: ['vernis', 'nail polish'] },
    'vernis-longue-tenue': { name: 'Vernis longue tenue', keywords: ['longue tenue', 'long wear'] },
  },
  'semi-permanent': {
    'gel-uv': { name: 'Gel UV', keywords: ['gel uv', 'uv gel'] },
    'vernis-semi': { name: 'Vernis semi', keywords: ['semi-permanent', 'shellac'] },
  },
  'faux-ongles': {
    'capsules': { name: 'Capsules', keywords: ['capsules', 'tips'] },
    'press-on': { name: 'Press-on', keywords: ['press-on', 'faux ongles'] },
  },
  'soins-ongles': {
    'base-coat': { name: 'Base coat', keywords: ['base', 'base coat'] },
    'top-coat': { name: 'Top coat', keywords: ['top coat', 'finition'] },
    'huile-cuticules': { name: 'Huile cuticules', keywords: ['cuticule', 'cuticle oil'] },
  },
  
  // ACCESSOIRES
  'pinceaux': {
    'pinceau-teint': { name: 'Pinceau teint', keywords: ['pinceau teint', 'foundation brush'] },
    'pinceau-yeux': { name: 'Pinceau yeux', keywords: ['pinceau yeux', 'eye brush'] },
    'pinceau-levres': { name: 'Pinceau lèvres', keywords: ['pinceau levres', 'lip brush'] },
    'set-pinceaux': { name: 'Set pinceaux', keywords: ['set', 'kit pinceaux'] },
  },
  'eponges': {
    'beauty-blender': { name: 'Beauty blender', keywords: ['beauty blender', 'sponge'] },
    'eponge-konjac': { name: 'Éponge konjac', keywords: ['konjac'] },
  },
  'trousses': {
    'trousse-maquillage': { name: 'Trousse maquillage', keywords: ['trousse', 'pochette'] },
    'vanity': { name: 'Vanity', keywords: ['vanity', 'malette'] },
  },
  'miroirs': {
    'miroir-grossissant': { name: 'Miroir grossissant', keywords: ['grossissant', 'magnifying'] },
    'miroir-lumineux': { name: 'Miroir lumineux', keywords: ['lumineux', 'led', 'light'] },
  },
};

export const BEAUTY_CATEGORIES: Record<string, Category> = {
  'maquillage': {
    name: 'Maquillage',
    subcategories: {
      'teint': { name: 'Teint', keywords: ['fond de teint', 'correcteur', 'poudre', 'blush'] },
      'yeux': { name: 'Yeux', keywords: ['mascara', 'eye-liner', 'fard', 'ombre'] },
      'levres': { name: 'Levres', keywords: ['rouge a levres', 'lipstick', 'gloss'] },
      'sourcils': { name: 'Sourcils', keywords: ['sourcil', 'brow'] },
      'palettes': { name: 'Palettes', keywords: ['palette', 'coffret'] },
    },
    defaultSubcategory: 'teint',
    keywords: ['maquillage', 'makeup']
  },
  'soins-visage': {
    name: 'Soins visage',
    subcategories: {
      'nettoyants': { name: 'Nettoyants', keywords: ['nettoyant', 'demaquillant', 'eau micellaire'] },
      'serums': { name: 'Serums', keywords: ['serum', 'concentre', 'booster'] },
      'cremes': { name: 'Cremes', keywords: ['creme visage', 'creme hydratante', 'moisturizer'] },
      'masques': { name: 'Masques', keywords: ['masque visage', 'mask', 'peel'] },
      'contour-yeux': { name: 'Contour des yeux', keywords: ['contour des yeux', 'eye cream'] },
    },
    defaultSubcategory: 'cremes',
    keywords: ['soin', 'skincare', 'visage', 'peau']
  },
  'cheveux': {
    name: 'Cheveux',
    subcategories: {
      'shampoings': { name: 'Shampoings', keywords: ['shampoing', 'shampooing', 'shampoo'] },
      'apres-shampoings': { name: 'Apres-shampoings', keywords: ['apres-shampoing', 'conditioner'] },
      'masques-capillaires': { name: 'Masques', keywords: ['masque cheveux', 'masque capillaire'] },
      'huiles': { name: 'Huiles', keywords: ['huile cheveux', 'hair oil', 'serum cheveux', 'elixir'] },
      'coiffants': { name: 'Coiffants', keywords: ['laque', 'gel coiffant', 'mousse', 'spray'] },
    },
    defaultSubcategory: 'shampoings',
    keywords: ['cheveux', 'capillaire', 'hair']
  },
  'parfums': {
    name: 'Parfums',
    subcategories: {
      'eau-de-parfum': { name: 'Eau de parfum', keywords: ['eau de parfum', 'edp'] },
      'eau-de-toilette': { name: 'Eau de toilette', keywords: ['eau de toilette', 'edt'] },
      'brumes': { name: 'Brumes', keywords: ['brume', 'mist', 'body mist'] },
      'coffrets-parfums': { name: 'Coffrets', keywords: ['coffret parfum', 'set parfum'] },
    },
    defaultSubcategory: 'eau-de-parfum',
    keywords: ['parfum', 'fragrance', 'cologne']
  },
  'ongles': {
    name: 'Ongles',
    subcategories: {
      'vernis': { name: 'Vernis', keywords: ['vernis', 'nail polish'] },
      'semi-permanent': { name: 'Semi-permanent', keywords: ['semi-permanent', 'gel'] },
      'faux-ongles': { name: 'Faux ongles', keywords: ['faux ongles', 'capsules'] },
      'soins-ongles': { name: 'Soins', keywords: ['soin ongles', 'base', 'top coat'] },
    },
    defaultSubcategory: 'vernis',
    keywords: ['ongle', 'nail', 'manucure']
  },
  'soins-corps': {
    name: 'Soins corps',
    subcategories: {
      'hydratants': { name: 'Hydratants', keywords: ['lait corps', 'creme corps', 'lotion', 'beurre'] },
      'gommages': { name: 'Gommages', keywords: ['gommage', 'exfoliant', 'scrub'] },
      'huiles': { name: 'Huiles', keywords: ['huile corps', 'huile seche'] },
      'solaires': { name: 'Solaires', keywords: ['solaire', 'spf', 'autobronzant', 'apres-soleil'] },
      'douche': { name: 'Douche', keywords: ['gel douche', 'savon', 'bain'] },
      'deodorants': { name: 'Déodorants', keywords: ['deodorant', 'anti-transpirant'] },
    },
    defaultSubcategory: 'hydratants',
    keywords: ['corps', 'body', 'soin corps']
  },
  'accessoires': {
    name: 'Accessoires',
    subcategories: {
      'pinceaux': { name: 'Pinceaux', keywords: ['pinceau', 'brush'] },
      'eponges': { name: 'Eponges', keywords: ['eponge', 'sponge', 'beauty blender'] },
      'trousses': { name: 'Trousses', keywords: ['trousse', 'pochette'] },
      'miroirs': { name: 'Miroirs', keywords: ['miroir', 'mirror'] },
    },
    defaultSubcategory: 'pinceaux',
    keywords: ['accessoire', 'outil', 'kit']
  },
};

function getDefaultSubcategory(category: Category): { slug: string; name: string } {
  const defaultSub = category.subcategories[category.defaultSubcategory];
  return { slug: category.defaultSubcategory, name: defaultSub?.name || 'Autre' };
}

function getDefaultSubsubcategory(subcategorySlug: string): { slug: string; name: string } | null {
  const subsubcats = SUBSUBCATEGORIES[subcategorySlug];
  if (!subsubcats) return null;
  const firstKey = Object.keys(subsubcats)[0];
  return firstKey ? { slug: firstKey, name: subsubcats[firstKey].name } : null;
}

export interface CategorizeResult {
  categorySlug: string;
  categoryName: string;
  subcategorySlug: string;
  subcategoryName: string;
  subsubcategorySlug: string | null;
  subsubcategoryName: string | null;
  brandTier: 1 | 2 | 3; // 1=marque connue, 2=moyenne, 3=inconnue
  confidence: 'high' | 'medium' | 'low';
  refinedTitle?: string; // Titre optimisé SEO
}

export async function categorizeProductsBatch(
  products: { name: string; brand?: string; volume?: string }[]
): Promise<Map<string, CategorizeResult>> {
  const results = new Map<string, CategorizeResult>();
  
  console.log('[AI] Classification de ' + products.length + ' produits...');
  
  // Créer le prompt avec catégories > sous-catégories > sous-sous-catégories
  const categoriesPrompt = Object.entries(BEAUTY_CATEGORIES)
    .map(([slug, cat]) => {
      const subcats = Object.entries(cat.subcategories).map(([subSlug, sub]) => {
        const subsubcats = SUBSUBCATEGORIES[subSlug];
        const subsubList = subsubcats ? Object.keys(subsubcats).join('|') : '';
        return `  ${subSlug} -> [${subsubList}]`;
      }).join('\n');
      return `${slug}:\n${subcats}`;
    })
    .join('\n');
  
  const BATCH_SIZE = 50;
  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE);
    // Inclure le volume dans la liste pour que l'IA l'utilise dans le titre
    const productList = batch.map((p, idx) => {
      const parts = [(idx + 1).toString()];
      if (p.brand) parts.push(p.brand);
      parts.push(p.name);
      if (p.volume) parts.push(`[${p.volume}]`);
      return parts.join(' - ');
    }).join('\n');
    
    console.log('   Batch ' + (Math.floor(i/BATCH_SIZE) + 1) + '/' + Math.ceil(products.length/BATCH_SIZE) + '...');
      
    try {
      const systemPrompt = `Tu es un expert en classification de produits beaute.

Categories avec sous-categories et sous-sous-categories:
${categoriesPrompt}

REGLES CATEGORIE:
- LOreal Professionnel, Kerastase = cheveux
- Cremes visage, serums = soins-visage
- Parfums, eaux de toilette = parfums
- Rouges a levres, mascara = maquillage

REGLES BRAND TIER (notoriete):
- Tier 1: Marques luxe/tres connues (Chanel, Dior, YSL, Guerlain, Lancome, Estee Lauder, La Mer, Tom Ford, Charlotte Tilbury, MAC, NARS, Kerastase, Olaplex)
- Tier 2: Marques moyennement connues (Too Faced, Benefit, Clinique, Clarins, Shiseido, Kiehls, Fenty, Rare Beauty, Moroccanoil)
- Tier 3: Marques peu connues (niche, petites marques)

Format: une ligne par produit (6 champs separes par |)
numero|categorie|sous-categorie|sous-sous-categorie|tier|titre_optimise

Le titre_optimise doit etre:
- Court et clair (max 60 caracteres)
- Format: "Marque - Type Produit Gamme (Volume)" 
- UTILISER LE VOLUME EXACT fourni entre crochets [xxx ml] - ne pas inventer
- Majuscules sur les mots importants
- Supprimer les termes techniques inutiles
- Si pas de volume fourni, ne pas en mettre

Exemples:
1|cheveux|shampoings|shampoing-hydratant|1|Kérastase - Shampoing Nutritive (250ml)
2|maquillage|levres|rouge-a-levres|2|MAC - Rouge à Lèvres Matte Ruby Woo
3|soins-visage|serums|serum-anti-age|1|Estée Lauder - Sérum Advanced Night Repair (50ml)
4|parfums|eau-de-parfum|edp-femme|3|Nina Ricci - Eau de Parfum Nina (80ml)`;

      // Utiliser l'API Chat Completions avec gpt-4o-mini
      const response = await getClient().chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Categorise:\n' + productList }
        ],
        max_tokens: 4000,
      });

      const content = response.choices[0]?.message?.content || '';
      
      if (!content) {
        console.error('[AI] Réponse vide');
        continue;
      }
      
      console.log('[AI] Réponse brute (première ligne):', content.split('\n')[0]);
      for (const line of content.trim().split('\n')) {
        // Format: numero|categorie|sous-categorie|sous-sous-categorie|tier|titre_optimise
        const parts = line.split('|');
        if (parts.length >= 5) {
          const idx = parseInt(parts[0]) - 1;
          const categorySlug = parts[1]?.trim();
          const subcategorySlug = parts[2]?.trim();
          const subsubcategorySlug = parts[3]?.trim();
          const brandTier = parseInt(parts[4]) as 1 | 2 | 3;
          const refinedTitle = parts[5]?.trim() || undefined;
          const product = batch[idx];
          const category = BEAUTY_CATEGORIES[categorySlug];
          
          if (product && category) {
            const subcategory = category.subcategories[subcategorySlug];
            const defaultSub = getDefaultSubcategory(category);
            const finalSubcatSlug = subcategory ? subcategorySlug : defaultSub.slug;
            
            // Vérifier la sous-sous-catégorie
            const subsubcats = SUBSUBCATEGORIES[finalSubcatSlug];
            const subsubcat = subsubcats?.[subsubcategorySlug];
            const defaultSubsub = getDefaultSubsubcategory(finalSubcatSlug);
            
            results.set(product.name, {
              categorySlug,
              categoryName: category.name,
              subcategorySlug: finalSubcatSlug,
              subcategoryName: subcategory?.name || defaultSub.name,
              subsubcategorySlug: subsubcat ? subsubcategorySlug : (defaultSubsub?.slug || null),
              subsubcategoryName: subsubcat?.name || defaultSubsub?.name || null,
              brandTier: brandTier >= 1 && brandTier <= 3 ? brandTier : 2,
              confidence: 'high',
              refinedTitle,
            });
          }
        }
      }
      
      if (i + BATCH_SIZE < products.length) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    } catch (error) {
      console.error('[AI] Erreur batch:', error);
      throw error; // Ne pas continuer si l'IA échoue
    }
  }
  
  // Log les produits non classifiés (sans fallback)
  for (const product of products) {
    if (!results.has(product.name)) {
      console.warn('[AI] ⚠️ Produit non classifié:', product.name);
    }
  }
  
  const stats = { high: 0, medium: 0, low: 0 };
  const tierStats = { tier1: 0, tier2: 0, tier3: 0 };
  results.forEach((r) => {
    stats[r.confidence]++;
    tierStats[`tier${r.brandTier}` as keyof typeof tierStats]++;
  });
  console.log('[AI] Termine: ' + stats.high + ' high, ' + stats.medium + ' medium, ' + stats.low + ' low');
  console.log('[AI] Tiers: ' + tierStats.tier1 + ' tier1, ' + tierStats.tier2 + ' tier2, ' + tierStats.tier3 + ' tier3');
  
  return results;
}
