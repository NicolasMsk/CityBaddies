import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Récupérer les stats admin
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    // Vérifier que l'utilisateur est admin
    const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
    if (!dbUser?.isAdmin) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
    }

    // Récupérer les stats
    const [totalDeals, totalUsers, totalVotes, totalComments] = await Promise.all([
      prisma.deal.count(),
      prisma.user.count(),
      prisma.vote.count(),
      prisma.comment.count(),
    ]);

    // Deals en attente (user-generated, non vérifiés) - on compte ceux avec authorId
    const pendingDeals = await prisma.deal.count({
      where: {
        authorId: { not: null },
        isHot: false,
      },
    });

    return NextResponse.json({
      totalDeals,
      totalUsers,
      totalVotes,
      totalComments,
      pendingDeals,
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
