/**
 * =============================================================================
 * STUDIO — GÉNÉRATEUR DE VIDÉO TIKTOK À PARTIR DES DONNÉES DE PRIX
 * =============================================================================
 * Pipeline complet, déterministe :
 *   1. Choisit une "histoire" dans la base (plus gros écart de prix à taille
 *      égale), ou un produit précis via --product <slug>.
 *   2. Injecte les données dans template.html (animation pilotée par renderAt).
 *   3. Rend la vidéo IMAGE PAR IMAGE (Playwright, horloge JS déterministe) puis
 *      l'assemble en MP4 vertical 1080x1920 H.264 (ffmpeg-static) + une cover.
 *   4. Génère la légende + les hashtags (voix City Baddies).
 *   5. Envoie le tout par email (Resend) : MP4 + cover + kit de publication.
 *
 * Usage :
 *   npx tsx src/scripts/studio/make-video.ts [--product <slug>] [--email <addr>]
 *                                            [--no-email] [--out <dir>]
 *
 * Cadre honnête : la vidéo cite "le moins cher chez {enseigne}" à partir de vrais
 * relevés — aucun chiffre inventé, aucune accusation.
 * =============================================================================
 */
import 'dotenv/config';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';
import ffmpegPath from 'ffmpeg-static';
import { spawnSync } from 'node:child_process';
import prisma from '../../lib/prisma';
import { fullProductName } from '../../lib/seo-config';

const ROOT = resolve(__dirname, '../../..');
const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const has = (name: string) => process.argv.includes(name);

const MERCHANT_LABEL: Record<string, string> = {
  sephora: 'Sephora', nocibe: 'Nocibé', marionnaud: 'Marionnaud', 'my-origines': 'My-Origines', notino: 'Notino',
};
// UA mobile iOS : passe la protection Akamai des CDN images (Sephora, Marionnaud,
// Nocibé) — sinon l'UA desktop du headless se prend un 403 → flacon cassé.
const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1';
// Hôtes dont le CDN sert les bots/headless (image affichable dans la vidéo).
// Sephora (media.sephora.eu) et Marionnaud (media.marionnaud.fr) = Akamai → 403.
const RENDERABLE = /nocibe\.|notinoimg|demandware|my-origines/i;
// Motifs de vrais packshots (face avant / global) plutôt qu'un swatch ou dos/côté.
const PACKSHOT = /front|global|_p\.jpg|-1-|media_1/i;

interface Story {
  slug: string; brand: string; displayName: string; meta: string;
  oldPrice: number; newPrice: number; gap: number; merchant: string; merchantSlug: string;
  volumeLabel: string; image: string;
}

/** Nom d'affichage court : marque + ligne, sans le suffixe "Eau de Parfum/Toilette". */
function cleanName(brand: string | null, name: string): string {
  let full = fullProductName(brand, name);
  full = full.replace(/\b(eau de parfum|eau de toilette|eau de cologne|eau fra[iî]che)\b.*$/i, '').trim();
  return full.replace(/[-–—]\s*$/, '').trim() || fullProductName(brand, name);
}
function concentration(name: string): string {
  if (/intense/i.test(name)) return 'Eau de Parfum Intense';
  if (/toilette/i.test(name)) return 'Eau de Toilette';
  if (/cologne/i.test(name)) return 'Eau de Cologne';
  return 'Eau de Parfum';
}
const fmt = (n: number) => n.toFixed(2).replace('.', ',');
const fmtInt = (n: number) => (Math.abs(n - Math.round(n)) < 0.005 ? String(Math.round(n)) : fmt(n));

/** Choisit l'histoire au plus gros écart (produit × contenance, ≥2 enseignes). */
async function pickStory(productSlug?: string): Promise<Story | null> {
  const deals = await prisma.deal.findMany({
    where: { status: 'ACTIVE', type: 'tracked', ...(productSlug ? { product: { slug: productSlug } } : {}) },
    include: { merchant: { select: { slug: true } }, product: { select: { slug: true, name: true, brand: true, images: { select: { url: true }, orderBy: { position: 'asc' } } } }, variant: true },
  });
  const byPV = new Map<string, typeof deals>();
  for (const d of deals) {
    if (!d.variant) continue;
    const k = `${d.product.slug}|${d.variant.volumeValue}${d.variant.volumeUnit}`;
    (byPV.get(k) ?? byPV.set(k, []).get(k)!).push(d);
  }
  let best: Story | null = null;
  for (const ds of byPV.values()) {
    const cheapest = new Map<string, number>();
    for (const d of ds) { const c = cheapest.get(d.merchant.slug); if (c === undefined || d.dealPrice < c) cheapest.set(d.merchant.slug, d.dealPrice); }
    if (cheapest.size < 2) continue;
    const sorted = [...cheapest.entries()].sort((a, b) => a[1] - b[1]);
    const [minSlug, minP] = sorted[0]; const maxP = sorted[sorted.length - 1][1];
    const gap = maxP - minP;
    if (best && gap <= best.gap) continue;
    const d0 = ds[0]; const imgs = d0.product.images.map((i) => i.url);
    // Ne garder que les produits avec une image AFFICHABLE (sinon flacon cassé).
    const image = imgs.find((u) => RENDERABLE.test(u) && PACKSHOT.test(u)) || imgs.find((u) => RENDERABLE.test(u)) || '';
    if (!image) continue; // aucune image rendable → produit ignoré
    best = {
      slug: d0.product.slug, brand: d0.product.brand || '', displayName: cleanName(d0.product.brand, d0.product.name),
      meta: `${concentration(d0.product.name)} · ${d0.variant!.volumeValue} ${d0.variant!.volumeUnit}`,
      oldPrice: maxP, newPrice: minP, gap, merchant: MERCHANT_LABEL[minSlug] ?? minSlug, merchantSlug: minSlug,
      volumeLabel: `${d0.variant!.volumeValue} ${d0.variant!.volumeUnit}`, image,
    };
  }
  return best;
}

