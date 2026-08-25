/**
 * =============================================================================
 * STUDIO — GÉNÉRATEUR DE VIDÉO TIKTOK À PARTIR DES DONNÉES DE PRIX
 * =============================================================================
 * Pipeline complet, déterministe. CHAQUE JOUR un CONCEPT différent tourne
 * (voir concepts.ts) → jamais deux fois la même vidéo :
 *   1. Construit le catalogue comparé (getCatalog) et choisit le concept du jour
 *      (rotation par jour) + les parfums (anti-répétition sur N jours).
 *   2. Rend la vidéo IMAGE PAR IMAGE (Playwright, horloge JS déterministe) :
 *        - format "single" : 1 parfum, révélation du prix (template.html)
 *        - format "list"   : top 3 thématique (template-list.html)
 *      puis assemble en MP4 vertical 1080x1920 H.264 (ffmpeg-static) + une cover.
 *   3. Génère la légende + les hashtags (voix City Baddies, humaine).
 *   4. Dépose la vidéo en BROUILLON TikTok (si configuré) et/ou l'envoie par email.
 *
 * Usage :
 *   npx tsx src/scripts/studio/make-video.ts
 *       [--concept <id>]   force un concept (voir concepts.ts)
 *       [--product <slug>] force un parfum précis (format single)
 *       [--email <addr>] [--no-email] [--no-tiktok] [--out <dir>] [--exclude-days N]
 *
 * Cadre honnête : "le moins cher chez {enseigne}" à partir de vrais relevés —
 * aucun chiffre inventé, aucune accusation.
 * =============================================================================
 */
import 'dotenv/config';
import { readFileSync, writeFileSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';
import ffmpegPath from 'ffmpeg-static';
import { spawnSync } from 'node:child_process';
import prisma from '../../lib/prisma';
import { uploadToTikTokInbox, tiktokConfigured } from '../../lib/social/tiktok';
import { CatalogItem, Story, MOBILE_UA, fmt, fmtInt, getCatalog, itemToStory } from './lib';
import { selectForDay, Selection } from './concepts';

const ROOT = resolve(__dirname, '../../..');
const arg = (name: string): string | undefined => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : undefined; };
const has = (name: string) => process.argv.includes(name);
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const eur = (n: number) => `${fmtInt(n)} €`;

/** Capture HTML → MP4 (frames déterministes via renderAt) + cover. Générique
 *  (single ou list) : attend le chargement de toutes les images `.w8`. */
async function captureHtmlToVideo(
  htmlPath: string, outDir: string, slug: string, durMs: number, coverAtMs: number,
): Promise<{ mp4: string; cover: string }> {
  const FPS = 25, step = 1000 / FPS;
  const framesDir = join(outDir, 'frames'); rmSync(framesDir, { recursive: true, force: true }); mkdirSync(framesDir, { recursive: true });
  // --disable-dev-shm-usage : évite les crashs "Target crashed" (long rendu).
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
  const page = await (await browser.newContext({ viewport: { width: 1080, height: 1920 }, userAgent: MOBILE_UA, deviceScaleFactor: 1 })).newPage();
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'load' });
  // Attendre que TOUS les packshots (.w8) soient réellement chargés (sinon cartes blanches).
  await page.waitForFunction(() => {
    const imgs = Array.from(document.querySelectorAll('img.w8')) as HTMLImageElement[];
    return imgs.length > 0 && imgs.every((im) => im.complete && im.naturalWidth > 10);
  }, { timeout: 9000 }).catch(() => console.warn('[studio] ⚠ un packshot n’a pas chargé (image indisponible)'));

  let n = 0;
  for (let t = 0; t <= durMs; t += step) {
    n++;
    await page.evaluate((tt) => (window as unknown as { renderAt: (t: number) => void }).renderAt(tt), t);
    await page.screenshot({ path: join(framesDir, `f-${String(n).padStart(4, '0')}.jpg`), type: 'jpeg', quality: 90 });
  }
  const cover = join(outDir, `${slug}-cover.png`);
  await page.evaluate((c) => (window as unknown as { renderAt: (t: number) => void }).renderAt(c), coverAtMs);
  await page.screenshot({ path: cover });
  await browser.close();

  const mp4 = join(outDir, `${slug}.mp4`);
  const ffArgs = [
    '-y', '-loglevel', 'error', '-framerate', '25', '-i', join(framesDir, 'f-%04d.jpg'),
    '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
    '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-r', '30',
    '-c:a', 'aac', '-b:a', '128k', '-shortest', '-movflags', '+faststart', mp4,
  ];
  // Un essai + un retry (l'encodage échoue parfois de façon transitoire sous Windows).
  let ff = spawnSync(ffmpegPath as string, ffArgs, { encoding: 'utf8' });
  if (ff.status !== 0) ff = spawnSync(ffmpegPath as string, ffArgs, { encoding: 'utf8' });
  if (ff.status !== 0) throw new Error(`ffmpeg a échoué (code ${ff.status}${ff.signal ? ', signal ' + ff.signal : ''})${ff.stderr ? ': ' + String(ff.stderr).trim().slice(-400) : ''}`);
  rmSync(framesDir, { recursive: true, force: true });
  return { mp4, cover };
}

