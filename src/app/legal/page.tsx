import { Scale, Shield, FileText } from 'lucide-react';

export const metadata = {
  title: 'Mentions légales | City Baddies',
  description: 'Mentions légales et politique de confidentialité de City Baddies.',
};

export default function LegalPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-4xl font-bold text-white mb-8 text-center">Mentions légales</h1>

      <div className="space-y-8">
        {/* Éditeur */}
        <section className="bg-[#1a1a1a] rounded-2xl border border-white/10 p-8">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-3">
            <FileText className="w-5 h-5 text-[#ff6b6b]" />
            Éditeur du site
          </h2>
          <div className="text-white/70 space-y-2">
            <p><strong className="text-white">Nom du site :</strong> City Baddies</p>
            <p><strong className="text-white">URL :</strong> citybaddies.com</p>
            <p><strong className="text-white">Contact :</strong> contact@citybaddies.com</p>
          </div>
        </section>

        {/* Hébergement */}
        <section className="bg-[#1a1a1a] rounded-2xl border border-white/10 p-8">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-3">
            <Shield className="w-5 h-5 text-[#ff6b6b]" />
            Hébergement
          </h2>
          <div className="text-white/70 space-y-2">
            <p><strong className="text-white">Hébergeur :</strong> Vercel Inc.</p>
            <p><strong className="text-white">Adresse :</strong> 340 S Lemon Ave #4133, Walnut, CA 91789, USA</p>
            <p><strong className="text-white">Site web :</strong> vercel.com</p>
          </div>
        </section>

        {/* Propriété intellectuelle */}
        <section className="bg-[#1a1a1a] rounded-2xl border border-white/10 p-8">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-3">
            <Scale className="w-5 h-5 text-[#ff6b6b]" />
            Propriété intellectuelle
          </h2>
          <div className="text-white/70 space-y-4">
            <p>
              L&apos;ensemble du contenu de ce site (textes, images, logos, icônes) est protégé par le droit 
              d&apos;auteur. Toute reproduction, même partielle, est interdite sans autorisation préalable.
            </p>
            <p>
              Les marques et logos des enseignes partenaires (Sephora, Nocibé, etc.) appartiennent à 
              leurs propriétaires respectifs.
            </p>
          </div>
        </section>

        {/* Données personnelles */}
        <section className="bg-[#1a1a1a] rounded-2xl border border-white/10 p-8">
          <h2 className="text-xl font-bold text-white mb-4">Protection des données personnelles</h2>
          <div className="text-white/70 space-y-4">
            <p>
              Conformément au Règlement Général sur la Protection des Données (RGPD), vous disposez 
              d&apos;un droit d&apos;accès, de rectification et de suppression de vos données personnelles.
            </p>
            <p>
              Les données collectées (email, nom d&apos;utilisateur) sont utilisées uniquement pour le 
              fonctionnement du service et ne sont jamais vendues à des tiers.
            </p>
            <p>
              Pour exercer vos droits, contactez-nous à : <span className="text-[#ff6b6b]">contact@citybaddies.com</span>
            </p>
          </div>
        </section>

        {/* Cookies */}
        <section className="bg-[#1a1a1a] rounded-2xl border border-white/10 p-8">
          <h2 className="text-xl font-bold text-white mb-4">Cookies</h2>
          <div className="text-white/70 space-y-4">
            <p>
              Ce site utilise des cookies techniques nécessaires au bon fonctionnement du service 
              (authentification, préférences utilisateur).
            </p>
            <p>
              Aucun cookie publicitaire ou de tracking tiers n&apos;est utilisé.
            </p>
          </div>
        </section>

        {/* Affiliation */}
        <section className="bg-[#1a1a1a] rounded-2xl border border-white/10 p-8">
          <h2 className="text-xl font-bold text-white mb-4">Liens d&apos;affiliation</h2>
          <div className="text-white/70 space-y-4">
            <p>
              Certains liens vers des sites marchands peuvent être des liens d&apos;affiliation. 
              Cela signifie que nous pouvons recevoir une commission si vous effectuez un achat 
              via ces liens, sans coût supplémentaire pour vous.
            </p>
            <p>
              Cette rémunération nous permet de maintenir le site et de continuer à vous proposer 
              les meilleures offres beauté.
            </p>
          </div>
        </section>
      </div>

      <p className="text-center text-white/40 text-sm mt-12">
        Dernière mise à jour : Décembre 2025
      </p>
    </div>
  );
}
