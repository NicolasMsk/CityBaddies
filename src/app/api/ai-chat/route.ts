import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import prisma from '@/lib/prisma';

// Lazy initialization pour éviter l'erreur au build time
let openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openai;
}

// Définition des tools/functions pour le LLM
const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'search_deals',
      description: 'Recherche des deals beauté dans notre base. Utilise cette fonction quand tu sais ce que l\'utilisateur veut (catégorie, sous-catégorie, type de produit ou marque). TOUJOURS utiliser le paramètre subcategories quand possible pour des résultats précis.',
      parameters: {
        type: 'object',
        properties: {
          categories: {
            type: 'array',
            items: { type: 'string' },
            description: 'Catégories principales (slugs EXACTS): maquillage, soins-visage, soins-corps, cheveux, parfums, ongles, accessoires',
          },
          subcategories: {
            type: 'array',
            items: { type: 'string' },
            description: 'Sous-catégories pour affiner (slugs EXACTS). MAQUILLAGE: teint, yeux, levres, sourcils, palettes. SOINS VISAGE: nettoyants, serums, cremes, masques, contour-yeux. CHEVEUX: shampoings, apres-shampoings, masques-capillaires, huiles, coiffants. PARFUMS: eau-de-parfum, eau-de-toilette, brumes, coffrets-parfums. SOINS CORPS: hydratants, gommages, solaires, douche, deodorants. ONGLES: vernis, semi-permanent, faux-ongles, soins-ongles. ACCESSOIRES: pinceaux, eponges, trousses, miroirs.',
          },
          brands: {
            type: 'array',
            items: { type: 'string' },
            description: 'Marques spécifiques (ex: Dior, Chanel, Charlotte Tilbury, Lancôme, YSL, Olaplex, Clarins, Nars...)',
          },
          minPrice: {
            type: 'number',
            description: 'Prix minimum en euros',
          },
          maxPrice: {
            type: 'number',
            description: 'Prix maximum en euros',
          },
          searchTerms: {
            type: 'string',
            description: 'Termes de recherche texte. UTILISE TOUJOURS CE PARAMÈTRE quand l\'utilisateur cherche un produit spécifique (ex: mascara, fond de teint, rouge à lèvres, shampoing, sérum). C\'est le filtre le plus important pour la pertinence.',
          },
          forGift: {
            type: 'boolean',
            description: 'Si le produit est destiné à être offert en cadeau → chercher coffrets',
          },
          luxuryOnly: {
            type: 'boolean',
            description: 'Si l\'utilisateur cherche uniquement des produits de luxe/premium (tier 1)',
          },
          sortBy: {
            type: 'string',
            enum: ['score', 'price_asc', 'price_desc', 'discount'],
            description: 'Tri des résultats. "score" (défaut) = meilleurs deals, "price_asc" = moins cher d\'abord (pour "les moins cher"), "price_desc" = plus cher d\'abord, "discount" = plus grosse promo',
          },
          limit: {
            type: 'number',
            description: 'Nombre de résultats à retourner (défaut: 8, max: 15). Augmenter si le user demande "plus de deals" ou "5 deals"',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ask_clarification',
      description: 'Pose une question à l\'utilisateur pour mieux comprendre ses besoins. Utilise cette fonction UNIQUEMENT si la demande est trop vague pour chercher.',
      parameters: {
        type: 'object',
        properties: {
          question: {
            type: 'string',
            description: 'La question à poser à l\'utilisateur',
          },
          suggestions: {
            type: 'array',
            items: { type: 'string' },
            description: 'Suggestions de réponses rapides (max 4)',
          },
        },
        required: ['question'],
      },
    },
  },
];

