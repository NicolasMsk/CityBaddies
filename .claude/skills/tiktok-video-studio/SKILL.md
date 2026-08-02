---
name: tiktok-video-studio
description: Use when the user wants a ready-to-post TikTok/Reels/Shorts video for City Baddies from real perfume price data, wants generated social/short-video content, says "fais/génère une vidéo", "du contenu TikTok", "prépare des vidéos à poster", or wants the result emailed. CityBaddies project only.
---

# TikTok Video Studio (City Baddies)

## Overview
Generates a **ready-to-post vertical MP4** (1080×1920, H.264, ~10 s) from a real
price story in the database — animated "price drop" reveal in the City Baddies
brand — then **emails** the video + posting kit (caption, hashtags, sound & steps).
One command does everything; the only human step left is adding a trending sound
in-app when posting.

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
# Auto-pick the biggest price-gap story, render, and email it:
npx tsx src/scripts/studio/make-video.ts

# A specific perfume (Product.slug), and/or a specific recipient:
npx tsx src/scripts/studio/make-video.ts --product yves-saint-laurent-libre-eau-de-parfum --email someone@mail.com

# Just render, no email (writes MP4 + <slug>-legende.txt in studio-out/):
npx tsx src/scripts/studio/make-video.ts --no-email
```
Output lands in `studio-out/` (`<slug>.mp4`, `<slug>-cover.png`). Default recipient
is `nicolas.musicki@gmail.com`.

## Workflow when invoked
1. Run the command (auto-pick, or `--product <slug>` if the user named a perfume).
2. For **N videos**, run once per distinct product — pass different `--product`
   slugs (query the DB for high-gap products first), so you don't repeat the same story.
3. Relay the result to the user: the perfume/gap chosen, the MP4 path, and the
   email id. Remind them of the one manual step (trending sound) — it's in the email.

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
