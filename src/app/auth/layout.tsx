import type { Metadata } from 'next';

// Les pages d'authentification (login/signup/reset) sont des composants client
// sans <title> propre → SE Ranking les remontait en « title manquant ». Ce layout
// leur donne un title ET les passe en noindex : une page de connexion n'a aucune
// raison d'être indexée ni de ranker.
export const metadata: Metadata = {
  title: 'Connexion | City Baddies',
  robots: { index: false, follow: true },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
