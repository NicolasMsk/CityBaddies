import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import prisma from '@/lib/prisma';

export const metadata: Metadata = {
  title: 'Admin Dashboard | City Baddies',
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nosnippet: true,
    noimageindex: true,
    nocache: true,
  },
};

// Rendu à la demande obligatoire : la garde admin lit la session (cookies) + la DB,
// impossible à pré-rendre statiquement.
export const dynamic = 'force-dynamic';

// Garde admin SERVEUR pour toutes les pages /admin/*.
// Le middleware edge ne peut pas vérifier isAdmin (pas d'accès Prisma) — il ne
// bloquait que les non-connectés. Ici on vérifie le rôle côté serveur : un simple
// compte public ne voit plus jamais l'interface admin.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/auth/login?redirect=/admin');

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { isAdmin: true },
  });
  if (!dbUser?.isAdmin) redirect('/');

  return <>{children}</>;
}
