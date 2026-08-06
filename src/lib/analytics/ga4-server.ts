/**
 * Envoi d'événements GA4 depuis le serveur (Measurement Protocol).
 *
 * Pourquoi côté serveur : le clic marchand est l'unique événement qui rapporte
 * de l'argent. Côté navigateur il se perd — bloqueurs de pub (googletagmanager
 * est dans toutes les listes), navigation qui tue le script avant l'envoi, JS en
 * erreur. Ici l'événement part du même endroit que la redirection : s'il y a
 * redirection, il y a événement.
 *
 * Consentement : on n'envoie QUE si le cookie `_ga` existe. Ce cookie est posé
 * par gtag, qui ne se charge que si l'utilisateur a accepté (voir
 * GoogleAnalytics.tsx). Sa présence est donc une preuve de consentement, et son
 * absence un refus — ou un bloqueur, auquel cas on renonce aussi. C'est
 * volontairement conservateur : mieux vaut un angle mort mesuré qu'un envoi non
 * consenti.
 */

const MP_ENDPOINT = 'https://www.google-analytics.com/mp/collect';

/** Le `_ga` vaut `GA1.1.<id1>.<id2>` ; le client_id est `<id1>.<id2>`. */
export function clientIdFromGaCookie(gaCookie: string | undefined): string | null {
  if (!gaCookie) return null;
  const parts = gaCookie.split('.');
  if (parts.length < 4) return null;
  const id = parts.slice(-2).join('.');
  return /^\d+\.\d+$/.test(id) ? id : null;
}

/**
 * Le cookie de session `_ga_<SUFFIXE>` a deux formats selon la version de gtag :
 *   GS1.1.<session_id>.<n>....
 *   GS2.1.s<session_id>$o<n>$g...
 * Sans session_id, GA4 ouvre une session distincte et l'événement perd son
 * canal d'acquisition — donc « quelle page/source convertit » devient faux.
 */
export function sessionIdFromGaCookie(sessionCookie: string | undefined): string | null {
  if (!sessionCookie) return null;
  const v2 = sessionCookie.match(/^GS2\.\d+\.s(\d+)/);
  if (v2) return v2[1];
  const v1 = sessionCookie.match(/^GS1\.\d+\.(\d+)/);
  if (v1) return v1[1];
  return null;
}

export type Ga4Event = {
  name: string;
  params: Record<string, string | number | undefined>;
};

/**
 * Envoie un ou plusieurs événements. Résout toujours — la mesure ne doit jamais
 * casser ni ralentir un parcours d'achat. `ok: false` signale une non-livraison
 * pour les logs, pas une erreur à propager.
 */
export async function sendGa4Events(
  events: Ga4Event[],
  opts: { clientId: string | null; sessionId?: string | null; timeoutMs?: number }
): Promise<{ ok: boolean; reason?: string }> {
  const measurementId = process.env.GA4_MEASUREMENT_ID;
  const apiSecret = process.env.GA4_API_SECRET;

  if (!measurementId || !apiSecret) return { ok: false, reason: 'config-absente' };
  if (!opts.clientId) return { ok: false, reason: 'pas-de-consentement' };
  if (events.length === 0) return { ok: false, reason: 'aucun-evenement' };

  // `engagement_time_msec` est requis pour que l'événement compte dans les
  // sessions engagées ; sans lui GA4 l'enregistre mais l'exclut des rapports
  // d'engagement, et le taux de conversion par page reste vide.
  const payload = {
    client_id: opts.clientId,
    events: events.map((e) => ({
      name: e.name,
      params: {
        ...Object.fromEntries(Object.entries(e.params).filter(([, v]) => v !== undefined && v !== '')),
        engagement_time_msec: 1,
        ...(opts.sessionId ? { session_id: opts.sessionId } : {}),
      },
    })),
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 1200);
  try {
    const res = await fetch(
      `${MP_ENDPOINT}?measurement_id=${encodeURIComponent(measurementId)}&api_secret=${encodeURIComponent(apiSecret)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      }
    );
    // MP répond 204 sans corps, même sur payload invalide : la validation se
    // fait via l'endpoint /debug/mp/collect (voir scripts de vérification).
    return res.ok ? { ok: true } : { ok: false, reason: `http-${res.status}` };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.name : 'echec-reseau' };
  } finally {
    clearTimeout(timer);
  }
}
