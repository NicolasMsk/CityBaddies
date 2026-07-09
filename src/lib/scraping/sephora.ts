/**
 * =============================================================================
 * SEPHORA.TS - SCRAPING EN MASSE DES PAGES CATÉGORIES
 * =============================================================================
 *
 * FONCTION : Parcourir les pages catégories Sephora pour récupérer TOUS les
 *            produits (et détecter ceux en promotion) en masse.
 *
 * UTILISÉ PAR : import-sephora.ts, ImportEngine.ts
 *
 * TECHNOLOGIE : Cheerio + fetch (HTML statique). Sephora rend le HTML côté
 *               serveur : chaque tuile produit expose un attribut
 *               `data-tcproduct="{...JSON...}"` que l'on peut parser
 *               directement, sans JavaScript ni navigateur.
 *
 * NE PAS CONFONDRE AVEC : sephora-search.ts (recherche d'UN produit spécifique)
 * =============================================================================
 */
import * as cheerio from 'cheerio';
import { Scraper, ScrapedProduct, ScrapingResult } from './types';

export interface SephoraProduct {
  name: string;
  brand: string;
  currentPrice: number;
  originalPrice: number;
  discountPercent: number;
  productUrl: string;
  imageUrl: string;
  category: string;
  volume?: string;
  sku?: string;
}

export interface SephoraScrapingResult {
  success: boolean;
  products: SephoraProduct[];
  errors: string[];
  duration: number;
}

export interface SephoraConfig {
  headless: boolean;
  timeout: number;
  delayBetweenRequests: number;
}

const DEFAULT_CONFIG: SephoraConfig = {
  headless: true,
  timeout: 15000,
  delayBetweenRequests: 500,
};

