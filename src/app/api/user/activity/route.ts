import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';

// GET - Récupérer l'activité de l'utilisateur (votes + commentaires)
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    // Récupérer les votes récents
    const votes = await prisma.vote.findMany({
      where: { userId: user.id },
      include: {
        deal: {
          include: {
            product: {
              include: {
                merchant: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    // Récupérer les commentaires récents
    const comments = await prisma.comment.findMany({
      where: { userId: user.id },
      include: {
        deal: {
          include: {
            product: {
              include: {
                merchant: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    // Combiner et trier par date
    const activity = [
      ...votes.map((v) => ({
        type: 'vote' as const,
        id: v.id,
        value: v.value,
        createdAt: v.createdAt,
        deal: v.deal,
      })),
      ...comments.map((c) => ({
        type: 'comment' as const,
        id: c.id,
        content: c.content,
        createdAt: c.createdAt,
        deal: c.deal,
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json(activity.slice(0, 30));
  } catch (error) {
    console.error('Error fetching activity:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
