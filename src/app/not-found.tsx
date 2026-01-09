import Link from 'next/link';
import { Home, Search } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[#0a0a0a]">
      <div className="text-center">
        <div className="text-8xl font-bold bg-gradient-to-r from-bordeaux-500 to-bordeaux-700 bg-clip-text text-transparent mb-4">
          404
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Page non trouvée</h1>
        <p className="text-white/40 mb-8 max-w-md">
          Oups ! La page que vous cherchez n&apos;existe pas ou a été déplacée.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-bordeaux-600 to-bordeaux-700 rounded-xl text-white font-semibold hover:from-bordeaux-500 hover:to-bordeaux-600 transition-all"
          >
            <Home className="h-5 w-5" />
            Retour à l&apos;accueil
          </Link>
          <Link
            href="/deals"
            className="flex items-center gap-2 px-6 py-3 bg-[#1a1a1a] border border-white/10 rounded-xl text-white font-semibold hover:border-bordeaux-600/40 transition-all"
          >
            <Search className="h-5 w-5" />
            Voir les deals
          </Link>
        </div>
      </div>
    </div>
  );
}
