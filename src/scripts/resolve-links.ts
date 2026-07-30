/**
 * =============================================================================
 * RESOLVE-LINKS.TS — RÉSOLVEUR DE LIENS MARCHANDS PAR PONT EAN
 * =============================================================================
 *
 * OBJET : combler les liens marchands MANQUANTS dans ScrapingQueue pour les
 * parfums curés, en utilisant le code-barres EAN comme clé de correspondance
 * INFAILLIBLE (jamais un flanker/produit voisin — on n'écrit QUE si l'EAN du
 * produit distant est STRICTEMENT égal à l'EAN interrogé).
 *
 * Chaque parfum (productName) doit idéalement avoir 3 fiches vérifiées
 * (nocibe + sephora + marionnaud) pour la comparaison multi-marchands. Certains
 * n'en ont que 1-2. Ce script comble le trou :
 *
 *   --target marionnaud (défaut) : parfums SANS marionnaud mais AVEC nocibe.
 *     1. EAN(s) du parfum : d'abord depuis ProductVariant.ean (aucun fetch),
 *        sinon on lit la fiche Nocibé (UA mobile, throttle) et on extrait les
 *        EAN-13 (/\b3\d{12}\b/).
 *     2. Pour chaque EAN : recherche Marionnaud PAR EAN (retourne 1 produit),
 *        puis fiche détail → on VÉRIFIE que detail.ean === EAN interrogé ET que
 *        la marque concorde. Si OK → lien Marionnaud résolu.
 *     3. Upsert ScrapingQueue [productName, 'marionnaud'] (verified, method
 *        'ean-bridge', status 'pending'). JAMAIS de match incertain.
 *
 *   --target nocibe (best-effort) : parfums SANS nocibe mais AVEC marionnaud.
 *     EAN depuis ProductVariant.ean sinon fiche détail Marionnaud, puis
 *     recherche Nocibé par EAN → on ouvre la 1re fiche /fr/p/ et on VÉRIFIE que
 *     l'EAN y figure avant d'écrire. Akamai peut bloquer (403) : dans ce cas on
 *     ne écrit rien et on le signale.
 *
 * Sephora : aucun EAN exploitable → NON traité (on laisse le trou).
 *
 * Usage :
 *   npx tsx src/scripts/resolve-links.ts [--target marionnaud|nocibe] [--limit N] [--dry-run]
 *
 * Exit : 0 toujours (sauf erreur fatale) — c'est un utilitaire de comblement.
 * =============================================================================
 */
import 'dotenv/config';
import prisma from '../lib/prisma';

type MerchantSlug = 'marionnaud' | 'nocibe' | 'sephora' | 'my-origines';
const ALL_MERCHANTS: MerchantSlug[] = ['marionnaud', 'nocibe', 'sephora', 'my-origines'];

// UA desktop pour l'API Marionnaud (pas d'Akamai — fonctionne depuis toute IP).
const DESKTOP_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';
const MARIONNAUD_HEADERS = { 'User-Agent': DESKTOP_UA, Accept: 'application/json' };

// UA mobile iOS — obligatoire pour Nocibé (Akamai bloque le desktop en 403).
const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1';
const NOCIBE_HEADERS = {
  'User-Agent': MOBILE_UA,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'fr-FR,fr;q=0.9',
};

const NOCIBE_THROTTLE_MS = 8000; // Akamai rate-limite → espacer les fiches Nocibé.
const MARIONNAUD_THROTTLE_MS = 700; // API polie mais on reste correct.
const MY_ORIGINES_THROTTLE_MS = 800; // Pas de WAF observé — poli.
const FETCH_TIMEOUT_MS = 20000;

