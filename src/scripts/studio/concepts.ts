/**
 * Studio — CONCEPTS de vidéos qui TOURNENT selon le jour.
 * Chaque jour → un concept différent (jour % nombre de concepts), avec
 * anti-répétition des parfums (exclude) → jamais deux fois la même vidéo.
 *
 * Deux formats de rendu :
 *  - 'single' : 1 parfum, révélation du prix (template.html)
 *  - 'list'   : top 3 thématique (template-list.html)
 */
import { CatalogItem, Story, fmtInt, itemToStory } from './lib';

export interface Selection {
  conceptId: string;
  conceptTitle: string;        // titre lisible (affiché dans la vidéo liste)
  kind: 'single' | 'list';
  story?: Story;               // format single
  items?: CatalogItem[];       // format list (3 parfums)
  slugs: string[];             // parfums utilisés (log + anti-répétition)
  caption: string;
  hashtags: string;
}

// Marques "prestige" pour le concept luxe (slugs normalisés).
const LUXE = new Set([
  'chanel', 'dior', 'christian-dior', 'guerlain', 'yves-saint-laurent', 'ysl', 'giorgio-armani', 'armani',
  'hermes', 'tom-ford', 'jean-paul-gaultier', 'lancome', 'paco-rabanne', 'mugler', 'thierry-mugler',
  'viktor-rolf', 'carolina-herrera', 'prada', 'gucci', 'versace', 'valentino', 'burberry',
  'narciso-rodriguez', 'maison-margiela', 'dolce-gabbana', 'givenchy', 'chloe', 'bvlgari', 'bulgari',
  'marc-jacobs', 'azzaro', 'issey-miyake', 'kenzo', 'lolita-lempicka',
]);
// Best-sellers "culte" reconnaissables (motifs sur le nom d'affichage).
const ICONIC = /(n°?\s?5|coco mademoiselle|sauvage|j'?adore|libre|black opium|la vie est belle|1 million|angel|alien|le male|scandal|acqua di gio|\bsi\b|good girl|la petite robe noire|for her|olympea|invictus|flowerbomb|light blue|bleu de chanel|miss dior|hypnotic poison|opium|paradoxe|born in roma)/i;

/** Hash déterministe (jour → variété de template de légende, sans Math.random). */
function pickBy<T>(arr: T[], seed: number): T { return arr[((seed % arr.length) + arr.length) % arr.length]; }

const MERCHANTS_COUNT = 5;
const TAILS = [
  'tout est en bio si tu veux vérifier les prix, je compare les 5 grosses enseignes',
  'je te mets où comparer en bio, prix relevés aujourd\'hui',
  'les liens sont en bio, tu vérifies toi-même, je te mens pas',
];

/** Sélectionne dans le catalogue selon un prédicat, en évitant les parfums récents. */
function choose(catalog: CatalogItem[], pred: (i: CatalogItem) => boolean, exclude: Set<string>, n: number): CatalogItem[] | null {
  const pool = catalog.filter(pred).sort((a, b) => b.gap - a.gap);
  const fresh = pool.filter((i) => !exclude.has(i.slug));
  const chosen = [...fresh.slice(0, n)];
  if (chosen.length < n) for (const it of pool) { if (chosen.length >= n) break; if (!chosen.includes(it)) chosen.push(it); }
  return chosen.length >= n ? chosen : null;
}

interface Concept {
  id: string; title: string; kind: 'single' | 'list';
  select: (catalog: CatalogItem[], exclude: Set<string>) => CatalogItem[] | null;
  caption: (items: CatalogItem[], seed: number) => { caption: string; hashtags: string };
}

function listCaption(leads: string[], tags: string, items: CatalogItem[], seed: number) {
  const lead = pickBy(leads, seed);
  const tail = pickBy(TAILS, seed + 1);
  const first = items[0];
  const caption = `${lead} le numéro 1 c'est ${first.displayName.toLowerCase()} à ${fmtInt(first.cheapest)}€ chez ${first.cheapestMerchant.toLowerCase()}. ${tail}`;
  return { caption, hashtags: tags };
}

/** Légende "single" — voix humaine, minuscules, quasi pas d'emoji (pas d'effet IA). */
function singleCaption(items: CatalogItem[], seed: number) {
  const s = itemToStory(items[0]);
  const old = fmtInt(s.oldPrice), neuf = fmtInt(s.newPrice), ecart = fmtInt(s.gap);
  const name = s.displayName, vol = s.volumeLabel, chez = s.merchant;
  const templates = [
    `non mais attends. le même flacon exactement. ${name} en ${vol}, c'est ${old}€ chez la plupart des enseignes… et ${neuf}€ chez ${chez}. ${ecart}€ de différence pour le même parfum, j'hallucine. je compare tout, c'est en bio`,
    `arrête de payer ton parfum plein pot franchement. ${name} ${vol} je l'ai trouvé à ${neuf}€ chez ${chez}, alors qu'ailleurs c'est ${old}€. même bouteille hein. tout est en bio`,
    `${name}, le ${vol}. soit tu le paies ${old}€, soit tu le prends à ${neuf}€ chez ${chez}. ${ecart}€ d'écart quoi. je te mets où comparer en bio`,
    `petit reminder que le même parfum change de prix selon le site. là ${name} ${vol} à ${neuf}€ chez ${chez} au lieu de ${old}€, ça fait ${ecart}€ de moins pour rien. lien en bio`,
  ];
  const brandTag = s.brand.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
  const hashtags = `#parfum #bonplan ${brandTag ? '#' + brandTag + ' ' : ''}#perfumetok #parfumpascher`.replace(/\s+/g, ' ').trim();
  return { caption: pickBy(templates, seed), hashtags };
}

// L'ORDRE définit la rotation (jour % CONCEPTS.length).
export const CONCEPTS: Concept[] = [
  {
    id: 'deal-du-jour', title: 'Le deal du jour', kind: 'single',
    select: (c, ex) => choose(c, () => true, ex, 1),
    caption: singleCaption,
  },
  {
    id: 'luxe-moins-100', title: '3 parfums de luxe à moins de 100 €', kind: 'list',
    select: (c, ex) => choose(c, (i) => LUXE.has(i.brandSlug) && i.cheapest < 100, ex, 3),
    caption: (it, s) => listCaption(
      ['franchement le luxe à moins de 100 balles ça existe, faut juste savoir où regarder.', 'le top 3 des parfums de luxe qui coûtent moins de 100€ si t\'achètes au bon endroit.'],
      '#parfum #parfumdeluxe #bonplan #perfumetok #parfumpascher', it, s),
  },
  {
    id: 'moins-50', title: '3 parfums canons à moins de 50 €', kind: 'list',
    select: (c, ex) => choose(c, (i) => i.cheapest < 50, ex, 3),
    caption: (it, s) => listCaption(
      ['petit budget mais tu veux sentir bon ? voilà 3 parfums à moins de 50€.', 'le top 3 des parfums à moins de 50 balles que je recommande les yeux fermés.'],
      '#parfum #petitbudget #bonplan #perfumetok #parfumpascher', it, s),
  },
  {
    id: 'grosses-economies', title: 'Tu paies trop cher (ailleurs)', kind: 'list',
    select: (c, ex) => choose(c, (i) => i.gap >= 15, ex, 3),
    caption: (it, s) => listCaption(
      ['3 parfums où tu paies vraiment trop cher si tu prends pas au bon endroit.', 'le même parfum, des écarts de prix de fou selon le site. top 3.'],
      '#parfum #bonplan #arnaque #perfumetok #parfumpascher', it, s),
  },
  {
    id: 'culte-au-meilleur-prix', title: '3 parfums culte au meilleur prix', kind: 'list',
    select: (c, ex) => choose(c, (i) => ICONIC.test(i.displayName), ex, 3),
    caption: (it, s) => listCaption(
      ['les parfums que tout le monde veut, au prix le plus bas que j\'ai trouvé.', '3 classiques que tu connais forcément, mais au meilleur prix cette fois.'],
      '#parfum #parfumculte #bonplan #perfumetok #parfumpascher', it, s),
  },
];

/**
 * Choisit le concept du jour (rotation) + les parfums, puis construit la légende.
 * `dayEpoch` = jour depuis epoch (déterministe). `conceptId` force un concept.
 * En rotation automatique, si un concept est impossible avec le catalogue du
 * jour, essaie les concepts suivants avant de revenir au format single.
 * Un concept forcé conserve le repli historique vers "deal-du-jour".
 */
export function selectForDay(
  catalog: CatalogItem[], exclude: Set<string>, opts: { dayEpoch: number; conceptId?: string },
): Selection | null {
  if (catalog.length === 0) return null;
  const seed = opts.dayEpoch;
  const forced = opts.conceptId ? CONCEPTS.find((c) => c.id === opts.conceptId) : undefined;
  const start = ((seed % CONCEPTS.length) + CONCEPTS.length) % CONCEPTS.length;
  const candidates = forced
    ? [forced, ...(forced.id === CONCEPTS[0].id ? [] : [CONCEPTS[0]])]
    : CONCEPTS.map((_, offset) => CONCEPTS[(start + offset) % CONCEPTS.length]);

  let chosen: Concept | undefined;
  let items: CatalogItem[] | null = null;
  for (const candidate of candidates) {
    items = candidate.select(catalog, exclude);
    if (items) { chosen = candidate; break; }
  }
  if (!items || items.length === 0) return null;
  if (!chosen) return null;

  const { caption, hashtags } = chosen.caption(items, seed);
  return {
    conceptId: chosen.id, conceptTitle: chosen.title, kind: chosen.kind,
    story: chosen.kind === 'single' ? itemToStory(items[0]) : undefined,
    items: chosen.kind === 'list' ? items : undefined,
    slugs: items.map((i) => i.slug), caption, hashtags,
  };
}
