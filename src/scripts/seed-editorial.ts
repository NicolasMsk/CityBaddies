/**
 * Seed éditorial : pages codes promo (3 enseignes) + guides d'achat (3).
 *
 * Règles de rédaction (ligne éditoriale City Baddies) :
 * - AUCUN code promo inventé : on ne publie jamais un code qu'on n'a pas
 *   vérifié. Les pages enseignes documentent les VRAIS leviers d'économie
 *   (fidélité, périodes, formats) — les codes s'ajouteront quand il y en aura.
 * - AUCUN prix chiffré ni pourcentage figé dans les textes (ils périment).
 * - Faits durables et vérifiables uniquement (groupes propriétaires, soldes
 *   réglementées, droit de rétractation légal 14 jours).
 * - Idempotent : upsert par slug — relançable sans doublon.
 *
 * Usage : npx tsx src/scripts/seed-editorial.ts
 */
import 'dotenv/config';
import prisma from '../lib/prisma';

// ────────────────────────────────────────────────────────────────────
// Pages codes promo par enseigne
// ────────────────────────────────────────────────────────────────────

const PROMO_PAGES = [
  {
    merchantSlug: 'sephora',
    canonicalSlug: 'sephora',
    metaTitle: 'Codes promo Sephora parfum — les vrais leviers | City Baddies',
    metaDescription:
      "Codes promo Sephora : ce qui existe vraiment pour payer ton parfum moins cher — ventes privées, fidélité, bons moments. Zéro code bidon.",
    heroTitle: 'Codes promo Sephora',
    heroSubtitle: 'Les vrais leviers pour payer ton parfum moins cher — sans les codes bidons qui traînent partout.',
    introduction:
      "<p>Soyons honnêtes deux minutes : les codes promo Sephora publics et valides sont rares — l'enseigne préfère les ventes flash, les offres membres et les prix barrés. La plupart des « codes Sephora -30% » qui circulent sur les sites de coupons sont morts ou soumis à des conditions invisibles. Chez City Baddies, on ne publie jamais un code qu'on n'a pas vérifié : cette page documente ce qui fait <strong>vraiment</strong> baisser la note chez Sephora — et nos relevés de prix, six fois par jour, montrent quand c'est le bon moment.</p>",
    merchantDescription:
      "<p>Sephora, enseigne du groupe LVMH, est le leader mondial de la parfumerie sélective. Son catalogue parfums couvre toutes les grandes maisons, avec des exclusivités et des éditions limitées qu'on ne trouve nulle part ailleurs. Côté prix, Sephora joue une partition précise : peu de remises frontales, mais des ventes privées membres, des offres applicatives et des prix qui bougent plus souvent qu'on ne le croit — nos historiques en témoignent.</p>",
    merchantAdvantages: [
      { icon: '💳', title: 'Programme de fidélité', text: "Des points sur chaque achat et des offres réservées aux membres, notamment lors des ventes privées qui précèdent les soldes." },
      { icon: '⭐', title: 'Exclusivités', text: "Certaines marques et éditions ne sont vendues que chez Sephora — impossible de comparer, mais bon à savoir avant de craquer." },
      { icon: '🏬', title: 'Retrait en magasin', text: "Commande en ligne et retrait en boutique, souvent sans frais — pratique pour éviter les seuils de livraison." },
    ],
    howToUse: [
      { step: 1, title: 'Compare d’abord le prix', description: "Avant tout code, vérifie sur City Baddies si Sephora est bien la moins chère sur ta contenance — un code de réduction sur un prix plus élevé reste une mauvaise affaire." },
      { step: 2, title: 'Ajoute ton parfum au panier', description: "Choisis bien ta contenance : le prix au millilitre change tout, et les promos ne portent pas toujours sur toutes les tailles." },
      { step: 3, title: 'Repère le champ « code promo » dans le panier', description: "Colle le code avant le paiement et vérifie que la remise s'applique sur le total." },
      { step: 4, title: 'Si le code ne passe pas, n’insiste pas', description: "Il est expiré ou soumis à conditions (sélection exclue, minimum d'achat, membres uniquement). Reviens au comparateur : le meilleur prix est peut-être ailleurs aujourd'hui." },
    ],
    tips: [
      { title: 'Les ventes privées valent mieux que les codes', content: "Les fenêtres de réduction réservées aux membres du programme de fidélité sont le vrai bon plan Sephora — inscription gratuite, offres reçues par email avant les soldes." },
      { title: 'Le format bat souvent le code', content: "Passer du 30 ml au 100 ml fait baisser le prix au millilitre plus sûrement qu'un code aléatoire. Notre tableau par taille fait le calcul à chaque relevé." },
      { title: 'Vérifie le prix barré', content: "Un « -30% » ne vaut que si le prix de départ est honnête. L'historique de prix sur chaque fiche City Baddies montre si la promo est réelle." },
    ],
    bestTimeToShop:
      "Les soldes réglementées (janvier, puis juin-juillet), le Black Friday fin novembre et les ventes privées membres qui précèdent chaque période de soldes. Les fêtes (Noël, Saint-Valentin, fête des mères) multiplient les coffrets et les mises en avant — mais pas toujours les vraies baisses : c'est là que l'historique de prix fait la différence.",
    loyaltyProgram:
      "Le programme de fidélité Sephora est gratuit et cumule des points à chaque achat, convertibles en avantages. Son vrai intérêt pour ton budget parfum : l'accès aux ventes privées et aux offres membres, généralement plus généreuses que les rares codes publics.",
    shippingInfo:
      "Livraison à domicile payante sous un seuil d'achat (montant variable selon les opérations), retrait en magasin généralement gratuit. Conditions détaillées sur sephora.fr.",
    returnPolicy:
      "Droit de rétractation légal de 14 jours pour les achats en ligne ; modalités détaillées sur sephora.fr.",
    faq: [
      { question: 'Y a-t-il souvent des codes promo Sephora valides ?', answer: "Moins que ce que les sites de coupons laissent croire : Sephora privilégie les ventes flash et les offres membres plutôt que les codes publics. Quand un code fiable existe, il est généralement diffusé par l'enseigne elle-même (newsletter, application)." },
      { question: 'Les codes Sephora sont-ils cumulables avec les promos ?', answer: "En règle générale, non : la plupart des codes excluent les produits déjà remisés et certaines marques. Les conditions exactes figurent toujours dans les mentions du code." },
      { question: 'Comment savoir si un code Sephora fonctionne encore ?', answer: "Le seul test fiable est le panier : si la remise ne s'affiche pas sur le total avant paiement, le code est mort ou soumis à conditions. Ne crée pas ton compte « pour voir » — compare d'abord les prix." },
      { question: 'Comment être sûre de payer mon parfum au meilleur prix chez Sephora ?', answer: "Vérifie la fiche du parfum sur City Baddies : on relève les prix six fois par jour chez Sephora, Nocibé, Marionnaud et My-Origines, à contenance identique, avec l'historique complet. Si Sephora n'est pas la moins chère aujourd'hui, tu le verras en dix secondes." },
    ],
    conclusion:
      "<p>Le meilleur « code promo Sephora », c'est de savoir quand le prix est réellement bas. Compare ta contenance sur City Baddies, surveille l'historique, et garde les ventes privées membres pour les achats prévus à l'avance.</p>",
    relatedMerchants: 'nocibe,marionnaud',
    targetKeywords: 'code promo sephora, réduction sephora parfum, sephora pas cher, vente privée sephora',
  },
  {
    merchantSlug: 'nocibe',
    canonicalSlug: 'nocibe',
    metaTitle: 'Codes promo Nocibé parfum — les vrais leviers | City Baddies',
    metaDescription:
      "Codes promo Nocibé : promos quasi permanentes, carte de fidélité, bons moments pour acheter ton parfum. Ce qui marche vraiment, vérifié par nos relevés.",
    heroTitle: 'Codes promo Nocibé',
    heroSubtitle: "L'enseigne la plus offensive sur les prix parfum — encore faut-il séparer les vraies baisses du théâtre promotionnel.",
    introduction:
      "<p>Nocibé est, selon nos relevés quotidiens, l'enseigne la plus agressive sur les prix parfum : promotions quasi permanentes sur les grandes marques, opérations à répétition, prix barrés généreux. Bonne nouvelle pour ton budget — à condition de vérifier que la promo du jour est une vraie baisse et pas un prix barré permanent. C'est exactement ce que montre l'historique de prix de chaque fiche City Baddies.</p>",
    merchantDescription:
      "<p>Nocibé, enseigne du groupe allemand Douglas, est l'un des tout premiers réseaux de parfumeries de France. Sa stratégie commerciale repose sur des opérations promotionnelles fréquentes et une carte de fidélité largement diffusée. Résultat dans nos données : Nocibé remporte très souvent la comparaison à taille égale — mais pas toujours, et pas sur tout.</p>",
    merchantAdvantages: [
      { icon: '🏷️', title: 'Promos quasi permanentes', text: "Les grandes marques passent régulièrement en opération — nos relevés montrent des remises fréquentes sur les best-sellers." },
      { icon: '💳', title: 'Carte de fidélité', text: "La carte Nocibé cumule des avantages et donne accès à des offres dédiées, en ligne comme en magasin." },
      { icon: '🏬', title: 'Réseau dense', text: "Des centaines de magasins en France — pratique pour sentir avant d'acheter, puis commander au meilleur prix." },
    ],
    howToUse: [
      { step: 1, title: 'Compare d’abord le prix', description: "Nocibé est souvent la moins chère — mais pas toujours. Dix secondes sur la fiche City Baddies de ton parfum et tu es fixée." },
      { step: 2, title: 'Vérifie la vraie nature de la promo', description: "Un « -30% » permanent n'est pas une promo. L'historique de prix montre si le prix du jour est un vrai creux." },
      { step: 3, title: 'Applique le code dans le panier', description: "Le champ code promo apparaît au moment du panier : colle le code, valide, et vérifie la remise sur le total avant paiement." },
      { step: 4, title: 'Compare le total final', description: "Frais de livraison inclus : un code peut être annulé par des frais de port que l'enseigne d'en face n'a pas." },
    ],
    tips: [
      { title: 'Les opérations tournent vite', content: "Chez Nocibé, une promo chasse l'autre. Si le prix de ton parfum n'est pas bon aujourd'hui, il peut le devenir la semaine prochaine — l'historique City Baddies te montre la tendance." },
      { title: 'Attention aux tailles exclues', content: "Les remises ne portent pas toujours sur toutes les contenances d'une même ligne. Compare à taille égale, jamais sur le « à partir de »." },
      { title: 'La carte avant la caisse', content: "La carte de fidélité est gratuite : autant la prendre avant un achat important pour bénéficier des offres porteurs de carte." },
    ],
    bestTimeToShop:
      "Toute l'année ou presque : Nocibé enchaîne les opérations. Les pics restent les soldes réglementées (janvier, juin-juillet), le Black Friday et les fêtes. Le bon réflexe n'est pas d'attendre une date, mais de surveiller l'historique du parfum visé et d'acheter au creux.",
    loyaltyProgram:
      "La carte de fidélité Nocibé, gratuite, cumule des avantages à chaque achat et débloque des offres réservées aux porteurs — souvent plus intéressantes que les codes publics.",
    shippingInfo:
      "Livraison à domicile payante sous un seuil d'achat, retrait en magasin généralement gratuit. Conditions détaillées sur nocibe.fr.",
    returnPolicy:
      "Droit de rétractation légal de 14 jours pour les achats en ligne ; modalités détaillées sur nocibe.fr.",
    faq: [
      { question: 'Nocibé est-elle vraiment la parfumerie la moins chère ?', answer: "Souvent, mais pas systématiquement. Nos relevés à taille égale montrent que Nocibé gagne une large majorité des comparaisons — et en perd aussi. La seule réponse fiable est sur la fiche du parfum qui t'intéresse, mise à jour six fois par jour." },
      { question: 'Les promos Nocibé sont-elles de vraies promos ?', answer: "Beaucoup le sont, certaines relèvent du prix barré permanent. L'historique de prix de chaque fiche City Baddies permet de trancher en un coup d'œil : si le prix n'a jamais été au niveau du prix barré, tu sais à quoi t'en tenir." },
      { question: 'Les codes Nocibé fonctionnent-ils sur les parfums de marque ?', answer: "Selon les opérations : certains codes excluent des marques ou des produits déjà remisés. Les conditions figurent dans les mentions du code — et le test du panier reste le juge de paix." },
      { question: 'Carte de fidélité ou code promo : que privilégier ?', answer: "Les deux ne s'excluent pas. La carte est gratuite et durable ; les codes sont ponctuels. Mais avant l'un comme l'autre : vérifie que le prix de base est le bon — c'est là que se joue l'essentiel de l'économie." },
    ],
    conclusion:
      "<p>Nocibé est l'alliée numéro un des budgets parfum — à condition de garder l'œil critique. Compare à taille égale, lis l'historique, et l'enseigne devient redoutablement rentable.</p>",
    relatedMerchants: 'sephora,marionnaud',
    targetKeywords: 'code promo nocibé, réduction nocibé parfum, nocibé pas cher, carte fidélité nocibé',
  },
  {
    merchantSlug: 'marionnaud',
    canonicalSlug: 'marionnaud',
    metaTitle: 'Codes promo Marionnaud parfum — les vrais leviers | City Baddies',
    metaDescription:
      "Codes promo Marionnaud : coupons, carte de fidélité, bons moments pour acheter ton parfum moins cher. Ce qui marche vraiment, sans code bidon.",
    heroTitle: 'Codes promo Marionnaud',
    heroSubtitle: "L'enseigne des coupons et des vagues d'offres — un rythme particulier qu'il faut apprendre à lire.",
    introduction:
      "<p>Marionnaud fonctionne par vagues : des périodes calmes au prix conseillé, puis des salves de coupons et d'offres fidélité qui peuvent faire chuter la note d'un coup. Ce rythme particulier rend la comparaison indispensable — au mauvais moment, Marionnaud est souvent l'enseigne la plus chère de nos relevés ; au bon moment, elle peut créer la surprise. Cette page t'explique comment lire ce tempo, sans te faire miroiter des codes qui n'existent pas.</p>",
    merchantDescription:
      "<p>Marionnaud, propriété du groupe A.S. Watson, est l'un des réseaux de parfumeries historiques de France. Son modèle commercial mise davantage sur la fidélisation — coupons personnalisés, offres porteurs de carte — que sur la remise frontale permanente. Dans nos comparaisons à taille égale, l'enseigne est moins souvent la moins chère que ses concurrentes, mais ses opérations ponctuelles méritent le coup d'œil.</p>",
    merchantAdvantages: [
      { icon: '🎟️', title: 'Coupons réguliers', text: "Des vagues de coupons et de réductions ciblées, souvent réservées aux porteurs de la carte de fidélité." },
      { icon: '💳', title: 'Carte de fidélité', text: "La carte Marionnaud cumule des points et débloque des offres personnalisées tout au long de l'année." },
      { icon: '🏬', title: 'Réseau historique', text: "Un maillage de magasins dense pour tester les parfums en vrai avant de comparer les prix en ligne." },
    ],
    howToUse: [
      { step: 1, title: 'Compare d’abord le prix', description: "Marionnaud est l'enseigne la plus irrégulière de nos relevés : la vérification préalable sur City Baddies y est encore plus rentable qu'ailleurs." },
      { step: 2, title: 'Ajoute le parfum au panier', description: "Vérifie la contenance : les offres Marionnaud portent souvent sur des références précises, pas sur toute une ligne." },
      { step: 3, title: 'Applique le coupon ou le code', description: "Le champ dédié apparaît dans le panier. Colle le code et contrôle la remise sur le total avant de payer." },
      { step: 4, title: 'Pèse le total livré', description: "Comme partout : frais de livraison inclus, l'addition peut changer d'enseigne gagnante." },
    ],
    tips: [
      { title: 'Le tempo Marionnaud', content: "Prix pleins la plupart du temps, puis vagues d'offres. Si ton achat n'est pas urgent, mets le parfum en suivi et attends que l'historique montre un creux." },
      { title: 'La carte change la donne', content: "Une partie des meilleures offres Marionnaud est réservée aux porteurs de la carte de fidélité — gratuite, autant la prendre." },
      { title: 'Ne te fie pas au prix barré', content: "Comme partout, la référence n'est pas le prix barré affiché mais l'historique réel du prix — visible sur chaque fiche City Baddies." },
    ],
    bestTimeToShop:
      "Les soldes réglementées (janvier, juin-juillet), le Black Friday, et surtout les vagues de coupons propres à l'enseigne, difficiles à prévoir — d'où l'intérêt de suivre l'historique de prix du parfum visé plutôt que d'acheter à l'aveugle.",
    loyaltyProgram:
      "La carte de fidélité Marionnaud, gratuite, cumule des points convertibles en avantages et donne accès à des offres personnalisées — le cœur du modèle promotionnel de l'enseigne.",
    shippingInfo:
      "Livraison à domicile payante sous un seuil d'achat, retrait en magasin selon disponibilité. Conditions détaillées sur marionnaud.fr.",
    returnPolicy:
      "Droit de rétractation légal de 14 jours pour les achats en ligne ; modalités détaillées sur marionnaud.fr.",
    faq: [
      { question: 'Marionnaud est-elle chère par rapport à Sephora et Nocibé ?', answer: "Hors opérations, souvent oui — c'est ce que montrent nos relevés à taille égale. Mais les vagues de coupons peuvent inverser ponctuellement la donne : la fiche du parfum, mise à jour six fois par jour, donne la réponse du moment." },
      { question: 'Où trouver les coupons Marionnaud ?', answer: "Principalement via la carte de fidélité et la newsletter de l'enseigne : les meilleures offres sont personnalisées et envoyées directement aux clientes. Les sites de coupons tiers recyclent surtout des codes expirés." },
      { question: 'Les offres Marionnaud sont-elles cumulables ?', answer: "Rarement : coupons et remises s'excluent le plus souvent entre eux et excluent certaines marques. Les conditions exactes figurent sur chaque offre." },
      { question: 'Comment acheter malin chez Marionnaud ?', answer: "Prends la carte (gratuite), inscris-toi à la newsletter, et surtout : compare le prix final sur City Baddies avant de valider. Au mauvais moment, la même bouteille coûte parfois nettement moins cher en face." },
    ],
    conclusion:
      "<p>Marionnaud récompense la patience : au bon moment, avec le bon coupon, l'enseigne peut battre tout le monde. Le reste du temps, nos relevés t'éviteront de payer le prix fort.</p>",
    relatedMerchants: 'sephora,nocibe',
    targetKeywords: 'code promo marionnaud, coupon marionnaud, réduction marionnaud parfum, carte fidélité marionnaud',
  },
];

