/**
 * =============================================================================
 * NOTINO.TS — LECTEUR DE PRIX NOTINO VIA NAVIGATEUR HEADLESS (Cloudflare)
 * =============================================================================
 *
 * Notino est protégé par Cloudflare : un simple fetch renvoie 403 (quel que soit
 * l'UA). Un Chromium headless, lui, passe le challenge sur les fiches produit
 * (VÉRIFIÉ LIVE depuis une IP datacenter : fiche = 200, home = 403).
 *
 * Playwright est importé DYNAMIQUEMENT : ce module n'est chargé que par le script
 * track-prices.ts (jamais par l'app Next), donc le bundle Next n'embarque jamais
 * Playwright. Le navigateur est un singleton (lancé au 1er appel, réutilisé) —
 * penser à appeler closeNotinoBrowser() en fin de run pour libérer le process.
 *
 * L'extraction elle-même est déléguée au parser PUR parseNotinoProduct
 * (product-price.ts) : on ne fait ici que charger la page et récupérer le
 * JSON-LD Product du DOM rendu.
 * =============================================================================
 */
import { parseNotinoProduct, type PriceFetchResult } from './product-price';

// Types minimaux (Playwright importé dynamiquement — pas d'import de types au top-level).
type Browser = { newContext: (o: unknown) => Promise<BrowserContext>; close: () => Promise<void> };
type BrowserContext = { newPage: () => Promise<Page> };
type Page = {
  goto: (url: string, o: unknown) => Promise<{ status: () => number } | null>;
  title: () => Promise<string>;
  content: () => Promise<string>;
  evaluate: <T>(fn: () => T) => Promise<T>;
  close: () => Promise<void>;
};

const NOTINO_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

let browserPromise: Promise<Browser> | null = null;
let context: BrowserContext | null = null;

async function ensureContext(): Promise<BrowserContext> {
  if (context) return context;
  if (!browserPromise) {
    // Import dynamique de playwright-extra + plugin STEALTH : masque les signaux
    // d'automatisation (navigator.webdriver, etc.) que Cloudflare détecte → le
    // Chromium headless passe le challenge même depuis une IP datacenter
    // (VÉRIFIÉ : 4/4 pages Notino sans stealth = bloquées, avec = 200).
    // playwright-extra s'appuie sur playwright-core (déjà en deps, pas de
    // postinstall → build Railway non impacté ; Chromium installé en CI).
    browserPromise = (async () => {
      const { chromium } = await import('playwright-extra');
      const stealth = (await import('puppeteer-extra-plugin-stealth')).default;
      chromium.use(stealth());
      return chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-blink-features=AutomationControlled'],
      }) as unknown as Browser;
    })();
  }
  const browser = await browserPromise;
  context = await browser.newContext({
    userAgent: NOTINO_UA,
    locale: 'fr-FR',
    viewport: { width: 1366, height: 900 },
    extraHTTPHeaders: { 'Accept-Language': 'fr-FR,fr;q=0.9' },
  });
  return context;
}

/** Ferme le navigateur singleton (à appeler en fin de run). */
export async function closeNotinoBrowser(): Promise<void> {
  try {
    if (browserPromise) {
      const b = await browserPromise;
      await b.close();
    }
  } catch {
    /* déjà fermé */
  } finally {
    browserPromise = null;
    context = null;
  }
}

/**
 * Rend une page Notino via navigateur headless et retourne son HTML complet
 * (DOM rendu), ou un marqueur d'échec. Utilisé par le résolveur (découverte +
 * vérification gtin). 'BLOCKED' = challenge Cloudflare.
 */
export async function renderNotinoHtml(url: string): Promise<string | 'BLOCKED' | 'NOT_FOUND' | null> {
  let page: Page | null = null;
  try {
    const ctx = await ensureContext();
    page = await ctx.newPage();
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 35000 });
    const status = resp?.status() ?? 0;
    const title = await page.title();
    if (status === 403 || status === 429 || /just a moment|attention required|checking your browser/i.test(title)) return 'BLOCKED';
    if (status === 404 || status === 410) return 'NOT_FOUND';
    return await page.content();
  } catch (err) {
    console.warn(`[notino] render ${url}:`, err instanceof Error ? err.message : err);
    return null;
  } finally {
    if (page) await page.close().catch(() => {});
  }
}

/** Récupère le JSON-LD Product d'une fiche Notino via navigateur headless. */
export async function fetchNotinoProductPrice(url: string): Promise<PriceFetchResult> {
  let page: Page | null = null;
  try {
    const ctx = await ensureContext();
    page = await ctx.newPage();
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 35000 });
    const status = resp?.status() ?? 0;

    // Challenge Cloudflare (souvent 403 + "Just a moment").
    const title = await page.title();
    if (status === 403 || status === 429 || /just a moment|attention required|checking your browser/i.test(title)) {
      return 'BLOCKED';
    }
    if (status === 404 || status === 410) return 'NOT_FOUND';

    const ld = await page.evaluate<unknown>(() => {
      let p: unknown = null;
      document.querySelectorAll('script[type="application/ld+json"]').forEach((s) => {
        try {
          const d = JSON.parse(s.textContent || '');
          for (const o of Array.isArray(d) ? d : [d]) {
            const t = ([] as unknown[]).concat((o as { ['@type']?: unknown })?.['@type'] ?? []);
            if (t.includes('Product')) p = o;
          }
        } catch {
          /* bloc suivant */
        }
      });
      return p;
    });

    if (!ld) {
      // 200 sans Product → soit challenge servi en 200, soit page inattendue.
      const html = await page.content();
      if (/just a moment|cf-browser-verification|cf_chl/i.test(html)) return 'BLOCKED';
      console.warn(`[notino] JSON-LD Product introuvable ${url}`);
      return null;
    }

    const result = parseNotinoProduct(ld);
    if (!result) console.warn(`[notino] extraction échouée ${url}`);
    return result;
  } catch (err) {
    console.warn(`[notino] erreur ${url}:`, err instanceof Error ? err.message : err);
    return null;
  } finally {
    if (page) await page.close().catch(() => {});
  }
}
