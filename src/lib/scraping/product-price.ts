/**
 * =============================================================================
 * PRODUCT-PRICE.TS — LECTEURS DE PRIX SUR UNE FICHE PRODUIT UNIQUE
 * =============================================================================
 *
 * FONCTION : Étant donné l'URL d'UNE fiche produit vérifiée (ScrapingQueue),
 * récupérer le PRIX COURANT (et le prix barré si présent), la contenance
 * affichée, la marque et l'image. Utilisé par le price tracker quotidien
 * (src/scripts/track-prices.ts) pour rafraîchir les Deals par marchand.
 *
 * NE PAS CONFONDRE AVEC :
 *  - marionnaud.ts / nocibe.ts / sephora.ts : scraping EN MASSE des pages
 *    catégories (listing) pour découvrir des promos.
 *  - details.ts : enrichissement d'une fiche (images/description/ingrédients),
 *    pas le prix.
 *
 * TECHNOLOGIE : fetch + cheerio (HTML statique).
 *  - Marionnaud : UA desktop, SSR Spartacus — prix dans le bloc add-to-cart.
 *    (Pas d'Akamai : testé en masse sans risque.)
 *  - Nocibé / Sephora : UA MOBILE obligatoire (Akamai bloque le desktop en 403)
 *    ET rate-limit par IP → l'appelant DOIT espacer les requêtes ; ces
 *    extracteurs ne retry pas et retournent null en cas d'échec.
 *
 * Chaque extracteur : timeout 20s (AbortController), try/catch → null, jamais de throw.
 * =============================================================================
 */
import * as cheerio from 'cheerio';
import { decompress } from 'compress-json';

/** Une contenance listée sur la fiche, avec son propre prix. */
export interface VariantPrice {
  volume: string;
  currentPrice: number;
  originalPrice?: number;
  ean?: string;
  /** Lien profond vers CETTE contenance (varSel/variant/sku) si disponible. */
  url?: string;
}

export interface ProductPrice {
  name?: string;
  brand?: string;
  currentPrice: number;
  originalPrice?: number;
  volume?: string;
  imageUrl?: string;
  promoCode?: string;
  priceConditions?: string;
  /** TOUTES les contenances de la fiche (y compris celle affichée). */
  variants?: VariantPrice[];
}

/**
 * Résultat d'un fetch de prix :
 *  - ProductPrice : prix trouvé
 *  - 'BLOCKED'    : rate-limit/blocage Akamai (403/429 ou page challenge) —
 *                   l'appelant doit faire un LONG backoff puis retenter
 *  - 'NOT_FOUND'  : HTTP 404, lien mort — à marquer en base, ne plus retenter
 *  - null         : échec d'extraction (page OK mais prix non trouvé)
 */
export type PriceFetchResult = ProductPrice | 'BLOCKED' | 'NOT_FOUND' | null;

const TIMEOUT_MS = 20000;

// UA mobile iOS — obligatoire pour Nocibé et Sephora (Akamai).
const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1';

const MOBILE_HEADERS: Record<string, string> = {
  'User-Agent': MOBILE_UA,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'fr-FR,fr;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
};

// Marionnaud accepte un UA desktop (mêmes en-têtes que details.ts).
const DESKTOP_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
  'Sec-Ch-Ua': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'same-origin',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
  Referer: 'https://www.marionnaud.fr/',
};

// ─── Session cookies par hôte ────────────────────────────────────────────────
// Akamai (Nocibé/Sephora) note le comportement : renvoyer les cookies posés
// (bm_sz, _abck, ak_bmsc...) rend la session crédible et retarde le rate-limit.
const cookieJar = new Map<string, string>();

function hostOf(url: string): string {
  try { return new URL(url).host; } catch { return ''; }
}

