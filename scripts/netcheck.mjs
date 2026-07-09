/**
 * Diagnostic réseau — À LANCER DEPUIS UN RÉSEAU RÉSIDENTIEL (chez toi, 4G, etc.)
 * pour savoir si Nocibé/Sephora/Marionnaud sont accessibles hors du réseau Groupon.
 *
 * Aucune dépendance — Node 18+ suffit :
 *   node scripts/netcheck.mjs
 *
 * Interprétation :
 *   - HTTP 200 + tiles>0  => accessible, le scraping direct marchera depuis ce réseau
 *   - HTTP 403 "Access Denied" / edgesuite => blocage Akamai (IP/edge), proxy nécessaire
 *   - HTTP 200 mais tiles=0 => accessible mais markup à mettre à jour (pas un blocage)
 */

const TARGETS = [
  ['nocibe', 'https://www.nocibe.fr/fr/c/parfum/01', 'product-tile'],
  ['sephora', 'https://www.sephora.fr/shop/parfum-c301/', 'data-tcproduct'],
  ['marionnaud', 'https://www.marionnaud.fr/parfum/c/P0000', 'product-tile'],
];

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'fr-FR,fr;q=0.9',
};

console.log('Test de reachability (fetch direct, sans navigateur)\n');

for (const [name, url, marker] of TARGETS) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 20000);
    const res = await fetch(url, { headers: HEADERS, signal: ctrl.signal });
    clearTimeout(t);
    const html = await res.text();
    const tiles = html.split(marker).length - 1;
    const akamai = /access denied|edgesuite|reference #\d/i.test(html);
    const verdict = res.status === 200 && tiles > 0
      ? '✅ ACCESSIBLE (markup présent)'
      : res.status === 200
        ? '⚠️ ACCESSIBLE mais markup à mettre à jour (tiles=0)'
        : akamai
          ? '⛔ BLOCAGE Akamai (IP/edge)'
          : `❓ HTTP ${res.status}`;
    console.log(`${name.padEnd(12)} HTTP ${res.status} | ${marker}=${tiles} | ${verdict}`);
  } catch (err) {
    console.log(`${name.padEnd(12)} ERREUR: ${err instanceof Error ? err.message : err}`);
  }
}

console.log('\nColle-moi ces 3 lignes de résultat.');