// My-Origines : la recherche est rendue en JS ; l'endpoint SFCC Search-UpdateGrid
// renvoie la grille de résultats en HTML. Les EAN ne sont PAS indexés par la
// recherche mais figurent sur la fiche produit (dataLayer) → on cherche par
// texte (marque+nom) puis on VÉRIFIE l'EAN sur chaque fiche candidate.
const MY_ORIGINES_HEADERS = {
  'User-Agent': MOBILE_UA,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'fr-FR,fr;q=0.9',
};
const MY_ORIGINES_SEARCH = 'https://www.my-origines.com/on/demandware.store/Sites-MyOrigines_FR-Site/fr_FR/Search-UpdateGrid';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Slug canonique = slug du productName (identique aux 3 marchands). Copie de track-prices. */
function canonicalSlug(productName: string): string {
  return productName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 80)
    .replace(/-$/, '');
}

/** Normalise pour comparaison de marque : minuscules, sans accents, alnum only. */
function normToken(s: string | null | undefined): string {
  if (!s) return '';
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

// Mots génériques (type/contenant) qui ne distinguent pas un parfum d'un autre.
const GENERIC_WORDS = new Set([
  'eau', 'de', 'du', 'des', 'la', 'le', 'les', 'parfum', 'toilette', 'cologne', 'edp', 'edt',
  'intense', 'extrait', 'vaporisateur', 'spray', 'pour', 'femme', 'homme', 'the', 'and', 'et',
  'rechargeable', 'recharge',
]);

/**
 * Jetons DISTINCTIFS d'un nom de parfum : tokens normalisés qui ne sont ni
 * génériques (eau/parfum/…) ni un morceau de la marque. Sert à confirmer que le
 * produit distant est bien la MÊME LIGNE (ex: "Trésor" ≠ "La Vie Est Belle"),
 * pas seulement la même marque.
 */
function distinctiveTokens(productName: string, brandNorm: string): string[] {
  const out: string[] = [];
  for (const raw of productName.split(/\s+/)) {
    const t = normToken(raw);
    if (t.length < 2) continue;
    if (GENERIC_WORDS.has(t)) continue;
    if (brandNorm && brandNorm.includes(t)) continue; // morceau de la marque
    out.push(t);
  }
  return [...new Set(out)];
}

/** fetch avec timeout — jamais de throw, retourne { status, text }. */
async function safeFetch(
  url: string,
  headers: Record<string, string>,
): Promise<{ status: number; text: string | null }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    if (!res.ok) return { status: res.status, text: null };
    return { status: res.status, text: await res.text() };
  } catch (err) {
    const msg = err instanceof Error ? (err.name === 'AbortError' ? 'timeout' : err.message) : String(err);
    console.warn(`[resolve] fetch échec ${url}: ${msg}`);
    return { status: 0, text: null };
  } finally {
    clearTimeout(timeout);
  }
}

// ─── MARIONNAUD (API) ─────────────────────────────────────────────────────────

interface MarionnaudMatch {
  ean: string;
  name: string;
  brand: string;
  productUrl: string; // URL publique complète (sans query)
  searchUrl: string; // URL de la recherche par EAN (provenance)
}

/**
 * Résout un parfum chez Marionnaud à partir d'un EAN.
 * Recherche par EAN (1 résultat), fiche détail, puis VÉRIFICATION stricte :
 *   detail.ean === ean  ET  la marque concorde avec le productName.
 * Retourne null si aucun match sûr.
 */
