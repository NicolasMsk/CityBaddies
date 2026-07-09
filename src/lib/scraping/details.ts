/**
 * =============================================================================
 * DETAILS.TS - EXTRACTION DES FICHES PRODUIT (2e passe d'enrichissement)
 * =============================================================================
 *
 * FONCTION : Visiter la fiche produit d'un deal chez le marchand et en extraire
 *            ce que le listing ne fournit pas : images multiples, description
 *            brute, ingrédients (INCI), conditions de prix, code promo.
 *
 * UTILISÉ PAR : src/scripts/enrich.ts
 *
 * TECHNOLOGIE : fetch + cheerio (HTML statique). Comme pour les scrapers de
 * listing : Nocibé et Sephora (Akamai) exigent un User-Agent MOBILE (403 en
 * desktop), Marionnaud passe en desktop. Chaque extracteur est tolérant aux
 * pannes : champ par champ, et retourne { images: [] } en cas d'échec total
 * (jamais de throw).
 * =============================================================================
 */
import * as cheerio from 'cheerio';

export interface ProductDetails {
  description?: string;      // texte brut de la fiche (≤2000 chars)
  ingredients?: string;      // liste INCI brute (≤4000 chars)
  images: string[];          // URLs absolues, dédupliquées, max 5, la principale d'abord
  priceConditions?: string;  // ex: "Prix avec la carte de fidélité"
  promoCode?: string;
}

const TIMEOUT_MS = 15000;
const MAX_IMAGES = 5;
const MAX_DESCRIPTION = 2000;
const MAX_INGREDIENTS = 4000;

// IMPORTANT: Nocibé et Sephora (Akamai) bloquent les User-Agents desktop (403).
// UA mobile iOS obligatoire — NE PAS repasser en desktop sans revérifier.
const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1';

const MOBILE_HEADERS: Record<string, string> = {
  'User-Agent': MOBILE_UA,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'fr-FR,fr;q=0.9',
};

// Marionnaud accepte un UA desktop (mêmes en-têtes que le scraper de listing).
const DESKTOP_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
  'Sec-Ch-Ua': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'same-origin',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
  'Referer': 'https://www.marionnaud.fr/',
};

/** Fetch avec timeout — retourne null (jamais de throw) si HTTP != 2xx ou erreur réseau. */
async function fetchHtml(url: string, headers: Record<string, string>): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { headers, signal: controller.signal });
    if (!response.ok) {
      console.warn(`[details] HTTP ${response.status} pour ${url}`);
      return null;
    }
    return await response.text();
  } catch (err) {
    const msg = err instanceof Error ? (err.name === 'AbortError' ? 'timeout' : err.message) : String(err);
    console.warn(`[details] Erreur fetch ${url}: ${msg}`);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/** URLs d'images à exclure: logos, icônes, placeholders, data-URIs, svg... */
function isJunkImage(url: string): boolean {
  return (
    !url ||
    url.startsWith('data:') ||
    /\.svg(\?|$)/i.test(url) ||
    /logo|sprite|placeholder|badge|icon|favicon|pictos?[/-]/i.test(url)
  );
}

/** Normalise une URL d'image en URL absolue https. */
function toAbsolute(url: string, origin: string): string {
  const u = url.trim();
  if (u.startsWith('//')) return 'https:' + u;
  if (u.startsWith('/')) return origin + u;
  return u;
}

/** Dédupe (en conservant l'ordre) + filtre le bruit + plafonne à MAX_IMAGES. */
function finalizeImages(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of urls) {
    if (isJunkImage(u) || !u.startsWith('https://') || seen.has(u)) continue;
    seen.add(u);
    out.push(u);
    if (out.length >= MAX_IMAGES) break;
  }
  return out;
}

function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

// ─── NOCIBÉ ──────────────────────────────────────────────────────────────────

/**
 * Fiche produit Nocibé (UA mobile, HTML statique).
 * - description : [data-testid="product-details-description"] (sélecteur V1, revalidé live)
 * - ingredients : #srchOpt--ingredients .product-detail-other-info__html
 * - images : carrousel [data-testid="product-main-media-image-container"] img
 *   (lazy: data-lazy-src). Le paramètre ?context=... est OBLIGATOIRE (400 sans),
 *   on ne retire que les params de rendu (imPolicy=grayScaled, imwidth...).
 *   Tri par l'index -N-global.jpg pour mettre l'image principale (-0) d'abord.
 */
