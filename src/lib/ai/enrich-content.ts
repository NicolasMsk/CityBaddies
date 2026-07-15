/**
 * Génération IA du contenu éditorial produit (gpt-4o-mini, JSON).
 *
 * - seoDescription : section "Description" de la page produit (120-200 mots)
 * - whyGoodDeal : section "Notre analyse" du deal (2-3 phrases HTML)
 *
 * Retourne null sur toute erreur (l'appelant tolère et réessaie au run suivant).
 */
import OpenAI from 'openai';

// Lazy initialization pour éviter erreur au build
let _client: OpenAI | null = null;
const getClient = () => {
  if (!_client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not defined');
    }
    _client = new OpenAI({ apiKey });
  }
  return _client;
};

const SYSTEM_PROMPT = `Tu es la rédactrice beauté de City Baddies, un comparateur de prix parfums français.
Ton style : dynamique, complice, mais FACTUEL. Pas de superlatifs creux, pas d'emojis.

RÈGLE ABSOLUE — ZÉRO INVENTION (le site affiche ces textes publiquement, une info fausse = faute grave) :
- N'écris un ingrédient, un actif, une note olfactive (ex: bergamote, muguet), un pourcentage
  (ex: "92% d'origine naturelle") ou une certification QUE s'il apparaît littéralement dans les
  "Données fournies" ci-dessous (description scrapée ou INCI). Sinon, NE LE MENTIONNE PAS.
- N'invente aucun chiffre, aucune statistique, aucune durée de tenue, aucun résultat clinique.
- Interdiction de "compléter" une pyramide olfactive ou une liste d'ingrédients à partir de tes
  connaissances : si seuls 2 ingrédients sont fournis, n'en cite que 2.
- Si les données sont pauvres, fais court et générique (type de produit + marque + usage évident
  d'après le nom). Une description courte et vraie vaut mieux qu'une longue inventée.

RÈGLE PRIX — JAMAIS DE MONTANT NI DE POURCENTAGE DANS LE TEXTE :
- Les prix changent tous les jours, ton texte reste affiché des semaines. Un montant écrit
  ("à 29.90€", "-30%") devient FAUX dès que le prix bouge et contredit la page.
- N'écris donc AUCUN montant en euros ni aucun pourcentage de réduction. Les prix fournis
  servent uniquement à situer le positionnement (entrée de gamme / cœur de marché / luxe).
- Parle en termes durables : positionnement prix de la marque, intérêt de comparer les
  contenances, intérêt de surveiller l'historique.

Tu réponds UNIQUEMENT en JSON avec exactement ces deux clés :
{
  "seoDescription": "80 à 180 mots en français, décrivant le produit à partir des SEULES données fournies. Bénéfices/texture/usage uniquement s'ils sont dans les données. Aucun ingrédient/note/chiffre non fourni. Aucun prix.",
  "whyGoodDeal": "2 à 3 phrases en HTML simple (<p> uniquement), en français : positionnement prix (sans montant ni pourcentage), notoriété de la marque, pourquoi comparer les enseignes/contenances pour ce produit."
}`;

export async function generateProductContent(input: {
  productName: string;
  brand: string;
  category: string;
  scrapedDescription?: string;
  ingredients?: string;
  dealPrice: number;
  originalPrice: number;
  discountPercent: number;
  volume?: string;
}): Promise<{ seoDescription: string; whyGoodDeal: string } | null> {
  try {
    const userPrompt = [
      `Produit : ${input.productName}`,
      `Marque : ${input.brand || 'Non renseignée'}`,
      `Catégorie : ${input.category}`,
      input.volume ? `Contenance : ${input.volume}` : null,
      `Prix deal : ${input.dealPrice.toFixed(2)}€ (au lieu de ${input.originalPrice.toFixed(2)}€, -${input.discountPercent}%)`,
      input.scrapedDescription
        ? `Description scrapée : ${input.scrapedDescription.substring(0, 1200)}`
        : 'Description scrapée : (aucune)',
      input.ingredients
        ? `Ingrédients (INCI) : ${input.ingredients.substring(0, 500)}`
        : null,
    ]
      .filter(Boolean)
      .join('\n');

    const response = await getClient().chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 900,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content) as { seoDescription?: unknown; whyGoodDeal?: unknown };
    const seoDescription = typeof parsed.seoDescription === 'string' ? parsed.seoDescription.trim() : '';
    const whyGoodDeal = typeof parsed.whyGoodDeal === 'string' ? parsed.whyGoodDeal.trim() : '';
    if (!seoDescription || !whyGoodDeal) return null;

    return { seoDescription, whyGoodDeal };
  } catch (err) {
    console.warn('[ai] generateProductContent échec:', err instanceof Error ? err.message : err);
    return null;
  }
}