async function resolveMarionnaudByEan(ean: string, productName: string): Promise<MarionnaudMatch | null> {
  const searchUrl = `https://api.marionnaud.fr/api/v2/mfr/products/search?query=${encodeURIComponent(ean)}&fields=FULL&pageSize=10&lang=fr_FR&curr=EUR`;
  const s = await safeFetch(searchUrl, MARIONNAUD_HEADERS);
  if (!s.text) return null;
  let products: any[];
  try {
    products = JSON.parse(s.text).products ?? [];
  } catch {
    return null;
  }
  if (products.length === 0) return null;

  const nameNorm = normToken(productName);

  // Vérifier chaque produit retourné (normalement 1 seul pour une recherche EAN).
  for (const p of products) {
    if (!p?.code) continue;
    await delay(MARIONNAUD_THROTTLE_MS);
    const detailUrl = `https://api.marionnaud.fr/api/v2/mfr/products/${p.code}?fields=FULL,couponCodeValue&lang=fr_FR&curr=EUR`;
    const d = await safeFetch(detailUrl, MARIONNAUD_HEADERS);
    if (!d.text) continue;
    let detail: any;
    try {
      detail = JSON.parse(d.text);
    } catch {
      continue;
    }

    // 1) EAN STRICTEMENT égal (clé infaillible).
    if (String(detail.ean) !== ean) continue;

    // 2) Concordance de marque (garde-fou contre un EAN erroné en base).
    const brand: string = detail.masterBrand?.name || detail.rangeName || '';
    const brandNorm = normToken(brand);
    // Le slug d'URL Marionnaud porte marque + ligne produit ; c'est le foin le plus fiable.
    const haystack = normToken(`${detail.name || ''} ${detail.rangeName || ''} ${detail.url || ''}`);
    const firstBrandWord = normToken(productName.split(/\s+/)[0] || '');
    const brandOk =
      (brandNorm && (nameNorm.includes(brandNorm) || brandNorm.includes(firstBrandWord))) ||
      (firstBrandWord.length >= 3 && haystack.includes(firstBrandWord));
    if (!brandOk) {
      console.warn(
        `[resolve] ⚠ EAN ${ean} matché chez Marionnaud (${detail.name}) mais marque douteuse "${brand}" vs "${productName}" — ignoré par sécurité`,
      );
      continue;
    }

    // 3) Concordance de LIGNE PRODUIT : au moins un jeton distinctif du nom
    //    (hors marque/génériques) doit figurer côté Marionnaud. Empêche d'écrire
    //    un flanker de la même marque (ex: Trésor résolu vers "La Vie Est Belle").
    const distinct = distinctiveTokens(productName, brandNorm);
    if (distinct.length > 0 && !distinct.some((t) => haystack.includes(t))) {
      console.warn(
        `[resolve] ⚠ EAN ${ean} → Marionnaud "${detail.name}" (${detail.url}) : ligne produit incohérente avec "${productName}" (jetons ${distinct.join(',')}) — ignoré par sécurité`,
      );
      continue;
    }

    const path = String(detail.url || '').split('?')[0];
    if (!path) continue;
    return {
      ean,
      name: detail.name || p.name || '',
      brand,
      productUrl: `https://www.marionnaud.fr${path}`,
      searchUrl,
    };
  }
  return null;
}

/** EAN du parfum chez Marionnaud (pour --target nocibe) : détail via code BP de l'URL. */
async function fetchMarionnaudEanFromUrl(marionnaudUrl: string): Promise<string | null> {
  // L'URL publique se termine par /p/BP_<code> ; le code produit détail est <code>.
  const m = marionnaudUrl.match(/\/p\/BP_(\d+)/);
  if (!m) return null;
  const code = m[1];
  const detailUrl = `https://api.marionnaud.fr/api/v2/mfr/products/${code}?fields=FULL,couponCodeValue&lang=fr_FR&curr=EUR`;
  const d = await safeFetch(detailUrl, MARIONNAUD_HEADERS);
  if (!d.text) return null;
  try {
    const ean = String(JSON.parse(d.text).ean || '');
    return /^\d{8,13}$/.test(ean) ? ean : null;
  } catch {
    return null;
  }
}

// ─── NOCIBÉ ─────────────────────────────────────────────────────────────────

/** Extrait les EAN-13 (préfixe 3) présents dans le HTML brut d'une fiche Nocibé. */
function extractNocibeEans(html: string): string[] {
  const matches = html.match(/\b3\d{12}\b/g) ?? [];
  return [...new Set(matches)];
}

