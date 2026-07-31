/**
 * Contenu éditorial des pages marques (/marques/[slug]).
 *
 * Règles de rédaction (SEO + GEO) :
 * - AUCUN prix chiffré ni pourcentage : les montants viennent de la base en temps
 *   réel dans la page — un prix écrit ici périmerait (leçon whyGoodDeal).
 * - Faits vérifiables uniquement (dates de fondation, créateurs, parfums iconiques
 *   notoires). Pas de claims marketing invérifiables.
 * - La FAQ est AFFICHÉE sur la page et sert de source au schema FAQPage :
 *   les deux doivent rester identiques (guideline Google).
 */

export interface BrandContent {
  /** Nom d'affichage propre (la base stocke "CHANEL", "Viktor&rolf"…) */
  displayName: string;
  /** Intro éditoriale (~100-150 mots), rendue server-side */
  intro: string;
  /** Signature olfactive / positionnement en une phrase */
  signature: string;
  /** FAQ visible + schema FAQPage */
  faq: { question: string; answer: string }[];
}

export const BRAND_CONTENT: Record<string, BrandContent> = {
  'chanel': {
    displayName: 'Chanel',
    intro:
      "Fondée par Gabrielle Chanel en 1910, la maison de la rue Cambon a réinventé le parfum moderne dès 1921 avec le N°5, premier grand parfum d'aldéhydes et probablement le plus célèbre du monde. Un siècle plus tard, Coco Mademoiselle et Chance Eau Tendre perpétuent la même exigence : des compositions signées par les parfumeurs exclusifs de la maison, des concentrations généreuses et des flacons devenus des icônes. Chanel maîtrise sa distribution comme peu d'autres : les prix sont tenus, les vraies variations se jouent entre enseignes et entre contenances — exactement ce que nos relevés quotidiens permettent de repérer.",
    signature: "L'élégance parisienne absolue : aldéhydes, jasmin de Grasse et une discipline tarifaire de fer.",
    faq: [
      {
        question: 'Où acheter les parfums Chanel au meilleur prix ?',
        answer:
          "Chanel encadre strictement ses prix, mais des écarts existent entre Sephora, Nocibé, Marionnaud, My-Origines et Notino selon les contenances et les périodes. Nos relevés, effectués six fois par jour à taille égale, affichent sur chaque fiche l'enseigne la moins chère du moment et la date exacte du relevé.",
      },
      {
        question: 'Quel est le parfum le plus iconique de Chanel ?',
        answer:
          "Le N°5, créé en 1921 par Ernest Beaux, reste la référence absolue. Coco Mademoiselle, lancé en 2001, est aujourd'hui l'un des parfums féminins les plus vendus en France, suivi de Chance Eau Tendre pour un registre plus frais.",
      },
      {
        question: 'Les parfums Chanel sont-ils parfois en promotion ?',
        answer:
          "Rarement : la maison protège sa politique tarifaire. Les opportunités réelles se situent surtout sur le choix de la contenance (le prix au millilitre baisse sur les grands formats) et les écarts ponctuels entre enseignes, visibles dans l'historique de prix de chaque fiche.",
      },
    ],
  },
  'christian-dior': {
    displayName: 'Dior',
    intro:
      "Depuis 1947 et le lancement de Miss Dior en même temps que le New Look, la parfumerie est au cœur de la maison Dior. J'adore, créé en 1999, est devenu l'un des parfums féminins les plus vendus au monde, porté par son bouquet floral opulent et son flacon amphore. La gamme Miss Dior s'est déclinée au fil des rééditions, dont le Blooming Bouquet, plus tendre. Dior appartient au groupe LVMH et sa distribution sélective laisse peu de place aux rabais spectaculaires — mais nos relevés montrent que les écarts entre enseignes, à contenance identique, sont plus fréquents qu'on ne le croit.",
    signature: 'La grande parfumerie couture française : florale, opulente, immédiatement reconnaissable.',
    faq: [
      {
        question: 'Où trouver les parfums Dior les moins chers ?',
        answer:
          "Les prix Dior varient entre Sephora, Nocibé, Marionnaud, My-Origines et Notino selon les contenances. Nos relevés six fois par jour comparent chaque taille séparément et affichent l'enseigne la moins chère avec la date du relevé — c'est le seul moyen fiable de repérer un vrai écart.",
      },
      {
        question: "J'adore ou Miss Dior : lequel choisir ?",
        answer:
          "J'adore est un floral doré, opulent et solaire ; Miss Dior (et sa version Blooming Bouquet) joue une partition plus fraîche et poudrée. Les deux existent en plusieurs concentrations et contenances — comparer le prix au millilitre entre formats évite de surpayer.",
      },
      {
        question: 'Les prix Dior baissent-ils pendant les soldes ?',
        answer:
          "Les baisses franches sont rares sur les lignes iconiques. En revanche, l'historique de prix de chaque fiche révèle les fenêtres ponctuelles où une enseigne décroche du prix conseillé — c'est là que se font les vraies économies.",
      },
    ],
  },
  'guerlain': {
    displayName: 'Guerlain',
    intro:
      "Maison fondée en 1828, Guerlain est la plus ancienne grande maison de parfum française encore en activité. Shalimar, créé en 1925 par Jacques Guerlain, a défini le genre oriental tout entier ; La Petite Robe Noire l'a réinventé en gourmand espiègle en 2012, et Mon Guerlain porte la signature de la lavande de Provence. Peu de catalogues traversent ainsi un siècle en restant désirables. Côté prix, Guerlain pratique une distribution sélective classique : les écarts entre Sephora, Nocibé, Marionnaud, My-Origines et Notino existent, se déplacent selon les contenances, et nos relevés quotidiens les rendent visibles noir sur blanc.",
    signature: "Deux siècles de parfumerie française : l'oriental inventé, le gourmand réinventé.",
    faq: [
      {
        question: 'Où acheter les parfums Guerlain au meilleur prix ?',
        answer:
          "Selon nos relevés effectués six fois par jour, l'enseigne la moins chère change selon le parfum et la contenance. Chaque fiche affiche le classement du moment entre Sephora, Nocibé, Marionnaud, My-Origines et Notino, avec la date exacte du relevé.",
      },
      {
        question: 'Quel est le parfum emblématique de Guerlain ?',
        answer:
          "Shalimar (1925) reste le monument absolu, référence de la famille orientale. La Petite Robe Noire est le best-seller contemporain de la maison, et Mon Guerlain sa signature moderne autour de la lavande Carla.",
      },
      {
        question: 'Comment payer un Guerlain moins cher sans risque ?',
        answer:
          "Rester sur les enseignes officielles (Sephora, Nocibé, Marionnaud) et jouer sur deux leviers : la contenance — le prix au millilitre chute sur les grands formats — et le moment d'achat, en surveillant l'historique de prix de la fiche pour acheter dans un creux.",
      },
    ],
  },
  'lancome': {
    displayName: 'Lancôme',
    intro:
      "Créée en 1935 par Armand Petitjean, Lancôme est la grande maison de beauté du groupe L'Oréal. La Vie Est Belle, lancée en 2012 avec son accord iris-praline signé par trois grands parfumeurs, est régulièrement classée parmi les parfums les plus vendus de France. Trésor (1990) reste un classique de la rose poudrée, et Idôle vise une génération plus jeune avec son flacon ultraplat. Marque de grande distribution sélective, Lancôme connaît des variations de prix plus fréquentes que les maisons couture : nos relevés quotidiens montrent des écarts réguliers entre enseignes sur les mêmes contenances — de vraies opportunités pour qui compare avant d'acheter.",
    signature: "La beauté française grand public assumée : gourmand fédérateur, rose classique, prix qui bougent.",
    faq: [
      {
        question: 'Où acheter La Vie Est Belle au meilleur prix ?',
        answer:
          "C'est l'un des parfums où les écarts entre enseignes sont les plus fréquents selon nos relevés. La fiche produit affiche six fois par jour le meilleur prix par contenance entre Sephora, Nocibé, Marionnaud, My-Origines et Notino, avec la date du relevé et l'historique complet.",
      },
      {
        question: 'Les parfums Lancôme sont-ils souvent en promotion ?',
        answer:
          "Plus souvent que les maisons couture, oui : les enseignes utilisent régulièrement les best-sellers Lancôme dans leurs opérations. L'historique de prix de chaque fiche permet de vérifier si la promo affichée est une vraie baisse ou un prix barré marketing.",
      },
      {
        question: 'Quelle contenance de La Vie Est Belle est la plus rentable ?',
        answer:
          "En règle générale, le prix au millilitre baisse nettement avec la taille du flacon — le 100 ml est presque toujours plus rentable que le 30 ml. Notre tableau comparatif par taille, mis à jour à chaque relevé, montre l'écart exact du moment.",
      },
    ],
  },
  'yves-saint-laurent': {
    displayName: 'Yves Saint Laurent',
    intro:
      "Maison fondée en 1961 par Yves Saint Laurent et Pierre Bergé, YSL Beauté a toujours cultivé une parfumerie de caractère. Libre, lancé en 2019 avec son accord lavande-fleur d'oranger, s'est imposé comme l'un des grands succès féminins de la décennie ; Mon Paris joue la carte du chypre fruité vertigineux. La marque, distribuée par L'Oréal Luxe, est très présente dans les opérations des enseignes : selon nos relevés, les prix YSL bougent souvent, et les écarts entre Sephora, Nocibé, Marionnaud, My-Origines et Notino sur une même contenance méritent systématiquement vérification avant achat.",
    signature: 'Le caractère couture : lavande audacieuse, chypre moderne, prix en mouvement permanent.',
    faq: [
      {
        question: 'Où acheter Libre d’YSL au meilleur prix ?',
        answer:
          "Libre fait partie des parfums les plus scrutés de nos relevés : les cinq enseignes s'alignent rarement. La fiche produit compare chaque contenance six fois par jour et signale l'enseigne la moins chère avec la date du relevé.",
      },
      {
        question: 'Quel parfum YSL choisir entre Libre et Mon Paris ?',
        answer:
          "Libre est un floral-lavande signature, affirmé et moderne ; Mon Paris un chypre fruité plus sucré et enveloppant. Les deux existent en plusieurs concentrations — comparer le prix au millilitre entre les formats reste le meilleur réflexe.",
      },
      {
        question: 'Les parfums YSL sont-ils souvent remisés ?',
        answer:
          "Oui, plus que la moyenne du secteur : les best-sellers YSL apparaissent régulièrement dans les opérations des enseignes. L'historique de prix sur chaque fiche distingue les vraies baisses des prix barrés permanents.",
      },
    ],
  },
  'giorgio-armani': {
    displayName: 'Giorgio Armani',
    intro:
      "Le couturier milanais, fondateur de sa maison en 1975, a bâti l'une des parfumeries les plus solides du marché. Sì, lancé en 2013 autour d'un accord cassis-rose-vanille, est devenu un pilier des ventes féminines en Europe. La parfumerie Armani, opérée par L'Oréal Luxe, est distribuée dans toutes les grandes enseignes françaises — un terrain idéal pour la comparaison, car les prix d'une même contenance s'écartent régulièrement d'une enseigne à l'autre au gré des opérations commerciales. Nos relevés six fois par jour capturent ces écarts en continu.",
    signature: "L'élégance milanaise : chic intemporel, cassis signature, présence dans toutes les enseignes.",
    faq: [
      {
        question: 'Où acheter Sì d’Armani au meilleur prix ?',
        answer:
          "Les prix de Sì varient fréquemment entre Sephora, Nocibé, Marionnaud, My-Origines et Notino. Notre fiche produit relève chaque contenance six fois par jour et affiche l'enseigne la moins chère du moment, avec la date exacte du relevé et l'historique.",
      },
      {
        question: 'Quelle est la différence entre les versions de Sì ?',
        answer:
          "La ligne Sì se décline en plusieurs concentrations (eau de parfum, intense, etc.), chacune avec sa propre tenue et son propre prix. À version identique, seule la comparaison à contenance égale entre enseignes est pertinente — c'est exactement ce que fait notre tableau.",
      },
      {
        question: 'Les parfums Armani baissent-ils souvent de prix ?',
        answer:
          "Les lignes féminines phares apparaissent régulièrement dans les opérations des enseignes. L'historique de prix de la fiche permet de vérifier en un coup d'œil si le prix du jour est réellement bas par rapport aux semaines précédentes.",
      },
    ],
  },
  'rabanne': {
    displayName: 'Rabanne',
    intro:
      "Paco Rabanne, l'enfant terrible de la couture des années 1960, a transmis son goût de la provocation à sa parfumerie — rebaptisée simplement Rabanne en 2023. Olympéa, lancée en 2015 avec son accord vanille salée, et Fame, son flacon-robot lancé en 2022, figurent parmi les parfums féminins les plus dynamiques du marché français. Distribuée par le groupe Puig, la marque est très active en enseigne : les prix bougent souvent, les écarts entre Sephora, Nocibé, Marionnaud, My-Origines et Notino sont fréquents, et nos relevés quotidiens en gardent la trace complète.",
    signature: 'La provocation devenue best-seller : métal, vanille salée et prix très disputés entre enseignes.',
    faq: [
      {
        question: 'Où acheter Olympéa ou Fame au meilleur prix ?',
        answer:
          "Les parfums Rabanne comptent parmi les plus disputés entre enseignes selon nos relevés. Chaque fiche compare les prix par contenance six fois par jour entre Sephora, Nocibé, Marionnaud, My-Origines et Notino et signale le meilleur prix daté.",
      },
      {
        question: 'Fame ou Olympéa : lequel choisir ?',
        answer:
          "Olympéa est un oriental floral à la vanille salée, solaire et affirmé ; Fame un gourmand plus crémeux autour de la mangue et de l'encens. Les deux se déclinent en plusieurs tailles — le prix au millilitre departage souvent mieux que le prix facial.",
      },
      {
        question: 'Les parfums Rabanne sont-ils souvent en promo ?',
        answer:
          "Oui, la marque est très présente dans les opérations commerciales. Notre historique de prix par contenance permet de distinguer une vraie fenêtre d'achat d'un prix barré permanent.",
      },
    ],
  },
  'thierry-mugler': {
    displayName: 'Mugler',
    intro:
      "Thierry Mugler a bouleversé la parfumerie à deux reprises : en 1992 avec Angel, premier grand parfum gourmand de l'histoire (chocolat, caramel, patchouli), puis en 2005 avec Alien et son jasmin solaire futuriste. La maison a aussi inventé la fontaine à parfum : les flacons Mugler sont rechargeables en enseigne, un vrai levier d'économie et un cas unique dans notre comparateur. Les prix Mugler varient sensiblement selon les enseignes et les formats — recharges comprises — et nos relevés quotidiens permettent d'y voir clair avant de choisir entre flacon neuf et recharge.",
    signature: "L'avant-garde olfactive : le gourmand inventé, le flacon rechargeable démocratisé.",
    faq: [
      {
        question: 'Où acheter Alien ou Angel au meilleur prix ?',
        answer:
          "Les prix varient entre Sephora, Nocibé, Marionnaud, My-Origines et Notino, et les recharges changent l'équation du prix au millilitre. Nos fiches relèvent chaque format six fois par jour et affichent le meilleur prix daté par contenance.",
      },
      {
        question: 'Les flacons Mugler sont-ils vraiment rechargeables ?',
        answer:
          "Oui, c'est une signature de la maison : la plupart des flacons Angel et Alien se rechargent, en boutique ou via des recharges vendues séparément — généralement plus économiques au millilitre que le flacon neuf.",
      },
      {
        question: 'Angel ou Alien : quelle différence ?',
        answer:
          "Angel est le gourmand originel — chocolat, caramel, patchouli — clivant et inimitable. Alien est un jasmin ambré solaire, plus linéaire et plus facile à porter au quotidien. Deux monuments, deux registres.",
      },
    ],
  },
  'givenchy': {
    displayName: 'Givenchy',
    intro:
      "Fondée en 1952 par Hubert de Givenchy, la maison est indissociable d'Audrey Hepburn, pour qui fut créé L'Interdit en 1957 — relancé avec succès en 2018 dans une version tubéreuse-vétiver devenue un best-seller. Irresistible complète la gamme féminine sur un registre rose-poire plus lumineux. Propriété de LVMH, Givenchy pratique une distribution sélective où les écarts de prix entre enseignes restent mesurés mais réels : nos relevés quotidiens à contenance identique les font apparaître, fiche par fiche.",
    signature: "L'aristocratie parisienne : la tubéreuse interdite d'Audrey Hepburn, réinventée pour aujourd'hui.",
    faq: [
      {
        question: 'Où acheter L’Interdit au meilleur prix ?',
        answer:
          "Les prix de L'Interdit s'écartent régulièrement entre Sephora, Nocibé, Marionnaud, My-Origines et Notino selon la contenance. La fiche produit affiche le classement du moment, relevé six fois par jour, avec la date exacte.",
      },
      {
        question: 'Quelle est l’histoire de L’Interdit ?',
        answer:
          "Créé en 1957 pour Audrey Hepburn — d'où son nom — L'Interdit a été réinventé en 2018 autour d'un contraste tubéreuse blanche/vétiver sombre. C'est cette version moderne que l'on trouve aujourd'hui en enseigne.",
      },
      {
        question: 'Les parfums Givenchy sont-ils souvent remisés ?',
        answer:
          "Modérément : la distribution sélective LVMH limite les grandes démarques. Les écarts se jouent surtout entre enseignes et entre formats — l'historique de prix de chaque fiche montre où et quand acheter.",
      },
    ],
  },
  'hermes': {
    displayName: 'Hermès',
    intro:
      "Sellier parisien depuis 1837, Hermès applique au parfum la même exigence artisanale qu'au cuir. Twilly d'Hermès, lancé en 2017 par la parfumeuse maison Christine Nagel autour du gingembre et de la tubéreuse, vise une clientèle jeune sans renier l'ADN de la maison. Hermès contrôle étroitement ses prix et sa distribution : les rabais sont rarissimes, ce qui rend la comparaison entre enseignes et entre contenances d'autant plus décisive — c'est souvent le seul levier d'économie réel, et nos relevés quotidiens le mesurent précisément.",
    signature: "L'artisanat du luxe absolu : gingembre espiègle, prix tenus, écarts rares mais réels.",
    faq: [
      {
        question: 'Où acheter Twilly d’Hermès au meilleur prix ?',
        answer:
          "Hermès tient fermement ses prix, mais des écarts ponctuels apparaissent entre Sephora, Nocibé, Marionnaud, My-Origines et Notino. Nos relevés six fois par jour les détectent dès qu'ils se produisent, contenance par contenance.",
      },
      {
        question: 'Pourquoi les parfums Hermès sont-ils rarement en promo ?',
        answer:
          "La maison protège strictement sa valeur de marque et sa distribution sélective. Les vraies économies se font sur le choix du format — le prix au millilitre baisse avec la taille — et sur les écarts ponctuels entre enseignes, visibles dans notre historique.",
      },
      {
        question: 'Twilly convient-il comme premier parfum ?',
        answer:
          "C'est son positionnement assumé : un Hermès jeune, pétillant (gingembre, tubéreuse, santal), plus accessible que les lignes historiques de la maison tout en gardant sa qualité de fabrication.",
      },
    ],
  },
  'carolina-herrera': {
    displayName: 'Carolina Herrera',
    intro:
      "La créatrice vénézuélienne installée à New York depuis 1981 a imposé une parfumerie glamour et assumée. Good Girl, lancé en 2016 dans son flacon escarpin devenu instantanément reconnaissable, est l'un des plus gros succès féminins de la décennie — un contraste tubéreuse/cacao-tonka pensé comme un manifeste. Distribuée par Puig, la marque est très travaillée par les enseignes françaises : les prix de Good Girl bougent souvent, dans les deux sens, et l'historique de nos relevés est particulièrement parlant sur cette référence.",
    signature: "Le glamour new-yorkais : l'escarpin le plus célèbre de la parfumerie, aux prix très mouvants.",
    faq: [
      {
        question: 'Où acheter Good Girl au meilleur prix ?',
        answer:
          "Good Girl est l'une des références où nos relevés observent le plus de mouvements de prix. La fiche produit compare Sephora, Nocibé, Marionnaud, My-Origines et Notino six fois par jour, contenance par contenance, avec la date de chaque relevé.",
      },
      {
        question: 'Pourquoi le flacon de Good Girl est-il un escarpin ?',
        answer:
          "Carolina Herrera voulait un manifeste du contraste « bonne fille / mauvaise fille » qui structure le parfum : le stiletto bleu nuit en est le symbole. C'est aujourd'hui l'un des flacons les plus identifiables du marché.",
      },
      {
        question: 'Les prix de Good Girl varient-ils beaucoup ?',
        answer:
          "Oui, sensiblement : la référence sert régulièrement de produit d'appel en enseigne. Notre historique de prix révèle les vraies fenêtres d'achat par rapport aux prix barrés permanents.",
      },
    ],
  },
  'dolce-gabbana': {
    displayName: 'Dolce & Gabbana',
    intro:
      "Le duo milanais fondé en 1985 a mis la Méditerranée en flacon. Light Blue, lancé en 2001 avec sa pomme verte, son cèdre et son citron de Sicile, reste l'un des parfums frais les plus vendus au monde plus de vingt ans après sa création — un cas d'école de longévité commerciale. La parfumerie D&G est largement distribuée en France et régulièrement animée en enseigne : les écarts de prix entre Sephora, Nocibé, Marionnaud, My-Origines et Notino sur une même contenance sont courants, et nos relevés quotidiens permettent d'acheter au bon moment.",
    signature: 'La Méditerranée en flacon : fraîcheur sicilienne intemporelle, prix régulièrement animés.',
    faq: [
      {
        question: 'Où acheter Light Blue au meilleur prix ?',
        answer:
          "Light Blue fait l'objet d'opérations fréquentes en enseigne. Notre fiche relève les prix six fois par jour chez Sephora, Nocibé, Marionnaud, My-Origines et Notino et affiche le meilleur prix daté par contenance, avec l'historique complet.",
      },
      {
        question: 'Pourquoi Light Blue reste-t-il si populaire ?',
        answer:
          "Sa fraîcheur pomme-citron-cèdre, immédiatement lisible et très polyvalente, en fait un parfum d'été de référence depuis 2001. Peu de compositions traversent deux décennies en restant dans les meilleures ventes.",
      },
      {
        question: 'Quelle contenance de Light Blue choisir ?',
        answer:
          "Pour un parfum frais porté généreusement, les grands formats sont vite rentabilisés : le prix au millilitre baisse nettement avec la taille. Notre tableau comparatif par contenance montre l'écart exact du moment.",
      },
    ],
  },
  'chloe': {
    displayName: 'Chloé',
    intro:
      "Maison parisienne fondée en 1952, pionnière du prêt-à-porter de luxe, Chloé a signé en 2008 l'une des roses les plus influentes de la parfumerie moderne : Chloé Eau de Parfum, une rose poudrée portée par un flacon au ruban devenu signature. Le parfum a défini toute une esthétique — féminité naturelle, presque négligée-chic — copiée depuis par d'innombrables lancements. Distribuée par Coty dans les trois grandes enseignes françaises, la référence connaît des variations de prix régulières que nos relevés quotidiens documentent contenance par contenance.",
    signature: 'La rose poudrée qui a défini une décennie : naturelle, lumineuse, faussement simple.',
    faq: [
      {
        question: 'Où acheter Chloé Eau de Parfum au meilleur prix ?',
        answer:
          "Les prix varient régulièrement entre Sephora, Nocibé, Marionnaud, My-Origines et Notino. Notre fiche compare chaque contenance six fois par jour et signale l'enseigne la moins chère du moment, avec la date exacte du relevé.",
      },
      {
        question: 'À quoi ressemble le parfum Chloé ?',
        answer:
          "C'est une rose poudrée moderne : fraîche en tête (pivoine, litchi), rose au cœur, ambrée-cèdre en fond. Une féminité naturelle qui a inspiré une génération entière de parfums floraux.",
      },
      {
        question: 'Le parfum Chloé est-il souvent en promotion ?',
        answer:
          "Régulièrement, comme la plupart des best-sellers Coty. L'historique de prix de la fiche distingue les vraies baisses des prix barrés récurrents — vérifiez-le avant d'acheter.",
      },
    ],
  },
  'valentino': {
    displayName: 'Valentino',
    intro:
      "La maison romaine fondée en 1960 par Valentino Garavani a relancé sa parfumerie avec un succès éclatant : Born in Roma, décliné depuis 2019 en plusieurs interprétations, mêle streetwear et haute couture — vanille moderne, jasmin, bois ambrés. Voce Viva complète la gamme sur un registre plus lumineux. Distribuée par L'Oréal Luxe, la parfumerie Valentino est jeune, dynamique et très animée en enseigne : selon nos relevés, les écarts de prix entre Sephora, Nocibé, Marionnaud, My-Origines et Notino y sont plus fréquents que la moyenne.",
    signature: 'Rome entre couture et streetwear : vanille contemporaine, clous dorés, prix très animés.',
    faq: [
      {
        question: 'Où acheter Born in Roma au meilleur prix ?',
        answer:
          "C'est l'une des gammes les plus disputées entre enseignes selon nos relevés. Chaque fiche compare les prix par contenance six fois par jour et affiche le meilleur prix daté chez Sephora, Nocibé ou Marionnaud.",
      },
      {
        question: 'Born in Roma ou Voce Viva : lequel choisir ?',
        answer:
          "Born in Roma Donna est une vanille-jasmin moderne et enveloppante ; Voce Viva un floral lumineux plus frais. Les deux se déclinent en plusieurs formats — comparer le prix au millilitre reste le meilleur arbitre.",
      },
      {
        question: 'Les parfums Valentino baissent-ils souvent ?',
        answer:
          "Oui, la gamme est régulièrement mise en avant dans les opérations des enseignes. Notre historique de prix par contenance montre si le prix du jour est réellement une opportunité.",
      },
    ],
  },
  'jean-paul-gaultier': {
    displayName: 'Jean Paul Gaultier',
    intro:
      "L'enfant terrible de la mode française a bâti l'une des parfumeries les plus identifiables du marché : bustes corsetés, boîtes de conserve, et des jus qui assument le spectaculaire. Scandal, lancé en 2017 autour d'un accord miel-patchouli, s'est imposé dans le trio de tête des ventes féminines françaises. Distribuée par Puig, la marque est omniprésente en enseigne et très animée commercialement : les prix de Scandal bougent souvent, et nos relevés six fois par jour permettent de saisir les vraies fenêtres d'achat.",
    signature: 'Le spectaculaire assumé : miel, corsets et jeux de prix permanents entre enseignes.',
    faq: [
      {
        question: 'Où acheter Scandal au meilleur prix ?',
        answer:
          "Scandal fait partie des références les plus animées en enseigne. Notre fiche relève les prix de chaque contenance six fois par jour chez Sephora, Nocibé, Marionnaud, My-Origines et Notino et affiche le meilleur prix avec sa date de relevé.",
      },
      {
        question: 'À quoi ressemble Scandal ?',
        answer:
          "Un gourmand miellé : miel blond en signature, jasmin au cœur, patchouli en fond. Voluptueux et immédiatement identifiable — dans la pure tradition Gaultier du parfum-personnage.",
      },
      {
        question: 'Les parfums Gaultier sont-ils souvent en promo ?',
        answer:
          "Très souvent : c'est une des marques les plus travaillées par les enseignes. Raison de plus pour consulter l'historique de prix de la fiche — un prix barré permanent n'est pas une promo.",
      },
    ],
  },
  'kenzo': {
    displayName: 'Kenzo',
    intro:
      "Kenzo Takada, premier créateur japonais installé à Paris, a laissé à la parfumerie un manifeste : Flower by Kenzo, lancé en 2000, et son coquelicot dressé dans un flacon incliné. Paradoxe voulu — le coquelicot est une fleur sans odeur — le parfum construit autour de la violette poudrée et du musc blanc est devenu un classique du floral moderne. Distribuée dans les trois grandes enseignes françaises, la référence connaît des écarts de prix réguliers que nos relevés quotidiens à contenance identique documentent précisément.",
    signature: "Le coquelicot de Paris : poésie japonaise, violette poudrée, un classique tranquille.",
    faq: [
      {
        question: 'Où acheter Flower by Kenzo au meilleur prix ?',
        answer:
          "Les prix varient entre Sephora, Nocibé, Marionnaud, My-Origines et Notino selon les contenances et les périodes. Notre fiche affiche le meilleur prix relevé six fois par jour, avec la date exacte et l'historique complet.",
      },
      {
        question: 'Quelle est la signature olfactive de Flower by Kenzo ?',
        answer:
          "Une violette poudrée sur fond de musc blanc et de vanille — douce, propre, réconfortante. Un floral poudré de référence, réédité en plusieurs concentrations au fil des années.",
      },
      {
        question: 'Flower by Kenzo existe-t-il en plusieurs versions ?',
        answer:
          "Oui, la ligne s'est déclinée en plusieurs concentrations et éditions. À version identique, comparez toujours à contenance égale — c'est ce que fait notre tableau, mis à jour à chaque relevé.",
      },
    ],
  },
  'narciso-rodriguez': {
    displayName: 'Narciso Rodriguez',
    intro:
      "Le créateur américain, célèbre pour avoir habillé Carolyn Bessette-Kennedy, a signé en 2003 l'un des parfums les plus influents du XXIe siècle : For Her, un musc enveloppant devenu la référence absolue de sa famille olfactive. Vingt ans plus tard, le sillage crémeux et la sensualité feutrée de For Her restent inimités. Distribuée par Shiseido dans les grandes enseignes françaises, la gamme connaît des variations de prix régulières — nos relevés quotidiens en gardent l'historique complet, contenance par contenance.",
    signature: 'Le musc définitif : sensualité feutrée, sillage crémeux, une référence jamais égalée.',
    faq: [
      {
        question: 'Où acheter For Her au meilleur prix ?',
        answer:
          "Les prix de For Her s'écartent régulièrement entre Sephora, Nocibé, Marionnaud, My-Origines et Notino. La fiche produit compare chaque contenance six fois par jour et signale le meilleur prix daté.",
      },
      {
        question: 'Pourquoi For Her est-il si culte ?',
        answer:
          "C'est le parfum qui a remis le musc au centre de la parfumerie féminine : un cœur de musc enveloppant, rehaussé de fleur d'oranger et d'ambre. Son sillage discret mais persistant a fait sa réputation.",
      },
      {
        question: 'Quelle version de For Her choisir ?',
        answer:
          "La ligne existe en plusieurs concentrations, du plus frais au plus profond. À concentration identique, le prix au millilitre entre formats fait souvent la vraie différence — notre tableau le calcule à chaque relevé.",
      },
    ],
  },
  'nina-ricci': {
    displayName: 'Nina Ricci',
    intro:
      "Maison de couture parisienne fondée en 1932, Nina Ricci a toujours parlé aux jeunes filles romantiques — de L'Air du Temps (1948) et ses colombes à Nina (2006) et sa pomme rouge scintillante. C'est cette pomme d'amour gourmande, entre citron caramélisé et praline, qui porte aujourd'hui la parfumerie de la maison auprès d'une nouvelle génération. Distribuée par Puig dans les cinq enseignes que nous suivons, la gamme Nina connaît des animations régulières et des écarts de prix fréquents, visibles dans nos relevés quotidiens.",
    signature: 'Le romantisme parisien : la pomme d’amour en flacon, gourmande et espiègle.',
    faq: [
      {
        question: 'Où acheter Nina au meilleur prix ?',
        answer:
          "Les prix de Nina varient régulièrement entre Sephora, Nocibé, Marionnaud, My-Origines et Notino. Notre fiche relève chaque contenance six fois par jour et affiche le meilleur prix avec la date exacte du relevé.",
      },
      {
        question: 'À quoi ressemble le parfum Nina ?',
        answer:
          "Une pomme d'amour olfactive : citron caramélisé et pomme rouge en tête, praline et musc en fond. Gourmand, juvénile, immédiatement séduisant — le flacon-pomme est devenu iconique.",
      },
      {
        question: 'Les parfums Nina Ricci sont-ils souvent en promo ?',
        answer:
          "La gamme est régulièrement animée en enseigne. L'historique de prix de la fiche permet de vérifier si la remise affichée correspond à une vraie baisse par rapport aux semaines précédentes.",
      },
    ],
  },
  'prada': {
    displayName: 'Prada',
    intro:
      "La maison milanaise fondée en 1913, devenue sous Miuccia Prada le laboratoire intellectuel de la mode, applique la même exigence conceptuelle à ses parfums. Paradoxe, lancé en 2022 dans son flacon triangulaire signature, explore la fleur d'oranger réinventée par la parfumerie moléculaire — une néroli à la fois familière et étrange, à l'image de la maison. Distribuée par L'Oréal Luxe, la gamme Prada est montée en puissance dans les enseignes françaises, avec des prix encore mouvants que nos relevés quotidiens suivent de près.",
    signature: 'Le conceptuel milanais : néroli réinventée, triangle iconique, une parfumerie qui pense.',
    faq: [
      {
        question: 'Où acheter Paradoxe au meilleur prix ?',
        answer:
          "Paradoxe étant une gamme récente et très soutenue, ses prix bougent régulièrement entre Sephora, Nocibé, Marionnaud, My-Origines et Notino. Notre fiche compare chaque contenance six fois par jour avec la date de chaque relevé.",
      },
      {
        question: 'Quelle est la signature de Paradoxe ?',
        answer:
          "Une fleur d'oranger moderne travaillée en trois dimensions — néroli, ambre, musc — pour un résultat à la fois lumineux et enveloppant. Le flacon triangle rechargeable reprend le symbole historique de la maison.",
      },
      {
        question: 'Le flacon Paradoxe est-il rechargeable ?',
        answer:
          "Oui, la ligne a été pensée rechargeable dès son lancement : la recharge revient généralement moins cher au millilitre que le flacon neuf. Comparez les deux formats sur notre fiche avant de choisir.",
      },
    ],
  },
  'miu-miu': {
    displayName: 'Miu Miu',
    intro:
      "Petite sœur turbulente de Prada, fondée par Miuccia Prada en 1993, Miu Miu transpose en parfumerie son esprit girly et décalé. L'Eau Bleue décline la signature florale-verte de la maison — muguet, lys, akigalawood — dans un registre frais et espiègle, reconnaissable à son flacon matelassé aux airs de vinyle sixties. Une parfumerie plus confidentielle que celle des géants du secteur, ce qui rend la comparaison de prix entre enseignes d'autant plus utile : les écarts y passent souvent inaperçus, sauf dans nos relevés.",
    signature: 'La sœur espiègle de Prada : muguet vert, flacon matelassé, charme sixties.',
    faq: [
      {
        question: 'Où acheter L’Eau Bleue au meilleur prix ?',
        answer:
          "Référence plus confidentielle, L'Eau Bleue affiche des écarts de prix entre enseignes qui passent souvent inaperçus. Nos relevés six fois par jour les détectent et affichent le meilleur prix daté par contenance.",
      },
      {
        question: 'À quoi ressemble L’Eau Bleue de Miu Miu ?',
        answer:
          "Un floral vert frais : muguet et lys sur un fond boisé d'akigalawood (une facette épicée du patchouli). Léger, propre, très printanier — dans l'esprit faussement sage de la maison.",
      },
      {
        question: 'Les parfums Miu Miu sont-ils souvent remisés ?',
        answer:
          "Moins fréquemment que les grands best-sellers, ce qui rend chaque écart d'autant plus intéressant. L'historique de prix de la fiche signale les fenêtres où une enseigne décroche.",
      },
    ],
  },
  'burberry': {
    displayName: 'Burberry',
    intro:
      "La maison anglaise fondée en 1856, inventrice de la gabardine et du trench, a trouvé avec Her (2018) sa signature olfactive contemporaine : un gourmand fruits rouges sur fond de muscs, pensé comme un portrait de Londres. La parfumerie Burberry, désormais opérée par Coty, est bien implantée dans les enseignes françaises et régulièrement animée — les prix de Her varient selon les contenances et les périodes, et nos relevés quotidiens en conservent l'historique complet.",
    signature: 'Londres en flacon : fruits rouges urbains, trench et modernité britannique.',
    faq: [
      {
        question: 'Où acheter Burberry Her au meilleur prix ?',
        answer:
          "Les prix de Her bougent régulièrement entre Sephora, Nocibé, Marionnaud, My-Origines et Notino. Notre fiche compare chaque contenance six fois par jour et affiche le meilleur prix avec la date exacte du relevé.",
      },
      {
        question: 'Quelle est la signature de Burberry Her ?',
        answer:
          "Un gourmand de fruits rouges — fraise, framboise, cassis — posé sur des muscs et un accord ambré. Moderne, urbain, facile à porter : le portrait olfactif d'une Londonienne d'aujourd'hui.",
      },
      {
        question: 'Les parfums Burberry sont-ils souvent en promotion ?',
        answer:
          "La gamme apparaît régulièrement dans les opérations des enseignes. Vérifiez l'historique de prix de la fiche pour distinguer une vraie baisse d'un prix barré permanent.",
      },
    ],
  },
  'versace': {
    displayName: 'Versace',
    intro:
      "Fondée à Milan en 1978 par Gianni Versace, la maison à la Méduse cultive un glamour solaire que sa parfumerie traduit fidèlement. Bright Crystal, lancé en 2006 — grenade, pivoine, musc — reste l'un des floraux frais les plus vendus au monde, porté par son flacon serti de son bouchon de cristal rose. Une valeur sûre des enseignes françaises, régulièrement animée commercialement : les écarts de prix entre Sephora, Nocibé, Marionnaud, My-Origines et Notino sont fréquents et nos relevés quotidiens permettent d'acheter au creux.",
    signature: 'Le glamour milanais solaire : grenade pétillante, Méduse dorée, fraîcheur best-seller.',
    faq: [
      {
        question: 'Où acheter Bright Crystal au meilleur prix ?',
        answer:
          "Bright Crystal fait l'objet d'animations fréquentes. Notre fiche relève les prix de chaque contenance six fois par jour chez Sephora, Nocibé, Marionnaud, My-Origines et Notino et signale le meilleur prix daté.",
      },
      {
        question: 'À quoi ressemble Bright Crystal ?',
        answer:
          "Un floral fruité frais : grenade et yuzu en tête, pivoine et magnolia au cœur, muscs en fond. Lumineux et facile, c'est un des parfums d'été les plus réachetés du marché.",
      },
      {
        question: 'Quelle contenance de Bright Crystal privilégier ?',
        answer:
          "Pour un parfum frais vaporisé généreusement, les grands formats sont vite amortis : le prix au millilitre y est nettement plus bas. Notre tableau par taille montre l'écart exact à chaque relevé.",
      },
    ],
  },
  'viktor-rolf': {
    displayName: 'Viktor & Rolf',
    intro:
      "Le duo néerlandais Viktor Horsting et Rolf Snoeren, maîtres de la couture conceptuelle, a frappé la parfumerie en 2005 avec Flowerbomb : une « bombe florale » — jasmin, freesia, rose, patchouli — dans un flacon grenade devenu culte. Le parfum, pensé comme une explosion de positivité, s'est installé durablement dans les meilleures ventes mondiales. Distribuée par L'Oréal Luxe, la gamme est présente dans les cinq enseignes que nous suivons, avec des prix qui varient régulièrement selon les formats — nos relevés quotidiens en gardent trace.",
    signature: 'La couture conceptuelle : une grenade florale culte, explosion de jasmin et de patchouli.',
    faq: [
      {
        question: 'Où acheter Flowerbomb au meilleur prix ?',
        answer:
          "Les prix de Flowerbomb s'écartent régulièrement entre Sephora, Nocibé, Marionnaud, My-Origines et Notino. Notre fiche compare chaque contenance six fois par jour et affiche le meilleur prix avec sa date de relevé.",
      },
      {
        question: 'Pourquoi Flowerbomb est-il culte ?',
        answer:
          "Son concept — une explosion florale dans un flacon grenade — et son sillage enveloppant jasmin-patchouli-praline en ont fait une signature immédiatement reconnaissable depuis 2005.",
      },
      {
        question: 'Flowerbomb existe-t-il en plusieurs intensités ?',
        answer:
          "Oui, la ligne s'est déclinée en plusieurs concentrations au fil des années. À version identique, comparez à contenance égale — notre tableau s'en charge à chaque relevé.",
      },
    ],
  },
  'issey-miyake': {
    displayName: 'Issey Miyake',
    intro:
      "Le designer japonais Issey Miyake a importé en parfumerie son minimalisme radical : L'Eau d'Issey, lancée en 1992, voulait sentir « l'eau » — un floral aquatique lotus-cyclamen devenu manifeste de toute une décennie. Son flacon-obélisque coiffé d'une perle demeure un des designs les plus purs du secteur. Distribuée dans les trois grandes enseignes françaises, la référence traverse les années avec des prix régulièrement animés — nos relevés quotidiens permettent de repérer les vraies fenêtres d'achat.",
    signature: "Le minimalisme japonais : l'eau mise en flacon, une pureté devenue classique.",
    faq: [
      {
        question: 'Où acheter L’Eau d’Issey au meilleur prix ?',
        answer:
          "Les prix varient entre Sephora, Nocibé, Marionnaud, My-Origines et Notino selon les contenances. La fiche produit affiche le meilleur prix relevé six fois par jour, avec la date exacte et l'historique complet.",
      },
      {
        question: 'Quelle est la signature de L’Eau d’Issey ?',
        answer:
          "Un floral aquatique pionnier : lotus, cyclamen et freesia sur un fond boisé légèrement musqué. La sensation d'eau pure qui a défini les années 1990 et reste unique aujourd'hui.",
      },
      {
        question: 'L’Eau d’Issey est-elle souvent en promotion ?',
        answer:
          "C'est un classique régulièrement animé en enseigne. L'historique de prix de la fiche permet de vérifier si le prix du jour est réellement bas par rapport aux semaines précédentes.",
      },
    ],
  },
  'elie-saab': {
    displayName: 'Elie Saab',
    intro:
      "Le couturier libanais, maître des robes du tapis rouge, a signé en 2011 avec le parfumeur Francis Kurkdjian un premier parfum devenu classique instantané : Le Parfum, une fleur d'oranger solaire montée sur miel et patchouli, aussi lumineuse que ses broderies. La gamme s'est enrichie de déclinaisons dont Le Parfum Royal. Une parfumerie moins omniprésente que celle des géants — ce qui rend les écarts de prix entre enseignes moins visibles et notre comparaison quotidienne d'autant plus utile.",
    signature: "La haute couture du soleil : fleur d'oranger et miel, signée Francis Kurkdjian.",
    faq: [
      {
        question: 'Où acheter Elie Saab Le Parfum au meilleur prix ?',
        answer:
          "Les prix varient entre les enseignes qui distribuent la marque. Notre fiche compare chaque contenance six fois par jour et affiche le meilleur prix daté — utile pour une référence dont les écarts passent souvent inaperçus.",
      },
      {
        question: 'Qui a créé Le Parfum d’Elie Saab ?',
        answer:
          "Francis Kurkdjian, l'un des parfumeurs les plus célébrés de sa génération, en 2011. Sa fleur d'oranger montée sur miel et patchouli est considérée comme un classique moderne.",
      },
      {
        question: 'Quelle différence entre Le Parfum et Le Parfum Royal ?',
        answer:
          "Le Parfum Royal est une déclinaison plus opulente de la signature originale — même famille solaire, orchestration plus riche. Deux parfums distincts : nos fiches les suivent séparément, chacun avec son historique.",
      },
    ],
  },
  'cacharel': {
    displayName: 'Cacharel',
    intro:
      "Maison française fondée en 1962 par Jean Bousquet, Cacharel a marqué la parfumerie populaire avec des jus romantiques et accessibles — Anaïs Anaïs hier, Amor Amor aujourd'hui. Lancé en 2003, Amor Amor et son flacon rouge passion est un fruité-floral pétillant (cassis, mandarine, jasmin) devenu un classique du premier parfum. Positionnée en entrée de gamme du sélectif, la marque est très animée en enseigne : les écarts et promotions sont fréquents, et nos relevés quotidiens permettent d'acheter réellement au meilleur moment.",
    signature: 'Le romantisme accessible : rouge passion, fruité pétillant, prix très animés.',
    faq: [
      {
        question: 'Où acheter Amor Amor au meilleur prix ?',
        answer:
          "Amor Amor est régulièrement en opération dans les cinq enseignes. Notre fiche relève chaque contenance six fois par jour chez Sephora, Nocibé, Marionnaud, My-Origines et Notino et affiche le meilleur prix avec sa date.",
      },
      {
        question: 'À quoi ressemble Amor Amor ?',
        answer:
          "Un fruité-floral pétillant : cassis et mandarine en tête, jasmin et muguet au cœur, vanille-musc en fond. Juvénile et direct — l'archétype du premier parfum plaisir.",
      },
      {
        question: 'Les parfums Cacharel sont-ils souvent en promo ?',
        answer:
          "Oui, c'est l'une des marques les plus animées de notre panel. Raison de plus pour consulter l'historique de prix : la vraie question n'est pas « est-ce en promo ? » mais « est-ce le bon creux ? ».",
      },
    ],
  },
  'azzaro': {
    displayName: 'Azzaro',
    intro:
      "Loris Azzaro, couturier des soirées parisiennes des années 1970, a fondé une maison où le parfum est pensé comme une arme de séduction. Mademoiselle décline cet héritage dans un registre jeune et floral. La marque, distribuée par Clarins Fragrance Group puis L'Oréal, reste un acteur solide du secteur avec un positionnement accessible. Les références Azzaro sont régulièrement animées en enseigne — nos relevés quotidiens documentent les variations pour distinguer les vraies opportunités des prix barrés récurrents.",
    signature: 'La séduction à la française : héritage seventies, positionnement accessible.',
    faq: [
      {
        question: 'Où acheter Azzaro Mademoiselle au meilleur prix ?',
        answer:
          "Les prix varient selon les enseignes qui distribuent la référence. Notre fiche affiche le meilleur prix relevé six fois par jour, avec la date exacte et l'historique complet par contenance.",
      },
      {
        question: 'À qui s’adresse Azzaro Mademoiselle ?',
        answer:
          "C'est un floral jeune et lumineux, pensé comme un premier parfum de caractère — dans la tradition de séduction de la maison, mais en version fraîche et accessible.",
      },
      {
        question: 'Les parfums Azzaro sont-ils souvent remisés ?',
        answer:
          "Régulièrement, comme la plupart des marques au positionnement accessible. L'historique de prix de la fiche montre si la remise du jour est une vraie baisse ou un prix barré permanent.",
      },
    ],
  },
  'boucheron': {
    displayName: 'Boucheron',
    intro:
      "Joaillier de la place Vendôme depuis 1858, Boucheron transpose en parfumerie ses codes de haute joaillerie. Quatre, qui reprend le nom de sa bague iconique aux quatre anneaux, est un floral-boisé ciselé comme un bijou. Une parfumerie confidentielle et élégante, moins exposée aux grandes animations commerciales — ce qui rend les écarts de prix entre enseignes discrets mais bien réels : nos relevés quotidiens les font apparaître là où l'œil nu ne les verrait pas.",
    signature: 'La haute joaillerie olfactive : quatre anneaux, un floral ciselé, une discrétion précieuse.',
    faq: [
      {
        question: 'Où acheter Boucheron Quatre au meilleur prix ?',
        answer:
          "Référence confidentielle, Quatre affiche des écarts entre enseignes qui passent facilement inaperçus. Nos relevés six fois par jour les détectent et affichent le meilleur prix daté par contenance.",
      },
      {
        question: 'D’où vient le nom du parfum Quatre ?',
        answer:
          "De la bague Quatre, l'icône de la maison Boucheron, qui superpose quatre anneaux d'or aux textures différentes. Le parfum en reprend l'esprit : plusieurs facettes (fruitée, florale, boisée) fondues en un seul bijou.",
      },
      {
        question: 'Les parfums Boucheron sont-ils chers ?',
        answer:
          "Le positionnement est celui d'une maison joaillière, mais les prix restent compétitifs face aux géants du luxe — et les écarts entre enseignes, visibles dans notre historique, permettent souvent une vraie économie.",
      },
    ],
  },
  'diesel': {
    displayName: 'Diesel',
    intro:
      "La marque italienne fondée par Renzo Rosso en 1978, pionnière du denim premium et du marketing provocateur, a transposé son irrévérence en parfumerie. Loverdose, avec son flacon en cœur violet transpercé, assume un gourmand addictif — réglisse, vanille, bois ambrés — pensé comme un philtre. Positionnée accessible et distribuée par L'Oréal, la gamme est régulièrement animée en enseigne : nos relevés quotidiens suivent ces mouvements de prix pour identifier les vraies fenêtres d'achat.",
    signature: "L'irrévérence italienne : un cœur violet, la réglisse en philtre d'amour.",
    faq: [
      {
        question: 'Où acheter Loverdose au meilleur prix ?',
        answer:
          "Les prix de Loverdose varient selon les enseignes et les périodes. Notre fiche relève chaque contenance six fois par jour et affiche le meilleur prix avec la date exacte du relevé.",
      },
      {
        question: 'À quoi ressemble Loverdose ?',
        answer:
          "Un gourmand assumé : mandarine en tête, réglisse étoilée et jasmin au cœur, vanille-bois ambrés en fond. Addictif et direct, à l'image du flacon-cœur transpercé.",
      },
      {
        question: 'Les parfums Diesel sont-ils souvent en promo ?',
        answer:
          "Régulièrement, comme la plupart des positionnements accessibles. Consultez l'historique de prix de la fiche pour distinguer une vraie baisse d'un prix barré récurrent.",
      },
    ],
  },
  'dkny': {
    displayName: 'DKNY',
    intro:
      "DKNY — Donna Karan New York — a mis l'énergie de Manhattan en flacon avec la ligne Be Delicious et sa pomme verte devenue signature mondiale. Lancé en 2004, le parfum au flacon-pomme métallique mêle concombre, pomme Granny Smith et bois blancs : la fraîcheur croquante d'un matin new-yorkais. Une référence au positionnement accessible, régulièrement animée dans les enseignes qui la distribuent — nos relevés quotidiens permettent de suivre ses variations de prix au plus près.",
    signature: 'Manhattan en flacon : la pomme verte la plus célèbre de la parfumerie.',
    faq: [
      {
        question: 'Où acheter Be Delicious au meilleur prix ?',
        answer:
          "Les prix varient selon les enseignes qui distribuent la référence. Notre fiche affiche le meilleur prix relevé six fois par jour, avec la date exacte et l'historique par contenance.",
      },
      {
        question: 'À quoi ressemble Be Delicious ?',
        answer:
          "Une pomme verte croquante : concombre et pamplemousse en tête, Granny Smith et muguet au cœur, bois blancs en fond. Frais, net, immédiatement identifiable depuis 2004.",
      },
      {
        question: 'Le parfum Be Delicious est-il souvent remisé ?',
        answer:
          "La référence apparaît régulièrement dans les opérations commerciales. L'historique de prix de la fiche montre si le prix du jour constitue une vraie opportunité.",
      },
    ],
  },
  'elizabeth-arden': {
    displayName: 'Elizabeth Arden',
    intro:
      "Pionnière de la beauté moderne, Elizabeth Arden ouvrait dès 1910 son premier salon derrière une porte rouge sur la Cinquième Avenue — une porte devenue le nom de son parfum signature, Red Door (1989), un grand floral opulent à l'ancienne (rose, jasmin, ylang). La marque incarne une parfumerie américaine classique au positionnement accessible, dont les prix varient sensiblement selon les enseignes et les périodes — des écarts que nos relevés quotidiens documentent précisément.",
    signature: 'La porte rouge de la Cinquième Avenue : un grand floral américain classique.',
    faq: [
      {
        question: 'Où acheter Red Door au meilleur prix ?',
        answer:
          "Les prix de Red Door varient selon les enseignes qui le distribuent. Notre fiche affiche le meilleur prix relevé six fois par jour, avec la date exacte et l'historique complet.",
      },
      {
        question: 'Quelle est l’histoire de Red Door ?',
        answer:
          "Le parfum, lancé en 1989, tire son nom de la porte rouge du premier salon Elizabeth Arden ouvert en 1910 sur la Cinquième Avenue à New York. C'est un floral opulent classique : rose, jasmin, ylang-ylang.",
      },
      {
        question: 'Red Door est-il un bon rapport qualité-prix ?',
        answer:
          "C'est l'un des grands floraux classiques les plus accessibles du marché. Comme toujours, le prix au millilitre selon la contenance et l'écart entre enseignes font la différence — notre tableau les affiche à chaque relevé.",
      },
    ],
  },
  'jimmy-choo': {
    displayName: 'Jimmy Choo',
    intro:
      "Le chausseur londonien dont les stilettos ont conquis les tapis rouges décline depuis 2011 son glamour en parfumerie. I Want Choo, lancé en 2020, assume la gourmandise pétillante — poire, jasmin sambac, vanille — dans un flacon dégradé rose champagne. Une parfumerie jeune, festive et accessible, régulièrement mise en avant dans les enseignes qui la distribuent. Nos relevés quotidiens suivent ses prix contenance par contenance pour repérer les vrais creux.",
    signature: 'Le glamour du soulier : gourmandise champagne, fête assumée, prix accessibles.',
    faq: [
      {
        question: 'Où acheter I Want Choo au meilleur prix ?',
        answer:
          "Les prix varient selon les enseignes qui distribuent la référence. Notre fiche affiche le meilleur prix relevé six fois par jour, avec la date exacte et l'historique par contenance.",
      },
      {
        question: 'À quoi ressemble I Want Choo ?',
        answer:
          "Un gourmand festif : mandarine et poivre rose en tête, jasmin sambac au cœur, vanille et benjoin en fond. Pétillant et assumé — un parfum de soirée qui se porte aussi en journée.",
      },
      {
        question: 'Les parfums Jimmy Choo sont-ils souvent en promo ?',
        answer:
          "La gamme est régulièrement animée en enseigne. Vérifiez l'historique de prix de la fiche pour acheter dans un vrai creux plutôt que sur un prix barré permanent.",
      },
    ],
  },
  'marc-jacobs': {
    displayName: 'Marc Jacobs',
    intro:
      "Le créateur new-yorkais a signé en 2007 l'un des parfums les plus identifiables du marché : Daisy, sa marguerite pop devenue icône — un floral frais (violette, fraise sauvage, jasmin) au flacon couronné de pâquerettes en vinyle. Le parfum a engendré toute une famille de déclinaisons, mais l'original conserve son charme faussement naïf. Distribuée par Coty, la gamme connaît des animations régulières dans les enseignes qui la proposent — nos relevés quotidiens en suivent chaque mouvement.",
    signature: 'La marguerite pop de New York : fraîcheur faussement naïve, flacon culte.',
    faq: [
      {
        question: 'Où acheter Daisy au meilleur prix ?',
        answer:
          "Les prix de Daisy varient selon les enseignes qui le distribuent. Notre fiche compare chaque contenance six fois par jour et affiche le meilleur prix avec sa date de relevé.",
      },
      {
        question: 'Daisy original ou ses déclinaisons ?',
        answer:
          "L'original (2007) est un floral frais violette-fraise-jasmin ; les déclinaisons (Daisy Love, Daisy Dream…) sont des parfums distincts, pas des variantes du même jus. Nos fiches ne les confondent jamais : chaque parfum a son propre suivi.",
      },
      {
        question: 'Les parfums Marc Jacobs sont-ils souvent remisés ?',
        answer:
          "Régulièrement, comme la plupart des gammes Coty. L'historique de prix de la fiche distingue les vraies baisses des prix barrés récurrents.",
      },
    ],
  },
  'tom-ford': {
    displayName: 'Tom Ford',
    intro:
      "Le créateur texan qui a réinventé Gucci a fondé en 2005 sa propre maison avec une ambition claire : ramener l'opulence et le trouble dans la parfumerie de luxe. Black Orchid, son premier parfum, reste son manifeste — une orchidée noire baroque, entre truffe, cacao et patchouli, aussi clivante qu'inoubliable. Positionnée haut de gamme et distribuée par Estée Lauder, la marque tient ses prix : les écarts entre enseignes sont rares mais précieux, et nos relevés quotidiens les capturent dès qu'ils apparaissent.",
    signature: "L'opulence assumée : une orchidée noire baroque, du trouble en flacon doré.",
    faq: [
      {
        question: 'Où acheter Black Orchid au meilleur prix ?',
        answer:
          "Tom Ford tient fermement ses prix, mais des écarts ponctuels apparaissent entre les enseignes qui le distribuent. Nos relevés six fois par jour les détectent par contenance, avec la date exacte.",
      },
      {
        question: 'À quoi ressemble Black Orchid ?',
        answer:
          "Un oriental baroque : truffe noire et cassis en tête, orchidée et épices au cœur, patchouli, vanille et encens en fond. Dense, nocturne, clivant — un parfum de caractère assumé.",
      },
      {
        question: 'Pourquoi les parfums Tom Ford sont-ils chers ?',
        answer:
          "Positionnement luxe assumé, concentrations élevées et distribution contrôlée. Raison de plus pour comparer : à contenance égale, l'écart entre enseignes — visible dans notre historique — peut représenter une économie réelle.",
      },
    ],
  },
};

