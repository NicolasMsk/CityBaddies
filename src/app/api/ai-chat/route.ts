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

⚠️ RÈGLE CRITIQUE N°1: CHERCHE TOUJOURS D'ABORD, PARLE ENSUITE.
NE JAMAIS affirmer qu'on a un produit ou lister des sous-catégories SANS avoir fait search_deals d'abord.
Tu ne connais PAS notre inventaire réel. Seul search_deals te dit ce qu'on a en stock.

RÈGLES:
1. Ton amical, branché, concis. Français uniquement.
2. TOUJOURS appeler search_deals en premier. Même pour une question vague comme "accessoires" ou "parfums" → cherche d'abord, décris les résultats ensuite.
3. searchTerms est OBLIGATOIRE dès que l'utilisateur mentionne un produit spécifique. Exemples: "mascara" → searchTerms: "mascara". "trousse" → searchTerms: "trousse". "brosse" → searchTerms: "brosse". TOUJOURS.
4. categories est un filtre complémentaire, il aide à affiner mais NE SUFFIT PAS seul pour un produit précis.
5. HONNÊTETÉ: Si 0 résultat, dis-le clairement. "On n'a pas ça en promo en ce moment." C'est OK.
6. PERTINENCE: Mieux vaut 0 résultat que des résultats hors-sujet.
7. ask_clarification: UNIQUEMENT si le message est totalement vide de sens ("aide moi", "je sais pas"). JAMAIS pour lister des sous-catégories.

CONTEXTE CONVERSATIONNEL:
- "les moins cher" / "moins cher" → REPRENDRE la recherche précédente + sortBy: "price_asc" (PAS maxPrice)
- "donne moi 5 deals" / "plus de résultats" → REPRENDRE la recherche précédente + limit: 5 (ou le nombre demandé)
- "et en parfum ?" → le user change de catégorie, adapter

CATÉGORIES (slugs pour le paramètre categories):
maquillage, soins-visage, soins-corps, cheveux, parfums, ongles, accessoires

COMMENT CHERCHER (exemples):
- "mascara" → searchTerms: "mascara", categories: ["maquillage"]
- "rouge à lèvres" → searchTerms: "rouge lèvres", categories: ["maquillage"]  
- "fond de teint" → searchTerms: "fond teint", categories: ["maquillage"]
- "sérum" → searchTerms: "sérum serum", categories: ["soins-visage"]
- "crème hydratante" → searchTerms: "crème hydratant", categories: ["soins-visage"]
- "shampoing" → searchTerms: "shampoing shampooing", categories: ["cheveux"]
- "parfum" (seul) → categories: ["parfums"]
- "parfum femme" → searchTerms: "femme", categories: ["parfums"]
- "Dior" → brands: ["Dior"]
- "Dior parfum" → brands: ["Dior"], categories: ["parfums"]
- "accessoires" → categories: ["accessoires"]
- "trousse" → searchTerms: "trousse", categories: ["accessoires"]
- "brosse à cheveux" → searchTerms: "brosse", categories: ["cheveux"]
- "pinceaux" → searchTerms: "pinceau pinceaux", categories: ["accessoires"]
- "coffret" / "idée cadeau" → forGift: true
- "anti-âge" → searchTerms: "anti-âge anti-rides", categories: ["soins-visage"]
- "solaire" / "SPF" → searchTerms: "solaire SPF", categories: ["soins-corps"]
- "top deals" / "meilleures promos" → sortBy: "discount" (pas de filtre)
- "maquillage pas cher" → categories: ["maquillage"], sortBy: "price_asc"

APRÈS avoir reçu les résultats de search_deals:
- Si 0 résultat: "On n'a pas de [produit] en promo actuellement." Propose une alternative logique.
- Si peu de résultats: Présente-les honnêtement. "Voici les X deals qu'on a en [catégorie]."
- Ne fais JAMAIS de promesses sur ce qu'on pourrait avoir d'autre sans chercher.`;

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

  // --- STRATÉGIE DE RECHERCHE ---
  // Règle d'or: Ne JAMAIS élargir au point de retourner des résultats hors-sujet.
  // On relaxe progressivement les filtres STRUCTURELS (category, subcategory)
  // mais on garde TOUJOURS les filtres de PERTINENCE (searchTerms, brands, gift).
  const strategies: Array<{ label: string; categories?: boolean; subcategories?: boolean }> = [];

  const hasTextFilter = !!(searchOr || giftOr);

  // Étape 1: Tous les filtres
  strategies.push({ label: 'full', categories: true, subcategories: true });

  // Étape 2: Drop subcategory, SEULEMENT si on a des searchTerms pour maintenir la pertinence
  if (params.subcategories?.length && hasTextFilter && params.categories?.length) {
    strategies.push({ label: 'no_sub', categories: true, subcategories: false });
  }

  // Étape 3: Drop category aussi, SEULEMENT si on a des searchTerms
  if (hasTextFilter && params.categories?.length) {
    strategies.push({ label: 'text_only', categories: false, subcategories: false });
  }

  // PAS de fallback "category_only" sans searchTerms quand une subcategory était demandée
  // → évite de retourner "colle à ongles" quand on cherche "trousse"

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