/** Récupère les EAN d'un parfum depuis sa fiche Nocibé (UA mobile). null si bloqué/échec. */
async function fetchNocibeEans(nocibeUrl: string): Promise<string[] | null> {
  const res = await safeFetch(nocibeUrl, { ...NOCIBE_HEADERS, Referer: 'https://www.nocibe.fr/' });
  if (!res.text) return null; // 403 Akamai / réseau
  const eans = extractNocibeEans(res.text);
  return eans;
}

/**
 * Résout un parfum chez Nocibé à partir d'un EAN (best-effort).
 * Recherche par EAN → 1re fiche /fr/p/ → on VÉRIFIE que l'EAN figure sur la fiche.
 * Retourne { productUrl, searchUrl } ou null (bloqué / pas de match sûr).
 */
async function resolveNocibeByEan(
  ean: string,
  productName: string,
): Promise<{ productUrl: string; searchUrl: string } | null> {
  const searchUrl = `https://www.nocibe.fr/fr/search?q=${encodeURIComponent(ean)}`;
  const s = await safeFetch(searchUrl, { ...NOCIBE_HEADERS, Referer: 'https://www.nocibe.fr/' });
  if (!s.text) return null; // bloqué

  // 1er lien fiche produit = résultat de recherche (les suivants = cross-sells).
  const m = s.text.match(/\/fr\/p\/\d+/);
  if (!m) return null;
  const productUrl = `https://www.nocibe.fr${m[0]}`;

  // VÉRIFICATION : ouvrir la fiche et confirmer que l'EAN y figure.
  await delay(NOCIBE_THROTTLE_MS);
  const eans = await fetchNocibeEans(productUrl);
  if (!eans) return null; // bloqué à la vérif → on n'écrit rien
  if (!eans.includes(ean)) {
    console.warn(`[resolve] ⚠ Nocibé ${productUrl} ne contient pas l'EAN ${ean} (${productName}) — ignoré`);
    return null;
  }
  return { productUrl, searchUrl };
}

// ─── MY-ORIGINES (recherche texte + vérif EAN) ────────────────────────────────

/** EAN-13 (préfixe 3) présents dans le HTML brut d'une fiche My-Origines. */
function extractMyOriginesEans(html: string): string[] {
  return [...new Set(html.match(/\b3\d{12}\b/g) ?? [])];
}

/** Liens fiche produit d'une grille de résultats : /fr/<slug>-<sku>.html (sku avec ≥1 chiffre). */
function myOriginesProductLinks(html: string): string[] {
  const raw = html.match(/\/fr\/[a-z0-9-]+-[0-9A-Za-z]*[0-9][0-9A-Za-z]*\.html/gi) ?? [];
  const bad = /\/(delivery|store|find-a-store|declaration|return|marques|offres|bons-plans|search)/i;
  return [...new Set(raw)].filter((u) => !bad.test(u));
}

/**
 * Résout un parfum chez My-Origines à partir de ses EAN connus (best-effort).
 * Recherche par TEXTE (marque + nom) → grille de candidats → on ouvre chaque
 * fiche et on VÉRIFIE qu'un EAN connu y figure (un EAN identifie un produit+taille
 * de façon unique → match infaillible). Retourne null si aucun match sûr.
 */
async function resolveMyOriginesBySearch(
  eans: string[],
  productName: string,
): Promise<{ productUrl: string; searchUrl: string } | null> {
  const eanSet = new Set(eans);
  const searchUrl = `${MY_ORIGINES_SEARCH}?q=${encodeURIComponent(productName)}`;
  const s = await safeFetch(searchUrl, MY_ORIGINES_HEADERS);
  if (!s.text) return null;

  const candidates = myOriginesProductLinks(s.text).slice(0, 8);
  if (candidates.length === 0) return null;

  for (const rel of candidates) {
    await delay(MY_ORIGINES_THROTTLE_MS);
    const url = `https://www.my-origines.com${rel}`;
    const page = await safeFetch(url, MY_ORIGINES_HEADERS);
    if (!page.text) continue;
    const pageEans = extractMyOriginesEans(page.text);
    if (pageEans.some((e) => eanSet.has(e))) {
      return { productUrl: url, searchUrl };
    }
  }
  console.warn(`[resolve] – ${productName} | aucune fiche My-Origines ne porte un EAN connu — non résolu`);
  return null;
}

