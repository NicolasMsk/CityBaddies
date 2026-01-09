import Link from 'next/link';
import { Heart, Sparkles, Shield, Users } from 'lucide-react';

export const metadata = {
  title: 'Qui sommes-nous | City Baddies',
  description: 'City Baddies - On trouve les meilleurs deals beauté pour toi.',
};

export default function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      {/* Hero */}
      <div className="text-center mb-16">
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
          C&apos;est quoi <span className="text-[#d4a855]">City Baddies</span> ?
        </h1>
        <p className="text-xl text-white/60 max-w-2xl mx-auto">
          Ta meilleure amie qui te dit « girl, attends, je l&apos;ai vu moins cher ailleurs ».
        </p>
      </div>

      {/* Mission */}
      <div className="bg-[#1a1a1a] rounded-2xl border border-white/10 p-8 mb-12">
        <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
          <Heart className="w-6 h-6 text-[#d4a855]" />
          Pourquoi on fait ça
        </h2>
        <p className="text-white/70 leading-relaxed">
          On en avait marre de payer plein pot alors que le même produit était à -50% 
          la semaine d&apos;avant. Alors on a créé City Baddies : on scanne Sephora, Nocibé 
          et les autres pour te trouver les vrais deals. Pas les fausses promos, 
          pas les -5% ridicules. Les vraies affaires qui valent le coup.
        </p>
      </div>

      {/* Values */}
      <div className="grid md:grid-cols-3 gap-6 mb-12">
        <div className="bg-[#1a1a1a] rounded-2xl border border-white/10 p-6 text-center">
          <div className="w-12 h-12 bg-[#7b0a0a]/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-6 h-6 text-[#d4a855]" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Zéro bullshit</h3>
          <p className="text-white/60 text-sm">
            On vérifie chaque deal. Si c&apos;est pas une vraie promo, on te la montre pas.
          </p>
        </div>
        <div className="bg-[#1a1a1a] rounded-2xl border border-white/10 p-6 text-center">
          <div className="w-12 h-12 bg-[#7b0a0a]/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-6 h-6 text-[#d4a855]" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Prix transparents</h3>
          <p className="text-white/60 text-sm">
            Historique des prix pour voir si le deal est vraiment intéressant.
          </p>
        </div>
        <div className="bg-[#1a1a1a] rounded-2xl border border-white/10 p-6 text-center">
          <div className="w-12 h-12 bg-[#7b0a0a]/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="w-6 h-6 text-[#d4a855]" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Entre baddies</h3>
          <p className="text-white/60 text-sm">
            Une communauté qui partage les bons plans. Ensemble on est plus fortes.
          </p>
        </div>
      </div>

      {/* CTA */}
      <div className="text-center">
        <Link
          href="/deals"
          className="inline-flex items-center gap-2 px-8 py-4 bg-[#7b0a0a] hover:bg-[#9b1a1a] text-white font-semibold rounded-xl transition-colors"
        >
          <Sparkles className="w-5 h-5" />
          Voir les deals
        </Link>
      </div>
    </div>
  );
}