// IMPORTANT: Sephora (Akamai) bloque les User-Agents desktop (403 "Access
// Denied"), y compris un vrai Chrome headed. Un User-Agent MOBILE passe (HTTP
// 200) avec la page complète via un simple fetch(). NE PAS repasser en UA desktop.
//
// Akamai fait aussi du rate-limiting / réputation IP : une rafale de requêtes
// depuis une même IP finit flaggée (403) même en UA mobile. On reste donc
// "poli" : pool d'UA mobiles, cookies persistants sur toute la session (le 1er
// GET pose des cookies Akamai qu'on renvoie ensuite = plus crédible), espacement
// minimum entre requêtes, et backoff sur 403/429.
const MOBILE_USER_AGENTS = [
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (Linux; Android 13; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
];

// Espacement minimum entre 2 requêtes Sephora (ms) — anti rate-limit Akamai.
const MIN_REQUEST_SPACING_MS = 8000;

// État de session partagé entre les appels scrape() successifs d'un même run.
let sessionCookie = '';
let lastRequestAt = 0;
let sessionUserAgent = '';

function pickUserAgent(): string {
  if (!sessionUserAgent) {
    // UA stable pour toute la session (cohérent avec les cookies posés).
    const idx = Math.floor((lastRequestAt || 1) % MOBILE_USER_AGENTS.length);
    sessionUserAgent = MOBILE_USER_AGENTS[idx] || MOBILE_USER_AGENTS[0];
  }
  return sessionUserAgent;
}

function buildHeaders(referer: string): Record<string, string> {
  const h: Record<string, string> = {
    'User-Agent': pickUserAgent(),
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'fr-FR,fr;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': referer ? 'same-origin' : 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
  };
  if (referer) h['Referer'] = referer;
  if (sessionCookie) h['Cookie'] = sessionCookie;
  return h;
}

function rememberCookies(res: Response): void {
  // Concatène les cookies Akamai posés (_abck, bm_sz, ak_bmsc...) pour la suite.
  const setCookie = (res.headers as any).getSetCookie?.() as string[] | undefined;
  const raw = setCookie && setCookie.length ? setCookie : (res.headers.get('set-cookie') ? [res.headers.get('set-cookie')!] : []);
  if (!raw.length) return;
  const jar = new Map<string, string>();
  if (sessionCookie) {
    for (const pair of sessionCookie.split('; ')) {
      const eq = pair.indexOf('=');
      if (eq > 0) jar.set(pair.slice(0, eq), pair.slice(eq + 1));
    }
  }
  for (const c of raw) {
    const first = c.split(';')[0];
    const eq = first.indexOf('=');
    if (eq > 0) jar.set(first.slice(0, eq).trim(), first.slice(eq + 1).trim());
  }
  sessionCookie = [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
}

export class SephoraScraper implements Scraper {
  private config: SephoraConfig;

  /** Identifiant du scraper pour l'ImportEngine */
  readonly merchantSlug = 'sephora';

  constructor(config: Partial<SephoraConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async init(): Promise<void> {
    // Plus besoin d'initialiser un navigateur (fetch + cheerio)
  }

  async close(): Promise<void> {
    // Plus rien à fermer
  }

  /**
   * Méthode standard de l'interface Scraper
   * Convertit SephoraProduct[] en ScrapedProduct[] standardisés
   */
  async scrape(url: string, maxProducts: number = 100): Promise<ScrapingResult> {
    const result = await this.scrapeCategoryPage(url, maxProducts);

    // Convertir SephoraProduct -> ScrapedProduct
    const standardProducts: ScrapedProduct[] = result.products.map(p => ({
      name: p.name,
      brand: p.brand,
      productUrl: p.productUrl,
      sku: p.sku,
      currentPrice: p.currentPrice,
      originalPrice: p.originalPrice,
      discountPercent: p.discountPercent,
      imageUrl: p.imageUrl,
      volume: p.volume,
      category: p.category,
      sourceUrl: url, // URL de la page de catégorie source (pour debug)
    }));

    return {
      success: result.success,
      products: standardProducts,
      errors: result.errors,
      duration: result.duration,
    };
  }

  // Mapper les catégories Sephora vers nos catégories
  private mapCategory(sephoraCategory: string): string {
    const categoryMap: Record<string, string> = {
      'c301': 'parfums',
      'c302': 'maquillage',
      'c303': 'soins-visage',
      'c304': 'soins-corps',
      'c307': 'cheveux',
      'c305': 'ongles',
    };
    return categoryMap[sephoraCategory.toLowerCase()] || 'maquillage';
  }

  private getCategoryFromUrl(url: string): string {
    const match = url.match(/-(c\d{3})\b/i);
    if (match) return this.mapCategory(match[1]);
    if (url.includes('parfum')) return 'parfums';
    if (url.includes('maquillage')) return 'maquillage';
    if (url.includes('soin-visage')) return 'soins-visage';
    if (url.includes('corps')) return 'soins-corps';
    if (url.includes('cheveux')) return 'cheveux';
    return 'maquillage';
  }

  // Scraper une page catégorie Sephora (HTML statique via fetch + cheerio)
  async scrapeCategoryPage(categoryUrl: string, maxProducts: number = 100): Promise<SephoraScrapingResult> {
    const startTime = Date.now();
    const products: SephoraProduct[] = [];
    const errors: string[] = [];
    const category = this.getCategoryFromUrl(categoryUrl);

    // Le HTML mobile expose ~24 produits par défaut. On demande davantage en une
    // seule requête via le paramètre `sz` (taille de page Demandware), confirmé
    // fonctionnel : `?sz=48` renvoie 48 produits. On plafonne à 96 pour rester
    // léger. Pas de scroll/pagination multi-requêtes nécessaire.
    const size = Math.min(Math.max(maxProducts, 24), 96);
    const sep = categoryUrl.includes('?') ? '&' : '?';
    const pageUrl = `${categoryUrl}${sep}sz=${size}`;

    // Jusqu'à 3 tentatives avec backoff en cas de 403/429 (rate-limit Akamai).
    for (let attempt = 1; attempt <= 3; attempt++) {
      await this.throttle();

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.config.timeout);
      try {
        console.log(`[Sephora] GET (essai ${attempt}/3): ${pageUrl}`);
        const response = await fetch(pageUrl, {
          headers: buildHeaders('https://www.sephora.fr/'),
          signal: controller.signal,
        });
        clearTimeout(timeout);
        rememberCookies(response);

        if (response.status === 403 || response.status === 429) {
          const wait = attempt * 15000; // 15s, 30s
          console.warn(`[Sephora] ${response.status} (rate-limit Akamai), attente ${wait / 1000}s...`);
          if (attempt < 3) { await this.delay(wait); continue; }
          errors.push(`HTTP ${response.status} après 3 essais pour ${pageUrl}`);
          break;
        }
        if (!response.ok) {
          errors.push(`HTTP ${response.status} pour ${pageUrl}`);
          break;
        }

        const html = await response.text();
        const pageProducts = this.extractProductsFromHtml(html, category);
        for (const p of pageProducts) {
          if (!products.find(existing => existing.productUrl === p.productUrl)) products.push(p);
          if (products.length >= maxProducts) break;
        }
        console.log(`[Sephora] ${products.length} produits valides trouvés`);
        break;
      } catch (err) {
        clearTimeout(timeout);
        const error = err instanceof Error ? err.message : 'Unknown';
        if (err instanceof Error && err.name === 'AbortError') {
          errors.push(`Timeout pour ${pageUrl}`);
          if (attempt < 3) { await this.delay(attempt * 5000); continue; }
        } else {
          errors.push('Erreur scraping catégorie: ' + error);
        }
        break;
      }
    }

    return { success: products.length > 0, products, errors, duration: Date.now() - startTime };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /** Impose un espacement minimum entre 2 requêtes Sephora (anti rate-limit). */
  private async throttle(): Promise<void> {
    const since = Date.now() - lastRequestAt;
    if (lastRequestAt && since < MIN_REQUEST_SPACING_MS) {
      await this.delay(MIN_REQUEST_SPACING_MS - since);
    }
    lastRequestAt = Date.now();
  }

  // Extraire les produits depuis les tuiles data-tcproduct du HTML statique
  private extractProductsFromHtml(html: string, category: string): SephoraProduct[] {
    const $ = cheerio.load(html);
    const products: SephoraProduct[] = [];

    $('.product-tile[data-tcproduct]').each((_, tile) => {
      try {
        const $tile = $(tile);
        const raw = $tile.attr('data-tcproduct');
        if (!raw) return;

        // Cheerio décode déjà les entités HTML (&quot; -> ", &eacute; -> é...),
        // donc l'attribut est du JSON directement parsable.
        const data = JSON.parse(raw);

        const name = (data.product_pid_name || '').trim();
        const brand = (data.product_brand || data.product_trademark || '').trim();
        const productUrl = data.product_url_page || '';

        const currentPrice = parseFloat(data.product_price_ati) || 0;
        const originalPrice = parseFloat(data.product_old_price_ati) || currentPrice;

        // Réduction calculée à partir des prix (product_discount_ati seul n'est
        // pas fiable).
        const discountPercent = originalPrice > currentPrice
          ? Math.round((1 - currentPrice / originalPrice) * 100)
          : 0;

        // Image : product_url_picture est souvent vide -> fallback sur la tuile.
        let imageUrl = (data.product_url_picture || '').trim();
        if (!imageUrl) {
          const $img = $tile.find('.product-first-img').first();
          imageUrl = $img.attr('src') || $img.attr('data-src') || '';
          if (!imageUrl) {
            const srcset = $img.attr('srcset') || '';
            if (srcset) imageUrl = srcset.split(',')[0].trim().split(/\s+/)[0];
          }
        }
        // Normaliser les URLs protocol-relative (//host/...)
        if (imageUrl.startsWith('//')) imageUrl = 'https:' + imageUrl;

        // Volume : extraire depuis product_sku_name, sinon product_pid_name.
        const volumeRegex = /(\d+(?:[.,]\d+)?)\s*(ml|g|l|cl)\b/i;
        let volume: string | undefined;
        const volSource = (data.product_sku_name || '') + ' ' + (data.product_pid_name || '');
        const volMatch = volSource.match(volumeRegex);
        if (volMatch) {
          volume = volMatch[1].replace(',', '.') + volMatch[2].toLowerCase();
        }

        const sku = data.product_sku || data.product_pid || '';

        if (name && currentPrice > 0 && productUrl) {
          products.push({
            name,
            brand,
            currentPrice,
            originalPrice,
            discountPercent,
            productUrl,
            imageUrl,
            category,
            volume,
            sku,
          });
        }
      } catch {
        // Ignorer les tuiles dont le JSON ne parse pas
      }
    });

    return products;
  }
}
