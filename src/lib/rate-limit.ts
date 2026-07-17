/**
 * Rate limiter en mémoire (fenêtre glissante), par clé.
 *
 * ⚠️ In-process : l'état vit dans l'instance Node. Sur un déploiement
 * mono-instance (Railway par défaut) c'est efficace ; en multi-instance,
 * la limite est appliquée par instance (mitigation, pas garantie absolue).
 * Suffisant pour freiner le flood/denial-of-wallet sans dépendance externe
 * (Redis/Upstash à envisager si le trafic grimpe).
 */
const hits = new Map<string, number[]>();

/** true = requête autorisée ; false = quota dépassé. */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) {
    hits.set(key, arr);
    return false;
  }
  arr.push(now);
  hits.set(key, arr);
  // Purge opportuniste : évite la croissance illimitée de la Map.
  if (hits.size > 5000) {
    for (const [k, v] of hits) {
      if (v.every((t) => now - t >= windowMs)) hits.delete(k);
    }
  }
  return true;
}

/** Extrait l'IP client derrière le proxy (Railway/CDN). */
export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  return (xff?.split(',')[0] || req.headers.get('x-real-ip') || 'unknown').trim();
}

/** Réponse 429 standard. */
export function tooMany(): Response {
  return new Response(JSON.stringify({ error: 'Trop de requêtes, réessaie dans un instant.' }), {
    status: 429,
    headers: { 'content-type': 'application/json', 'retry-after': '60' },
  });
}