function rememberCookies(host: string, res: Response): void {
  const setCookie = (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ??
    (res.headers.get('set-cookie') ? [res.headers.get('set-cookie')!] : []);
  if (!setCookie.length) return;
  const jar = new Map<string, string>();
  const existing = cookieJar.get(host);
  if (existing) {
    for (const pair of existing.split('; ')) {
      const eq = pair.indexOf('=');
      if (eq > 0) jar.set(pair.slice(0, eq), pair.slice(eq + 1));
    }
  }
  for (const c of setCookie) {
    const first = c.split(';')[0];
    const eq = first.indexOf('=');
    if (eq > 0) jar.set(first.slice(0, eq).trim(), first.slice(eq + 1).trim());
  }
  cookieJar.set(host, [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; '));
}

/** Page challenge Akamai servie en 200 (sans le produit) ? */
function looksBlocked(html: string): boolean {
  if (html.length < 4000) return /access denied|edgesuite|challenge|captcha|pardon our interruption/i.test(html);
  return false;
}

interface FetchOutcome {
  status: number; // 0 = erreur réseau/timeout
  html: string | null;
}

/** Fetch avec timeout + cookies de session — jamais de throw. */
async function fetchHtml(url: string, headers: Record<string, string>): Promise<FetchOutcome> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const host = hostOf(url);
  try {
    const h = { ...headers };
    const cookies = cookieJar.get(host);
    if (cookies) h['Cookie'] = cookies;
    const response = await fetch(url, { headers: h, signal: controller.signal });
    rememberCookies(host, response);
    if (!response.ok) {
      console.warn(`[product-price] HTTP ${response.status} pour ${url}`);
      return { status: response.status, html: null };
    }
    return { status: response.status, html: await response.text() };
  } catch (err) {
    const msg = err instanceof Error ? (err.name === 'AbortError' ? 'timeout' : err.message) : String(err);
    console.warn(`[product-price] Erreur fetch ${url}: ${msg}`);
    return { status: 0, html: null };
  } finally {
    clearTimeout(timeout);
  }
}

/** Convertit un FetchOutcome raté en résultat typé (BLOCKED / NOT_FOUND / null). */
function classifyFailure(outcome: FetchOutcome): PriceFetchResult {
  if (outcome.status === 403 || outcome.status === 429) return 'BLOCKED';
  if (outcome.status === 404 || outcome.status === 410) return 'NOT_FOUND';
  return null;
}

/**
 * Warmup de session : visite la homepage du marchand pour récolter les cookies
 * Akamai avant d'enchaîner les fiches. À appeler une fois par run et par site.
 */
export async function warmupSession(origin: string, mobile: boolean): Promise<void> {
  const headers = mobile ? MOBILE_HEADERS : DESKTOP_HEADERS;
  await fetchHtml(origin, headers);
}

/** Extrait le 1er montant en euros d'une chaîne (ex: "  103,50 €" -> 103.5). */
function parseEuro(text: string | null | undefined): number | null {
  if (!text) return null;
  const m = text.match(/([\d]{1,6}(?:[.\s]\d{3})*[.,]?\d*)\s*€/);
  if (!m) return null;
  const num = m[1].replace(/[\s.](?=\d{3}\b)/g, '').replace(',', '.');
  const val = parseFloat(num);
  return Number.isFinite(val) && val > 0 ? val : null;
}

/** Normalise une chaîne de contenance en "50ml" parsable par parseVolume. */
function parseVolumeString(text: string | null | undefined): string | undefined {
  if (!text) return undefined;
  const m = text.match(/(\d+(?:[.,]\d+)?)\s*(ml|mL|ML|cl|l|L|g|gr|G)\b/);
  if (!m) return undefined;
  return m[1].replace(',', '.') + m[2].toLowerCase();
}

/**
 * Nettoie une liste de contenances extraites d'une fiche :
 *  - volume normalisé parsable requis (sinon la variante est écartée)
 *  - déduplication par volume (1re occurrence gardée = ordre de la page)
 *  - prix barré gardé UNIQUEMENT s'il est > prix courant (sinon pas de promo)
 * Retourne undefined si la liste finale est vide (l'appelant retombe alors sur
 * le comportement mono-variante actuel — fail soft, jamais de casse).
 */
function sanitizeVariants(list: VariantPrice[]): VariantPrice[] | undefined {
  const seen = new Set<string>();
  const out: VariantPrice[] = [];
  for (const v of list) {
    const volume = parseVolumeString(v.volume);
    if (!volume) continue;
    if (!(Number.isFinite(v.currentPrice) && v.currentPrice > 0)) continue;
    if (seen.has(volume)) continue;
    seen.add(volume);
    const originalPrice =
      v.originalPrice && Number.isFinite(v.originalPrice) && v.originalPrice > v.currentPrice
        ? v.originalPrice
        : undefined;
    out.push({ volume, currentPrice: v.currentPrice, originalPrice, ean: v.ean, url: v.url });
  }
  return out.length > 0 ? out : undefined;
}

function toAbsolute(url: string, origin: string): string {
  const u = (url || '').trim();
  if (!u) return '';
  if (u.startsWith('//')) return 'https:' + u;
  if (u.startsWith('/')) return origin + u;
  return u;
}

function isJunkImage(url: string): boolean {
  return !url || url.startsWith('data:') || /\.svg(\?|$)/i.test(url) || /logo|sprite|placeholder|icon|favicon/i.test(url);
}

// ─── MARIONNAUD ──────────────────────────────────────────────────────────────

/**
 * Fiche produit Marionnaud (UA desktop, SSR). VÉRIFIÉ LIVE (2026-07).
 *
 * La variante SÉLECTIONNÉE (celle vers laquelle pointe la fiche) est rendue dans
 * le bloc add-to-cart `e2core-price.product-add-to-cart__price-depiction` :
 *  - prix courant : `.price__default-value`  (ex: "103,50 €")
 *  - prix barré   : `.price__was--strikethrough` (absent si pas de promo)
 * La contenance sélectionnée est dans `.variant-selected__option` ("35ML"/"50mL").
 * Marque : `.product-details-brand-link__text-link` ; titre : `h1`.
 * Image  : 1er visuel produit `[class*="product-image"] img` (media.marionnaud.fr).
 *
 * TOUTES LES CONTENANCES (VÉRIFIÉ LIVE 2026-07) : la fiche embarque un
 * `<script id="json-ld">` avec un `@graph` contenant un ProductGroup dont
 * `hasVariant[]` liste chaque taille : `size` ("50ML"), `offers.price`,
 * `offers.url` (lien ?varSel=), `offers.availability`, `gtin13` (EAN).
 * Le json-ld ne porte que le prix de VENTE (pas le prix barré) → pour la
 * variante affichée on garde les prix du DOM (courant + barré).
 */
export async function fetchMarionnaudProductPrice(url: string): Promise<PriceFetchResult> {
  const outcome = await fetchHtml(url, DESKTOP_HEADERS);
  if (!outcome.html) return classifyFailure(outcome);
  const html = outcome.html;
  if (looksBlocked(html)) return 'BLOCKED';

  try {
    const $ = cheerio.load(html);

    // Bloc prix de la variante sélectionnée (add-to-cart).
    const dep = $('e2core-price.product-add-to-cart__price-depiction').first();
    const currentPrice =
      parseEuro(dep.find('.price__default-value').first().text()) ??
      parseEuro($('.product-add-to-cart__price-depiction .price__default-value').first().text());
    if (currentPrice == null) {
      console.warn(`[product-price][marionnaud] prix introuvable ${url}`);
      return null;
    }

    const wasPrice = parseEuro(dep.find('.price__was--strikethrough, .price__was').first().text());
    const originalPrice = wasPrice && wasPrice > currentPrice ? wasPrice : currentPrice;

    const volume =
      parseVolumeString($('.variant-selected__option').first().text()) ??
      parseVolumeString($('[class*="variant-selected"]').first().text());

    const brand = $('.product-details-brand-link__text-link').first().text().trim() || undefined;
    const name = $('h1').first().text().replace(/\s+/g, ' ').trim() || undefined;

    let imageUrl = '';
    $('[class*="product-image"] img, .product-info-gallery__wrapper img').each((_, el) => {
      if (imageUrl) return;
      const src = toAbsolute($(el).attr('src') || $(el).attr('data-src') || '', 'https://www.marionnaud.fr');
      if (src && /media\.marionnaud\.fr/i.test(src) && !isJunkImage(src)) imageUrl = src;
    });

    // Toutes les contenances via le json-ld ProductGroup (fail soft : si absent
    // ou illisible, variants reste undefined → mono-variante comme avant).
    let variants: VariantPrice[] | undefined;
    try {
      const collected: VariantPrice[] = [];
      $('script#json-ld, script[type="application/ld+json"]').each((_, el) => {
        let parsed: unknown;
        try { parsed = JSON.parse($(el).html() || ''); } catch { return; }
        const nodes: any[] = [];
        for (const item of Array.isArray(parsed) ? parsed : [parsed]) {
          if (item && Array.isArray((item as any)['@graph'])) nodes.push(...(item as any)['@graph']);
          else if (item) nodes.push(item);
        }
        for (const node of nodes) {
          if (!node || node['@type'] !== 'ProductGroup' || !Array.isArray(node.hasVariant)) continue;
          for (const v of node.hasVariant) {
            const offer = Array.isArray(v?.offers) ? v.offers[0] : v?.offers;
            const priceNum = typeof offer?.price === 'number' ? offer.price : parseFloat(offer?.price);
            const vol = parseVolumeString(v?.size) ?? parseVolumeString(v?.name);
            if (!vol || !Number.isFinite(priceNum) || priceNum <= 0) continue;
            if (offer?.availability && /OutOfStock/i.test(String(offer.availability))) continue;
            collected.push({
              volume: vol,
              currentPrice: priceNum,
              ean: v?.gtin13 ? String(v.gtin13) : undefined,
              url: typeof offer?.url === 'string' ? toAbsolute(offer.url, 'https://www.marionnaud.fr') : undefined,
            });
          }
        }
      });
      // Pour la contenance affichée, le DOM fait foi (il porte le prix barré).
      if (volume) {
        const selected = collected.find((v) => v.volume === parseVolumeString(volume));
        if (selected) {
          selected.currentPrice = currentPrice;
          selected.originalPrice = originalPrice > currentPrice ? originalPrice : undefined;
        }
      }
      variants = sanitizeVariants(collected);
    } catch {
      variants = undefined;
    }

    return { name, brand, currentPrice, originalPrice, volume, imageUrl: imageUrl || undefined, variants };
  } catch (err) {
    console.warn(`[product-price][marionnaud] parsing ${url}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

// ─── NOCIBÉ ──────────────────────────────────────────────────────────────────

/**
 * Fiche produit Nocibé (UA MOBILE obligatoire — Akamai). VÉRIFIÉ sur 1 fiche.
 *
 * La fiche embarque un unique bloc ld+json `@type=Product` dont le `sku`
 * correspond au `?variant=<id>` de l'URL (= variante sélectionnée) :
 *  - prix courant : offers.price
 *  - prix barré   : offers.priceSpecification.price (StrikethroughPrice)
 *  - marque       : brand.name
 *  - contenance   : name (ex: "100 ml")
 *  - image        : image
 *
 * TOUTES LES CONTENANCES (VÉRIFIÉ LIVE 2026-07) : la page embarque
 * `window.__INITIAL_DATA_CACHE__` au format compress-json ; une fois décodé,
 * l'entrée `GET_PRODUCT:<variant>` expose `response.variantOptions[]` avec,
 * pour CHAQUE taille : `code`, `variantName` ("50 ml"), `priceData.value`,
 * `priceData.originalValue` (prix barré si promo), `url`, `availability.code`,
 * et `couponPromotionBoxes[]` (promo par CODE : `coupon`, `discountedPrice`).
 * Le ld+json de la variante sélectionnée affiche déjà le prix APRÈS code
 * (vérifié : 132,75 € barré 177 € = coupon HOLIDAY25 -25%) → pour être
 * cohérent, chaque variante applique son `discountedPrice` si présent.
 * L'EAN n'existe qu'au niveau de la variante sélectionnée (`response.ean`).
 */

/** Décode window.__INITIAL_DATA_CACHE__ (compress-json) — null si absent/illisible. */
function decodeNocibeDataCache(html: string): any[] | null {
  const idx = html.indexOf('__INITIAL_DATA_CACHE__');
  if (idx < 0) return null;
  const start = html.indexOf('[', idx);
  if (start < 0) return null;
  // Scanner à équilibrage de crochets (les chaînes peuvent contenir ']').
  let depth = 0, k = start, inStr = false, esc = false;
  for (; k < html.length; k++) {
    const c = html[k];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '[') depth++;
    else if (c === ']') { depth--; if (depth === 0) { k++; break; } }
  }
  try {
    const packed = JSON.parse(html.slice(start, k));
    const data = decompress(packed);
    return Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}

/** Extrait les variantOptions (toutes contenances) du DATA_CACHE Nocibé. */
function extractNocibeVariants(html: string): { variants?: VariantPrice[]; promoCode?: string } {
  try {
    const cache = decodeNocibeDataCache(html);
    if (!cache) return {};
    const entry = cache.find((e) => Array.isArray(e) && typeof e[0] === 'string' && e[0].startsWith('GET_PRODUCT:'));
    const resp = entry?.[1]?.data?.response;
    if (!resp || !Array.isArray(resp.variantOptions)) return {};
    const collected: VariantPrice[] = [];
    let promoCode: string | undefined;
    for (const v of resp.variantOptions) {
      const vol = parseVolumeString(v?.variantName);
      const base = typeof v?.priceData?.value === 'number' ? v.priceData.value : parseFloat(v?.priceData?.value);
      if (!vol || !Number.isFinite(base) || base <= 0) continue;
      if (v?.availability?.code && /NOT_AVAILABLE|OUT_OF_STOCK/i.test(String(v.availability.code))) continue;
      const origNum = typeof v?.priceData?.originalValue === 'number' ? v.priceData.originalValue : parseFloat(v?.priceData?.originalValue);
      let currentPrice = base;
      let originalPrice = Number.isFinite(origNum) && origNum > base ? origNum : undefined;
      // Promo par CODE : le site (et son ld+json) affiche le prix après code.
      const coupon = Array.isArray(v?.couponPromotionBoxes) ? v.couponPromotionBoxes[0] : undefined;
      const discounted = typeof coupon?.discountedPrice === 'number' ? coupon.discountedPrice : parseFloat(coupon?.discountedPrice);
      if (Number.isFinite(discounted) && discounted > 0 && discounted < currentPrice) {
        originalPrice = originalPrice && originalPrice > currentPrice ? originalPrice : currentPrice;
        currentPrice = discounted;
        if (!promoCode && typeof coupon?.coupon === 'string' && coupon.coupon) promoCode = coupon.coupon;
      }
      let deepUrl: string | undefined;
      if (typeof v?.url === 'string' && v.url) {
        deepUrl = /[?&]variant=/.test(v.url) || !v.code ? v.url : `${v.url}?variant=${v.code}`;
        deepUrl = toAbsolute(deepUrl, 'https://www.nocibe.fr');
      }
      collected.push({
        volume: vol,
        currentPrice,
        originalPrice,
        // EAN connu uniquement pour la variante sélectionnée.
        ean: v?.code && resp.code && String(v.code) === String(resp.code) && resp.ean ? String(resp.ean) : undefined,
        url: deepUrl,
      });
    }
    return { variants: sanitizeVariants(collected), promoCode };
  } catch {
    return {};
  }
}
export async function fetchNocibeProductPrice(url: string): Promise<PriceFetchResult> {
  const outcome = await fetchHtml(url, { ...MOBILE_HEADERS, Referer: 'https://www.nocibe.fr/' });
  if (!outcome.html) return classifyFailure(outcome);
  const html = outcome.html;
  if (looksBlocked(html)) return 'BLOCKED';

  try {
    const $ = cheerio.load(html);

    // Récupérer le(s) bloc(s) ld+json Product. Si plusieurs, préférer celui dont
    // le sku == variant de l'URL ; sinon le premier.
    const variantMatch = url.match(/[?&]variant=(\d+)/);
    const variantId = variantMatch ? variantMatch[1] : null;
    const products: any[] = [];
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const parsed = JSON.parse($(el).html() || '');
        const items = Array.isArray(parsed) ? parsed : [parsed];
        for (const it of items) if (it && it['@type'] === 'Product') products.push(it);
      } catch {
        /* bloc suivant */
      }
    });
    if (products.length === 0) {
      console.warn(`[product-price][nocibe] ld+json Product introuvable ${url}`);
      return null;
    }
    const ld =
      (variantId && products.find((p) => String(p.sku) === variantId)) || products[0];

    const offer = Array.isArray(ld.offers) ? ld.offers[0] : ld.offers;
    const currentPrice = parseFloat(offer?.price);
    if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
      console.warn(`[product-price][nocibe] prix ld+json invalide ${url}`);
      return null;
    }

    const strike = parseFloat(offer?.priceSpecification?.price);
    const originalPrice = Number.isFinite(strike) && strike > currentPrice ? strike : currentPrice;

    const brand =
      (typeof ld.brand === 'object' ? ld.brand?.name : ld.brand) || undefined;
    // ld.name est souvent la contenance ("100 ml") ; sinon fallback sur le H1.
    const volume =
      parseVolumeString(ld.name) ??
      parseVolumeString($('[data-testid="price-base-unit"] span[aria-label]').first().attr('aria-label')) ??
      parseVolumeString($('h1').first().text());

    let imageUrl: string | undefined;
    const img = Array.isArray(ld.image) ? ld.image[0] : ld.image;
    if (typeof img === 'string' && !isJunkImage(img)) imageUrl = toAbsolute(img, 'https://www.nocibe.fr');

    // Toutes les contenances via __INITIAL_DATA_CACHE__ (fail soft).
    const { variants, promoCode } = extractNocibeVariants(html);

    return { brand: brand?.trim(), currentPrice, originalPrice, volume, imageUrl, variants, promoCode };
  } catch (err) {
    console.warn(`[product-price][nocibe] parsing ${url}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

// ─── SEPHORA ─────────────────────────────────────────────────────────────────

/**
 * Fiche produit Sephora (UA MOBILE obligatoire — Akamai). VÉRIFIÉ sur 1 fiche.
 *
 * La fiche 2026 est une app Next.js (RSC) : plus de `data-tcproduct` ni de
 * ld+json Product. Signaux microdata exploités :
 *  - L'élément racine `[itemtype*=Product][data-product-sku]` porte le sku de la
 *    variante SÉLECTIONNÉE (data-product-sku).
 *  - Chaque variante expose un `[itemtype*=Offer]` avec `[itemprop=sku]` +
 *    `[itemprop=price]` (contenu). On prend le prix de l'offre au sku sélectionné.
 *  - Contenance : le libellé de taille affiché (ex: "100 ml").
 *  - Marque : `[itemprop=brand]` ; image : og:image.
 *
 * ⚠️ Si data-tcproduct réapparaît (ancien markup), on le lit en priorité :
 * product_price_ati / product_old_price_ati / product_sku_name.
 *
 * TOUTES LES CONTENANCES (VÉRIFIÉ LIVE 2026-07) : chaque `[itemtype*=Offer]`
 * porte AUSSI un `[itemprop=name]` dont le content se termine par la taille
 * (ex: "COCO MADEMOISELLE - Eau De Parfum Vaporisateur - 100 ml"). Les
 * coffrets multi-flacons ("3x20ml") sont écartés. Le prix barré par taille
 * vient du payload Next.js Flight embarqué (objets échappés
 * `{\"id\":\"<sku>\",...,\"price\":72.75,\"priceBeforeDiscount\":97,...}`).
 */

/** Dernière contenance mentionnée dans une chaîne (ex: "... - 100 ml" -> "100ml"). */
function parseLastVolume(text: string | null | undefined): string | undefined {
  if (!text) return undefined;
  const matches = [...text.matchAll(/(\d+(?:[.,]\d+)?)\s*(ml|mL|ML|cl|l|L|g|gr|G)\b/g)];
  if (!matches.length) return undefined;
  const m = matches[matches.length - 1];
  return m[1].replace(',', '.') + m[2].toLowerCase();
}

/**
 * Prix barré d'un sku Sephora depuis le payload Flight (JSON échappé dans les
 * <script>). Cherche l'objet `\"id\":\"<sku>\"` puis `priceBeforeDiscount`
 * AVANT le début de l'objet suivant. undefined si pas de promo / introuvable.
 */
function sephoraPriceBeforeDiscount(html: string, sku: string): number | undefined {
  for (const needle of [`\\"id\\":\\"${sku}\\"`, `"id":"${sku}"`]) {
    const idx = html.indexOf(needle);
    if (idx < 0) continue;
    let window = html.slice(idx + needle.length, idx + needle.length + 2000);
    // Tronquer au prochain objet variante pour ne pas lire son prix.
    const next = window.search(/\\?"id\\?":\\?"/);
    if (next >= 0) window = window.slice(0, next);
    const m = window.match(/\\?"priceBeforeDiscount\\?":\s*([\d.]+)/);
    if (m) {
      const val = parseFloat(m[1]);
      if (Number.isFinite(val) && val > 0) return val;
    }
    return undefined;
  }
  return undefined;
}
export async function fetchSephoraProductPrice(url: string): Promise<PriceFetchResult> {
  const outcome = await fetchHtml(url, { ...MOBILE_HEADERS, Referer: 'https://www.sephora.fr/' });
  if (!outcome.html) return classifyFailure(outcome);
  const html = outcome.html;
  if (looksBlocked(html)) return 'BLOCKED';

  try {
    const $ = cheerio.load(html);

    // 1) Ancien markup data-tcproduct (au cas où) — le plus fiable s'il existe.
    const tcRaw = $('[data-tcproduct]').first().attr('data-tcproduct');
    if (tcRaw) {
      try {
        const d = JSON.parse(tcRaw);
        const currentPrice = parseFloat(d.product_price_ati);
        if (Number.isFinite(currentPrice) && currentPrice > 0) {
          const oldPrice = parseFloat(d.product_old_price_ati);
          return {
            name: (d.product_pid_name || '').trim() || undefined,
            brand: (d.product_brand || d.product_trademark || '').trim() || undefined,
            currentPrice,
            originalPrice: Number.isFinite(oldPrice) && oldPrice > currentPrice ? oldPrice : currentPrice,
            volume: parseVolumeString(d.product_sku_name) ?? parseVolumeString(d.product_pid_name),
            imageUrl: $('meta[property="og:image"]').attr('content') || undefined,
          };
        }
      } catch {
        /* on retombe sur le markup microdata ci-dessous */
      }
    }

    // 2) Markup microdata (fiche Next.js actuelle).
    const productEl = $('[itemtype*="schema.org/Product"][data-product-sku], [itemtype*="Product"][data-product-sku]').first();
    const selectedSku = productEl.attr('data-product-sku') || '';

    // Offres variante -> une entrée par sku (prix + taille dans le name).
    // On récupère au passage le prix de la variante sélectionnée.
    let currentPrice: number | null = null;
    const offerPrices: number[] = [];
    const collected: VariantPrice[] = [];
    let selectedVariant: VariantPrice | undefined;
    $('[itemtype*="Offer"]').each((_, el) => {
      const $o = $(el);
      const sku = $o.find('[itemprop="sku"]').attr('content') || '';
      const price = parseFloat($o.find('[itemprop="price"]').attr('content') || '');
      if (!Number.isFinite(price) || price <= 0) return;
      offerPrices.push(price);
      if (selectedSku && sku === selectedSku) currentPrice = price;

      // Contenance depuis le name de l'offre (dernier "N ml" de la chaîne).
      const offerName = $o.find('[itemprop="name"]').attr('content') || '';
      if (/\d+\s*[x×]\s*\d+\s*ml/i.test(offerName)) return; // coffret multi-flacons
      const vol = parseLastVolume(offerName);
      if (!vol) return;
      const avail = $o.find('[itemprop="availability"]').attr('content') || '';
      if (/OutOfStock/i.test(avail)) return;
      const v: VariantPrice = {
        volume: vol,
        currentPrice: price,
        originalPrice: sku ? sephoraPriceBeforeDiscount(html, sku) : undefined,
        url: $o.find('[itemprop="url"]').attr('content') || undefined,
      };
      collected.push(v);
      if (selectedSku && sku === selectedSku) selectedVariant = v;
    });

    // Fallback : prix affiché en évidence, puis prix le plus bas parmi les offres.
    if (currentPrice == null) {
      const displayed = parseEuro(
        $('[class*="text-mobileTitle"], [class*="text-title"]')
          .filter((_, el) => /€/.test($(el).text()))
          .first()
          .text(),
      );
      currentPrice = displayed ?? (offerPrices.length ? Math.min(...offerPrices) : null);
    }
    if (currentPrice == null) {
      // Page 200 SANS aucun marqueur produit (ni microdata, ni og:title, ni €)
      // = challenge Akamai servi en 200, pas un échec de parsing.
      const hasProductMarkers =
        $('[itemtype*="Product"]').length > 0 ||
        !!$('meta[property="og:title"]').attr('content') ||
        /€/.test($('body').text());
      if (!hasProductMarkers) {
        console.warn(`[product-price][sephora] page challenge (200 sans produit) ${url}`);
        return 'BLOCKED';
      }
      console.warn(`[product-price][sephora] prix introuvable ${url}`);
      return null;
    }

    // Prix barré : élément en line-through près du prix, sinon pas de promo.
    const struck = parseEuro($('[class*="line-through"], del, s, .strikethrough').first().text());
    const originalPrice = struck && struck > currentPrice ? struck : currentPrice;

    // La variante affichée hérite du prix barré du DOM si le Flight ne l'a pas.
    if (selectedVariant && !selectedVariant.originalPrice && struck && struck > selectedVariant.currentPrice) {
      selectedVariant.originalPrice = struck;
    }
    const variants = sanitizeVariants(collected);

    // Contenance : libellé de taille affiché (la variante sélectionnée).
    let volume: string | undefined;
    $('*').each((_, el) => {
      if (volume) return;
      const t = $(el).clone().children().remove().end().text().trim();
      if (t.length < 12) {
        const v = parseVolumeString(t);
        if (v && /^\d+(?:[.,]\d+)?\s*(ml|g|l)$/i.test(t)) volume = v;
      }
    });

    const brand =
      ($('[itemprop="brand"] [itemprop="name"]').first().text().trim() ||
        $('[itemprop="brand"]').first().text().trim() ||
        ($('meta[property="og:title"]').attr('content') || '').split('|').pop()?.replace(/[≡]|SEPHORA/gi, '').trim()) ||
      undefined;

    const ogTitle = $('meta[property="og:title"]').attr('content') || '';
    const name = ogTitle.split('|')[0].trim() || undefined;
    const imageUrl = $('meta[property="og:image"]').attr('content') || undefined;

    return { name, brand, currentPrice, originalPrice, volume, imageUrl, variants };
  } catch (err) {
    console.warn(`[product-price][sephora] parsing ${url}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

// ─── MY-ORIGINES ─────────────────────────────────────────────────────────────

const MY_ORIGINES_ORIGIN = 'https://www.my-origines.com';

/**
 * Contenance d'une offre My-Origines. Le `name` de l'offre encode la taille en
 * FIN de chaîne, SANS unité : "Libre 30" = 30 ml, "Libre 150" = 150 ml.
 * On tente d'abord une unité explicite (au cas où), sinon on prend le DERNIER
 * nombre du name et on l'interprète en millilitres (parfums : 5–200 ml).
 */
function parseMyOriginesVolume(offerName: string | undefined): string | undefined {
  if (!offerName) return undefined;
  const explicit = parseVolumeString(offerName);
  if (explicit) return explicit;
  const nums = offerName.match(/\d+(?:[.,]\d+)?/g);
  if (!nums || !nums.length) return undefined;
  return nums[nums.length - 1].replace(',', '.') + 'ml';
}

/** sku My-Origines depuis l'URL /fr/<slug>-<sku>.html (ex: ...-81413585.html). */
function myOriginesSkuFromUrl(url: string | undefined): string | null {
  if (!url) return null;
  const m = url.match(/-([0-9A-Za-z]+)\.html(?:[?#]|$)/i);
  return m ? m[1] : null;
}

/**
 * Parse une fiche produit My-Origines (Salesforce Commerce). VÉRIFIÉ LIVE 2026-07.
 * Fonction PURE (testable sur fixture HTML) : ne fait pas de réseau.
 *
 * La fiche embarque un `<script type="application/ld+json">` `@type=Product` :
 *  - marque      : brand.name ("Yves St Laurent")
 *  - nom         : name ("Libre")
 *  - image       : image
 *  - contenances : offers (AggregateOffer) → offers[] avec, par taille :
 *      `name` ("Libre 30" → 30 ml), `price`, `priceCurrency`, `availability`,
 *      `url`, `sku`. Le sku de l'URL désigne la variante affichée.
 *
 * ⚠️ Pas de prix barré exploitable dans le ld+json (le dataLayer expose un
 * `discountfree_tax` au sens ambigu → volontairement NON capté pour ne pas
 * fabriquer de fausse promo). originalPrice = prix de vente.
 *
 * @returns ProductPrice si trouvé, null si pas de ld+json Product / prix invalide.
 */
export function parseMyOriginesProduct(html: string, url?: string): ProductPrice | null {
  const $ = cheerio.load(html);
  const products: any[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    let parsed: unknown;
    try { parsed = JSON.parse($(el).html() || ''); } catch { return; }
    for (const it of Array.isArray(parsed) ? parsed : [parsed]) {
      const types = ([] as unknown[]).concat((it as any)?.['@type'] ?? []);
      if (it && types.includes('Product')) products.push(it);
    }
  });
  if (products.length === 0) return null;
  const ld = products[0];

  const brand = (typeof ld.brand === 'object' ? ld.brand?.name : ld.brand)?.toString().trim() || undefined;
  const name = typeof ld.name === 'string' ? ld.name.trim() : undefined;
  let imageUrl: string | undefined;
  const img = Array.isArray(ld.image) ? ld.image[0] : ld.image;
  if (typeof img === 'string' && !isJunkImage(img)) imageUrl = toAbsolute(img, MY_ORIGINES_ORIGIN);

  // Liste des offres : AggregateOffer.offers[] (cas normal) ou offers direct.
  const agg = ld.offers && !Array.isArray(ld.offers) ? ld.offers : undefined;
  const offerArr: any[] = Array.isArray(agg?.offers)
    ? agg.offers
    : Array.isArray(ld.offers)
      ? ld.offers
      : agg
        ? [agg]
        : [];

  const collected: VariantPrice[] = [];
  for (const o of offerArr) {
    if (o?.availability && /OutOfStock/i.test(String(o.availability))) continue;
    const priceNum = typeof o?.price === 'number' ? o.price : parseFloat(o?.price);
    if (!Number.isFinite(priceNum) || priceNum <= 0) continue;
    const vol = parseMyOriginesVolume(o?.name);
    if (!vol) continue;
    collected.push({
      volume: vol,
      currentPrice: priceNum,
      url: typeof o?.url === 'string' ? toAbsolute(o.url, MY_ORIGINES_ORIGIN) : undefined,
    });
  }
  const variants = sanitizeVariants(collected);

  // Variante affichée = celle dont le sku est dans l'URL ; sinon repli sur la
  // 1re variante valide, sinon lowPrice de l'AggregateOffer.
  const sku = myOriginesSkuFromUrl(url);
  const selected = sku ? offerArr.find((o) => String(o?.sku) === sku) : undefined;
  let currentPrice = selected
    ? typeof selected.price === 'number' ? selected.price : parseFloat(selected.price)
    : NaN;
  let volume = selected ? parseMyOriginesVolume(selected.name) : undefined;
  if (!(Number.isFinite(currentPrice) && currentPrice > 0)) {
    if (variants && variants.length) {
      currentPrice = variants[0].currentPrice;
      volume = variants[0].volume;
    } else {
      const lp = parseFloat(agg?.lowPrice);
      if (Number.isFinite(lp) && lp > 0) currentPrice = lp;
    }
  }
  if (!(Number.isFinite(currentPrice) && currentPrice > 0)) return null;

  return { name, brand, currentPrice, originalPrice: currentPrice, volume, imageUrl, variants };
}

/**
 * Fiche produit My-Origines (ex-Origines Parfums). Pas de WAF (VÉRIFIÉ 2026-07 :
 * 200 sur n'importe quel UA) → pas de blocage attendu. UA mobile par cohérence.
 */
export async function fetchMyOriginesProductPrice(url: string): Promise<PriceFetchResult> {
  const outcome = await fetchHtml(url, { ...MOBILE_HEADERS, Referer: 'https://www.my-origines.com/' });
  if (!outcome.html) return classifyFailure(outcome);
  const html = outcome.html;
  if (looksBlocked(html)) return 'BLOCKED';
  try {
    const result = parseMyOriginesProduct(html, url);
    if (!result) console.warn(`[product-price][my-origines] extraction échouée ${url}`);
    return result;
  } catch (err) {
    console.warn(`[product-price][my-origines] parsing ${url}:`, err instanceof Error ? err.message : err);
    return null;
  }
}
