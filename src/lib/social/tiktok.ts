/**
 * =============================================================================
 * TIKTOK — DÉPÔT EN BROUILLON (Content Posting API, mode "inbox")
 * =============================================================================
 * On envoie la vidéo dans l'INBOX/brouillons du créateur (endpoint
 * /v2/post/publish/inbox/video/init/). Le créateur finit dans l'app : il ajoute
 * un SON TENDANCE (impossible via l'API, et c'est le principal levier de reach)
 * puis publie. Ce mode ne requiert PAS l'audit "Direct Post" de TikTok.
 *
 * Config (secrets / .env) :
 *   TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET  → app développeur TikTok
 *   TIKTOK_REFRESH_TOKEN                     → obtenu une fois via tiktok-auth.ts
 *
 * Scope requis : video.upload
 * Docs : https://developers.tiktok.com/doc/content-posting-api-reference-upload-video
 * =============================================================================
 */
import { readFileSync } from 'node:fs';

const TT = 'https://open.tiktokapis.com';

export function tiktokConfigured(): boolean {
  return !!(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET && process.env.TIKTOK_REFRESH_TOKEN);
}

/** Échange le refresh_token contre un access_token frais (validité ~24 h). */
export async function getTikTokAccessToken(): Promise<string> {
  const client_key = process.env.TIKTOK_CLIENT_KEY;
  const client_secret = process.env.TIKTOK_CLIENT_SECRET;
  const refresh_token = process.env.TIKTOK_REFRESH_TOKEN;
  if (!client_key || !client_secret || !refresh_token) {
    throw new Error('TikTok non configuré (TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET / TIKTOK_REFRESH_TOKEN manquants)');
  }
  const res = await fetch(`${TT}/v2/oauth/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_key, client_secret, grant_type: 'refresh_token', refresh_token }),
  });
  const j = (await res.json()) as { access_token?: string; error?: string; error_description?: string };
  if (!j.access_token) throw new Error(`TikTok token: ${j.error_description || j.error || JSON.stringify(j)}`);
  return j.access_token;
}

/**
 * Dépose une vidéo MP4 dans les brouillons TikTok du créateur.
 * @returns publish_id (identifiant de suivi côté TikTok)
 */
export async function uploadToTikTokInbox(videoPath: string): Promise<string> {
  const token = await getTikTokAccessToken();
  const bytes = readFileSync(videoPath);
  const size = bytes.length;

  // 1) Initialisation de l'upload (fichier unique → 1 chunk).
  const initRes = await fetch(`${TT}/v2/post/publish/inbox/video/init/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify({
      source_info: { source: 'FILE_UPLOAD', video_size: size, chunk_size: size, total_chunk_count: 1 },
    }),
  });
  const init = (await initRes.json()) as { data?: { publish_id?: string; upload_url?: string }; error?: { code?: string; message?: string } };
  const uploadUrl = init.data?.upload_url;
  const publishId = init.data?.publish_id;
  if (!uploadUrl || !publishId) {
    throw new Error(`TikTok init: ${init.error?.message || JSON.stringify(init)}`);
  }

  // 2) Upload des octets vers l'URL signée.
  const put = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'video/mp4', 'Content-Range': `bytes 0-${size - 1}/${size}` },
    body: bytes,
  });
  if (!put.ok) {
    throw new Error(`TikTok upload: HTTP ${put.status} ${(await put.text()).slice(0, 200)}`);
  }
  return publishId;
}
