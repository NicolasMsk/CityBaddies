import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * GET /api/brands
 * Récupère toutes les marques disponibles depuis les produits actifs
 */
export async function GET() {
  try {
    // Récupérer toutes les marques distinctes des produits actifs
    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        brand: {
          not: null,
        },
      },
      select: {
        brand: true,
      },
      distinct: ['brand'],
    });

    // Extraire et trier les marques
    const brands = products
      .map(p => p.brand)
      .filter((brand): brand is string => brand !== null && brand.trim() !== '')
      .sort((a, b) => a.localeCompare(b));

    // Dédupliquer (case-insensitive) et formater
    const uniqueBrands = Array.from(
      new Map(
        brands.map(brand => [
          brand.toLowerCase(),
          {
            name: brand,
            slug: brand.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
          }
        ])
      ).values()
    );

    return NextResponse.json(uniqueBrands);
  } catch (error) {
    console.error('Error fetching brands:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des marques' },
      { status: 500 }
    );
  }
}
