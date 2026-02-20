/**
 * Nettoie une URL d'image pour supprimer les paramètres invalides
 * (ex: scaleWidth=undefined de Sephora)
 */
export function cleanImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    // Supprimer les paramètres avec valeur "undefined" ou vide
    const keysToRemove: string[] = [];
    u.searchParams.forEach((value, key) => {
      if (value === 'undefined' || value === 'null' || value === '') {
        keysToRemove.push(key);
      }
    });
    keysToRemove.forEach(k => u.searchParams.delete(k));
    return u.toString();
  } catch {
    return url;
  }
}
