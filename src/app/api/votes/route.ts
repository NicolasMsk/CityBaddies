import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST - Voter pour un deal
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const { dealId, value } = await request.json();

    if (!dealId || (value !== 1 && value !== -1)) {
      return NextResponse.json({ error: 'dealId et value (+1 ou -1) requis' }, { status: 400 });
    }

    // Vérifier que le deal existe
    const deal = await prisma.deal.findUnique({ where: { id: dealId } });
    if (!deal) {
      return NextResponse.json({ error: 'Deal non trouvé' }, { status: 404 });
    }

    // Vérifier s'il y a déjà un vote
    const existingVote = await prisma.vote.findUnique({
      where: {
        userId_dealId: {
          userId: user.id,
          dealId,
        },
      },
    });

    let voteChange = value;

    if (existingVote) {
      if (existingVote.value === value) {
        // Même vote - supprimer le vote
        await prisma.vote.delete({
          where: { id: existingVote.id },
        });
        voteChange = -value;
      } else {
        // Vote opposé - mettre à jour
        await prisma.vote.update({
          where: { id: existingVote.id },
          data: { value },
        });
        voteChange = value * 2; // De -1 à +1 = +2 ou de +1 à -1 = -2
      }
    } else {
      // Nouveau vote
      await prisma.vote.create({
        data: {
          userId: user.id,
          dealId,
          value,
        },
      });
    }

    // Mettre à jour le compteur de votes du deal
    const updatedDeal = await prisma.deal.update({
      where: { id: dealId },
      data: {
        votes: {
          increment: voteChange,
        },
        // Marquer comme HOT si beaucoup de votes positifs
        isHot: deal.votes + voteChange >= 10,
      },
    });

    // Récupérer le vote actuel de l'utilisateur
    const userVote = await prisma.vote.findUnique({
      where: {
        userId_dealId: {
          userId: user.id,
          dealId,
        },
      },
    });

    return NextResponse.json({
      votes: updatedDeal.votes,
      userVote: userVote?.value || null,
      isHot: updatedDeal.isHot,
    });
  } catch (error) {
    console.error('Error voting:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// GET - Récupérer le vote de l'utilisateur pour un deal
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ userVote: null });
    }

    const { searchParams } = new URL(request.url);
    const dealId = searchParams.get('dealId');

    if (!dealId) {
      return NextResponse.json({ error: 'dealId requis' }, { status: 400 });
    }

    const vote = await prisma.vote.findUnique({
      where: {
        userId_dealId: {
          userId: user.id,
          dealId,
        },
      },
    });

    return NextResponse.json({ userVote: vote?.value || null });
  } catch (error) {
    console.error('Error fetching vote:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