// ─── CHARGEMENT / EAN SOURCE ──────────────────────────────────────────────────

interface QueueGroup {
  productName: string;
  merchants: Map<MerchantSlug, { productUrl: string }>;
}

/** Parfums vérifiés (status != error) groupés par productName → marchands présents. */
async function loadGroups(): Promise<Map<string, QueueGroup>> {
  const rows = await prisma.scrapingQueue.findMany({
    where: { verified: true, status: { not: 'error' } },
    select: { productName: true, merchantSlug: true, productUrl: true },
  });
  const groups = new Map<string, QueueGroup>();
  for (const r of rows) {
    if (!ALL_MERCHANTS.includes(r.merchantSlug as MerchantSlug)) continue;
    let g = groups.get(r.productName);
    if (!g) {
      g = { productName: r.productName, merchants: new Map() };
      groups.set(r.productName, g);
    }
    g.merchants.set(r.merchantSlug as MerchantSlug, { productUrl: r.productUrl });
  }
  return groups;
}

/** EAN stockés (ProductVariant.ean) du parfum, via son slug canonique. */
async function storedEans(productName: string): Promise<string[]> {
  const product = await prisma.product.findUnique({
    where: { slug: canonicalSlug(productName) },
    select: { variants: { select: { ean: true } } },
  });
  if (!product) return [];
  const eans = product.variants.map((v) => v.ean).filter((e): e is string => !!e && /^\d{8,13}$/.test(e));
  return [...new Set(eans)];
}

// ─── ÉCRITURE ─────────────────────────────────────────────────────────────────

async function upsertQueueLink(
  productName: string,
  merchantSlug: MerchantSlug,
  productUrl: string,
  searchUrl: string,
  method = 'ean-bridge',
): Promise<void> {
  await prisma.scrapingQueue.upsert({
    where: { productName_merchantSlug: { productName, merchantSlug } },
    update: {
      productUrl,
      searchUrl,
      verified: true,
      confidence: 1,
      method,
      status: 'pending',
      retryCount: 0,
      errorMessage: null,
    },
    create: {
      productName,
      merchantSlug,
      productUrl,
      searchUrl,
      verified: true,
      confidence: 1,
      method,
      status: 'pending',
    },
  });
}

// ─── MAIN ──────────────────────────────────────────────────────────────────────

interface Summary {
  processed: number;
  resolved: number;
  unresolved: number;
  errors: number;
}

