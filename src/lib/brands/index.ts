/**
 * Module de gestion des marques
 */

export {
  normalizeBrandName,
  generateBrandSlug,
  findSimilarBrands,
  getBrandAliases,
  KNOWN_BRAND_ALIASES,
  KNOWN_BRAND_CASES,
} from './normalize';

import prisma from '@/lib/prisma';
import { normalizeBrandName, generateBrandSlug, getBrandAliases } from './normalize';

// Cast pour accéder à brand
const db = prisma as any;

/**
 * Trouve ou crée une marque dans la base de données
 * Gère la normalisation automatiquement
 */
export async function findOrCreateBrand(rawBrandName: string | null | undefined): Promise<string | null> {
  const normalizedName = normalizeBrandName(rawBrandName);
  
  if (!normalizedName) {
    return null;
  }
  
  const slug = generateBrandSlug(normalizedName);
  
  // Chercher par slug (plus fiable que le nom)
  let brand = await db.brand.findUnique({
    where: { slug },
  });
  
  if (!brand) {
    // Chercher par nom exact
    brand = await db.brand.findUnique({
      where: { name: normalizedName },
    });
  }
  
  if (!brand) {
    // Créer la marque
    const aliases = getBrandAliases(normalizedName);
    
    brand = await db.brand.create({
      data: {
        name: normalizedName,
        slug,
        aliases: aliases.length > 0 ? aliases.join(',') : null,
      },
    });
    
    console.log(`✨ Nouvelle marque créée: ${normalizedName} (${slug})`);
  }
  
  return brand.id;
}

/**
 * Cherche une marque par son nom (ou alias)
 */
export async function findBrandByName(rawBrandName: string): Promise<{ id: string; name: string; slug: string } | null> {
  const normalizedName = normalizeBrandName(rawBrandName);
  
  if (!normalizedName) {
    return null;
  }
  
  const slug = generateBrandSlug(normalizedName);
  
  // Chercher par slug
  let brand = await db.brand.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true },
  });
  
  if (brand) return brand;
  
  // Chercher par nom
  brand = await db.brand.findUnique({
    where: { name: normalizedName },
    select: { id: true, name: true, slug: true },
  });
  
  if (brand) return brand;
  
  // Chercher dans les alias
  const allBrands = await db.brand.findMany({
    where: { aliases: { not: null } },
    select: { id: true, name: true, slug: true, aliases: true },
  });
  
  const searchLower = rawBrandName.toLowerCase().trim();
  
  for (const b of allBrands) {
    if (b.aliases) {
      const aliasArray = b.aliases.split(',').map((a: string) => a.toLowerCase().trim());
      if (aliasArray.includes(searchLower)) {
        return { id: b.id, name: b.name, slug: b.slug };
      }
    }
  }
  
  return null;
}

/**
 * Liste toutes les marques avec le nombre de produits
 */
export async function listBrandsWithCount() {
  return db.brand.findMany({
    select: {
      id: true,
      name: true,
      slug: true,
      logoUrl: true,
      _count: {
        select: { products: true },
      },
    },
    orderBy: {
      products: { _count: 'desc' },
    },
  });
}
