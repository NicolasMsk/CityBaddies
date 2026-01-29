import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';
    const limit = Math.min(parseInt(searchParams.get('limit') || '5'), 8);
    
    if (!query || query.trim().length < 2) {
      return NextResponse.json({ results: [], query: '', brands: [] });
    }

    // Pour SQLite, on fait une recherche simple avec LIKE (case-insensitive par défaut)
    const searchQuery = query.trim();

    // Recherche dans les deals actifs
    const deals = await prisma.deal.findMany({
      where: {
        isActive: true,
        OR: [
          // Recherche dans le titre du deal
          { title: { contains: searchQuery } },
          // Recherche dans le titre raffiné
          { refinedTitle: { contains: searchQuery } },
          // Recherche dans la marque du produit
          { product: { brand: { contains: searchQuery } } },
          // Recherche dans le nom du produit
          { product: { name: { contains: searchQuery } } },
        ]
      },
      include: {
        product: {
          include: {
            category: true,
            merchant: true,
          }
        }
      },
      orderBy: [
        { score: 'desc' },
        { discountPercent: 'desc' },
        { createdAt: 'desc' }
      ],
      take: limit * 3,
    });

    // Dédupliquer par produit (garder le meilleur deal par produit)
    const seenProducts = new Set<string>();
    const uniqueDeals = deals.filter(deal => {
      if (seenProducts.has(deal.productId)) return false;
      seenProducts.add(deal.productId);
      return true;
    }).slice(0, limit);

    // Formater les résultats
    const results = uniqueDeals.map(deal => ({
      id: deal.id,
      title: deal.refinedTitle || deal.product.name,
      brand: deal.product.brand,
      category: deal.product.category?.name,
      imageUrl: deal.product.imageUrl,
      dealPrice: deal.dealPrice,
      originalPrice: deal.originalPrice,
      discountPercent: deal.discountPercent,
      merchant: {
        name: deal.product.merchant.name,
        slug: deal.product.merchant.slug,
      },
      volume: deal.volume,
      updatedAt: deal.updatedAt,
    }));

    // Rechercher des marques correspondantes (table Brand + marques des deals trouvés)
    const brandsFromTable = await prisma.brand.findMany({
      where: {
        name: { contains: searchQuery }
      },
      take: 3,
    });

    // Extraire les marques uniques des deals trouvés (dédupliquées par nom lowercase)
    const brandsFromDeals = new Map<string, { name: string; slug: string }>();
    deals.forEach(deal => {
      const brand = deal.product.brand;
      if (brand && brand.toLowerCase().includes(searchQuery.toLowerCase())) {
        const key = brand.toLowerCase(); // Clé en lowercase pour dédupliquer
        if (!brandsFromDeals.has(key)) {
          const slug = brand.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
          brandsFromDeals.set(key, { name: brand, slug });
        }
      }
    });

    // Combiner les marques (table Brand prioritaire car bien formatée)
    const allBrands = new Map<string, { name: string; slug: string }>();
    
    // D'abord les marques de la table Brand (prioritaires)
    brandsFromTable.forEach(b => {
      allBrands.set(b.name.toLowerCase(), { name: b.name, slug: b.slug });
    });
    
    // Puis celles des deals (seulement si pas déjà présentes)
    brandsFromDeals.forEach((value, key) => {
      if (!allBrands.has(key)) {
        allBrands.set(key, value);
      }
    });

    // Convertir en array (max 3)
    const brands = Array.from(allBrands.values()).slice(0, 3);

    return NextResponse.json({
      results,
      brands,
      query,
      total: deals.length,
    });

  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la recherche', results: [], brands: [] },
      { status: 500 }
    );
  }
}
