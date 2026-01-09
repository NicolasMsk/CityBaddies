import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';

/**
 * GET /api/comments?dealId=xxx
 * Récupère les commentaires d'un deal
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dealId = searchParams.get('dealId');
    
    if (!dealId) {
      return NextResponse.json(
        { error: 'dealId requis' },
        { status: 400 }
      );
    }
    
    // Récupérer les commentaires avec leurs auteurs et réponses
    const comments = await prisma.comment.findMany({
      where: {
        dealId,
        parentId: null, // Seulement les commentaires racines
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        replies: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    
    return NextResponse.json(comments);
  } catch (error) {
    console.error('Erreur GET /api/comments:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/comments
 * Ajoute un commentaire (authentification requise)
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Authentification requise' },
        { status: 401 }
      );
    }
    
    const body = await request.json();
    const { dealId, content, parentId } = body;
    
    if (!dealId || !content || content.trim() === '') {
      return NextResponse.json(
        { error: 'dealId et content requis' },
        { status: 400 }
      );
    }
    
    // Vérifier que le deal existe
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
    });
    
    if (!deal) {
      return NextResponse.json(
        { error: 'Deal non trouvé' },
        { status: 404 }
      );
    }
    
    // Si c'est une réponse, vérifier que le parent existe
    if (parentId) {
      const parent = await prisma.comment.findUnique({
        where: { id: parentId },
      });
      
      if (!parent || parent.dealId !== dealId) {
        return NextResponse.json(
          { error: 'Commentaire parent non trouvé' },
          { status: 404 }
        );
      }
    }
    
    // Créer le commentaire
    const comment = await prisma.comment.create({
      data: {
        content: content.trim(),
        userId: user.id,
        dealId,
        parentId: parentId || null,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        replies: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });
    
    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    console.error('Erreur POST /api/comments:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/comments?id=xxx
 * Supprime un commentaire (auteur ou admin uniquement)
 */
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Authentification requise' },
        { status: 401 }
      );
    }
    
    const { searchParams } = new URL(request.url);
    const commentId = searchParams.get('id');
    
    if (!commentId) {
      return NextResponse.json(
        { error: 'id requis' },
        { status: 400 }
      );
    }
    
    // Récupérer le commentaire
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
    });
    
    if (!comment) {
      return NextResponse.json(
        { error: 'Commentaire non trouvé' },
        { status: 404 }
      );
    }
    
    // Vérifier que l'utilisateur est l'auteur ou admin
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
    });
    
    if (comment.userId !== user.id && !dbUser?.isAdmin) {
      return NextResponse.json(
        { error: 'Non autorisé' },
        { status: 403 }
      );
    }
    
    // Supprimer le commentaire (les réponses seront supprimées en cascade)
    await prisma.comment.delete({
      where: { id: commentId },
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erreur DELETE /api/comments:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
