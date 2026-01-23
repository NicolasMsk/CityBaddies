import { NextRequest, NextResponse } from 'next/server';
import { sendWelcomeEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, username } = body;

    // Validation des paramètres
    if (!email || !username) {
      return NextResponse.json(
        { error: 'Email et username requis' },
        { status: 400 }
      );
    }

    // Validation format email basique
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Format email invalide' },
        { status: 400 }
      );
    }

    // Envoi de l'email de bienvenue
    const result = await sendWelcomeEmail({ email, username });

    if (!result.success) {
      console.error('[API] Échec envoi email de bienvenue:', result.error);
      return NextResponse.json(
        { error: 'Erreur lors de l\'envoi de l\'email' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Email de bienvenue envoyé',
      id: result.id,
    });
  } catch (error) {
    console.error('[API] Erreur endpoint welcome-email:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
