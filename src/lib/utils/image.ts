/**
 * Nettoie une URL d'image pour supprimer les paramètres invalides
 * et demander la meilleure qualité possible selon le CDN marchand.
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

/**
 * Optimise l'URL d'une image pour obtenir la meilleure résolution
 * selon le CDN du marchand (Sephora, Nocibé, Marionnaud, etc.)
 */
export function getHighQualityImageUrl(url: string | null | undefined): string | null {
  const cleaned = cleanImageUrl(url);
  if (!cleaned) return null;

  try {
    const u = new URL(cleaned);
    const hostname = u.hostname.toLowerCase();

    // ── Sephora (media.sephora.eu) ──
    // Utilise scaleWidth/scaleHeight pour contrôler la taille
    if (hostname.includes('sephora')) {
      u.searchParams.set('scaleWidth', '800');
      u.searchParams.delete('scaleHeight'); // laisser le ratio naturel
      return u.toString();
    }

    // ── Nocibé (media.nocibe.fr) ──
    // Les URLs Nocibé contiennent souvent un segment de taille comme /220x220/ ou /340x340/
    if (hostname.includes('nocibe')) {
      const path = u.pathname;
      // Remplacer les tailles connues par 800x800
      const upgraded = path.replace(/\/\d{2,4}x\d{2,4}\//g, '/800x800/');
      if (upgraded !== path) {
        u.pathname = upgraded;
      }
      return u.toString();
    }

    // ── Marionnaud (media.marionnaud.fr) ──
    // Les URLs Marionnaud utilisent parfois un format avec taille dans le path
    if (hostname.includes('marionnaud')) {
      const path = u.pathname;
      const upgraded = path.replace(/\/\d{2,4}x\d{2,4}\//g, '/800x800/');
      if (upgraded !== path) {
        u.pathname = upgraded;
      }
      return u.toString();
    }

    // ── Notino (cdn.notinoimg.com) ──
    if (hostname.includes('notinoimg')) {
      // Notino utilise /ft/ pour les tailles (ex: /ft/220x220/)
      const path = u.pathname;
      const upgraded = path.replace(/\/ft\/\d+x\d+\//g, '/ft/800x800/');
      if (upgraded !== path) {
        u.pathname = upgraded;
      }
      return u.toString();
    }

    return u.toString();
  } catch {
    return cleaned;
  }
}

/**
 * Valide qu'une URL est une vraie image HTTPS utilisable
 */
export function isValidImageUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    if (!parsed.hostname.includes('.')) return false;
    if (parsed.hostname.split('.').length < 2) return false;
    if (parsed.hostname.split('.')[0].length <= 1) return false;

    // Exclure les placeholders connus
    const PLACEHOLDER_PATTERNS = [
      'cq5dam.web',          // Placeholder Nocibé / AEM générique
      'no-image',
      'placeholder',
      'noimage',
      'default-image',
    ];
    const pathname = parsed.pathname.toLowerCase();
    if (PLACEHOLDER_PATTERNS.some(p => pathname.includes(p))) return false;

    return true;
  } catch {
    return false;
  }
}
