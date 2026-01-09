import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const deal = await prisma.deal.findUnique({
      where: { id },
      include: {
        product: {
          include: {
            category: true,
            merchant: true,
            priceHistory: {
              orderBy: { date: 'asc' },
              take: 90, // 3 mois d'historique
            },
          },
        },
      },
    });

    if (!deal) {
      return NextResponse.json(
        { error: 'Deal non trouvé' },
        { status: 404 }
      );
    }

    // Incrémenter le compteur de vues
    await prisma.deal.update({
      where: { id },
      data: { views: { increment: 1 } },
    });

    return NextResponse.json(deal);
  } catch (error) {
    console.error('Error fetching deal:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du deal' },
      { status: 500 }
    );
  }
}

// Voter pour un deal
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { vote } = await request.json(); // 'up' ou 'down'

    const deal = await prisma.deal.update({
      where: { id },
      data: {
        votes: {
          increment: vote === 'up' ? 1 : -1,
        },
      },
    });

    return NextResponse.json({ votes: deal.votes });
  } catch (error) {
    console.error('Error voting on deal:', error);
    return NextResponse.json(
      { error: 'Erreur lors du vote' },
      { status: 500 }
    );
  }
}