// Système prompt pour l'assistant
const SYSTEM_PROMPT = `Tu es l'assistant shopping de City Baddies, un site de bons plans beauté premium.
Tu aides les utilisateurs à trouver les meilleurs deals parmi notre sélection chez Sephora, Nocibé et Marionnaud.

RÈGLES IMPORTANTES:
1. Sois amicale, concise et efficace. Ton branché mais pas forcé.
2. PRIVILÉGIE la recherche (search_deals) plutôt que de poser des questions. Si l'utilisateur mentionne quelque chose de concret, cherche.
3. Utilise ask_clarification UNIQUEMENT si c'est vraiment trop vague (ex: "je sais pas", "aide moi").
4. Tu parles français uniquement.
5. HONNÊTETÉ ABSOLUE: Si 0 résultat, dis clairement qu'on n'a pas ce produit.
6. searchTerms EST LE FILTRE LE PLUS IMPORTANT. Pour tout produit spécifique (mascara, fond de teint, sérum, shampoing, brosse, rouge à lèvres...), TOUJOURS remplir searchTerms. Les categories et subcategories sont des filtres complémentaires, pas suffisants seuls.
7. CONTEXTE CONVERSATIONNEL: Quand l'utilisateur dit "les moins cher", "plus de résultats", "donne m'en 5", etc. → c'est une modification de sa recherche précédente. Reprends les mêmes paramètres et ajuste (sortBy: price_asc, limit: 5, etc.). NE refais PAS une recherche complètement différente.
8. BUDGET: "les moins cher" ou "pas cher" → utilise sortBy: "price_asc" SANS maxPrice restrictif. L'utilisateur veut voir les moins chers, pas être limité à 25€.
9. QUANTITÉ: Si l'utilisateur demande "5 deals", "plus de résultats", "montre-moi plus" → utilise limit avec le nombre demandé.

CATALOGUE — CATÉGORIES ET SOUS-CATÉGORIES (utilise les slugs exacts):

📦 MAQUILLAGE (slug: "maquillage")
  Sous-catégories: teint, yeux, levres, sourcils, palettes
  Produits: fond de teint, correcteur, poudre, blush, bronzer, highlighter, primer, mascara, eyeliner, fard à paupières, rouge à lèvres, gloss, crayon lèvres

📦 SOINS VISAGE (slug: "soins-visage")
  Sous-catégories: nettoyants, serums, cremes, masques, contour-yeux
  Produits: gel nettoyant, eau micellaire, huile démaquillante, sérum hydratant, sérum anti-âge, sérum éclat, crème hydratante, crème de nuit, masque purifiant, crème contour yeux

📦 CHEVEUX (slug: "cheveux")
  Sous-catégories: shampoings, apres-shampoings, masques-capillaires, huiles, coiffants
  Produits: shampoing, après-shampoing, masque capillaire, huile cheveux, sérum pointes, laque, mousse coiffante, spray

📦 PARFUMS (slug: "parfums")
  Sous-catégories: eau-de-parfum, eau-de-toilette, brumes, coffrets-parfums
  Produits: eau de parfum femme/homme, eau de toilette, brume corps, coffret miniatures

📦 SOINS CORPS (slug: "soins-corps")
  Sous-catégories: hydratants, gommages, solaires, douche, deodorants
  Produits: lait corps, crème corps, gommage, gel douche, protection solaire, autobronzant, déodorant

📦 ONGLES (slug: "ongles")
  Sous-catégories: vernis, semi-permanent, faux-ongles, soins-ongles
  Produits: vernis, gel UV, faux ongles, base coat, top coat

📦 ACCESSOIRES (slug: "accessoires")
  Sous-catégories: pinceaux, eponges, trousses, miroirs
  Produits: pinceau teint, beauty blender, trousse, miroir grossissant

MAPPING REQUÊTES → RECHERCHE:
- "mascara" → searchTerms: "mascara", categories: ["maquillage"]
- "rouge à lèvres" → searchTerms: "rouge lèvres", categories: ["maquillage"]
- "fond de teint" → searchTerms: "fond teint", categories: ["maquillage"]
- "sérum" → searchTerms: "sérum serum", categories: ["soins-visage"]
- "crème hydratante" → searchTerms: "crème hydratante", categories: ["soins-visage"]
- "shampoing" → searchTerms: "shampoing shampooing", categories: ["cheveux"]
- "parfum femme" → searchTerms: "femme", categories: ["parfums"]
- "parfum homme" → searchTerms: "homme", categories: ["parfums"]
- "coffret" / "idée cadeau" → forGift: true
- "Dior" → brands: ["Dior"]
- "Dior parfum" → brands: ["Dior"], categories: ["parfums"]
- "maquillage pas cher" → categories: ["maquillage"], sortBy: "price_asc"
- "les moins cher" (après une recherche) → REPRENDRE la recherche précédente + sortBy: "price_asc"
- "donne moi 5 deals" → REPRENDRE la recherche précédente + limit: 5
- "anti-âge" → searchTerms: "anti-âge rides", categories: ["soins-visage"]
- "solaire" / "SPF" → searchTerms: "solaire SPF", categories: ["soins-corps"]
- "top deals" / "meilleures promos" → (pas de filtre, sortBy: "discount")
- "routine skincare" → categories: ["soins-visage"]

SUBCATEGORIES — utiliser SEULEMENT pour NAVIGUER une sous-catégorie (sans produit précis):
- "maquillage des yeux" → categories: ["maquillage"], subcategories: ["yeux"]
- "soins pour les lèvres" → categories: ["maquillage"], subcategories: ["levres"]
- "produits pour le teint" → categories: ["maquillage"], subcategories: ["teint"]
NE PAS combiner subcategories + searchTerms (trop restrictif).

BUDGET:
- "pas cher" / "petit budget" → maxPrice: 25
- "budget moyen" → maxPrice: 50
- "budget confort" → maxPrice: 100

QUAND UTILISER ask_clarification (rare):
- L'utilisateur dit juste "aide moi" ou "je sais pas quoi chercher"
- La demande est totalement ambiguë

QUAND CHERCHER DIRECTEMENT (majorité des cas):
- Tout mot-clé produit, marque, catégorie ou besoin → search_deals immédiatement
- "maquillage" seul → search_deals avec categories: ["maquillage"] (montre les meilleurs deals maquillage)
- "skincare" seul → search_deals avec categories: ["soins-visage"]
- "parfum" seul → search_deals avec categories: ["parfums"]
- "cheveux" seul → search_deals avec categories: ["cheveux"]`;

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatRequest {
  message: string;
  history: Message[];
}