// ────────────────────────────────────────────────────────────────────
// Guides d'achat
// ────────────────────────────────────────────────────────────────────

interface GuideSeed {
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  heroImageUrl: string;
  introduction: string;
  content: string;
  conclusion: string;
  criteria: string[];
  faq: { question: string; answer: string }[];
  tags: string;
  targetKeywords: string;
  products: {
    productNameContains: string;
    rank: number;
    badge?: string;
    miniReview: string;
    pros: string;
    cons: string;
    verdict: string;
    rating: number;
  }[];
}

const GUIDES: GuideSeed[] = [
  {
    slug: 'meilleurs-parfums-femme',
    title: 'Meilleurs parfums femme : le classement aux vrais prix',
    metaTitle: 'Meilleurs parfums femme — classement & vrais prix',
    metaDescription:
      'Notre classement des meilleurs parfums femme, avec les prix réellement relevés chez Sephora, Nocibé, Marionnaud et My-Origines — pas des impressions, des données.',
    heroImageUrl: '/images/baddies_2.png',
    introduction:
      "<p>Les classements de parfums, tout le monde en fait. La différence ici : chaque parfum de cette sélection est suivi par nos relevés de prix, six fois par jour, chez Sephora, Nocibé, Marionnaud et My-Origines. Tu sais donc non seulement <strong>lequel choisir</strong>, mais aussi <strong>où et quand l'acheter</strong>. Cinq monuments, cinq personnalités — et zéro flacon qu'on n'assumerait pas sur notre propre coiffeuse.</p>",
    content:
      "<p>Notre sélection privilégie les parfums au succès durable — pas les buzz d'une saison. Chacun est noté par la rédaction sur sa signature olfactive, sa polyvalence et son rapport plaisir/prix constaté dans nos relevés.</p>",
    conclusion:
      "<p>Un dernier conseil de baddie : le meilleur parfum est celui que tu réachètes. Commence petit format si tu hésites, compare à taille égale, et laisse l'historique de prix te dire quand craquer.</p>",
    criteria: [
      'Signature olfactive reconnaissable',
      'Succès durable (pas un buzz saisonnier)',
      'Polyvalence jour/soir',
      'Rapport plaisir/prix constaté dans nos relevés',
    ],
    faq: [
      { question: 'Quel est le meilleur parfum femme en ce moment ?', answer: "Celui qui te ressemble — mais si on parle des valeurs sûres, La Vie Est Belle, Coco Mademoiselle et Libre dominent les ventes françaises depuis des années. Notre classement détaille pourquoi, et surtout à quel prix réel." },
      { question: 'Vaut-il mieux acheter en eau de parfum ou en eau de toilette ?', answer: "L'eau de parfum tient plus longtemps, l'eau de toilette coûte moins cher à ligne identique. Pour un parfum signature porté tous les jours, l'EDP est généralement le bon calcul ; pour un parfum d'été ou de bureau, l'EDT suffit souvent." },
      { question: 'Comment payer ces parfums moins cher ?', answer: "Trois leviers : comparer les quatre enseignes à contenance identique (les écarts dépassent parfois plusieurs dizaines d'euros), choisir le format au meilleur prix au millilitre, et acheter dans un creux de l'historique — trois choses que chaque fiche City Baddies affiche." },
    ],
    tags: 'classement,best-sellers,femme',
    targetKeywords: 'meilleur parfum femme, classement parfum femme, parfum femme populaire',
    products: [
      {
        productNameContains: 'La Vie Est Belle',
        rank: 1,
        badge: 'Le Choix Baddie',
        miniReview:
          "Le best-seller français par excellence depuis 2012. Son accord iris-praline, signé par trois grands parfumeurs, a inventé une catégorie entière : le gourmand chic. Sillage généreux, compliments garantis — et, avantage pour ton budget, c'est l'un des parfums où nos relevés observent le plus d'écarts entre enseignes : le comparer avant achat rapporte presque toujours.",
        pros: 'Signature immédiatement reconnaissable|Tenue excellente|Écarts de prix fréquents entre enseignes (opportunités)',
        cons: 'Très porté — tu ne seras pas la seule|Gourmand assumé, clivant pour qui aime les parfums frais',
        verdict: "L'icône moderne. Si tu n'as qu'un parfum à connaître avant d'acheter, c'est celui-là.",
        rating: 4.7,
      },
      {
        productNameContains: 'Coco Mademoiselle',
        rank: 2,
        badge: 'La Valeur Sûre',
        miniReview:
          "L'oriental frais de Chanel, pensé pour celles qui trouvent le N°5 trop classique. Patchouli propre, orange pétillante, élégance sans effort : vingt ans après son lancement, il reste dans le trio de tête des ventes. Chanel tient ses prix — les écarts entre enseignes sont plus rares, mais nos relevés les capturent quand ils arrivent.",
        pros: 'Élégance intemporelle|Polyvalent bureau/soirée|Qualité Chanel constante',
        cons: 'Prix tenu, promos rares|Moins distinctif aujourd’hui tant il a été porté',
        verdict: 'Le chic parisien en flacon. Un investissement qui ne déçoit jamais.',
        rating: 4.6,
      },
      {
        productNameContains: 'Libre',
        rank: 3,
        badge: 'La Moderne',
        miniReview:
          "Le grand succès YSL de la décennie : une lavande — ingrédient historiquement masculin — twistée fleur d'oranger et vanille. Résultat affirmé, moderne, immédiatement identifiable. Et côté prix, c'est un des parfums les plus disputés entre enseignes selon nos relevés : rarement au même tarif partout.",
        pros: 'Signature audacieuse et moderne|Tenue solide|Prix très disputés entre enseignes',
        cons: 'La lavande divise|Moins discret qu’un floral classique',
        verdict: 'Pour celles qui veulent un parfum à caractère — et une vraie marge de négociation entre enseignes.',
        rating: 4.5,
      },
      {
        productNameContains: 'adore',
        rank: 4,
        badge: "L'Intemporel",
        miniReview:
          "J'adore, c'est le floral doré absolu : ylang, rose de Damas, jasmin — l'opulence Dior dans ce qu'elle a de plus solaire. Un parfum de femme assumée, porté par vingt-cinq ans de succès ininterrompu. Distribution sélective oblige, les écarts de prix sont mesurés mais réels, surtout sur les grands formats.",
        pros: 'Bouquet floral luxueux|Icône installée, valeur sûre en cadeau|Grands formats au meilleur prix au ml',
        cons: 'Style très classique|Peu de promos franches',
        verdict: "L'opulence florale de référence. On ne se trompe jamais avec J'adore.",
        rating: 4.4,
      },
      {
        productNameContains: 'Good Girl',
        rank: 5,
        badge: 'La Séductrice',
        miniReview:
          "L'escarpin le plus célèbre de la parfumerie. Good Girl joue le contraste tubéreuse lumineuse / cacao-tonka sombre — un parfum de soirée assumé, devenu phénomène. Bonus pour les chasseuses de prix : c'est l'une des références où nos relevés observent les plus gros écarts entre enseignes, parfois spectaculaires à taille égale.",
        pros: 'Flacon iconique|Sillage de soirée puissant|Écarts de prix parfois énormes entre enseignes',
        cons: 'Trop intense pour le bureau|Sucré assumé',
        verdict: 'Le parfum de soirée statement — à ne jamais acheter sans comparer, les écarts sont trop gros.',
        rating: 4.3,
      },
    ],
  },
  {
    slug: 'quel-parfum-offrir',
    title: 'Quel parfum offrir ? La sélection cadeau qui fait mouche',
    metaTitle: 'Quel parfum offrir ? Sélection cadeau qui fait mouche',
    metaDescription:
      "Offrir un parfum sans se tromper : notre sélection de valeurs sûres testées et comparées, avec les vrais prix chez Sephora, Nocibé, Marionnaud et My-Origines.",
    heroImageUrl: '/images/baddies_3.png',
    introduction:
      "<p>Offrir un parfum, c'est le cadeau le plus élégant — et le plus risqué. La règle d'or : on n'offre pas une curiosité de niche à quelqu'un dont on ne connaît pas les goûts, on offre une <strong>valeur sûre magnifiquement exécutée</strong>. Voici notre sélection spéciale cadeau : des parfums qui plaisent à (presque) tout le monde, classés par profil, avec les prix réels relevés chez les quatre enseignes — parce qu'un beau cadeau payé trop cher, c'est dommage.</p>",
    content:
      "<p>Sélection pensée par profil de destinataire : la romantique, la pétillante, l'élégante, la douce, la moderne. Tous ces parfums existent en plusieurs contenances — le 30 ou 50 ml est le format cadeau idéal.</p>",
    conclusion:
      "<p>Dernier réflexe avant d'acheter : compare la contenance choisie sur City Baddies. Les parfums cadeaux sont les plus travaillés en promo — et les écarts entre enseignes se paient cash en période de fêtes.</p>",
    criteria: [
      'Plaît au plus grand nombre (taux de retour minimal)',
      'Flacon qui fait de l’effet au déballage',
      'Disponible en plusieurs contenances',
      'Comparé chez les 4 enseignes (vrai prix vérifiable)',
    ],
    faq: [
      { question: 'Quel parfum offrir quand on ne connaît pas les goûts de la personne ?', answer: "Va vers les floraux lumineux ou les gourmands doux, best-sellers depuis des années : Flowerbomb, Chance Eau Tendre ou Idôle plaisent très largement. Évite les parfums très clivants (cuir, oud, gourmands extrêmes) et les eaux fraîches trop discrètes." },
      { question: 'Quelle contenance choisir pour un cadeau ?', answer: "Le 50 ml est l'équilibre parfait : format généreux, prix contenu, flacon crédible au déballage. Le 30 ml convient pour un premier parfum ou un budget serré ; le 100 ml, à réserver aux parfums dont on SAIT qu'ils sont portés." },
      { question: 'Coffret ou flacon seul ?', answer: "Le coffret (flacon + lait corps ou format voyage) fait plus d'effet à prix souvent proche — surtout en période de fêtes. Vérifie juste que le prix du coffret est réellement avantageux par rapport au flacon seul : c'est loin d'être systématique." },
    ],
    tags: 'cadeau,sélection,fêtes',
    targetKeywords: 'quel parfum offrir, parfum cadeau femme, idée cadeau parfum',
    products: [
      {
        productNameContains: 'Flowerbomb',
        rank: 1,
        badge: 'Le Cadeau Sûr',
        miniReview:
          "Une explosion florale dans un flacon grenade : Flowerbomb est LE parfum cadeau par excellence — spectaculaire au déballage, enveloppant au porter, apprécié de 20 à 60 ans. Son jasmin-praline-patchouli fait l'unanimité depuis 2005. Difficile de faire plus sûr.",
        pros: 'Plaît à presque tout le monde|Flacon spectaculaire|Sillage chaleureux mémorable',
        cons: 'Assez sucré|Très connu',
        verdict: "Si tu hésites, c'est lui. Taux d'échec proche de zéro.",
        rating: 4.6,
      },
      {
        productNameContains: 'Chance Eau Tendre',
        rank: 2,
        badge: "L'Élégant",
        miniReview:
          "Le Chanel le plus facile à offrir : pamplemousse et jasmin, fraîcheur poudrée, aucune fausse note possible. Le nom fait son effet, le parfum aussi — et son registre tendre convient aux plus jeunes comme aux mamans. L'arme absolue du cadeau chic.",
        pros: 'Prestige Chanel|Fraîcheur consensuelle|Convient à tous les âges',
        cons: 'Tenue moyenne (eau de toilette)|Peu de promos',
        verdict: 'Le cadeau qui dit « je te connais bien » même quand ce n’est pas tout à fait vrai.',
        rating: 4.5,
      },
      {
        productNameContains: 'Idôle',
        rank: 3,
        badge: 'La Jeune Moderne',
        miniReview:
          "Le flacon le plus fin du marché — une flasque dorée qui fait son petit effet — et une rose-chypre propre, lumineuse, pensée pour une nouvelle génération. Parfait pour offrir à une vingtenaire ou une trentenaire qui n'a pas encore « son » parfum.",
        pros: 'Flacon ultra-plat original|Rose moderne, jamais vieillotte|Positionnement prix accessible pour un grand nom',
        cons: 'Sillage modéré|Moins statement que les icônes',
        verdict: 'Le cadeau jeune et pointu sans prise de risque.',
        rating: 4.3,
      },
      {
        productNameContains: 'Mon Paris',
        rank: 4,
        badge: 'La Romantique',
        miniReview:
          "Un chypre fruité vertigineux — fraise, framboise, patchouli — pensé comme un vertige amoureux au-dessus de Paris. C'est LE profil « romantique moderne » : doux mais pas naïf, sucré mais structuré. Idéal en cadeau d'amoureux·se.",
        pros: 'Registre romantique assumé|Fruité gourmand équilibré|Flacon au nœud lavallière réussi',
        cons: 'Sucré marqué|Moins polyvalent bureau',
        verdict: "Pour dire « je t'aime » sans carte de vœux.",
        rating: 4.2,
      },
      {
        productNameContains: 'Miss Dior Eau de Parfum',
        rank: 5,
        badge: 'La Classique Chic',
        miniReview:
          "La rose Dior dans sa version contemporaine : fraîche, veloutée, avec ce nœud couture sur le flacon qui fait toujours son effet sous le papier cadeau. Une valeur refuge — au sens propre : le nom Dior rassure celle qui offre comme celle qui reçoit.",
        pros: 'Nom prestigieux|Rose moderne consensuelle|Beau flacon cadeau',
        cons: 'Classique, peu surprenant|Prix tenu',
        verdict: 'Le cadeau élégant zéro risque, à comparer quand même — les écarts existent.',
        rating: 4.3,
      },
    ],
  },
  {
    slug: 'parfums-qui-tiennent-longtemps',
    title: 'Les parfums femme qui tiennent vraiment toute la journée',
    metaTitle: 'Parfums femme longue tenue — la sélection qui dure',
    metaDescription:
      "Marre des parfums qui disparaissent à midi ? Notre sélection de parfums femme à la tenue redoutable, comparés aux vrais prix chez les 4 enseignes.",
    heroImageUrl: '/images/baddies_5.png',
    introduction:
      "<p>Le crime le plus frustrant de la parfumerie : payer un flacon plein tarif pour ne plus rien sentir à midi. La tenue d'un parfum dépend de sa concentration, de sa construction… et de ta peau — mais certaines compositions sont structurellement taillées pour durer : gourmands denses, orientaux ambrés, muscs profonds. Voici notre sélection de forteresses olfactives, toutes suivies par nos relevés de prix chez Sephora, Nocibé, Marionnaud et My-Origines.</p>",
    content:
      "<p>Sélection concentrée sur les eaux de parfum à fond ambré, gourmand ou musqué — les familles dont la rémanence est la plus documentée. Astuce d'application : hydrate ta peau avant (crème neutre), vaporise sur les points de pulsation ET sur les vêtements (en vérifiant qu'ils ne tachent pas).</p>",
    conclusion:
      "<p>Un parfum qui tient toute la journée, c'est aussi un flacon qui dure plus longtemps — donc un meilleur prix au millilitre réel. Raison de plus pour l'acheter au bon prix : compare ta contenance avant de craquer.</p>",
    criteria: [
      'Tenue sur peau réputée (8 h et plus)',
      'Sillage présent sans être étouffant',
      'Concentration eau de parfum minimum',
      'Prix comparés chez les 4 enseignes',
    ],
    faq: [
      { question: 'Pourquoi mon parfum ne tient-il pas sur moi ?', answer: "Peau sèche, application sur peau nue non hydratée, ou composition trop volatile (agrumes, eaux fraîches). Hydrate ta peau avant application, vise les points de chaleur (poignets, cou, derrière les oreilles) et privilégie les eaux de parfum aux fonds ambrés ou musqués." },
      { question: 'L’eau de parfum tient-elle vraiment plus longtemps que l’eau de toilette ?', answer: "Oui, à ligne identique : la concentration en essences est supérieure. La contrepartie est un prix plus élevé — que l'écart de tenue justifie généralement si tu portes ton parfum du matin au soir." },
      { question: 'Comment faire durer son parfum toute la journée ?', answer: "Trois gestes : peau hydratée (le parfum s'accroche mieux au gras d'une crème), vaporisation sur les vêtements et les cheveux (à distance), et retouche de mi-journée avec un petit format de sac — souvent plus économique qu'on ne croit en le comparant au prix au millilitre." },
    ],
    tags: 'longue-tenue,sillage,edp',
    targetKeywords: 'parfum qui tient longtemps, parfum longue tenue femme, parfum sillage puissant',
    products: [
      {
        productNameContains: 'Alien',
        rank: 1,
        badge: 'La Forteresse',
        miniReview:
          "Le jasmin solaire de Mugler est une légende de rémanence : quelques vaporisations le matin, et il est encore là le soir — parfois le lendemain sur un pull. Signature ambrée-boisée unique, immédiatement reconnaissable. Bonus malin : les flacons Mugler se rechargent, ce qui améliore encore le prix au millilitre.",
        pros: 'Tenue exceptionnelle|Signature unique|Flacon rechargeable (économies réelles)',
        cons: 'Très identifiable, clivant|Peut saturer en excès',
        verdict: 'La référence absolue de la longue tenue. Deux sprays suffisent — vraiment.',
        rating: 4.7,
      },
      {
        productNameContains: 'Angel',
        rank: 2,
        badge: "L'Indestructible",
        miniReview:
          "Le premier grand gourmand de l'histoire (1992) reste l'un des parfums les plus tenaces jamais créés : chocolat, caramel et patchouli fusionnent en un sillage qui traverse la journée sans faiblir. Un monument clivant — on adore ou on déteste — mais côté rémanence, personne ne discute. Rechargeable, lui aussi.",
        pros: 'Rémanence hors norme|Pionnier du gourmand, unique|Rechargeable en fontaine',
        cons: 'Très clivant|Trop riche pour l’été',
        verdict: 'Le gourmand originel, indestructible. À apprivoiser, puis à adopter pour la vie.',
        rating: 4.4,
      },
      {
        productNameContains: 'Black Orchid',
        rank: 3,
        badge: 'La Nocturne',
        miniReview:
          "L'orchidée noire de Tom Ford est un parfum de nuit à la densité rare : truffe, cacao, patchouli, encens — une matière olfactive épaisse qui s'accroche à la peau pendant des heures. Le luxe assumé, avec la tenue qui va avec. À réserver aux soirées et aux saisons froides.",
        pros: 'Densité et tenue remarquables|Signature luxueuse|Présence inoubliable',
        cons: 'Positionnement prix élevé|Trop intense en journée',
        verdict: 'Le parfum de soirée qui tient jusqu’au dernier verre — et après.',
        rating: 4.4,
      },
      {
        productNameContains: 'Scandal',
        rank: 4,
        badge: 'La Mielleuse',
        miniReview:
          "Le miel est l'un des matériaux les plus tenaces de la parfumerie, et Scandal en fait sa signature : miel blond, jasmin, patchouli — un gourmand solaire qui reste présent du matin au soir sans jamais crier. L'option longue tenue la plus accessible de cette sélection, et l'une des plus travaillées en promo.",
        pros: 'Tenue miel remarquable|Souvent en opération (vraies occasions)|Plus portable qu’Angel au quotidien',
        cons: 'Sucré assumé|Sillage parfois envahissant en intérieur',
        verdict: 'La longue tenue accessible et joyeuse — à acheter au creux, il y en a souvent.',
        rating: 4.2,
      },
      {
        productNameContains: 'For Her',
        rank: 5,
        badge: 'La Seconde Peau',
        miniReview:
          "For Her joue la tenue autrement : pas un sillage qui remplit la pièce, mais un musc enveloppant qui reste collé à la peau des heures durant — l'effet « tu sens incroyablement bon » quand on s'approche. La rémanence intime par excellence, unique en son genre depuis 2003.",
        pros: 'Rémanence peau exceptionnelle|Élégance discrète|Culte justifié',
        cons: 'Sillage volontairement modéré|Moins « wow » au premier spray',
        verdict: 'Pour durer sans envahir : le musc qui ne te quitte pas de la journée.',
        rating: 4.5,
      },
    ],
  },
];

