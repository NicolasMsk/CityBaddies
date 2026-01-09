import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const redirect = searchParams.get('redirect') || '/';

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error && data.user) {
      // Créer ou mettre à jour l'utilisateur dans Prisma
      try {
        await prisma.user.upsert({
          where: { id: data.user.id },
          update: {
            email: data.user.email!,
            displayName: data.user.user_metadata?.full_name || data.user.user_metadata?.display_name,
            avatarUrl: data.user.user_metadata?.avatar_url,
            username: data.user.user_metadata?.username || null,
          },
          create: {
            id: data.user.id,
            email: data.user.email!,
            displayName: data.user.user_metadata?.full_name || data.user.user_metadata?.display_name,
            avatarUrl: data.user.user_metadata?.avatar_url,
            username: data.user.user_metadata?.username || null,
          },
        });
      } catch (e) {
        console.error('Error syncing user to database:', e);
      }
      
      return NextResponse.redirect(`${origin}${redirect}`);
    }
  }

  // Erreur - rediriger vers la page de login
  return NextResponse.redirect(`${origin}/auth/login?error=auth_error`);
}