/** Rendu format "single" (1 parfum, révélation du prix). */
async function renderSingle(story: Story, outDir: string): Promise<{ mp4: string; cover: string }> {
  const logo = pathToFileURL(join(ROOT, 'public/images/logo-white.png')).href;
  let tpl = readFileSync(join(__dirname, 'template.html'), 'utf8');
  const rep: Record<string, string> = {
    __LOGO__: logo, __IMG__: esc(story.image), __HOOK__: 'Le m&ecirc;me flacon.',
    __PNAME__: esc(story.displayName), __PMETA__: esc(story.meta.toUpperCase()).replace(/·/g, '&middot;'),
    __OLD__: `${fmtInt(story.oldPrice)}&nbsp;&euro;`, __SAVE__: `tu &eacute;conomises ${fmtInt(story.gap)}&nbsp;&euro;`,
    __MERCHANT__: esc(story.merchant), __FROM__: String(story.oldPrice), __TO__: String(story.newPrice),
  };
  for (const [k, v] of Object.entries(rep)) tpl = tpl.split(k).join(v);
  const htmlPath = join(outDir, `${story.slug}.html`); writeFileSync(htmlPath, tpl);
  return captureHtmlToVideo(htmlPath, outDir, story.slug, 9800, 5000);
}

/** Rendu format "list" (top 3 thématique). */
async function renderList(sel: Selection, outDir: string): Promise<{ mp4: string; cover: string }> {
  const logo = pathToFileURL(join(ROOT, 'public/images/logo-white.png')).href;
  const items = sel.items!;
  let tpl = readFileSync(join(__dirname, 'template-list.html'), 'utf8');
  const titleHtml = esc(sel.conceptTitle).replace(/(\d+\s?€)/g, '<em>$1</em>');
  const rep: Record<string, string> = { __LOGO__: logo, __TITLE__: titleHtml };
  items.forEach((it, i) => {
    const k = i + 1;
    rep[`__IMG${k}__`] = esc(it.image);
    rep[`__NAME${k}__`] = esc(it.displayName);
    rep[`__META${k}__`] = esc(it.meta).replace(/·/g, '&middot;');
    rep[`__PRICE${k}__`] = eur(it.cheapest);
    rep[`__OLD${k}__`] = eur(it.highest);
    rep[`__MERCH${k}__`] = esc(it.cheapestMerchant);
  });
  for (const [k, v] of Object.entries(rep)) tpl = tpl.split(k).join(v);
  const slug = sel.conceptId;
  const htmlPath = join(outDir, `${slug}.html`); writeFileSync(htmlPath, tpl);
  return captureHtmlToVideo(htmlPath, outDir, slug, 11000, 4200);
}

