/**
 * OAuth TikTok — À LANCER UNE SEULE FOIS pour obtenir le refresh_token.
 *
 * Prérequis (.env) : TIKTOK_CLIENT_KEY et TIKTOK_CLIENT_SECRET (depuis ton app
 * sur developers.tiktok.com). Le redirect URI de l'app DOIT contenir exactement :
 *   http://localhost:4567/callback
 *
 * Usage :  npx tsx src/scripts/studio/tiktok-auth.ts
 * → ouvre l'URL affichée dans ton navigateur (connecté à ton compte TikTok),
 *   autorise, puis copie le TIKTOK_REFRESH_TOKEN affiché dans tes secrets.
 */
import 'dotenv/config';
import http from 'node:http';

const client_key = process.env.TIKTOK_CLIENT_KEY;
const client_secret = process.env.TIKTOK_CLIENT_SECRET;
const REDIRECT = 'http://localhost:4567/callback';
const PORT = 4567;

if (!client_key || !client_secret) {
  console.error('❌ Ajoute TIKTOK_CLIENT_KEY et TIKTOK_CLIENT_SECRET dans .env avant de lancer ce script.');
  process.exit(1);
}

const authUrl =
  `https://www.tiktok.com/v2/auth/authorize/?client_key=${encodeURIComponent(client_key)}` +
  `&scope=${encodeURIComponent('video.upload')}&response_type=code` +
  `&redirect_uri=${encodeURIComponent(REDIRECT)}&state=citybaddies`;

console.log('\n1) Ouvre CETTE URL dans ton navigateur (connecté au compte TikTok voulu) :\n');
console.log('   ' + authUrl + '\n');
console.log('2) Autorise l\'accès. Tu seras redirigé vers localhost — laisse ce script tourner.\n');

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url || '/', `http://localhost:${PORT}`);
  const code = u.searchParams.get('code');
  if (u.pathname !== '/callback' || !code) { res.statusCode = 200; res.end('En attente de l\'autorisation TikTok…'); return; }
  try {
    const r = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_key: client_key!, client_secret: client_secret!, grant_type: 'authorization_code', code, redirect_uri: REDIRECT }),
    });
    const j = (await r.json()) as { refresh_token?: string; access_token?: string; scope?: string; error_description?: string };
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end('<h2>✅ C\'est bon, tu peux fermer cet onglet et revenir au terminal.</h2>');
    if (j.refresh_token) {
      console.log('\n===================================================================');
      console.log('✅ COPIE ce refresh token dans tes secrets (TIKTOK_REFRESH_TOKEN) :\n');
      console.log('   ' + j.refresh_token);
      console.log('\n(scope: ' + (j.scope || '?') + ')');
      console.log('===================================================================\n');
    } else {
      console.error('❌ Échec :', j.error_description || JSON.stringify(j));
    }
  } catch (e) {
    console.error('Erreur:', e instanceof Error ? e.message : e);
  } finally {
    server.close();
    process.exit(0);
  }
});
server.listen(PORT, () => console.log(`(serveur local prêt sur ${REDIRECT} — j'attends la redirection…)\n`));