/** Contenu de repli pour une marque sans éditorial dédié (nouvelle marque ajoutée). */
export function fallbackBrandContent(name: string): BrandContent {
  return {
    displayName: name,
    intro:
      `Nous suivons les parfums ${name} chez Sephora, Nocibé, Marionnaud, My-Origines et Notino : prix relevés six fois par jour, contenance par contenance, avec historique complet. Le tableau ci-dessous affiche le meilleur prix actuel pour chaque parfum suivi — cliquez sur une fiche pour voir la comparaison détaillée par taille et l'évolution du prix dans le temps.`,
    signature: 'Prix relevés six fois par jour, comparés à taille égale.',
    faq: [
      {
        question: `Où acheter les parfums ${name} au meilleur prix ?`,
        answer:
          "Les prix varient entre Sephora, Nocibé, Marionnaud, My-Origines et Notino selon les contenances et les périodes. Nos relevés, effectués six fois par jour à taille égale, affichent sur chaque fiche l'enseigne la moins chère du moment et la date exacte du relevé.",
      },
      {
        question: `Les parfums ${name} sont-ils souvent en promotion ?`,
        answer:
          "Cela dépend des périodes et des enseignes. L'historique de prix de chaque fiche permet de vérifier si une remise affichée est une vraie baisse ou un prix barré permanent.",
      },
    ],
  };
}
