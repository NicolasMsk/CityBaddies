/**
 * Récupère les logos des marques depuis Wikipédia (fichiers d'infobox) et les
 * stocke dans public/images/brands/{slug}.png, puis met à jour Brand.logoUrl.
 *
 * - Source : fichiers "logo" des pages Wikipédia (usage nominatif — identifier
 *   la marque dans un comparateur, même pratique que tout comparateur).
 * - Les wordmarks simples (typographie) ne posent pas de problème de droit
 *   d'auteur ; on évite les emblèmes figuratifs complexes quand possible.
 * - Fallback assumé : si aucun logo propre n'est trouvé, Brand.logoUrl reste
 *   vide et l'UI affiche le wordmark texte (déjà élégant).
 *
 * Usage : npx tsx src/scripts/fetch-brand-logos.ts [--dry-run]
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import prisma from '../lib/prisma';

const UA = { 'User-Agent': 'CityBaddiesBot/1.0 (https://citybaddies.com; contact@citybaddies.com)' };
const OUT_DIR = path.join(process.cwd(), 'public', 'images', 'brands');
const THUMB_WIDTH = 600;

// Titres de pages Wikipédia candidats par marque (essayés dans l'ordre, en puis fr)
const BRAND_TITLES: Record<string, string[]> = {
  'azzaro': ['Azzaro (fashion house)', 'Loris Azzaro'],
  'boucheron': ['Boucheron'],
  'burberry': ['Burberry'],
  'cacharel': ['Cacharel'],
  'carolina-herrera': ['Carolina Herrera (fashion house)', 'Carolina Herrera'],
  'chanel': ['Chanel'],
  'chloe': ['Chloé'],
  'christian-dior': ['Dior', 'Christian Dior (fashion house)'],
  'diesel': ['Diesel (brand)'],
  'dkny': ['DKNY'],
  'dolce-gabbana': ['Dolce & Gabbana'],
  'elie-saab': ['Elie Saab'],
  'elizabeth-arden': ['Elizabeth Arden, Inc.', 'Elizabeth Arden'],
  'giorgio-armani': ['Armani', 'Giorgio Armani'],
  'givenchy': ['Givenchy'],
  'guerlain': ['Guerlain'],
  'hermes': ['Hermès'],
  'issey-miyake': ['Issey Miyake'],
  'jean-paul-gaultier': ['Jean Paul Gaultier', 'Jean-Paul Gaultier'],
  'jimmy-choo': ['Jimmy Choo Ltd', 'Jimmy Choo'],
  'kenzo': ['Kenzo (brand)'],
  'lancome': ['Lancôme'],
  'marc-jacobs': ['Marc Jacobs'],
  'miu-miu': ['Miu Miu'],
  'narciso-rodriguez': ['Narciso Rodriguez'],
  'nina-ricci': ['Nina Ricci (brand)', 'Nina Ricci'],
  'prada': ['Prada'],
  'rabanne': ['Rabanne', 'Paco Rabanne (brand)', 'Paco Rabanne'],
  'thierry-mugler': ['Mugler', 'Thierry Mugler'],
  'tom-ford': ['Tom Ford (brand)', 'Tom Ford'],
  'valentino': ['Valentino (fashion house)'],
  'versace': ['Versace'],
  'viktor-rolf': ['Viktor & Rolf', 'Viktor&Rolf'],
  'yves-saint-laurent': ['Yves Saint Laurent (brand)', 'Saint Laurent (fashion house)'],
};

// Fichiers wiki à EXCLURE (icônes de l'interface, pas des logos de marque)
// + disambig/travaux (icônes wiki), exchange/emporio (sous-marques Armani)
const WIKI_NOISE = /commons-logo|wikidata|wiktionary|wikinews|wikiquote|wikisource|wikiversity|wikivoyage|wikibooks|wikispecies|meta[- ]?wiki|wikimedia|edit|padlock|question|increase|decrease|symbol|icon[_ ]|ambox|crystal|magnify|loudspeaker|red pog|flag of|disambig|travaux|exchange|emporio|text document/i;

async function api(lang: string, params: string): Promise<any> {
  const r = await fetch(`https://${lang}.wikipedia.org/w/api.php?${params}&format=json&origin=*`, { headers: UA });
  if (!r.ok) return null;
  return r.json();
}

/** Trouve l'URL (thumb PNG) du fichier logo de la page. */
async function findLogoUrl(title: string, lang: string, brandToken: string): Promise<string | null> {
  const j = await api(lang, `action=query&titles=${encodeURIComponent(title)}&prop=images&imlimit=100&redirects=1`);
  const page = Object.values(j?.query?.pages || {})[0] as any;
  const files: string[] = (page?.images || []).map((i: any) => i.title as string);
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const clean = files.filter(t => /\.(svg|png)$/i.test(t) && !WIKI_NOISE.test(t));
  // 1er choix : fichier "logo" ; 2e choix : fichier nommé par la marque
  // (ex: "Givenchy.svg" sans le mot logo). Déprioriser les anciens logos.
  const candidates = [
    ...clean.filter(t => /logo/i.test(t)),
    ...clean.filter(t => !/logo/i.test(t) && norm(t).includes(norm(brandToken))),
  ];
  if (candidates.length === 0) return null;
  const score = (t: string) =>
    (norm(t).includes(norm(brandToken)) ? 2 : 0) - (/old|former|ancien|\(19\d\d/i.test(t) ? 3 : 0);
  const best = [...candidates].sort((a, b) => score(b) - score(a))[0];
  const j2 = await api(lang, `action=query&titles=${encodeURIComponent(best)}&prop=imageinfo&iiprop=url|size&iiurlwidth=${THUMB_WIDTH}`);
  const info = (Object.values(j2?.query?.pages || {})[0] as any)?.imageinfo?.[0];
  return info?.thumburl || info?.url || null;
}

async function download(url: string, dest: string): Promise<boolean> {
  const r = await fetch(url, { headers: UA });
  if (!r.ok) return false;
  const ct = r.headers.get('content-type') || '';
  if (!ct.startsWith('image')) return false;
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length < 1000) return false; // fichier suspect/vide
  fs.writeFileSync(dest, buf);
  return true;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const results: { slug: string; ok: boolean; source?: string }[] = [];
  for (const [slug, titles] of Object.entries(BRAND_TITLES)) {
    const brandToken = titles[0].split(/[ (]/)[0]; // premier mot du 1er titre
    let logoUrl: string | null = null;
    let source = '';
    outer: for (const lang of ['en', 'fr']) {
      for (const title of titles) {
        try {
          logoUrl = await findLogoUrl(title, lang, brandToken);
          if (logoUrl) { source = `${lang}:${title}`; break outer; }
        } catch { /* page absente → candidat suivant */ }
      }
    }
    if (!logoUrl) {
      console.log(`✗ ${slug.padEnd(20)} — aucun logo trouvé (fallback wordmark)`);
      results.push({ slug, ok: false });
      continue;
    }
    if (dryRun) {
      console.log(`~ ${slug.padEnd(20)} → ${logoUrl.slice(0, 90)} [${source}]`);
      results.push({ slug, ok: true, source });
      continue;
    }
    const dest = path.join(OUT_DIR, `${slug}.png`);
    // Déjà téléchargé lors d'un run précédent → juste s'assurer que la DB pointe dessus
    if (fs.existsSync(dest) && fs.statSync(dest).size > 2000) {
      await prisma.brand.updateMany({ where: { slug }, data: { logoUrl: `/images/brands/${slug}.png` } });
      console.log(`= ${slug.padEnd(20)} déjà présent`);
      results.push({ slug, ok: true, source });
      continue;
    }
    const ok = await download(logoUrl, dest);
    if (ok) {
      await prisma.brand.updateMany({ where: { slug }, data: { logoUrl: `/images/brands/${slug}.png` } });
      console.log(`✓ ${slug.padEnd(20)} → /images/brands/${slug}.png [${source}]`);
    } else {
      console.log(`✗ ${slug.padEnd(20)} — téléchargement échoué (${logoUrl.slice(0, 60)})`);
    }
    results.push({ slug, ok, source });
    await new Promise(res => setTimeout(res, 1500)); // politesse API (upload.wikimedia rate-limite)
  }

  const okCount = results.filter(r => r.ok).length;
  console.log(`\n${okCount}/${results.length} logos récupérés — les autres gardent le wordmark texte.`);
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