async function runMarionnaud(groups: Map<string, QueueGroup>, limit: number, dryRun: boolean, summary: Summary) {
  // Parfums SANS marionnaud mais AVEC nocibe (source d'EAN).
  const targets = [...groups.values()].filter(
    (g) => !g.merchants.has('marionnaud') && g.merchants.has('nocibe'),
  );
  console.log(`\n=== Cible MARIONNAUD ===`);
  console.log(`Parfums sans Marionnaud mais avec Nocibé (candidats) : ${targets.length}`);

  let noEanSource = 0;
  let count = 0;
  for (const g of targets) {
    if (count >= limit) break;
    count++;
    summary.processed++;

    // 1) EAN depuis ProductVariant (aucun fetch).
    let eans = await storedEans(g.productName);
    let source = 'ProductVariant';

    // 2) Sinon, lire la fiche Nocibé (throttle, best-effort).
    if (eans.length === 0) {
      const nocibeUrl = g.merchants.get('nocibe')!.productUrl;
      await delay(NOCIBE_THROTTLE_MS);
      const fetched = await fetchNocibeEans(nocibeUrl);
      if (fetched === null) {
        console.warn(`[resolve] ✗ ${g.productName} | Nocibé bloqué/échec — pas d'EAN, non résolu`);
        summary.errors++;
        continue;
      }
      eans = fetched;
      source = 'fiche Nocibé';
    }

    if (eans.length === 0) {
      noEanSource++;
      console.log(`[resolve] – ${g.productName} | aucun EAN disponible — non résolu`);
      summary.unresolved++;
      continue;
    }

    // 3) Tenter chaque EAN chez Marionnaud jusqu'à un match sûr.
    let match: MarionnaudMatch | null = null;
    for (const ean of eans) {
      match = await resolveMarionnaudByEan(ean, g.productName);
      if (match) break;
      await delay(MARIONNAUD_THROTTLE_MS);
    }

    if (!match) {
      console.log(
        `[resolve] – ${g.productName} | EAN(s) [${eans.join(',')}] (${source}) → aucun produit Marionnaud — non résolu (probablement pas vendu chez Marionnaud)`,
      );
      summary.unresolved++;
      continue;
    }

    if (dryRun) {
      console.log(`[DRY] ${g.productName} -> marionnaud ${match.productUrl} (via EAN ${match.ean})`);
    } else {
      await upsertQueueLink(g.productName, 'marionnaud', match.productUrl, match.searchUrl);
      console.log(`[resolve] ✓ ${g.productName} | ${match.ean} → ${match.productUrl}`);
    }
    summary.resolved++;
  }

  if (noEanSource > 0) console.log(`(${noEanSource} parfum(s) sans aucun EAN exploitable)`);
}

async function runNocibe(groups: Map<string, QueueGroup>, limit: number, dryRun: boolean, summary: Summary) {
  // Parfums SANS nocibe mais AVEC marionnaud (source d'EAN via API Marionnaud).
  const targets = [...groups.values()].filter(
    (g) => !g.merchants.has('nocibe') && g.merchants.has('marionnaud'),
  );
  console.log(`\n=== Cible NOCIBÉ (best-effort) ===`);
  console.log(`Parfums sans Nocibé mais avec Marionnaud (candidats) : ${targets.length}`);

  let count = 0;
  for (const g of targets) {
    if (count >= limit) break;
    count++;
    summary.processed++;

    // EAN : d'abord ProductVariant, sinon détail Marionnaud.
    let eans = await storedEans(g.productName);
    if (eans.length === 0) {
      const marUrl = g.merchants.get('marionnaud')!.productUrl;
      await delay(MARIONNAUD_THROTTLE_MS);
      const ean = await fetchMarionnaudEanFromUrl(marUrl);
      if (ean) eans = [ean];
    }
    if (eans.length === 0) {
      console.log(`[resolve] – ${g.productName} | aucun EAN disponible — non résolu`);
      summary.unresolved++;
      continue;
    }

    let match: { productUrl: string; searchUrl: string } | null = null;
    for (const ean of eans) {
      match = await resolveNocibeByEan(ean, g.productName);
      if (match) break;
      await delay(NOCIBE_THROTTLE_MS);
    }

    if (!match) {
      console.log(`[resolve] – ${g.productName} | EAN(s) [${eans.join(',')}] → pas de fiche Nocibé sûre — non résolu`);
      summary.unresolved++;
      continue;
    }

    if (dryRun) {
      console.log(`[DRY] ${g.productName} -> nocibe ${match.productUrl}`);
    } else {
      await upsertQueueLink(g.productName, 'nocibe', match.productUrl, match.searchUrl);
      console.log(`[resolve] ✓ ${g.productName} → ${match.productUrl}`);
    }
    summary.resolved++;
  }
}

