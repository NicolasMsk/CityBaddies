import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Récupérer l'utilisateur courant
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ user: null });
    }

    // Récupérer ou créer l'utilisateur dans Prisma
    let dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        _count: {
          select: {
            favorites: true,
            postedDeals: true,
            votes: true,
            comments: true,
          },
        },
      },
    });

    if (!dbUser) {
      // Créer l'utilisateur si n'existe pas
      dbUser = await prisma.user.create({
        data: {
          id: user.id,
          email: user.email!,
          displayName: user.user_metadata?.full_name || user.user_metadata?.display_name,
          avatarUrl: user.user_metadata?.avatar_url,
          username: user.user_metadata?.username,
        },
        include: {
          _count: {
            select: {
              favorites: true,
              postedDeals: true,
              votes: true,
              comments: true,
            },
          },
        },
      });
    }

    return NextResponse.json({ user: dbUser });
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// PATCH - Mettre à jour le profil
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const { username, displayName, bio } = await request.json();

    // Vérifier que le username est unique
    if (username) {
      const existingUser = await prisma.user.findUnique({
        where: { username },
      });
      if (existingUser && existingUser.id !== user.id) {
        return NextResponse.json({ error: 'Ce pseudo est déjà pris' }, { status: 400 });
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(username && { username }),
        ...(displayName !== undefined && { displayName }),
        ...(bio !== undefined && { bio }),
      },
      include: {
        _count: {
          select: {
            favorites: true,
            postedDeals: true,
            votes: true,
            comments: true,
          },
        },
      },
    });

    return NextResponse.json({ user: updatedUser });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