export async function fetchNocibeDetails(productUrl: string): Promise<ProductDetails> {
  const details: ProductDetails = { images: [] };
  const html = await fetchHtml(productUrl, MOBILE_HEADERS);
  if (!html) return details;

  try {
    const $ = cheerio.load(html);

    try {
      const description =
        cleanText($('[data-testid="product-details-description"]').first().text()) ||
        cleanText($('#srchOpt-product-details .product-details__description').first().text());
      if (description) details.description = description.substring(0, MAX_DESCRIPTION);
    } catch { /* champ ignoré */ }

    try {
      const ingredients =
        cleanText($('#srchOpt--ingredients .product-detail-other-info__html').first().text()) ||
        cleanText($('#srchOpt--ingredients').first().text().replace(/^ingr[eé]dients?/i, ''));
      if (ingredients) details.ingredients = ingredients.substring(0, MAX_INGREDIENTS);
    } catch { /* champ ignoré */ }

    try {
      const raw: string[] = [];
      $('[data-testid="product-main-media-image-container"] img').each((_, el) => {
        const src = $(el).attr('data-lazy-src') || $(el).attr('src') || '';
        if (!src) return;
        // Retirer les params de rendu, garder context (obligatoire côté CDN)
        const [base, qs] = toAbsolute(src, 'https://www.nocibe.fr').split('?');
        const kept = (qs || '')
          .split('&')
          .filter((p) => p && !/^(imPolicy|imwidth|imdensity|grid)=/i.test(p));
        raw.push(kept.length ? `${base}?${kept.join('&')}` : base);
      });
      // Image principale d'abord: les URLs suivent le motif
      // <hash><sku>-N-global.jpg ou <hash><sku>-N-ncb-FR.jpg (N=0 = principale)
      const indexOf = (u: string) => {
        const m = u.match(/-(\d+)-(?:global|ncb-FR)\.(?:jpe?g|png|webp)/i);
        return m ? parseInt(m[1], 10) : 99;
      };
      raw.sort((a, b) => indexOf(a) - indexOf(b));
      details.images = finalizeImages(raw);
    } catch { /* champ ignoré */ }

    try {
      const promoCode =
        cleanText($('.eyecatcher--coupon-promotion').first().text()) ||
        cleanText($('[data-testid="variant-copy-coupon-code"]').first().text());
      if (promoCode && promoCode.length <= 30) details.promoCode = promoCode;
    } catch { /* champ ignoré */ }
  } catch (err) {
    console.warn(`[details][nocibe] Erreur parsing ${productUrl}:`, err instanceof Error ? err.message : err);
  }

  return details;
}

// ─── MARIONNAUD ──────────────────────────────────────────────────────────────

/**
 * Fiche produit Marionnaud (UA desktop, HTML statique — SSR Spartacus).
 * - description : <e2-product-information> (accordéon "Information produit")
 * - ingredients : <e2-product-ingredients> (accordéon "Ingrédients")
 * - images : galerie .product-info-gallery__wrapper — on garde les 2000x2000
 *   (les 150x150 sont les vignettes des mêmes visuels). Ordre DOM = front,
 *   back, side, last → la principale d'abord.
 * - priceConditions : liste des promotions de la fiche (titre + description).
 */
