import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Récupérer les favoris de l'utilisateur
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const favorites = await prisma.favorite.findMany({
      where: { userId: user.id },
      include: {
        deal: {
          include: {
            product: {
              include: {
                category: true,
                merchant: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(favorites.map(f => f.deal));
  } catch (error) {
    console.error('Error fetching favorites:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// POST - Ajouter un deal en favori
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const { dealId } = await request.json();

    if (!dealId) {
      return NextResponse.json({ error: 'dealId requis' }, { status: 400 });
    }

    // Vérifier que le deal existe
    const deal = await prisma.deal.findUnique({ where: { id: dealId } });
    if (!deal) {
      return NextResponse.json({ error: 'Deal non trouvé' }, { status: 404 });
    }

    // Créer le favori (upsert pour éviter les doublons)
    const favorite = await prisma.favorite.upsert({
      where: {
        userId_dealId: {
          userId: user.id,
          dealId,
        },
      },
      update: {},
      create: {
        userId: user.id,
        dealId,
      },
    });

    return NextResponse.json(favorite);
  } catch (error) {
    console.error('Error adding favorite:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// DELETE - Retirer un deal des favoris
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const { dealId } = await request.json();

    if (!dealId) {
      return NextResponse.json({ error: 'dealId requis' }, { status: 400 });
    }

    await prisma.favorite.deleteMany({
      where: {
        userId: user.id,
        dealId,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing favorite:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