// Construire les conditions de recherche textuelle
function buildSearchConditions(searchTerms: string) {
  const searchWords = searchTerms.split(/\s+/).filter(w => w.length > 2);
  if (searchWords.length === 0) return null;
  return searchWords.flatMap(word => [
    { title: { contains: word, mode: 'insensitive' as const } },
    { refinedTitle: { contains: word, mode: 'insensitive' as const } },
    { product: { name: { contains: word, mode: 'insensitive' as const } } },
    { product: { brand: { contains: word, mode: 'insensitive' as const } } },
  ]);
}

// Déterminer l'ordre de tri
function getSortOrder(sortBy?: string) {
  switch (sortBy) {
    case 'price_asc': return [{ dealPrice: 'asc' as const }];
    case 'price_desc': return [{ dealPrice: 'desc' as const }];
    case 'discount': return [{ discountPercent: 'desc' as const }];
    default: return [{ score: 'desc' as const }, { discountPercent: 'desc' as const }];
  }
}

// Fonction pour exécuter la recherche de deals
async function executeSearchDeals(params: {
  categories?: string[];
  subcategories?: string[];
  brands?: string[];
  minPrice?: number;
  maxPrice?: number;
  searchTerms?: string;
  forGift?: boolean;
  luxuryOnly?: boolean;
  sortBy?: string;
  limit?: number;
}) {
  const take = Math.min(params.limit || 8, 15);
  const orderBy = getSortOrder(params.sortBy);
  const includeRelations = { product: { include: { category: true, merchant: true } } };

  // --- Construire le filtre de base (prix, luxe, marques) ---
  const baseWhere: any = { status: 'ACTIVE' };
  const baseProductFilter: any = {};

  if (params.brands && params.brands.length > 0) {
    if (params.brands.length === 1) {
      baseProductFilter.brand = { contains: params.brands[0], mode: 'insensitive' };
    } else {
      baseProductFilter.OR = params.brands.map(brand => ({
        brand: { contains: brand, mode: 'insensitive' }
      }));
    }
  }

  if (params.minPrice !== undefined || params.maxPrice !== undefined) {
    baseWhere.dealPrice = {};
    if (params.minPrice) baseWhere.dealPrice.gte = params.minPrice;
    if (params.maxPrice) baseWhere.dealPrice.lte = params.maxPrice;
  }

  if (params.luxuryOnly) {
    baseProductFilter.brandRef = { tier: 1 };
  }

  // Construire les conditions textuelles
  const searchOr = params.searchTerms ? buildSearchConditions(params.searchTerms) : null;

  // Conditions cadeau
  let giftOr: any[] | null = null;
  if (params.forGift) {
    giftOr = ['coffret', 'set', 'kit', 'cadeau'].flatMap(word => [
      { title: { contains: word, mode: 'insensitive' } },
      { refinedTitle: { contains: word, mode: 'insensitive' } },
      { product: { name: { contains: word, mode: 'insensitive' } } },
    ]);
  }

  // --- STRATÉGIE DE RECHERCHE PROGRESSIVE ---
  // On essaie du plus précis au moins précis, mais on garde TOUJOURS searchTerms
  const strategies: Array<{ label: string; categories?: boolean; subcategories?: boolean }> = [];

  // Étape 1: Tous les filtres (category + subcategory + searchTerms)
  if (params.subcategories?.length) {
    strategies.push({ label: 'full', categories: true, subcategories: true });
  }
  // Étape 2: Category + searchTerms (sans subcategory)
  if (params.categories?.length) {
    strategies.push({ label: 'no_sub', categories: true, subcategories: false });
  }
  // Étape 3: Juste searchTerms (sans category ni subcategory)
  if (searchOr || giftOr) {
    strategies.push({ label: 'text_only', categories: false, subcategories: false });
  }
  // Étape 4: Juste category (quand pas de searchTerms, ex: "du parfum")
  if (!searchOr && params.categories?.length) {
    strategies.push({ label: 'category_only', categories: true, subcategories: false });
  }

  for (const strategy of strategies) {
    const where = { ...baseWhere };
    const productFilter = { ...baseProductFilter };

    if (strategy.categories && params.categories?.length) {
      productFilter.category = { slug: { in: params.categories } };
    }
    if (strategy.subcategories && params.subcategories?.length) {
      productFilter.subcategory = { in: params.subcategories };
    }

    // Ajouter conditions textuelles
    if (searchOr && giftOr) {
      where.AND = [{ OR: searchOr }, { OR: giftOr }];
    } else if (searchOr) {
      where.OR = searchOr;
    } else if (giftOr) {
      where.OR = giftOr;
    }

    if (Object.keys(productFilter).length > 0) {
      where.product = productFilter;
    }

    const deals = await prisma.deal.findMany({
      where,
      include: includeRelations,
      orderBy,
      take,
    });

    if (deals.length > 0) {
      return deals;
    }
  }

  // Rien trouvé même avec les fallbacks → retourner vide honnêtement
  return [];
}

