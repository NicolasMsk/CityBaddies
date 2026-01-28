import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Multi-filtres (arrays via virgule)
    const categories = searchParams.get('categories')?.split(',').filter(Boolean) || [];
    const subcategories = searchParams.get('subcategories')?.split(',').filter(Boolean) || [];
    const subsubcategories = searchParams.get('subsubcategories')?.split(',').filter(Boolean) || [];
    const merchants = searchParams.get('merchants')?.split(',').filter(Boolean) || [];
    const brands = searchParams.get('brands')?.split(',').filter(Boolean) || [];
    const tags = searchParams.get('tags')?.split(',').filter(Boolean) || [];
    
    // Filtres simples (rétro-compatibilité)
    const category = searchParams.get('category');
    const subcategory = searchParams.get('subcategory');
    const merchant = searchParams.get('merchant');
    
    // Autres filtres
    const search = searchParams.get('search');
    const minPrice = searchParams.get('minPrice') ? parseFloat(searchParams.get('minPrice')!) : undefined;
    const maxPrice = searchParams.get('maxPrice') ? parseFloat(searchParams.get('maxPrice')!) : undefined;
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '12');
    const hotOnly = searchParams.get('hotOnly') === 'true';

    // Construire les filtres
    const where: any = {
      isExpired: false,
      score: { gte: 60 }, // Score minimum de 60/100 pour garantir la qualité
    };

    if (hotOnly) {
      where.isHot = true;
    }

    // Filtre de prix
    if (minPrice !== undefined || maxPrice !== undefined) {
      where.dealPrice = {};
      if (minPrice !== undefined) where.dealPrice.gte = minPrice;
      if (maxPrice !== undefined) where.dealPrice.lte = maxPrice;
    }

    // Multi-catégories OU catégorie simple
    const categoryFilter = categories.length > 0 ? categories : (category ? [category] : []);
    const subcategoryFilter = subcategories.length > 0 ? subcategories : (subcategory ? [subcategory] : []);
    const merchantFilter = merchants.length > 0 ? merchants : (merchant ? [merchant] : []);

    // Construire le filtre product
    const productFilter: any = {};
    
    if (categoryFilter.length > 0) {
      productFilter.category = { slug: { in: categoryFilter } };
    }
    
    if (subcategoryFilter.length > 0) {
      productFilter.subcategory = { in: subcategoryFilter };
    }
    
    if (subsubcategories.length > 0) {
      productFilter.subsubcategory = { in: subsubcategories };
    }
    
    if (merchantFilter.length > 0) {
      productFilter.merchant = { slug: { in: merchantFilter } };
    }
    
    if (brands.length > 0) {
      productFilter.brand = { in: brands };
    }

    if (Object.keys(productFilter).length > 0) {
      where.product = productFilter;
    }

    // Recherche texte
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { product: { name: { contains: search } } },
        { product: { brand: { contains: search } } },
      ];
    }

    // Filtre par tags (le deal doit contenir TOUS les tags sélectionnés)
    if (tags.length > 0) {
      where.AND = tags.map(tag => ({
        tags: { contains: tag }
      }));
    }

    // Récupérer les deals avec pagination
    const [deals, total] = await Promise.all([
      prisma.deal.findMany({
        where,
        include: {
          product: {
            include: {
              category: true,
              merchant: true,
            },
          },
        },
        orderBy: {
          [sortBy]: sortOrder,
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.deal.count({ where }),
    ]);

    return NextResponse.json({
      deals,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching deals:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des deals' },
      { status: 500 }
    );
  }
}

// POST - Créer un nouveau deal (utilisateur connecté)
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const body = await request.json();
    const { title, description, url, imageUrl, originalPrice, price, categoryId, promoCode, expiresAt } = body;

    // Validation
    if (!title || !url || !price || !categoryId) {
      return NextResponse.json({ error: 'Champs requis manquants' }, { status: 400 });
    }

    // Vérifier que la catégorie existe
    const category = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) {
      return NextResponse.json({ error: 'Catégorie non trouvée' }, { status: 404 });
    }

    // Créer ou récupérer un merchant générique "Autre"
    let merchant = await prisma.merchant.findFirst({ where: { slug: 'autre' } });
    if (!merchant) {
      merchant = await prisma.merchant.create({
        data: {
          name: 'Autre',
          slug: 'autre',
          website: 'https://autre.com',
        },
      });
    }

    // Créer un produit temporaire pour ce deal user-generated (sans prix - les prix sont dans Deal)
    const product = await prisma.product.create({
      data: {
        name: title,
        slug: `deal-${Date.now()}`,
        brand: 'Non spécifié',
        productUrl: url,
        imageUrl: imageUrl || null,
        categoryId: categoryId,
        merchantId: merchant.id,
      },
    });

    // Calculer le discount
    const discountPercent = originalPrice && price ? Math.round((1 - price / originalPrice) * 100) : 0;
    const discountAmount = originalPrice ? originalPrice - price : 0;

    // Créer le deal
    const deal = await prisma.deal.create({
      data: {
        title,
        description: description || null,
        dealPrice: price,
        originalPrice: originalPrice || price,
        discountPercent,
        discountAmount,
        promoCode: promoCode || null,
        productId: product.id,
        authorId: user.id,
        isHot: false,
        isExpired: false,
        endDate: expiresAt ? new Date(expiresAt) : null,
      },
      include: {
        product: {
          include: {
            category: true,
            merchant: true,
          },
        },
        author: {
          select: {
            id: true,
            displayName: true,
            username: true,
            avatarUrl: true,
          },
        },
      },
    });

    return NextResponse.json(deal, { status: 201 });
  } catch (error) {
    console.error('Error creating deal:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la création du deal' },
      { status: 500 }
    );
  }
}