async function sendEmail(
  to: string,
  m: { subject: string; title: string; sub: string; caption: string; hashtags: string; mp4: string; cover: string; slug: string; tiktokDraft: boolean },
) {
  const { Resend } = await import('resend');
  const resend = new Resend(process.env.RESEND_API_KEY);
  const from = process.env.STUDIO_EMAIL_FROM || 'City Baddies <onboarding@resend.dev>';
  const pre = (t: string) => `<pre style="white-space:pre-wrap;background:#f5f2ec;border:1px solid #e3ddd0;border-radius:10px;padding:16px;font-family:monospace;font-size:14px;color:#1a1a1a;line-height:1.5">${t.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</pre>`;
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:640px;margin:auto;color:#1a1a1a">
<div style="background:#0a0a0a;color:#fff;padding:28px;border-radius:14px 14px 0 0;text-align:center">
<div style="color:#d4a855;font-weight:800;letter-spacing:.2em;font-size:12px;text-transform:uppercase">City Baddies · Studio</div>
<h1 style="margin:10px 0 0;font-size:23px">🎬 ${m.title}</h1></div>
<div style="padding:26px;background:#fff;border:1px solid #eee;border-top:0;border-radius:0 0 14px 14px">
${m.tiktokDraft ? `<div style="background:#eefaf0;border:1px solid #bfe6c9;border-radius:10px;padding:14px 16px;margin-bottom:16px"><strong>📲 Déjà déposée dans tes brouillons TikTok.</strong> Ouvre l'app → brouillons → ajoute un son tendance → publie. ~30 secondes.</div>` : ''}
<p>${m.sub}</p>
<p>Vidéo en <strong>pièce jointe</strong> — 1080×1920, H.264, prête pour TikTok, Reels et Shorts.</p>
<h3 style="margin-top:22px">✍️ Légende + hashtags <span style="font-weight:400;color:#888;font-size:13px">(copie tout le bloc d'un coup)</span></h3>${pre(m.caption + '\n\n' + m.hashtags)}
<h3>🔊 Son (à ne pas zapper)</h3><p>Vidéo muette exprès. Dans TikTok → <strong>Sons</strong> → un <strong>son tendance</strong>. C'est ce qui donne la reach.</p>
<h3>✅ Poster</h3><ol><li>Ouvrir le brouillon TikTok (ou importer la vidéo).</li><li>Ajouter un son tendance ⚠️.</li><li>Coller légende + hashtags.</li><li>Cover : la pièce jointe <code>cover.png</code>.</li><li>Publier, puis recycler sur Reels + Shorts.</li></ol>
<div style="background:#fff7ef;border:1px solid #f0d9bd;border-radius:10px;padding:14px 16px;margin-top:18px"><strong>🔗</strong> Vérifie que ta bio TikTok pointe vers <strong>citybaddies.com</strong>.</div>
<p style="color:#888;font-size:12px;margin-top:22px">Prix relevés le jour de la génération. Cadre honnête « le moins cher chez {enseigne} ». Généré par le studio City Baddies 🐆</p></div></div>`;
  const { data, error } = await resend.emails.send({
    from, to, subject: m.subject, html,
    attachments: [
      { filename: `${m.slug}.mp4`, content: readFileSync(m.mp4).toString('base64') },
      { filename: 'cover.png', content: readFileSync(m.cover).toString('base64') },
    ],
  });
  if (error) throw new Error('Resend: ' + JSON.stringify(error));
  return data?.id;
}

/** Log une exécution dans StudioRun (audit + anti-répétition). Best-effort. */
async function logRun(row: {
  status: string; source: string; conceptTitle?: string; slugs?: string[]; story?: Story | null;
  emailId?: string | null; videoBytes?: number | null; durationMs: number; errorMessage?: string | null;
}): Promise<void> {
  try {
    await prisma.studioRun.create({
      data: {
        status: row.status, source: row.source,
        // slugs joints par ',' → l'anti-répétition les re-split (couvre single ET list).
        productSlug: row.slugs && row.slugs.length ? row.slugs.join(',') : (row.story?.slug ?? null),
        productName: row.conceptTitle ?? row.story?.displayName ?? null,
        oldPrice: row.story?.oldPrice ?? null, newPrice: row.story?.newPrice ?? null,
        gap: row.story?.gap ?? null, merchant: row.story?.merchant ?? null,
        emailId: row.emailId ?? null, videoBytes: row.videoBytes ?? null,
        durationMs: Math.round(row.durationMs), errorMessage: row.errorMessage ?? null,
      },
    });
  } catch (e) { console.warn('[studio] log StudioRun échoué:', e instanceof Error ? e.message : e); }
}

async function main() {
  const started = Date.now();
  const outDir = arg('--out') || join(ROOT, 'studio-out');
  const email = arg('--email') || 'nicolas.musicki@gmail.com';
  const source = process.env.GITHUB_ACTIONS ? 'cron' : (arg('--source') || 'manual');
  const recentDays = parseInt(arg('--exclude-days') || '14', 10);
  const dayEpoch = Math.floor(Date.now() / 864e5);
  mkdirSync(outDir, { recursive: true });
  let sel: Selection | null = null;

  try {
    // Anti-répétition : exclure les parfums déjà utilisés (succès) récemment.
    const recent = await prisma.studioRun.findMany({
      where: { status: 'success', createdAt: { gte: new Date(Date.now() - recentDays * 864e5) }, productSlug: { not: null } },
      select: { productSlug: true },
    });
    const exclude = new Set(recent.flatMap((r) => (r.productSlug ?? '').split(',')).map((s) => s.trim()).filter(Boolean));

    console.log('🎬 Studio — sélection du concept du jour…');
    const productSlug = arg('--product');
    if (productSlug) {
      // Format single forcé sur un parfum précis.
      const cat = await getCatalog({ productSlug });
      if (cat.length) {
        const story = itemToStory(cat[0]);
        sel = { conceptId: 'produit', conceptTitle: story.displayName, kind: 'single', story, slugs: [story.slug], caption: '', hashtags: '' };
      }
    } else {
      const catalog = await getCatalog();
      sel = selectForDay(catalog, exclude, { dayEpoch, conceptId: arg('--concept') });
    }
    if (!sel) { console.error('Aucune histoire exploitable (pas assez de données comparées).'); await logRun({ status: 'error', source, durationMs: Date.now() - started, errorMessage: 'no story' }); await prisma.$disconnect(); process.exit(1); }

    // Si --product : générer la légende single via concepts (pour rester cohérent).
    if (sel.conceptId === 'produit' && sel.story) {
      const { CONCEPTS } = await import('./concepts');
      const dealConcept = CONCEPTS.find((c) => c.id === 'deal-du-jour')!;
      const cat = await getCatalog({ productSlug });
      const cap = dealConcept.caption([cat[0]], dayEpoch);
      sel.caption = cap.caption; sel.hashtags = cap.hashtags;
    }

    const isList = sel.kind === 'list';
    console.log(`   Concept: ${sel.conceptTitle} [${sel.kind}] — ${sel.slugs.join(', ')}`);

    console.log('🎞️  Rendu vidéo (image par image + MP4)…');
    const { mp4, cover } = isList ? await renderList(sel, outDir) : await renderSingle(sel.story!, outDir);
    console.log(`   MP4 : ${mp4}`);

    // Dépôt automatique en BROUILLON TikTok (si configuré). Best-effort.
    let tiktokDraft = false;
    if (!has('--no-tiktok') && tiktokConfigured()) {
      try {
        console.log('📲 Dépôt du brouillon TikTok…');
        const publishId = await uploadToTikTokInbox(mp4);
        tiktokDraft = true;
        console.log(`   ✅ Brouillon déposé sur TikTok (publish_id ${publishId})`);
      } catch (e) { console.warn('   ⚠ TikTok (brouillon non déposé) :', e instanceof Error ? e.message : e); }
    }

    // Sujet + résumé email selon le format.
    const slug = isList ? sel.conceptId : sel.story!.slug;
    let subject: string, title: string, sub: string;
    if (isList) {
      const items = sel.items!;
      subject = `🎬 TikTok du jour — ${sel.conceptTitle}`;
      title = `Vidéo TikTok prête — ${sel.conceptTitle}`;
      sub = 'Le top du jour : ' + items.map((it, i) => `${i + 1}) <strong>${esc(it.displayName)}</strong> — ${eur(it.cheapest)} chez ${esc(it.cheapestMerchant)}`).join('  ·  ');
    } else {
      const s = sel.story!;
      subject = `🎬 TikTok du jour — ${s.displayName} (−${fmtInt(s.gap)} €)`;
      title = `Vidéo TikTok prête — ${s.displayName}`;
      sub = `La vidéo <strong>${esc(s.displayName)} ${esc(s.volumeLabel)}</strong> (écart <strong>${fmtInt(s.gap)} €</strong>, moins cher chez <strong>${esc(s.merchant)}</strong>).`;
    }

    let emailId: string | null = null;
    if (has('--no-email')) {
      writeFileSync(join(outDir, `${slug}-legende.txt`), sel.caption + '\n\n' + sel.hashtags);
      console.log('📄 Légende écrite (email sauté).');
    } else {
      console.log(`📧 Envoi à ${email}…`);
      emailId = (await sendEmail(email, { subject, title, sub, caption: sel.caption, hashtags: sel.hashtags, mp4, cover, slug, tiktokDraft })) ?? null;
      console.log(`   ✅ Email envoyé (id ${emailId})`);
    }

    await logRun({ status: 'success', source, conceptTitle: sel.conceptTitle, slugs: sel.slugs, story: sel.story ?? null, emailId, videoBytes: statSync(mp4).size, durationMs: Date.now() - started });
    await prisma.$disconnect();
    process.exit(0);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('Erreur fatale:', msg);
    await logRun({ status: 'error', source, conceptTitle: sel?.conceptTitle, slugs: sel?.slugs, story: sel?.story ?? null, durationMs: Date.now() - started, errorMessage: msg });
    await prisma.$disconnect();
    process.exit(1);
  }
}
main();
