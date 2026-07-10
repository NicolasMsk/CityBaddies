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

export interface ProductPrice {
  name?: string;
  brand?: string;
  currentPrice: number;
  originalPrice?: number;
  volume?: string;
  imageUrl?: string;
  promoCode?: string;
  priceConditions?: string;
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

    return { name, brand, currentPrice, originalPrice, volume, imageUrl: imageUrl || undefined };
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
 */
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

    return { brand: brand?.trim(), currentPrice, originalPrice, volume, imageUrl };
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
 */
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

    // Offres variante -> map sku:price. On récupère le prix de la variante sélectionnée.
    let currentPrice: number | null = null;
    const offerPrices: number[] = [];
    $('[itemtype*="Offer"]').each((_, el) => {
      const $o = $(el);
      const sku = $o.find('[itemprop="sku"]').attr('content') || '';
      const price = parseFloat($o.find('[itemprop="price"]').attr('content') || '');
      if (!Number.isFinite(price) || price <= 0) return;
      offerPrices.push(price);
      if (selectedSku && sku === selectedSku) currentPrice = price;
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

    return { name, brand, currentPrice, originalPrice, volume, imageUrl };
  } catch (err) {
    console.warn(`[product-price][sephora] parsing ${url}:`, err instanceof Error ? err.message : err);
    return null;
  }
}
