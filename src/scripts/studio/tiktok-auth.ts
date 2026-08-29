/**
 * OAuth TikTok — À LANCER UNE SEULE FOIS pour obtenir le refresh_token.
 *
 * Prérequis (.env) : TIKTOK_CLIENT_KEY et TIKTOK_CLIENT_SECRET (Sandbox) depuis
 * ton app sur developers.tiktok.com. Le Redirect URI de l'app DOIT être EXACTEMENT :
 *   https://citybaddies.com/tiktok-callback
 * (TikTok refuse http://localhost — il faut une URL https. La page affichera un
 *  404, c'est normal : le code est dans la barre d'adresse.)
 *
 * Usage :  npx tsx src/scripts/studio/tiktok-auth.ts
 * 1) Ouvre l'URL affichée (connecté au compte Target user), autorise.
 * 2) Copie l'URL complète de redirection et colle-la dans le terminal.
 * 3) Le script échange le code et affiche ton TIKTOK_REFRESH_TOKEN.
 * Le code d'autorisation est à usage unique et expire vite : enchaîne vite.
 */
import 'dotenv/config';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const client_key = process.env.TIKTOK_CLIENT_KEY;
const client_secret = process.env.TIKTOK_CLIENT_SECRET;
const REDIRECT = 'https://citybaddies.com/tiktok-callback';

if (!client_key || !client_secret) {
  console.error('❌ Ajoute TIKTOK_CLIENT_KEY et TIKTOK_CLIENT_SECRET dans .env avant de lancer ce script.');
  process.exit(1);
}

const authUrl =
  `https://www.tiktok.com/v2/auth/authorize/?client_key=${encodeURIComponent(client_key)}` +
  `&scope=${encodeURIComponent('video.upload')}&response_type=code` +
  `&redirect_uri=${encodeURIComponent(REDIRECT)}&state=citybaddies`;

/** Renvoie le code d'autorisation COMPLET (sans le tronquer au '*'). */
function extractCode(inputStr: string): string | null {
  const s = inputStr.trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    const c = u.searchParams.get('code');
    if (c) return c; // full code, '*' inclus
  } catch {
    /* pas une URL : on suppose que c'est déjà le code brut, éventuellement URL-encodé */
  }
  // Chaîne brute : enlève un éventuel "code=" et décode le %2A/%21
  const raw = s.replace(/^.*?code=/, '').split('&')[0];
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

async function exchange(code: string) {
  const r = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: client_key!,
      client_secret: client_secret!,
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT,
    }),
  });
  return (await r.json()) as {
    refresh_token?: string; access_token?: string; scope?: string;
    error_description?: string; error?: string;
  };
}

async function main() {
  const rl = readline.createInterface({ input, output });
  console.log('\n1) Ouvre CETTE URL dans ton navigateur (connecté au compte Target user) :\n');
  console.log('   ' + authUrl + '\n');
  console.log('2) Autorise. Tu arrives sur citybaddies.com/tiktok-callback (page 404 = NORMAL).');
  console.log('3) Copie l\'URL COMPLÈTE de la barre d\'adresse et colle-la ci-dessous.\n');

  for (let attempt = 1; attempt <= 5; attempt++) {
    const answer = await rl.question('Colle l\'URL de redirection (ou le code) puis Entrée : ');
    const code = extractCode(answer);
    if (!code) { console.error('❌ Aucun code détecté, réessaie.\n'); continue; }
    try {
      const j = await exchange(code);
      if (j.refresh_token) {
        console.log('\n===================================================================');
        console.log('✅ COPIE ce refresh token dans tes secrets GitHub (TIKTOK_REFRESH_TOKEN) :\n');
        console.log('   ' + j.refresh_token);
        console.log('\n(scope: ' + (j.scope || '?') + ')');
        console.log('===================================================================\n');
        break;
      }
      const msg = j.error_description || j.error || JSON.stringify(j);
      console.error(`❌ Échec : ${msg}`);
      if (/expired|invalid/i.test(msg)) {
        console.error('   → Le code est à usage unique. RÉ-OUVRE l\'URL ci-dessus, ré-autorise,');
        console.error('     puis colle la NOUVELLE URL rapidement.\n');
      } else {
        console.error('');
      }
    } catch (e) {
      console.error('Erreur réseau :', e instanceof Error ? e.message : e, '\n');
    }
  }
  rl.close();
}

main();
