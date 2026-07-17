import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * Garde d'authentification admin pour les routes API.
 *
 * Usage :
 *   const guard = await requireAdmin();
 *   if ('error' in guard) return guard.error;
 *   // ... guard.user / guard.dbUser disponibles
 *
 * Renvoie 401 si non connecté, 403 si connecté mais non-admin.
 */
export async function requireAdmin(): Promise<
  | { error: NextResponse }
  | { user: { id: string }; dbUser: { isAdmin: boolean } }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: 'Non authentifié' }, { status: 401 }) };
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { isAdmin: true },
  });

  if (!dbUser?.isAdmin) {
    return { error: NextResponse.json({ error: 'Non autorisé' }, { status: 403 }) };
  }

  return { user: { id: user.id }, dbUser };
}
