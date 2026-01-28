import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import prisma from '@/lib/prisma';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Définition des tools/functions pour le LLM
const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'search_deals',
      description: 'Recherche des deals beauté selon les critères de l\'utilisateur. Utilise cette fonction quand tu as assez d\'informations pour faire une recherche.',
      parameters: {
        type: 'object',
        properties: {
          categories: {
            type: 'array',
            items: { type: 'string' },
            description: 'Catégories à filtrer: maquillage, soins-visage, soins-corps, cheveux, parfums, ongles, accessoires',
          },
          brands: {
            type: 'array',
            items: { type: 'string' },
            description: 'Marques spécifiques recherchées (ex: Dior, Chanel, Charlotte Tilbury, Lancôme, YSL...)',
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
            description: 'Termes de recherche libre (ex: rouge à lèvres, sérum, mascara...)',
          },
          forGift: {
            type: 'boolean',
            description: 'Si le produit est destiné à être offert en cadeau',
          },
          luxuryOnly: {
            type: 'boolean',
            description: 'Si l\'utilisateur cherche uniquement des produits de luxe/premium',
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
      description: 'Pose une question à l\'utilisateur pour mieux comprendre ses besoins. Utilise cette fonction si tu as besoin de plus d\'informations.',
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
const SYSTEM_PROMPT = `Tu es l'assistant shopping de City Baddies, un site de bons plans beauté.

Ton rôle est d'aider les utilisateurs à trouver les meilleurs deals sur le maquillage, skincare, parfums et soins.

Règles:
1. Sois amical et utilise un ton branché mais évite les emojis excessifs
2. POSE DES QUESTIONS pour bien cerner les besoins avant de chercher
3. Si la demande est VAGUE (ex: "maquillage", "skincare", "parfum"), utilise ask_clarification pour demander des précisions
4. Utilise search_deals SEULEMENT quand tu as un produit SPÉCIFIQUE (ex: "mascara", "fond de teint", "sérum vitamine C")
5. Privilégie les réponses courtes et punchy avec des suggestions cliquables
6. Tu parles français

QUAND POSER DES QUESTIONS (utilise ask_clarification):
- "maquillage" → Demande : teint, yeux, lèvres ou ongles ?
- "skincare" ou "soins" → Demande : nettoyant, sérum, crème, masque ?
- "parfum" → Demande : pour femme/homme ? notes préférées (floral, boisé, fruité) ?
- "cheveux" → Demande : shampoing, masque, huile, styling ?
- "cadeau" → Demande : pour qui ? quel type de produit ?

QUAND CHERCHER DIRECTEMENT (utilise search_deals):
- Produit précis mentionné : "rouge à lèvres", "mascara", "fond de teint", "sérum", "crème hydratante"
- Marque + catégorie : "Dior parfum", "Charlotte Tilbury"
- Demande très spécifique : "anti-cernes waterproof", "huile démaquillante"

Mapping catégories (utilise le slug exact):
- skincare, routine, peau, visage, sérum, crème → categories: ["soins-visage"]
- maquillage, make-up, teint, rouge à lèvres, mascara, fond de teint → categories: ["maquillage"]
- parfum, fragrance, eau de toilette → categories: ["parfums"]
- corps, body, huile → categories: ["soins-corps"]
- cheveux, shampoing, masque capillaire → categories: ["cheveux"]

Mapping budget:
- "petit budget", "pas cher" → maxPrice: 25
- "budget moyen" → maxPrice: 50
- "budget confort" → maxPrice: 100

Mapping peau:
- "peau grasse" → searchTerms: "matifiant purifiant contrôle sébum"
- "peau sèche" → searchTerms: "hydratant nourrissant"
- "peau sensible" → searchTerms: "apaisant doux sensible"
- "anti-âge" → searchTerms: "anti-âge rides fermeté"

Exemples de conversation:
- User: "Maquillage < 30€" → ask_clarification: "Quel type de maquillage t'intéresse ?" avec suggestions: ["Teint & fond de teint", "Yeux & mascara", "Lèvres", "Tout le maquillage"]
- User: "Teint & fond de teint" → search_deals avec categories: ["maquillage"], maxPrice: 30, searchTerms: "fond de teint teint"
- User: "Je cherche un mascara" → search_deals directement avec categories: ["maquillage"], searchTerms: "mascara"
- User: "Parfum Dior" → search_deals avec brands: ["Dior"], categories: ["parfums"]`;

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
  brands?: string[];
  minPrice?: number;
  maxPrice?: number;
  searchTerms?: string;
  forGift?: boolean;
  luxuryOnly?: boolean;
}) {
  const where: any = {
    isExpired: false,
    score: { gte: 50 }, // Filtrage par score de qualité du deal
  };

  const productFilter: any = {};

  // Filtre par catégorie
  if (params.categories && params.categories.length > 0) {
    productFilter.category = { slug: { in: params.categories } };
  }

  // Filtre par marque (plus souple avec contains)
  if (params.brands && params.brands.length > 0) {
    productFilter.OR = params.brands.map(brand => ({
      brand: { contains: brand, mode: 'insensitive' }
    }));
  }

  // Filtre par prix
  if (params.minPrice !== undefined || params.maxPrice !== undefined) {
    where.dealPrice = {};
    if (params.minPrice) where.dealPrice.gte = params.minPrice;
    if (params.maxPrice) where.dealPrice.lte = params.maxPrice;
  }

  // Recherche textuelle améliorée - recherche chaque mot séparément avec OR
  if (params.searchTerms) {
    const searchWords = params.searchTerms.split(/\s+/).filter(w => w.length > 2);
    if (searchWords.length > 0) {
      // Créer des conditions OR pour chaque mot
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

  if (Object.keys(productFilter).length > 0) {
    where.product = productFilter;
  }

  // Exécuter la recherche
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

  // FALLBACK: Si aucun résultat et qu'on avait des searchTerms, réessayer sans eux (juste catégorie + prix)
  if (deals.length === 0 && params.searchTerms && params.categories && params.categories.length > 0) {
    const fallbackWhere: any = {
      isExpired: false,
      score: { gte: 40 }, // Score plus bas pour le fallback
      product: {
        category: { slug: { in: params.categories } },
      },
    };
    
    if (params.maxPrice) {
      fallbackWhere.dealPrice = { lte: params.maxPrice };
    }

    deals = await prisma.deal.findMany({
      where: fallbackWhere,
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
    const response = await openai.chat.completions.create({
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

        // Générer un message de présentation
        let presentationMessage = '';
        if (formattedDeals.length === 0) {
          presentationMessage = "Aucun deal ne correspond à ces critères pour le moment. Essaie une recherche plus large ou une autre catégorie.";
        } else if (formattedDeals.length <= 3) {
          presentationMessage = `J'ai trouvé ${formattedDeals.length} deal${formattedDeals.length > 1 ? 's' : ''} pour toi.`;
        } else {
          presentationMessage = `Voici ${formattedDeals.length} deals qui correspondent à ta recherche :`;
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