export async function POST(request: NextRequest) {
  try {
    const { message, history }: ChatRequest = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'Message requis' }, { status: 400 });
    }

    // Construire l'historique des messages pour OpenAI
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history.map((msg) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      })),
      { role: 'user', content: message },
    ];

    // Appel à OpenAI avec function calling
    const response = await getOpenAI().chat.completions.create({
      model: 'gpt-4o',
      messages,
      tools,
      tool_choice: 'auto',
    });

    const assistantMessage = response.choices[0].message;

    // Si le LLM veut appeler une fonction
    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      const toolCall = assistantMessage.tool_calls[0] as any;
      const functionName = toolCall.function.name as string;
      const functionArgs = JSON.parse(toolCall.function.arguments as string);

      if (functionName === 'search_deals') {
        // Exécuter la recherche
        const deals = await executeSearchDeals(functionArgs);

        // Formater les résultats pour le frontend
        const formattedDeals = deals.map((deal) => ({
          id: deal.id,
          title: deal.refinedTitle || deal.title,
          brand: deal.product.brand,
          imageUrl: deal.product.imageUrl,
          dealPrice: deal.dealPrice,
          originalPrice: deal.originalPrice,
          discountPercent: deal.discountPercent,
          merchant: {
            name: deal.product.merchant.name,
            slug: deal.product.merchant.slug,
          },
          category: deal.product.category?.name,
          productUrl: deal.product.productUrl,
        }));

        // Générer un message adapté au résultat — TOUJOURS honnête
        let presentationMessage = '';
        if (formattedDeals.length === 0) {
          const searchDesc = [
            functionArgs.searchTerms,
            functionArgs.subcategories?.join(', '),
            functionArgs.brands?.join(', '),
          ].filter(Boolean).join(' / ');
          presentationMessage = `Désolée, je n'ai trouvé aucun deal${searchDesc ? ` pour "${searchDesc}"` : ''} en ce moment 😕 On n'a peut-être pas ce type de produit dans notre sélection. Essaie autre chose !`;
        } else if (formattedDeals.length <= 3) {
          presentationMessage = `J'ai trouvé ${formattedDeals.length} deal${formattedDeals.length > 1 ? 's' : ''} pour toi :`;
        } else {
          presentationMessage = `Voici ${formattedDeals.length} deals qui correspondent à ta recherche 🔥`;
        }

        return NextResponse.json({
          type: 'deals',
          message: presentationMessage,
          deals: formattedDeals,
          searchParams: functionArgs,
        });
      }

      if (functionName === 'ask_clarification') {
        return NextResponse.json({
          type: 'clarification',
          message: functionArgs.question,
          suggestions: functionArgs.suggestions || [],
        });
      }
    }

    // Réponse textuelle simple
    return NextResponse.json({
      type: 'message',
      message: assistantMessage.content || "Je n'ai pas compris, peux-tu reformuler ?",
    });
  } catch (error) {
    console.error('AI Chat error:', error);
    return NextResponse.json(
      { error: 'Erreur lors du traitement de la requête' },
      { status: 500 }
    );
  }
}