// ────────────────────────────────────────────────────────────────────
// Seed
// ────────────────────────────────────────────────────────────────────

async function main() {
  const now = new Date();

  // ── Pages promo ──
  console.log('=== PAGES CODES PROMO ===');
  for (const pg of PROMO_PAGES) {
    const merchant = await prisma.merchant.findUnique({ where: { slug: pg.merchantSlug } });
    if (!merchant) { console.warn(`✗ marchand introuvable: ${pg.merchantSlug}`); continue; }
    const { merchantSlug, ...data } = pg;
    await prisma.merchantPromoPage.upsert({
      where: { merchantId: merchant.id },
      update: { ...data, lastVerifiedAt: now },
      create: { ...data, merchantId: merchant.id, lastVerifiedAt: now },
    });
    console.log(`✓ /codes-promo/${pg.canonicalSlug}`);
  }

  // ── Guides ──
  console.log('\n=== GUIDES ===');
  for (const g of GUIDES) {
    // Résoudre chaque produit → son deal ACTIF le moins cher
    const resolved: { dealId: string; seed: (typeof g.products)[0] }[] = [];
    for (const p of g.products) {
      // Deal d'ancrage = le moins cher en format ≥30 ml : afficher le prix d'un
      // 10 ml sur une carte de classement induirait en erreur (paraît "pas cher").
      const product = await prisma.product.findFirst({
        where: {
          name: { contains: p.productNameContains },
          deals: { some: { status: 'ACTIVE', type: 'tracked' } },
        },
        include: {
          deals: {
            where: { status: 'ACTIVE', type: 'tracked', variant: { volumeUnit: 'ml', volumeValue: { gte: 30 } } },
            orderBy: { dealPrice: 'asc' },
            take: 1,
          },
        },
      });
      if (!product || product.deals.length === 0) {
        console.warn(`  ✗ produit introuvable/sans deal: "${p.productNameContains}" (guide ${g.slug}) — ignoré`);
        continue;
      }
      resolved.push({ dealId: product.deals[0].id, seed: p });
    }
    if (resolved.length < 3) {
      console.warn(`  ✗ guide ${g.slug}: seulement ${resolved.length} produits résolus — guide non publié`);
      continue;
    }

    const { products: _products, criteria, faq, ...guideData } = g;
    const guide = await prisma.buyingGuide.upsert({
      where: { slug: g.slug },
      update: { ...guideData, criteria, faq, category: 'parfums', status: 'PUBLISHED', publishedAt: now },
      create: { ...guideData, criteria, faq, category: 'parfums', status: 'PUBLISHED', publishedAt: now },
    });

    // Rangs recréés proprement à chaque run (idempotent)
    await prisma.buyingGuideProduct.deleteMany({ where: { guideId: guide.id } });
    // Re-numéroter séquentiellement au cas où un produit a été ignoré
    let rank = 1;
    for (const { dealId, seed } of resolved.sort((a, b) => a.seed.rank - b.seed.rank)) {
      await prisma.buyingGuideProduct.create({
        data: {
          guideId: guide.id,
          dealId,
          rank: rank++,
          badge: seed.badge,
          miniReview: seed.miniReview,
          pros: seed.pros,
          cons: seed.cons,
          verdict: seed.verdict,
          rating: seed.rating,
        },
      });
    }
    console.log(`✓ /guides/${g.slug} (${resolved.length} produits)`);
  }

  await prisma.$disconnect();
  console.log('\nSeed éditorial terminé.');
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
