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
            description: 'Termes de recherche libre pour affiner (ex: vitamine C, retinol, hydratant, anti-âge). NE PAS mettre le nom de la catégorie ou sous-catégorie ici, utilise les paramètres dédiés.',
          },
          forGift: {
            type: 'boolean',
            description: 'Si le produit est destiné à être offert en cadeau → chercher coffrets',
          },
          luxuryOnly: {
            type: 'boolean',
            description: 'Si l\'utilisateur cherche uniquement des produits de luxe/premium (tier 1)',
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
5. IMPORTANT: Quand tu présentes des résultats, sois honnête. Si rien ne correspond exactement, dis-le.

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
- "rouge à lèvres" / "lipstick" → categories: ["maquillage"], subcategories: ["levres"], searchTerms: "rouge à lèvres"
- "mascara" → categories: ["maquillage"], subcategories: ["yeux"], searchTerms: "mascara"
- "fond de teint" → categories: ["maquillage"], subcategories: ["teint"], searchTerms: "fond de teint"
- "sérum" / "serum" → categories: ["soins-visage"], subcategories: ["serums"]
- "crème visage" / "crème hydratante" → categories: ["soins-visage"], subcategories: ["cremes"]
- "shampoing" → categories: ["cheveux"], subcategories: ["shampoings"]
- "parfum femme" → categories: ["parfums"], searchTerms: "femme"
- "parfum homme" → categories: ["parfums"], searchTerms: "homme"
- "coffret" / "idée cadeau" → forGift: true, searchTerms: "coffret"
- "routine skincare" → categories: ["soins-visage"] (sans sous-catégorie pour tout voir)
- "Dior" (seul) → brands: ["Dior"]
- "Dior parfum" → brands: ["Dior"], categories: ["parfums"]
- "maquillage pas cher" → categories: ["maquillage"], maxPrice: 25
- "anti-âge" → categories: ["soins-visage"], searchTerms: "anti-âge rides"
- "peau grasse" → categories: ["soins-visage"], searchTerms: "matifiant purifiant"
- "peau sèche" → categories: ["soins-visage"], searchTerms: "hydratant nourrissant"
- "solaire" / "SPF" → categories: ["soins-corps"], subcategories: ["solaires"]
- "top deals" / "best-sellers" / "meilleures promos" → (pas de filtre, les meilleurs scores)

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
}) {
  // --- Construire le filtre principal ---
  const where: any = {
    status: 'ACTIVE',
  };

  const productFilter: any = {};

  // Filtre par catégorie
  if (params.categories && params.categories.length > 0) {
    productFilter.category = { slug: { in: params.categories } };
  }

  // Filtre par sous-catégorie (utilise le champ product.subcategory)
  if (params.subcategories && params.subcategories.length > 0) {
    productFilter.subcategory = { in: params.subcategories };
  }

  // Filtre par marque (souple avec contains)
  if (params.brands && params.brands.length > 0) {
    if (params.brands.length === 1) {
      productFilter.brand = { contains: params.brands[0], mode: 'insensitive' };
    } else {
      productFilter.OR = params.brands.map(brand => ({
        brand: { contains: brand, mode: 'insensitive' }
      }));
    }
  }

  // Filtre par prix
  if (params.minPrice !== undefined || params.maxPrice !== undefined) {
    where.dealPrice = {};
    if (params.minPrice) where.dealPrice.gte = params.minPrice;
    if (params.maxPrice) where.dealPrice.lte = params.maxPrice;
  }

  // Recherche textuelle — chaque mot en OR sur titre/nom/marque
  if (params.searchTerms) {
    const searchWords = params.searchTerms.split(/\s+/).filter(w => w.length > 2);
    if (searchWords.length > 0) {
      const searchConditions = searchWords.flatMap(word => [
        { title: { contains: word, mode: 'insensitive' } },
        { refinedTitle: { contains: word, mode: 'insensitive' } },
        { product: { name: { contains: word, mode: 'insensitive' } } },
        { product: { brand: { contains: word, mode: 'insensitive' } } },
      ]);
      where.OR = searchConditions;
    }
  }

  // Produits luxe uniquement
  if (params.luxuryOnly) {
    productFilter.brandRef = { tier: 1 };
  }

  // Filtre cadeau → chercher coffrets
  if (params.forGift) {
    const giftWords = ['coffret', 'set', 'kit', 'cadeau'];
    const giftConditions = giftWords.flatMap(word => [
      { title: { contains: word, mode: 'insensitive' } },
      { refinedTitle: { contains: word, mode: 'insensitive' } },
      { product: { name: { contains: word, mode: 'insensitive' } } },
    ]);
    // Ajouter aux conditions OR existantes ou créer
    if (where.OR) {
      where.AND = [{ OR: where.OR }, { OR: giftConditions }];
      delete where.OR;
    } else {
      where.OR = giftConditions;
    }
  }

  if (Object.keys(productFilter).length > 0) {
    where.product = productFilter;
  }

  // --- Recherche principale ---
  let deals = await prisma.deal.findMany({
    where,
    include: {
      product: {
        include: {
          category: true,
          merchant: true,
        },
      },
    },
    orderBy: [
      { score: 'desc' },
      { discountPercent: 'desc' },
    ],
    take: 12,
  });

  // --- FALLBACK PROGRESSIF ---
  // Étape 1: Si 0 résultat avec searchTerms → retenter avec juste catégorie + sous-catégorie + prix
  if (deals.length === 0 && params.searchTerms) {
    const fallback1: any = { status: 'ACTIVE', product: {} as any };
    if (params.categories?.length) {
      (fallback1.product as any).category = { slug: { in: params.categories } };
    }
    if (params.subcategories?.length) {
      (fallback1.product as any).subcategory = { in: params.subcategories };
    }
    if (params.maxPrice) fallback1.dealPrice = { lte: params.maxPrice };
    if (params.brands?.length) {
      (fallback1.product as any).brand = { contains: params.brands[0], mode: 'insensitive' };
    }
    if (Object.keys(fallback1.product).length === 0) delete fallback1.product;

    deals = await prisma.deal.findMany({
      where: fallback1,
      include: { product: { include: { category: true, merchant: true } } },
      orderBy: [{ score: 'desc' }, { discountPercent: 'desc' }],
      take: 12,
    });

    // Si c'est un fallback, on flag pour que le LLM le sache
    if (deals.length > 0) {
      (deals as any).__fallback = 'dropped_searchTerms';
    }
  }

  // Étape 2: Si toujours 0 et qu'on a une sous-catégorie → retenter avec juste catégorie (sans sous-catégorie)
  if (deals.length === 0 && params.subcategories?.length && params.categories?.length) {
    const fallback2: any = {
      status: 'ACTIVE',
      product: { category: { slug: { in: params.categories } } },
    };
    if (params.maxPrice) fallback2.dealPrice = { lte: params.maxPrice };

    deals = await prisma.deal.findMany({
      where: fallback2,
      include: { product: { include: { category: true, merchant: true } } },
      orderBy: [{ score: 'desc' }, { discountPercent: 'desc' }],
      take: 12,
    });

    if (deals.length > 0) {
      (deals as any).__fallback = 'dropped_subcategory';
    }
  }

  return deals;
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
      model: 'gpt-4o-mini',
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
        const fallbackType = (deals as any).__fallback;

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

        // Générer un message adapté au résultat
        let presentationMessage = '';
        if (formattedDeals.length === 0) {
          // Aucun résultat → message honnête avec suggestions
          const searchDesc = [
            functionArgs.categories?.join(', '),
            functionArgs.subcategories?.join(', '),
            functionArgs.brands?.join(', '),
            functionArgs.searchTerms,
          ].filter(Boolean).join(' / ');
          presentationMessage = `Désolée, je n'ai trouvé aucun deal${searchDesc ? ` pour "${searchDesc}"` : ''} en ce moment 😕 Essaie avec une recherche plus large, une autre catégorie ou une marque différente !`;
        } else if (fallbackType === 'dropped_searchTerms') {
          presentationMessage = `Je n'ai pas trouvé exactement ce que tu cherches, mais voici ${formattedDeals.length} deal${formattedDeals.length > 1 ? 's' : ''} dans la même catégorie qui pourraient t'intéresser :`;
        } else if (fallbackType === 'dropped_subcategory') {
          presentationMessage = `Pas de deal dans cette sous-catégorie précise, mais voici ${formattedDeals.length} deal${formattedDeals.length > 1 ? 's' : ''} dans la catégorie plus large :`;
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
