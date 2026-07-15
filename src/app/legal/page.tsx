import { Scale, Shield, FileText, Mail, Cookie, Link2, Users, AlertTriangle, Heart } from 'lucide-react';
import type { Metadata } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://citybaddies.com';

export const metadata: Metadata = {
  title: 'Mentions Légales & CGU',
  description: 'Mentions légales, conditions générales d\'utilisation et politique de confidentialité de City Baddies. Informations sur la collecte de données et vos droits.',
  keywords: [
    "mentions légales city baddies",
    "CGU",
    "conditions utilisation",
    "politique confidentialité",
    "RGPD",
  ],
  alternates: {
    canonical: `${BASE_URL}/legal`,
  },
  robots: {
    index: true,
    follow: false, // Pas besoin de suivre les liens sur une page légale
  },
};

export default function LegalPage() {
  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background Effects */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_0%,_#1a1a1a_0%,_#0a0a0a_80%)] z-0 pointer-events-none" />
      <div className="fixed top-[-10%] left-[-10%] w-[40vw] h-[40vw] bg-[#9b1515] opacity-[0.06] blur-[100px] rounded-full pointer-events-none z-0" />
      <div className="fixed bottom-[10%] right-[-5%] w-[30vw] h-[30vw] bg-[#d4a855] opacity-[0.04] blur-[120px] rounded-full pointer-events-none z-0" />

      <div className="max-w-4xl mx-auto px-4 py-16 relative z-10">
        {/* Header */}
        <div className="text-center mb-16">
          <span className="text-xs font-bold tracking-[0.3em] text-[#d4a855] uppercase border border-[#d4a855]/30 px-3 py-1 rounded-full">
            Informations légales
          </span>
          <h1 className="text-4xl sm:text-5xl font-thin text-white tracking-tight uppercase mt-6 mb-4">
            Mentions légales
          </h1>
          <p className="text-neutral-500 font-light max-w-lg mx-auto">
            Tout ce que tu dois savoir sur l&apos;utilisation de City Baddies
          </p>
        </div>

        {/* Navigation rapide */}
        <div className="flex flex-wrap justify-center gap-3 mb-12">
          <a href="#cgu" className="px-4 py-2 bg-white/5 border border-white/10 rounded-full text-xs uppercase tracking-widest text-neutral-400 hover:text-[#d4a855] hover:border-[#d4a855]/30 transition-all">
            CGU
          </a>
          <a href="#confidentialite" className="px-4 py-2 bg-white/5 border border-white/10 rounded-full text-xs uppercase tracking-widest text-neutral-400 hover:text-[#d4a855] hover:border-[#d4a855]/30 transition-all">
            Confidentialité
          </a>
          <a href="#mentions" className="px-4 py-2 bg-white/5 border border-white/10 rounded-full text-xs uppercase tracking-widest text-neutral-400 hover:text-[#d4a855] hover:border-[#d4a855]/30 transition-all">
            Mentions
          </a>
        </div>

        <div className="space-y-12">
          
          {/* ========== CONDITIONS D'UTILISATION ========== */}
          <section id="cgu" className="scroll-mt-8">
            <div className="flex items-center gap-4 mb-10 border-b border-white/5 pb-4">
              <FileText className="w-6 h-6 text-[#d4a855]" />
              <h2 className="text-2xl md:text-3xl font-thin text-white uppercase tracking-tight">
                Conditions d&apos;utilisation
              </h2>
            </div>

            <div className="space-y-6">
              {/* Acceptation */}
              <div className="bg-[#0a0a0a]/50 backdrop-blur-md border border-white/5 rounded-2xl p-6 sm:p-8">
                <h3 className="text-sm font-bold text-[#d4a855] uppercase tracking-widest mb-4">
                  1. Acceptation des conditions
                </h3>
                <div className="text-neutral-400 space-y-3 text-sm leading-relaxed">
                  <p>
                    En accédant et en utilisant City Baddies, tu acceptes d&apos;être lié(e) par les présentes 
                    conditions d&apos;utilisation. Si tu n&apos;acceptes pas ces conditions, merci de ne pas 
                    utiliser notre service.
                  </p>
                  <p>
                    Nous nous réservons le droit de modifier ces conditions à tout moment. Les modifications 
                    prennent effet dès leur publication sur le site.
                  </p>
                </div>
              </div>

              {/* Description du service */}
              <div className="bg-[#0a0a0a]/50 backdrop-blur-md border border-white/5 rounded-2xl p-6 sm:p-8">
                <h3 className="text-sm font-bold text-[#d4a855] uppercase tracking-widest mb-4">
                  2. Description du service
                </h3>
                <div className="text-neutral-400 space-y-3 text-sm leading-relaxed">
                  <p>
                    City Baddies est une plateforme de comparaison de prix de parfums. 
                    Notre service permet aux utilisateurs de :
                  </p>
                  <ul className="list-disc list-inside space-y-2 ml-2">
                    <li>Comparer les prix des parfums entre enseignes et suivre leur historique</li>
                    <li>Partager des bons plans avec la communauté</li>
                    <li>Commenter et voter sur les deals</li>
                    <li>Sauvegarder leurs deals favoris</li>
                    <li>S&apos;inscrire à notre newsletter</li>
                  </ul>
                  <p>
                    City Baddies n&apos;est pas un site marchand. Nous redirigeons vers les sites 
                    des enseignes partenaires où tu pourras effectuer tes achats.
                  </p>
                </div>
              </div>

              {/* Inscription */}
              <div className="bg-[#0a0a0a]/50 backdrop-blur-md border border-white/5 rounded-2xl p-6 sm:p-8">
                <h3 className="text-sm font-bold text-[#d4a855] uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  3. Inscription et compte utilisateur
                </h3>
                <div className="text-neutral-400 space-y-3 text-sm leading-relaxed">
                  <p>
                    Pour accéder à certaines fonctionnalités (poster des commentaires, voter, sauvegarder 
                    des favoris), tu dois créer un compte.
                  </p>
                  <p><strong className="text-white">Tu t&apos;engages à :</strong></p>
                  <ul className="list-disc list-inside space-y-2 ml-2">
                    <li>Fournir des informations exactes lors de ton inscription</li>
                    <li>Maintenir la confidentialité de ton mot de passe</li>
                    <li>Nous informer immédiatement de toute utilisation non autorisée de ton compte</li>
                    <li>Ne pas créer plusieurs comptes</li>
                  </ul>
                  <p>
                    Tu dois avoir au moins 16 ans pour créer un compte sur City Baddies.
                  </p>
                </div>
              </div>

              {/* Comportement */}
              <div className="bg-[#0a0a0a]/50 backdrop-blur-md border border-white/5 rounded-2xl p-6 sm:p-8">
                <h3 className="text-sm font-bold text-[#d4a855] uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Heart className="w-4 h-4" />
                  4. Règles de conduite
                </h3>
                <div className="text-neutral-400 space-y-3 text-sm leading-relaxed">
                  <p>
                    City Baddies est une communauté bienveillante. En utilisant notre service, tu t&apos;engages à :
                  </p>
                  <ul className="list-disc list-inside space-y-2 ml-2">
                    <li>Respecter les autres membres de la communauté</li>
                    <li>Ne pas publier de contenu offensant, discriminatoire ou illégal</li>
                    <li>Ne pas spammer ou publier de contenu publicitaire non sollicité</li>
                    <li>Ne pas usurper l&apos;identité d&apos;une autre personne</li>
                    <li>Partager uniquement des deals véridiques et actuels</li>
                  </ul>
                  <p className="text-[#d4a855]">
                    Tout manquement à ces règles pourra entraîner la suspension ou la suppression de ton compte.
                  </p>
                </div>
              </div>

              {/* Limitation de responsabilité */}
              <div className="bg-[#0a0a0a]/50 backdrop-blur-md border border-white/5 rounded-2xl p-6 sm:p-8">
                <h3 className="text-sm font-bold text-[#d4a855] uppercase tracking-widest mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  5. Limitation de responsabilité
                </h3>
                <div className="text-neutral-400 space-y-3 text-sm leading-relaxed">
                  <p>
                    Les offres et promotions affichées sur City Baddies proviennent de sources tierces. 
                    Nous faisons notre maximum pour vérifier leur exactitude, mais :
                  </p>
                  <ul className="list-disc list-inside space-y-2 ml-2">
                    <li>Les prix et disponibilités peuvent changer sans préavis</li>
                    <li>Certaines offres peuvent être épuisées ou expirées</li>
                    <li>Les conditions des offres sont définies par les enseignes partenaires</li>
                  </ul>
                  <p>
                    City Baddies ne peut être tenu responsable des transactions effectuées sur les 
                    sites des enseignes partenaires.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* ========== POLITIQUE DE CONFIDENTIALITÉ ========== */}
          <section id="confidentialite" className="scroll-mt-8">
            <div className="flex items-center gap-4 mb-10 border-b border-white/5 pb-4">
              <Shield className="w-6 h-6 text-[#d4a855]" />
              <h2 className="text-2xl md:text-3xl font-thin text-white uppercase tracking-tight">
                Politique de confidentialité
              </h2>
            </div>

            <div className="space-y-6">
              {/* Données collectées */}
              <div className="bg-[#0a0a0a]/50 backdrop-blur-md border border-white/5 rounded-2xl p-6 sm:p-8">
                <h3 className="text-sm font-bold text-[#d4a855] uppercase tracking-widest mb-4">
                  1. Données que nous collectons
                </h3>
                <div className="text-neutral-400 space-y-3 text-sm leading-relaxed">
                  <p><strong className="text-white">Données d&apos;inscription :</strong></p>
                  <ul className="list-disc list-inside space-y-1 ml-2 mb-4">
                    <li>Adresse email</li>
                    <li>Pseudo / nom d&apos;utilisateur</li>
                    <li>Mot de passe (chiffré)</li>
                  </ul>
                  <p><strong className="text-white">Données d&apos;utilisation :</strong></p>
                  <ul className="list-disc list-inside space-y-1 ml-2 mb-4">
                    <li>Deals consultés et favoris</li>
                    <li>Commentaires et votes</li>
                    <li>Préférences de navigation</li>
                  </ul>
                  <p><strong className="text-white">Données techniques :</strong></p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>Adresse IP</li>
                    <li>Type de navigateur</li>
                    <li>Pages visitées</li>
                  </ul>
                </div>
              </div>

              {/* Utilisation des données */}
              <div className="bg-[#0a0a0a]/50 backdrop-blur-md border border-white/5 rounded-2xl p-6 sm:p-8">
                <h3 className="text-sm font-bold text-[#d4a855] uppercase tracking-widest mb-4">
                  2. Comment nous utilisons tes données
                </h3>
                <div className="text-neutral-400 space-y-3 text-sm leading-relaxed">
                  <p>Tes données sont utilisées pour :</p>
                  <ul className="list-disc list-inside space-y-2 ml-2">
                    <li><strong className="text-white">Gérer ton compte</strong> : authentification, personnalisation</li>
                    <li><strong className="text-white">Améliorer le service</strong> : comprendre l&apos;utilisation du site</li>
                    <li><strong className="text-white">Communiquer avec toi</strong> : notifications, newsletter (si tu t&apos;es inscrit(e))</li>
                    <li><strong className="text-white">Assurer la sécurité</strong> : prévenir les fraudes et abus</li>
                  </ul>
                  <p className="mt-4 p-3 bg-[#d4a855]/10 border border-[#d4a855]/20 rounded-lg text-[#d4a855]">
                    🔒 Nous ne vendons JAMAIS tes données à des tiers.
                  </p>
                </div>
              </div>

              {/* Cookies */}
              <div className="bg-[#0a0a0a]/50 backdrop-blur-md border border-white/5 rounded-2xl p-6 sm:p-8">
                <h3 className="text-sm font-bold text-[#d4a855] uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Cookie className="w-4 h-4" />
                  3. Cookies
                </h3>
                <div className="text-neutral-400 space-y-3 text-sm leading-relaxed">
                  <p>Nous utilisons des cookies pour :</p>
                  <ul className="list-disc list-inside space-y-2 ml-2">
                    <li><strong className="text-white">Cookies essentiels</strong> : maintenir ta session connectée</li>
                    <li><strong className="text-white">Cookies de préférences</strong> : retenir tes choix (thème, filtres, consentement cookies)</li>
                    <li><strong className="text-white">Cookies analytiques (Google Analytics 4)</strong> : mesurer la fréquentation du site (pages vues, navigation). Ces cookies ne sont déposés <strong className="text-white">qu&apos;après ton consentement explicite</strong> via notre bandeau cookies. Les données sont anonymisées (IP anonymisée) et ne sont jamais partagées à des fins publicitaires.</li>
                  </ul>
                  <p className="mt-4">
                    Nous n&apos;utilisons <strong className="text-white">aucun cookie publicitaire</strong>, 
                    aucun pixel de tracking (Facebook Pixel, TikTok Pixel, etc.) et aucun outil de retargeting.
                  </p>
                  <p className="mt-2">
                    Tu peux <strong className="text-white">retirer ton consentement à tout moment</strong> en supprimant 
                    tes cookies navigateur ou en nous contactant. Sans consentement, seuls les cookies essentiels au fonctionnement du site sont utilisés.
                  </p>
                </div>
              </div>

              {/* Tes droits */}
              <div className="bg-[#0a0a0a]/50 backdrop-blur-md border border-white/5 rounded-2xl p-6 sm:p-8">
                <h3 className="text-sm font-bold text-[#d4a855] uppercase tracking-widest mb-4">
                  4. Tes droits (RGPD)
                </h3>
                <div className="text-neutral-400 space-y-3 text-sm leading-relaxed">
                  <p>
                    Conformément au Règlement Général sur la Protection des Données (RGPD), tu disposes des droits suivants :
                  </p>
                  <ul className="list-disc list-inside space-y-2 ml-2">
                    <li><strong className="text-white">Droit d&apos;accès</strong> : savoir quelles données nous avons sur toi</li>
                    <li><strong className="text-white">Droit de rectification</strong> : corriger tes données</li>
                    <li><strong className="text-white">Droit à l&apos;effacement</strong> : supprimer ton compte et tes données</li>
                    <li><strong className="text-white">Droit à la portabilité</strong> : récupérer tes données</li>
                    <li><strong className="text-white">Droit d&apos;opposition</strong> : te désinscrire de la newsletter</li>
                  </ul>
                  <p className="mt-4">
                    Pour exercer ces droits, contacte-nous à : 
                    <a href="mailto:contact@citybaddies.com" className="text-[#d4a855] hover:underline ml-1">
                      contact@citybaddies.com
                    </a>
                  </p>
                </div>
              </div>

              {/* Conservation */}
              <div className="bg-[#0a0a0a]/50 backdrop-blur-md border border-white/5 rounded-2xl p-6 sm:p-8">
                <h3 className="text-sm font-bold text-[#d4a855] uppercase tracking-widest mb-4">
                  5. Conservation des données
                </h3>
                <div className="text-neutral-400 space-y-3 text-sm leading-relaxed">
                  <p>Nous conservons tes données :</p>
                  <ul className="list-disc list-inside space-y-2 ml-2">
                    <li><strong className="text-white">Données de compte</strong> : tant que ton compte est actif</li>
                    <li><strong className="text-white">Après suppression</strong> : tes données sont effacées sous 30 jours</li>
                    <li><strong className="text-white">Logs techniques</strong> : 12 mois maximum</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* ========== MENTIONS LÉGALES ========== */}
          <section id="mentions" className="scroll-mt-8">
            <div className="flex items-center gap-4 mb-10 border-b border-white/5 pb-4">
              <Scale className="w-6 h-6 text-[#d4a855]" />
              <h2 className="text-2xl md:text-3xl font-thin text-white uppercase tracking-tight">
                Mentions légales
              </h2>
            </div>

            <div className="space-y-6">
              {/* Éditeur */}
              <div className="bg-[#0a0a0a]/50 backdrop-blur-md border border-white/5 rounded-2xl p-6 sm:p-8">
                <h3 className="text-sm font-bold text-[#d4a855] uppercase tracking-widest mb-4 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Éditeur du site
                </h3>
                <div className="text-neutral-400 space-y-2 text-sm">
                  <p><strong className="text-white">Nom du site :</strong> City Baddies</p>
                  <p><strong className="text-white">URL :</strong> citybaddies.com</p>
                  <p><strong className="text-white">Email :</strong> <a href="mailto:contact@citybaddies.com" className="text-[#d4a855] hover:underline">contact@citybaddies.com</a></p>
                  <p className="text-neutral-500 text-xs mt-4">
                    Ce site est édité par un particulier dans le cadre d&apos;un projet personnel.
                  </p>
                </div>
              </div>

              {/* Hébergement */}
              <div className="bg-[#0a0a0a]/50 backdrop-blur-md border border-white/5 rounded-2xl p-6 sm:p-8">
                <h3 className="text-sm font-bold text-[#d4a855] uppercase tracking-widest mb-4">
                  Hébergement
                </h3>
                <div className="text-neutral-400 space-y-2 text-sm">
                  <p><strong className="text-white">Hébergeur :</strong> Vercel Inc.</p>
                  <p><strong className="text-white">Adresse :</strong> 340 S Lemon Ave #4133, Walnut, CA 91789, USA</p>
                  <p><strong className="text-white">Site web :</strong> <a href="https://vercel.com" target="_blank" rel="noopener noreferrer" className="text-[#d4a855] hover:underline">vercel.com</a></p>
                </div>
              </div>

              {/* Propriété intellectuelle */}
              <div className="bg-[#0a0a0a]/50 backdrop-blur-md border border-white/5 rounded-2xl p-6 sm:p-8">
                <h3 className="text-sm font-bold text-[#d4a855] uppercase tracking-widest mb-4">
                  Propriété intellectuelle
                </h3>
                <div className="text-neutral-400 space-y-3 text-sm leading-relaxed">
                  <p>
                    L&apos;ensemble du contenu de ce site (design, logo, textes) est protégé par le droit 
                    d&apos;auteur. Toute reproduction sans autorisation est interdite.
                  </p>
                  <p>
                    Les marques et logos des enseignes (Sephora, Nocibé, etc.) appartiennent 
                    à leurs propriétaires respectifs.
                  </p>
                </div>
              </div>

              {/* Affiliation */}
              <div className="bg-[#0a0a0a]/50 backdrop-blur-md border border-white/5 rounded-2xl p-6 sm:p-8">
                <h3 className="text-sm font-bold text-[#d4a855] uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Link2 className="w-4 h-4" />
                  Liens d&apos;affiliation
                </h3>
                <div className="text-neutral-400 space-y-3 text-sm leading-relaxed">
                  <p>
                    Certains liens vers des sites marchands sont des <strong className="text-white">liens d&apos;affiliation</strong>. 
                    Cela signifie que nous pouvons recevoir une petite commission si tu effectues un achat via ces liens.
                  </p>
                  <p className="p-3 bg-white/5 border border-white/10 rounded-lg">
                    💡 Cette commission n&apos;entraîne <strong className="text-white">aucun surcoût</strong> pour toi et nous permet 
                    de maintenir City Baddies gratuitement.
                  </p>
                </div>
              </div>

              {/* Contact */}
              <div className="bg-[#0a0a0a]/50 backdrop-blur-md border border-white/5 rounded-2xl p-6 sm:p-8">
                <h3 className="text-sm font-bold text-[#d4a855] uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Nous contacter
                </h3>
                <div className="text-neutral-400 space-y-3 text-sm leading-relaxed">
                  <p>
                    Pour toute question concernant ces mentions légales, la politique de confidentialité, 
                    ou pour exercer tes droits sur tes données :
                  </p>
                  <a 
                    href="mailto:contact@citybaddies.com" 
                    className="inline-flex items-center gap-2 px-6 py-3 bg-[#d4a855] hover:bg-white text-black font-bold rounded-lg transition-all text-xs tracking-widest uppercase mt-2"
                  >
                    <Mail className="w-4 h-4" />
                    contact@citybaddies.com
                  </a>
                </div>
              </div>
            </div>
          </section>
        </div>

        <p className="text-center text-neutral-600 text-xs mt-16 uppercase tracking-widest">
          Dernière mise à jour : Janvier 2026
        </p>
      </div>
    </div>
  );
}