export async function fetchMarionnaudDetails(productUrl: string): Promise<ProductDetails> {
  const details: ProductDetails = { images: [] };
  const html = await fetchHtml(productUrl, DESKTOP_HEADERS);
  if (!html) return details;

  try {
    const $ = cheerio.load(html);

    try {
      let description = cleanText($('e2-product-information').first().text());
      description = description
        .replace(/^information produit\s*/i, '')
        .replace(/num[eé]ro d'article.*$/i, '')
        .trim();
      if (description) details.description = description.substring(0, MAX_DESCRIPTION);
    } catch { /* champ ignoré */ }

    try {
      let ingredients = cleanText($('e2-product-ingredients').first().text());
      ingredients = ingredients.replace(/^ingr[eé]dients\s*/i, '').trim();
      if (ingredients) details.ingredients = ingredients.substring(0, MAX_INGREDIENTS);
    } catch { /* champ ignoré */ }

    try {
      const raw: string[] = [];
      $('.product-info-gallery__wrapper img, .gallery img').each((_, el) => {
        let src = $(el).attr('src') || $(el).attr('data-src') || '';
        if (!src) return;
        src = toAbsolute(src, 'https://www.marionnaud.fr');
        // Écarter les vignettes 150x150 (doublons des visuels 2000x2000)
        if (/_150x150|-150x150/i.test(src)) return;
        raw.push(src);
      });
      details.images = finalizeImages(raw);
    } catch { /* champ ignoré */ }

    try {
      const conditions: string[] = [];
      $('.product-add-to-cart__promotion-item').each((_, el) => {
        const title = cleanText($(el).find('.product-add-to-cart__promotion-title').text());
        const desc = cleanText($(el).find('.product-add-to-cart__promotion-description').text());
        const line = desc && desc !== title ? `${title} — ${desc}`.replace(/^\s*—\s*/, '') : title || desc;
        if (line && !conditions.includes(line)) conditions.push(line);
      });
      if (conditions.length) details.priceConditions = conditions.join(' · ').substring(0, 500);
    } catch { /* champ ignoré */ }
  } catch (err) {
    console.warn(`[details][marionnaud] Erreur parsing ${productUrl}:`, err instanceof Error ? err.message : err);
  }

  return details;
}

// ─── SEPHORA ─────────────────────────────────────────────────────────────────

/**
 * Fiche produit Sephora (UA mobile obligatoire — Akamai).
 *
 * ⚠️ Sephora rate-limite aussi par IP (réputation Akamai). L'appelant DOIT
 * espacer les requêtes (≥8s) et tolérer les 403 — cet extracteur ne retry pas.
 *
 * Sélecteurs issus de V1 (d164158, enrich-sephora.ts) + ld+json :
 * - description : #product-infos-content .pdp-description .description-content
 * - ingredients : #product-infos-content .pdp-ingredients .ingredients-content
 * - images : ld+json Product.image en priorité, puis les visuels produit du
 *   carrousel (media.sephora.fr / dev.sephora.fr).
 */
export async function fetchSephoraDetails(productUrl: string): Promise<ProductDetails> {
  const details: ProductDetails = { images: [] };
  const html = await fetchHtml(productUrl, { ...MOBILE_HEADERS, 'Referer': 'https://www.sephora.fr/' });
  if (!html) return details;

  try {
    const $ = cheerio.load(html);

    // ld+json Product (source la plus stable pour description + image principale)
    let ldProduct: any = null;
    try {
      $('script[type="application/ld+json"]').each((_, el) => {
        if (ldProduct) return;
        try {
          const parsed = JSON.parse($(el).html() || '');
          const items = Array.isArray(parsed) ? parsed : [parsed];
          ldProduct = items.find((i: any) => i && i['@type'] === 'Product') || null;
        } catch { /* bloc suivant */ }
      });
    } catch { /* champ ignoré */ }

    try {
      const $desc = $('#product-infos-content .pdp-description .description-content').first().clone();
      $desc.find('img, style, script, .gpsr-supplier-infos').remove();
      const description =
        cleanText($desc.text()) ||
        cleanText(String(ldProduct?.description || '').replace(/<[^>]+>/g, ' '));
      if (description) details.description = description.substring(0, MAX_DESCRIPTION);
    } catch { /* champ ignoré */ }

    try {
      let ingredients = cleanText($('#product-infos-content .pdp-ingredients .ingredients-content').first().text());
      ingredients = ingredients.replace(/Cette liste d'ingr[eé]dients peut faire l'objet.*$/i, '').trim();
      if (ingredients) details.ingredients = ingredients.substring(0, MAX_INGREDIENTS);
    } catch { /* champ ignoré */ }

    try {
      const raw: string[] = [];
      // 1. Image(s) du ld+json (principale d'abord)
      const ldImages = ldProduct?.image;
      for (const img of Array.isArray(ldImages) ? ldImages : ldImages ? [ldImages] : []) {
        if (typeof img === 'string') raw.push(toAbsolute(img, 'https://www.sephora.fr'));
      }
      // 2. Visuels du carrousel produit
      $('.product-slider img, .carousel-img, .product-first-img, [class*="product-img"] img, img[src*="/on/demandware.static/"], img[data-src*="/on/demandware.static/"]').each((_, el) => {
        const src = $(el).attr('src') || $(el).attr('data-src') || '';
        if (src) raw.push(toAbsolute(src, 'https://www.sephora.fr'));
      });
      // Nettoyer les params de redimensionnement Demandware (sw/sh/sm/scaleWidth)
      // et écarter les visuels éditoriaux (Library-Sites = bannières, pas produit).
      const cleaned = raw
        .filter((u) => !/Library-Sites/i.test(u))
        .map((u) => {
          const [base, qs] = u.split('?');
          const kept = (qs || '').split('&').filter((p) => p && !/^(sw|sh|sm|sfrm|q|scaleWidth)=/i.test(p));
          return kept.length ? `${base}?${kept.join('&')}` : base;
        });
      details.images = finalizeImages(cleaned);
    } catch { /* champ ignoré */ }
  } catch (err) {
    console.warn(`[details][sephora] Erreur parsing ${productUrl}:`, err instanceof Error ? err.message : err);
  }

  return details;
}