/**
 * My-Origines : parfums SANS my-origines mais AVEC un marchand source d'EAN
 * (nocibe ou marionnaud). EAN pris dans ProductVariant, sinon lu chez le peer.
 * Recherche texte + vérification EAN sur fiche (voir resolveMyOriginesBySearch).
 */
async function runMyOrigines(groups: Map<string, QueueGroup>, limit: number, dryRun: boolean, summary: Summary) {
  const targets = [...groups.values()].filter(
    (g) => !g.merchants.has('my-origines') && (g.merchants.has('nocibe') || g.merchants.has('marionnaud')),
  );
  console.log(`\n=== Cible MY-ORIGINES (recherche + vérif EAN) ===`);
  console.log(`Parfums sans My-Origines mais avec une source d'EAN (candidats) : ${targets.length}`);

  let count = 0;
  for (const g of targets) {
    if (count >= limit) break;
    count++;
    summary.processed++;

    // EAN : d'abord ProductVariant, sinon peer (API Marionnaud, puis fiche Nocibé).
    let eans = await storedEans(g.productName);
    if (eans.length === 0 && g.merchants.has('marionnaud')) {
      await delay(MARIONNAUD_THROTTLE_MS);
      const ean = await fetchMarionnaudEanFromUrl(g.merchants.get('marionnaud')!.productUrl);
      if (ean) eans = [ean];
    }
    if (eans.length === 0 && g.merchants.has('nocibe')) {
      await delay(NOCIBE_THROTTLE_MS);
      const fetched = await fetchNocibeEans(g.merchants.get('nocibe')!.productUrl);
      if (fetched) eans = fetched;
    }
    if (eans.length === 0) {
      console.log(`[resolve] – ${g.productName} | aucun EAN disponible — non résolu`);
      summary.unresolved++;
      continue;
    }

    const match = await resolveMyOriginesBySearch(eans, g.productName);
    if (!match) {
      summary.unresolved++;
      continue;
    }

    if (dryRun) {
      console.log(`[DRY] ${g.productName} -> my-origines ${match.productUrl}`);
    } else {
      await upsertQueueLink(g.productName, 'my-origines', match.productUrl, match.searchUrl, 'search-ean-verified');
      console.log(`[resolve] ✓ ${g.productName} → ${match.productUrl}`);
    }
    summary.resolved++;
    await delay(MY_ORIGINES_THROTTLE_MS);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const targetIdx = args.indexOf('--target');
  const target = (targetIdx >= 0 ? args[targetIdx + 1] : 'marionnaud') as 'marionnaud' | 'nocibe' | 'my-origines';
  const limitIdx = args.indexOf('--limit');
  const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : Infinity;
  const dryRun = args.includes('--dry-run');

  if (target !== 'marionnaud' && target !== 'nocibe' && target !== 'my-origines') {
    console.error(`Cible inconnue: ${target} (attendu: marionnaud|nocibe|my-origines)`);
    process.exit(1);
  }

  console.log(`Résolveur de liens (pont EAN) — cible: ${target}${dryRun ? ' (DRY RUN)' : ''}, limit=${limit}`);

  const groups = await loadGroups();
  const summary: Summary = { processed: 0, resolved: 0, unresolved: 0, errors: 0 };

  if (target === 'marionnaud') await runMarionnaud(groups, limit, dryRun, summary);
  else if (target === 'nocibe') await runNocibe(groups, limit, dryRun, summary);
  else await runMyOrigines(groups, limit, dryRun, summary);

  console.log('\n=== Résumé ===');
  console.log(`parfums traités : ${summary.processed}`);
  console.log(`résolus (liens écrits) : ${summary.resolved}${dryRun ? ' (dry-run, rien écrit)' : ''}`);
  console.log(`non résolus     : ${summary.unresolved}`);
  console.log(`erreurs         : ${summary.errors}`);

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('Erreur fatale:', err);
  await prisma.$disconnect();
  process.exit(1);
});
