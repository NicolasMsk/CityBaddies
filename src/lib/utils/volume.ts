/**
 * Utilitaires pour parser les volumes et calculer le prix par unité
 */

export interface VolumeInfo {
  volume: string;       // Volume original (ex: "75 ml")
  volumeValue: number;  // Valeur numérique (ex: 75)
  volumeUnit: string;   // Unité normalisée (ex: "ml")
}

export interface PricePerUnitInfo extends VolumeInfo {
  pricePerUnit: number; // Prix par unité (€/ml ou €/g)
}

/**
 * Parse une chaîne de volume et extrait la valeur et l'unité
 * Gère les formats: "75 ml", "100ml", "50 ML", "30g", "1.7 oz", etc.
 */
export function parseVolume(volumeStr: string | null | undefined): VolumeInfo | null {
  if (!volumeStr) return null;
  
  const normalized = volumeStr.toLowerCase().trim();
  
  // Pattern pour extraire nombre + unité
  // Gère: "75 ml", "100ml", "1.7 oz", "50 g", "30 gr", etc.
  const match = normalized.match(/(\d+(?:[.,]\d+)?)\s*(ml|l|cl|g|gr|gramme|grammes|kg|oz|fl\.?\s*oz)/i);
  
  if (!match) return null;
  
  let value = parseFloat(match[1].replace(',', '.'));
  let unit = match[2].toLowerCase();
  
  // Normaliser les unités
  switch (unit) {
    case 'l':
      value *= 1000;
      unit = 'ml';
      break;
    case 'cl':
      value *= 10;
      unit = 'ml';
      break;
    case 'kg':
      value *= 1000;
      unit = 'g';
      break;
    case 'gr':
    case 'gramme':
    case 'grammes':
      unit = 'g';
      break;
    case 'oz':
    case 'fl oz':
    case 'fl. oz':
      // 1 fl oz ≈ 29.57 ml
      value *= 29.57;
      unit = 'ml';
      break;
  }
  
  return {
    volume: volumeStr,
    volumeValue: Math.round(value * 100) / 100, // Arrondir à 2 décimales
    volumeUnit: unit,
  };
}

/**
 * Calcule le prix par unité (€/ml ou €/g)
 */
export function calculatePricePerUnit(
  price: number,
  volumeStr: string | null | undefined
): PricePerUnitInfo | null {
  const volumeInfo = parseVolume(volumeStr);
  
  if (!volumeInfo || volumeInfo.volumeValue <= 0) return null;
  
  // Garder la précision complète (pas d'arrondi) pour calcul exact du prix/100ml
  const pricePerUnit = price / volumeInfo.volumeValue;
  
  return {
    ...volumeInfo,
    pricePerUnit,
  };
}

/**
 * Formatte le prix par unité pour l'affichage
 * Ex: "0.85 €/ml" ou "1.20 €/g"
 */
export function formatPricePerUnit(pricePerUnit: number, unit: string): string {
  return `${pricePerUnit.toFixed(2)} €/${unit}`;
}

/**
 * Compare deux deals par leur prix par unité
 * Retourne le deal avec le meilleur rapport qualité/prix
 */
export function compareDealsByValue(
  deal1: { pricePerUnit: number | null; volumeUnit: string | null },
  deal2: { pricePerUnit: number | null; volumeUnit: string | null }
): number {
  // Si les unités sont différentes, on ne peut pas comparer
  if (deal1.volumeUnit !== deal2.volumeUnit) return 0;
  
  // Si l'un des deux n'a pas de prix par unité
  if (!deal1.pricePerUnit) return 1;
  if (!deal2.pricePerUnit) return -1;
  
  // Plus le prix par unité est bas, meilleur est le deal
  return deal1.pricePerUnit - deal2.pricePerUnit;
}

/**
 * Crée ou trouve une variante de produit existante
 * Utilisé lors de l'import pour lier les deals aux bonnes variantes
 */
export async function findOrCreateVariant(
  prisma: any,
  productId: string,
  volumeStr: string | null | undefined,
  ean?: string | null
): Promise<{ id: string; volumeValue: number; volumeUnit: string } | null> {
  const volumeInfo = parseVolume(volumeStr);
  if (!volumeInfo) return null;

  // Chercher une variante existante
  let variant = await prisma.productVariant.findFirst({
    where: {
      productId,
      volumeValue: volumeInfo.volumeValue,
      volumeUnit: volumeInfo.volumeUnit,
    },
  });

  // Créer si n'existe pas
  if (!variant) {
    variant = await prisma.productVariant.create({
      data: {
        productId,
        volumeValue: volumeInfo.volumeValue,
        volumeUnit: volumeInfo.volumeUnit,
        volumeRaw: volumeStr,
        ean: ean || null,
      },
    });
  } else if (ean && !variant.ean) {
    // Mettre à jour l'EAN si on l'a maintenant
    variant = await prisma.productVariant.update({
      where: { id: variant.id },
      data: { ean },
    });
  }

  return {
    id: variant.id,
    volumeValue: variant.volumeValue,
    volumeUnit: variant.volumeUnit,
  };
}
