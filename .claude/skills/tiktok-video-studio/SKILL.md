---
name: tiktok-video-studio
description: Use when the user wants a ready-to-post TikTok/Reels/Shorts video for City Baddies from real perfume price data, wants generated social/short-video content, says "fais/génère une vidéo", "du contenu TikTok", "prépare des vidéos à poster", or wants the result emailed. CityBaddies project only.
---

# TikTok Video Studio (City Baddies)

## Overview
Generates a **ready-to-post vertical MP4** (1080×1920, H.264) from real price data
in the City Baddies brand, then **emails** the video + posting kit (caption,
hashtags, sound & steps) and (optionally) **drops it in TikTok drafts**. One
command does everything; the only human step is adding a trending sound in-app.

**Concepts rotatifs (jamais deux fois la même vidéo).** Le concept tourne selon le
jour (`jour % nombre de concepts`) + anti-répétition des parfums sur N jours.
Défini dans `src/scripts/studio/concepts.ts` :
- `deal-du-jour` — 1 parfum, plus gros écart (format *single*, `template.html`).
- `luxe-moins-100` — top 3 parfums de marques prestige < 100 € (*list*, `template-list.html`).
- `moins-50` — top 3 parfums < 50 €.
- `grosses-economies` — top 3 des plus gros écarts de prix.
- `culte-au-meilleur-prix` — top 3 best-sellers iconiques au prix le plus bas.

Les sélecteurs restent **honnêtes** : la relance en cas d'exclusion pioche dans le
**même pool** (ex. « moins de 50 € » n'inclura jamais un parfum plus cher). Ajouter
un concept = pousser une entrée dans `CONCEPTS[]` (ordre = rotation).

## When to use
- "fais/génère une vidéo", "du contenu TikTok", "prépare X vidéos à poster"
- Weekly/batch social content for the perfume deals
- User wants the finished file emailed to them

## Prerequisites (check once)
- `RESEND_API_KEY` in `.env` (email). Optional `STUDIO_EMAIL_FROM` (default
  `onboarding@resend.dev` until `citybaddies.com` is verified on Resend).
- Deps installed: `playwright-core`, `ffmpeg-static` (in package.json). The
  Chromium binary must exist: `npx playwright-core install chromium` (once, or in CI).

## How to run
```bash
# Concept du jour (rotation auto), rendu + email (+ brouillon TikTok si configuré):
npx tsx src/scripts/studio/make-video.ts

# Forcer un concept précis :
npx tsx src/scripts/studio/make-video.ts --concept luxe-moins-100

# Un parfum précis (Product.slug) en format single, et/ou un destinataire :
npx tsx src/scripts/studio/make-video.ts --product yves-saint-laurent-libre-eau-de-parfum --email someone@mail.com

# Juste rendre, sans email ni TikTok (écrit MP4 + <slug>-legende.txt dans studio-out/):
npx tsx src/scripts/studio/make-video.ts --no-email --no-tiktok
```
Output lands in `studio-out/` (`<slug>.mp4`, `<slug>-cover.png`). Default recipient
is `nicolas.musicki@gmail.com`.

## Workflow when invoked
1. Run the command (auto-pick, or `--product <slug>` if the user named a perfume).
2. For **N videos**, run once per distinct product — pass different `--product`
   slugs (query the DB for high-gap products first), so you don't repeat the same story.
3. Relay the result to the user: the perfume/gap chosen, the MP4 path, and the
   email id. Remind them of the one manual step (trending sound) — it's in the email.

## Dépôt automatique en brouillon TikTok (optionnel)
Si les secrets `TIKTOK_CLIENT_KEY` / `TIKTOK_CLIENT_SECRET` / `TIKTOK_REFRESH_TOKEN`
sont présents, le script **dépose aussi la vidéo dans les brouillons TikTok**
(API Content Posting, mode inbox — pas d'audit public requis). L'utilisateur finit
dans l'app : ajout du son tendance + publication (le son n'est pas automatisable
via l'API, et c'est le levier de reach). Setup une fois : voir
`src/scripts/studio/SETUP-TIKTOK.md` (+ helper `tiktok-auth.ts` pour le refresh
token). Désactiver ponctuellement : `--no-tiktok`. Absent de config → étape sautée.

## Editing the look / copy
- Animation & layout: `src/scripts/studio/template.html` (driven by `renderAt(t)`,
  deterministic — never rely on CSS-animation timing under headless).
- Caption/hashtags & story selection: `src/scripts/studio/make-video.ts`
  (`buildCaption`, `pickStory`). Keep the honest framing: "le moins cher chez
  {enseigne}" from real relevés — never invent prices or accuse a merchant.

## Common mistakes
- **Empty/blank flacon** in the video → the product image host blocks the headless
  browser. `pickStory` prefers bot-accessible hosts (`SAFE_IMG`); if a product has
  only Sephora/Akamai images the card may render white — pick another `--product`.
- **Email 403 "domain not verified"** → keep `onboarding@resend.dev` as sender, or
  verify `citybaddies.com` on resend.com/domains and set `STUDIO_EMAIL_FROM`.
- **ffmpeg/chromium missing in CI** → add `npx playwright-core install --with-deps chromium`
  step; `ffmpeg-static` ships its own binary.
