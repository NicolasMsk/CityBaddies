import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    
    const product = await prisma.product.findUnique({
      where: { slug },
      include: {
        category: true,
        merchant: true,
        priceHistory: {
          orderBy: { date: 'asc' },
        },
        deals: {
          where: { isActive: true },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!product) {
      return NextResponse.json(
        { error: 'Produit non trouvé' },
        { status: 404 }
      );
    }

    // Calculer les statistiques de prix
    const prices = product.priceHistory.map(ph => ph.price);
    // Prix actuel = prix du deal le plus récent (ou dernier prix historique)
    const currentDeal = product.deals[0];
    const currentPrice = currentDeal?.dealPrice ?? prices[prices.length - 1] ?? 0;
    const stats = {
      current: currentPrice,
      lowest: Math.min(...prices),
      highest: Math.max(...prices),
      average: prices.reduce((a, b) => a + b, 0) / prices.length,
    };

    return NextResponse.json({
      ...product,
      priceStats: stats,
    });
  } catch (error) {
    console.error('Error fetching product:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du produit' },
      { status: 500 }
    );
  }
}