/** Rend la vidéo (frames déterministes → MP4) et une cover. Retourne les chemins. */
async function renderVideo(story: Story, outDir: string): Promise<{ mp4: string; cover: string }> {
  const logo = pathToFileURL(join(ROOT, 'public/images/logo-white.png')).href;
  let tpl = readFileSync(join(__dirname, 'template.html'), 'utf8');
  const rep: Record<string, string> = {
    __LOGO__: logo, __IMG__: story.image, __HOOK__: 'Le m&ecirc;me flacon.',
    __PNAME__: story.displayName, __PMETA__: story.meta.toUpperCase().replace(/·/g, '&middot;'),
    __OLD__: `${fmtInt(story.oldPrice)}&nbsp;&euro;`, __SAVE__: `tu &eacute;conomises ${fmtInt(story.gap)}&nbsp;&euro;`,
    __MERCHANT__: story.merchant, __FROM__: String(story.oldPrice), __TO__: String(story.newPrice),
  };
  for (const [k, v] of Object.entries(rep)) tpl = tpl.split(k).join(v);
  const htmlPath = join(outDir, `${story.slug}.html`);
  writeFileSync(htmlPath, tpl);

  const framesDir = join(outDir, 'frames'); rmSync(framesDir, { recursive: true, force: true }); mkdirSync(framesDir, { recursive: true });
  // JPEG (encodage ~2-3x plus rapide que PNG) + 25 fps → rendu bien plus rapide,
  // qualité conservée (ffmpeg ré-encode ensuite). Fluide pour ce motion.
  const FPS = 25, DUR = 9800, step = 1000 / FPS;
  // --disable-dev-shm-usage : évite les crashs "Target crashed" (Chromium à court
  // de /dev/shm) lors d'un long rendu image par image.
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
  const page = await (await browser.newContext({ viewport: { width: 1080, height: 1920 }, userAgent: MOBILE_UA, deviceScaleFactor: 1 })).newPage();
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'load' });
  // Attendre que le packshot soit RÉELLEMENT chargé (sinon carte blanche/cassée).
  await page.waitForFunction(() => {
    const im = document.getElementById('pimg') as HTMLImageElement | null;
    return !!im && im.complete && im.naturalWidth > 10;
  }, { timeout: 8000 }).catch(() => { console.warn('[studio] ⚠ packshot non chargé (image indisponible)'); });
  let n = 0;
  for (let t = 0; t <= DUR; t += step) {
    n++;
    await page.evaluate((tt) => (window as unknown as { renderAt: (t: number) => void }).renderAt(tt), t);
    await page.screenshot({ path: join(framesDir, `f-${String(n).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 90 });
  }
  const cover = join(outDir, `${story.slug}-cover.png`);
  await page.evaluate(() => (window as unknown as { renderAt: (t: number) => void }).renderAt(5000));
  await page.screenshot({ path: cover });
  await browser.close();

  const mp4 = join(outDir, `${story.slug}.mp4`);
  const ff = spawnSync(ffmpegPath as string, [
    '-y', '-loglevel', 'error', '-framerate', '25', '-i', join(framesDir, 'f-%04d.jpg'),
    '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
    '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-r', '30',
    '-c:a', 'aac', '-b:a', '128k', '-shortest', '-movflags', '+faststart', mp4,
  ], { stdio: 'inherit' });
  if (ff.status !== 0) throw new Error('ffmpeg a échoué');
  rmSync(framesDir, { recursive: true, force: true });
  return { mp4, cover };
}

function buildCaption(s: Story) {
  const caption =
`POV : tu allais payer ton parfum plein pot 💸

${s.displayName} ${s.volumeLabel}, le MÊME flacon :
❌ ${fmtInt(s.oldPrice)} € dans certaines enseignes
✅ ${fmt(s.newPrice)} € chez ${s.merchant}

Soit ${fmtInt(s.gap)} € d'écart. Pour rien. 🤯

Chez City Baddies on compare 5 enseignes 6×/jour pour te trouver le prix le plus bas — avant que tu craques. Le lien est en bio 🔗🐆`;
  const brandTag = s.brand.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
  const hashtags = `#parfum #perfumetok ${brandTag ? '#' + brandTag + ' ' : ''}#parfumpascher #bonplan #beautytok #parfumfemme #astucebeauté #perfume #fyp #pourtoi`.replace(/\s+/g, ' ').trim();
  return { caption, hashtags };
}

async function sendEmail(to: string, s: Story, mp4: string, cover: string, caption: string, hashtags: string) {
  const { Resend } = await import('resend');
  const resend = new Resend(process.env.RESEND_API_KEY);
  const from = process.env.STUDIO_EMAIL_FROM || 'City Baddies <onboarding@resend.dev>';
  const pre = (t: string) => `<pre style="white-space:pre-wrap;background:#f5f2ec;border:1px solid #e3ddd0;border-radius:10px;padding:16px;font-family:monospace;font-size:14px;color:#1a1a1a;line-height:1.5">${t.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</pre>`;
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:640px;margin:auto;color:#1a1a1a">
<div style="background:#0a0a0a;color:#fff;padding:28px;border-radius:14px 14px 0 0;text-align:center">
<div style="color:#d4a855;font-weight:800;letter-spacing:.2em;font-size:12px;text-transform:uppercase">City Baddies · Studio</div>
<h1 style="margin:10px 0 0;font-size:23px">🎬 Vidéo TikTok prête — ${s.displayName}</h1></div>
<div style="padding:26px;background:#fff;border:1px solid #eee;border-top:0;border-radius:0 0 14px 14px">
<p>La vidéo <strong>${s.displayName} ${s.volumeLabel}</strong> (écart <strong>${fmtInt(s.gap)} €</strong>, moins cher chez <strong>${s.merchant}</strong>) est en <strong>pièce jointe</strong> — 1080×1920, H.264, prête pour TikTok, Reels et Shorts.</p>
<h3 style="margin-top:22px">✍️ Légende</h3>${pre(caption)}
<h3>🏷️ Hashtags</h3>${pre(hashtags)}
<h3>🔊 Son (à ne pas zapper)</h3><p>Vidéo muette exprès. Dans TikTok → <strong>Sons</strong> → un <strong>son tendance</strong> (plot twist / storytime). C'est ce qui donne la reach.</p>
<h3>✅ Poster</h3><ol><li>Importer la vidéo dans TikTok.</li><li>Ajouter un son tendance ⚠️.</li><li>Coller légende + hashtags.</li><li>Cover : la pièce jointe <code>cover.png</code> (prix en or).</li><li>Publier, puis recycler sur Reels + Shorts + Pinterest.</li></ol>
<div style="background:#fff7ef;border:1px solid #f0d9bd;border-radius:10px;padding:14px 16px;margin-top:18px"><strong>🔗</strong> Vérifie que ta bio TikTok pointe vers <strong>citybaddies.com</strong>.</div>
<p style="color:#888;font-size:12px;margin-top:22px">Prix relevés le jour de la génération. Cadre honnête « le moins cher chez {enseigne} ». Généré par le studio City Baddies 🐆</p></div></div>`;
  const { data, error } = await resend.emails.send({
    from, to, subject: `🎬 Vidéo TikTok prête — ${s.displayName} (−${fmtInt(s.gap)} €)`, html,
    attachments: [
      { filename: `${s.slug}.mp4`, content: readFileSync(mp4).toString('base64') },
      { filename: 'cover.png', content: readFileSync(cover).toString('base64') },
    ],
  });
  if (error) throw new Error('Resend: ' + JSON.stringify(error));
  return data?.id;
}

async function main() {
  const outDir = arg('--out') || join(ROOT, 'studio-out');
  const email = arg('--email') || 'nicolas.musicki@gmail.com';
  mkdirSync(outDir, { recursive: true });

  console.log('🎬 Studio — sélection de l\'histoire…');
  const story = await pickStory(arg('--product'));
  if (!story) { console.error('Aucune histoire exploitable (pas assez de données comparées).'); process.exit(1); }
  console.log(`   ${story.displayName} ${story.volumeLabel} · ${fmtInt(story.oldPrice)}€ → ${fmt(story.newPrice)}€ chez ${story.merchant} (écart ${fmtInt(story.gap)}€)`);

  console.log('🎞️  Rendu vidéo (image par image + MP4)…');
  const { mp4, cover } = await renderVideo(story, outDir);
  console.log(`   MP4 : ${mp4}`);

  const { caption, hashtags } = buildCaption(story);

  if (has('--no-email')) {
    writeFileSync(join(outDir, `${story.slug}-legende.txt`), caption + '\n\n' + hashtags);
    console.log('📄 Légende écrite (email sauté).');
  } else {
    console.log(`📧 Envoi à ${email}…`);
    const id = await sendEmail(email, story, mp4, cover, caption, hashtags);
    console.log(`   ✅ Email envoyé (id ${id})`);
  }
  await prisma.$disconnect();
  process.exit(0);
}
main().catch(async (e) => { console.error('Erreur fatale:', e instanceof Error ? e.message : e); await prisma.$disconnect(); process.exit(1); });
