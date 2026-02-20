import prisma from '@/lib/prisma';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, Star } from 'lucide-react';
import DealCard from '@/components/deals/DealCard';
import { Deal } from '@/types';

export const dynamic = 'force-dynamic';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://citybaddies.com';

// Mapping des images personnalisées par slug
// Les images doivent être placées dans public/images/categories/
const CATEGORY_IMAGES: Record<string, string> = {
  'maquillage': '/images/categories/header-maquillage.png',
  'soins-visage': '/images/categories/header-soins-visage.png',
  'soins-corps': '/images/categories/header-soins-corps.png',
  'cheveux': '/images/categories/header-cheveux.png',
  'parfums': '/images/categories/header-parfums.png',
  'ongles': '/images/categories/header-ongles.png',
  'accessoires': '/images/categories/header-accessoires.png',
};

// Descriptions SEO enrichies par catégorie
const CATEGORY_CONTENT: Record<string, {
  heroTitle: string;
  heroDescription: string;
  seoDescription: string;
  keywords: string[];
  tips: string[];
  richContent: {
    intro: string;
    sections: { title: string; content: string }[];
    faq: { question: string; answer: string }[];
  };
}> = {
  'maquillage': {
    heroTitle: 'Deals Maquillage | Luxe & Drugstore',
    heroDescription: 'Fonds de teint couvrants, rouges à lèvres longue tenue, mascaras volume extrême... Les essentiels de votre trousse beauté à prix d\'initié.',
    seoDescription: 'Accédez aux ventes privées Maquillage : -50% sur MAC, Charlotte Tilbury, NARS. Fonds de teint, palettes, mascaras. Stock limité, vérifié en temps réel.',
    keywords: ['maquillage de luxe pas cher', 'palettes fards à paupières promo', 'rouge à lèvres mac solde', 'fond de teint estee lauder reduction', 'anti cernes nars promo', 'maquillage sephora pas cher'],
    tips: [
      'Investissez dans le teint : Un fond de teint de luxe (Dior, Armani) contient de meilleurs pigments et tient toute la journée. En promo à -40%, il coûte le prix d’un produit de supermarché.',
      'Les palettes yeux sont les investissements les plus rentables : Le coût par fard est dérisoire sur les grandes palettes (Huda, Natasha Denona). Visez les soldes pour les acquérir.',
      'Fixateurs & Bases sont souvent négligés mais essentiels pour rentabiliser votre maquillage : un spray fixant en promo double la durée de vie de votre look.',
    ],    richContent: {
      intro: 'Le maquillage de luxe n\'a jamais été aussi accessible. Chez City Baddies, nous traquons quotidiennement les meilleures promotions sur les marques que vous adorez : MAC, Charlotte Tilbury, NARS, Urban Decay, Too Faced, et bien d\'autres. Notre mission ? Vous permettre d\'accéder aux produits haut de gamme sans exploser votre budget.',
      sections: [
        { title: 'Comment choisir son fond de teint en promo ?', content: 'Le fond de teint est la base de tout maquillage réussi. Avant de craquer sur une offre, vérifiez toujours la date de péremption (les produits soldés sont parfois proches de l\'expiration). Privilégiez les marques reconnues pour leur tenue : Estée Lauder Double Wear, Giorgio Armani Luminous Silk, ou Dior Forever. En promo à -30% ou -40%, ces références valent largement l\'investissement.' },
        { title: 'Les palettes : le meilleur rapport qualité-prix', content: 'Une palette de fards à paupières de qualité (Huda Beauty, Natasha Denona, Urban Decay Naked) contient généralement entre 12 et 18 teintes. Calculez le prix par fard : sur une palette à 50€ avec 15 fards, chaque teinte revient à 3,33€. Attendez les soldes (-30% à -50%) et ce prix descend à moins de 2€ par fard. Imbattable comparé à l\'achat de fards individuels.' },
        { title: 'Mascaras et rouges à lèvres : les essentiels', content: 'Les mascaras sèchent en 3 à 6 mois après ouverture. N\'achetez pas en trop grande quantité, même en promo. En revanche, les rouges à lèvres (surtout les formules liquides mates) se conservent très bien. Les coffrets "Lip Kits" avec plusieurs teintes sont particulièrement intéressants pendant les French Days et le Black Friday.' }
      ],
      faq: [
        { question: 'Où trouver du maquillage de marque pas cher ?', answer: 'City Baddies compare en temps réel les prix chez Sephora, Nocibé et Marionnaud. Nous détectons automatiquement les ventes privées, soldes et offres flash. Inscrivez-vous à notre newsletter pour être alertée dès qu\'une promo exceptionnelle apparaît sur vos marques favorites.' },
        { question: 'Le maquillage en promotion est-il de qualité ?', answer: 'Absolument. Les enseignes comme Sephora soldent des produits authentiques, souvent en fin de collection ou avant le lancement d\'une nouvelle gamme. La qualité est identique aux produits plein tarif. Vérifiez simplement la date de péremption sur les produits liquides (fond de teint, mascara).' },
        { question: 'Quand acheter son maquillage moins cher ?', answer: 'Les meilleures périodes sont : les French Days (mai et septembre), le Black Friday (novembre), les soldes d\'hiver (janvier) et d\'été (juin-juillet), et les ventes privées Sephora (Gold et VIB). City Baddies surveille ces périodes pour vous.' }
      ]
    }  },
  'soins-visage': {
    heroTitle: 'Soins Visage | Skincare Premium',
    heroDescription: 'La peau parfaite commence ici. Sérums actifs, crèmes riches et soins dermatologiques pour une routine sur-mesure sans compromis.',
    seoDescription: 'Meilleures offres Skincare France : -40% sur La Roche-Posay, Estée Lauder, Lancôme, The Ordinary. Sérums Rétinol, Vitamine C, Crèmes anti-âge. Prix vérifiés.',
    keywords: ['skincare routine pas cher', 'sérum vitamine c efficace', 'crème anti age promo', 'rétinol the ordinary reduction', 'soin visage estee lauder moins cher', 'nettoyant visage cerave promo'],
    tips: [
      'Le Rétinol et la Vitamine C sont les actifs les plus chers. N’achetez jamais ces sérums plein pot : les parapharmacies en ligne font des offres tournantes chaque semaine.',
      'L’hydratation n’a pas besoin d’être chère : Les crèmes simples (CeraVe, La Roche Posay) en grand format pompe sont imbattables en rapport qualité/prix.',
      'Protection solaire 365 jours/an : Les SPF asiatiques ou de parapharmacie s’achètent souvent par lot de 2 avant l’été. C’est le meilleur moment pour stocker.',
    ],    richContent: {
      intro: 'La skincare est devenue un rituel incontournable. Mais entre les sérums à 80€ et les crèmes à 150€, le budget peut vite exploser. City Baddies vous aide à construire une routine efficace sans vous ruiner en dénichant les meilleures promotions sur les actifs qui fonctionnent vraiment : rétinol, vitamine C, acide hyaluronique, niacinamide.',
      sections: [
        { title: 'Les actifs essentiels à avoir dans sa routine', content: 'Une routine skincare efficace repose sur quelques actifs clés. Le matin : Vitamine C (antioxydant, éclat) + SPF (protection obligatoire). Le soir : Rétinol (anti-âge, texture) ou acides exfoliants (AHA/BHA pour les pores). Toujours : un bon nettoyant et une crème hydratante. The Ordinary, La Roche-Posay et CeraVe proposent ces actifs à prix abordables, encore plus intéressants en promo.' },
        { title: 'Skincare de luxe vs parapharmacie : que choisir ?', content: 'Les marques de luxe (La Mer, Estée Lauder, Lancôme) offrent des textures exceptionnelles et des expériences sensorielles premium. Mais côté efficacité pure, les marques dermatologiques (La Roche-Posay, CeraVe, Avène) rivalisent souvent pour une fraction du prix. Notre conseil : investissez dans les sérums actifs de luxe en promo, et restez basique sur les nettoyants et hydratants.' },
        { title: 'Comment repérer les vraies bonnes affaires ?', content: 'Méfiez-vous des "prix barrés" gonflés artificiellement. City Baddies calcule le prix au millilitre pour chaque produit, vous permettant de comparer objectivement. Un sérum à 30ml soldé à 40€ (-30%) peut être moins intéressant qu\'un flacon de 50ml à 55€ sans promo. Faites toujours le calcul.' }
      ],
      faq: [
        { question: 'Quel ordre pour appliquer ses soins visage ?', answer: 'Du plus léger au plus épais : 1) Nettoyant 2) Tonique/Essence 3) Sérum(s) 4) Contour des yeux 5) Crème hydratante 6) SPF le matin / Huile le soir. Attendez 30 secondes entre chaque couche pour une meilleure absorption.' },
        { question: 'À quel âge commencer les soins anti-âge ?', answer: 'Dès 25 ans, vous pouvez introduire un sérum à la vitamine C (antioxydant). À partir de 30 ans, le rétinol devient pertinent. Mais le soin anti-âge le plus efficace reste le SPF quotidien, à utiliser dès l\'adolescence.' },
        { question: 'The Ordinary, c\'est vraiment bien ?', answer: 'The Ordinary offre des actifs concentrés à prix imbattables. Les best-sellers (Niacinamide 10%, Acide Hyaluronique, Buffet) sont excellents. En revanche, les textures sont basiques et certaines formules peuvent irriter. Parfait pour débuter ou compléter une routine, moins adapté si vous cherchez une expérience sensorielle premium.' }
      ]
    }  },
  'soins-corps': {
    heroTitle: 'Soins Corps | Spa à Domicile',
    heroDescription: 'L’art du soin global. Gommages luxueux, laits fondants et huiles satinées pour sublimer chaque centimètre de peau.',
    seoDescription: 'Ventes flash Soins Corps : Rituals, Nuxe, Clarins, Sol de Janeiro. Gommages, Huiles sèches, Crèmes raffermissantes. Jusqu\'à -60% sur les best-sellers.',
    keywords: ['rituals promo', 'huile prodigieuse nuxe pas cher', 'crème corps sol de janeiro reduction', 'gommage corps rituals solde', 'autobronzant st tropez promo'],
    tips: [
      'Les pots formats "Salon" (500ml) sont une astuce d’initié. Souvent cachés en bas de page, ils coûtent 30% moins cher au litre que les formats standards.',
      'Les huiles sèches sont multi-usages : Visage, corps, pointes de cheveux. Une bouteille de Nuxe en promo remplace 3 produits dans votre valise.',
      'Les coffrets "Rituals" ou "Sol de Janeiro" sont souvent moins chers que l\'achat du gommage et de la crème séparés. Vérifiez toujours les bundles.',
    ],    richContent: {
      intro: 'Transformer sa salle de bain en spa n\'a jamais été aussi accessible. Des gommages exfoliants aux huiles satinées, en passant par les laits fondants parfumés, City Baddies sélectionne les meilleures promotions sur les marques qui font la différence : Rituals, Nuxe, Clarins, Sol de Janeiro, The Body Shop.',
      sections: [
        { title: 'Routine corps complète : les étapes essentielles', content: 'Une routine corps efficace se décompose en 3 étapes : 1) Gommage (1 à 2 fois par semaine) pour éliminer les cellules mortes et booster l\'éclat. 2) Huile ou beurre sur peau humide pour nourrir en profondeur. 3) Lait ou crème pour sceller l\'hydratation. Sol de Janeiro Bum Bum Cream, Nuxe Huile Prodigieuse et les gommages Rituals sont des valeurs sûres à guetter en promo.' },
        { title: 'Sol de Janeiro : le phénomène brésilien', content: 'La marque brésilienne a conquis le monde avec sa Bum Bum Cream et son parfum signature Brazilian Bum Bum. Les prix sont élevés (45€ le pot de 240ml), mais les coffrets en édition limitée et les ventes privées permettent d\'économiser jusqu\'à 30%. Le format Beija Flor (400ml avec pompe) est le plus économique à long terme.' },
        { title: 'Autobronzants et préparation soleil', content: 'Avant l\'été, les autobronzants St. Tropez, Bondi Sands et Tan-Luxe sont régulièrement soldés. Astuce : achetez en mai-juin quand les stocks sont pleins et les promos fréquentes. Les mousses autobronzantes s\'appliquent facilement avec un gant (indispensable pour éviter les traces).' }
      ],
      faq: [
        { question: 'À quelle fréquence faire un gommage corps ?', answer: '1 à 2 fois par semaine maximum. Un gommage trop fréquent irrite la peau et détruit sa barrière naturelle. Privilégiez les gommages à grains fins (sucre, sel fin) plutôt que les exfoliants agressifs.' },
        { question: 'Huile ou crème corps, que choisir ?', answer: 'L\'huile pénètre mieux sur peau humide et laisse un fini satiné. La crème est plus pratique au quotidien (pas de temps de séchage). L\'idéal : huile le soir après la douche, crème le matin pour une hydratation express.' },
        { question: 'Les soins corps anti-cellulite fonctionnent-ils ?', answer: 'Soyons honnêtes : aucune crème ne fait disparaître la cellulite. En revanche, les soins raffermissants à la caféine (Clarins, Biotherm) améliorent l\'aspect de la peau et créent un effet tenseur temporaire. Combinés à un massage régulier, ils valent le coup en promo.' }
      ]
    }  },
  'cheveux': {
    heroTitle: 'Soins Cheveux | Salon Quality',
    heroDescription: 'Transformez votre chevelure avec les protocoles professionnels. Kérastase, Olaplex et Redken enfin accessibles.',
    seoDescription: 'Promos Coiffure Pro : Olaplex, Kérastase, GHD, Dyson. Shampoings, Masques, Lisseurs. Des cheveux de salon à 50% du prix.',
    keywords: ['olaplex pas cher', 'kerastase promo', 'steampod reduction', 'shampoing professionnel pas cher', 'masque cheveux abimés promo', 'huile cheveux kerastase solde'],
    tips: [
      'La Règle du Litre : N’achetez plus jamais les formats 250ml. Les bouteilles d’un litre (avec pompe) de Kérastase ou L’Oréal Pro durent 6 mois et divisent le prix par deux.',
      'Olaplex N°3 est un investissement : Attendez les bundles "N°3 + N°0" ou les offres "2 achetés 1 offert" pour faire votre stock de l’année. Ça part très vite.',
      'Les outils chauffants (GHD, Steampod) ne s\'achètent que pendant le Black Friday ou les French Days. En dehors de ces périodes, les vraies promos sont rares.',
    ],    richContent: {
      intro: 'Des cheveux de salon sans le prix du salon, c\'est possible. City Baddies traque les meilleures offres sur les marques professionnelles : Kérastase, Olaplex, Redken, L\'Oréal Professionnel, ainsi que les outils iconiques comme GHD, Dyson et Steampod. Découvrez comment économiser jusqu\'à 50% sur votre routine capillaire.',
      sections: [
        { title: 'Olaplex : le traitement miracle décrypté', content: 'Olaplex a révolutionné le soin capillaire avec sa technologie de reconstruction des ponts disulfures. Le N°3 (soin maison) est le plus populaire, mais le N°0 (primer) amplifie ses effets. Le duo N°0 + N°3 en coffret est souvent plus avantageux que les produits séparés. Attention aux contrefaçons sur les marketplaces : achetez uniquement chez les revendeurs agréés (Sephora, Nocibé, salons).' },
        { title: 'Kérastase : quelle gamme choisir ?', content: 'Kérastase propose des gammes ciblées : Nutritive (cheveux secs), Résistance (cheveux abîmés), Blond Absolu (blonds/méchés), Genesis (chute), Elixir Ultime (huiles). Identifiez votre besoin principal avant de craquer sur une promo. Les formats 1 litre (shampoing + soin) sont les plus économiques et régulièrement soldés sur les sites spécialisés.' },
        { title: 'GHD vs Dyson vs Steampod : quel outil choisir ?', content: 'Le lisseur GHD est la référence salon, fiable et efficace (150-200€). Le Dyson Airwrap est un investissement conséquent (500€+) mais polyvalent (séchage, bouclage, lissage). Le Steampod L\'Oréal offre un lissage à la vapeur doux pour les cheveux fragiles (250€). Tous ces outils ne s\'achètent qu\'en promo (Black Friday, French Days).' }
      ],
      faq: [
        { question: 'À quelle fréquence utiliser Olaplex N°3 ?', answer: 'Une fois par semaine pour les cheveux très abîmés (colorations, décolorations). Tous les 10-15 jours pour l\'entretien. Laissez poser minimum 10 minutes, idéalement 30 minutes à 1 heure pour un effet optimal.' },
        { question: 'Les shampoings sans sulfates sont-ils meilleurs ?', answer: 'Les sulfates nettoient efficacement mais peuvent assécher les cheveux colorés ou sensibles. Les shampoings sans sulfates sont plus doux mais moussent moins. Pour les cheveux naturels non traités, les sulfates ne posent généralement pas de problème.' },
        { question: 'Comment reconnaître un vrai Olaplex ?', answer: 'Achetez uniquement chez les revendeurs agréés : Sephora, Nocibé, Marionnaud, salons de coiffure. Évitez Amazon Marketplace et les sites inconnus. Le packaging doit être impeccable, le produit doit avoir une légère odeur chimique caractéristique.' }
      ]
    }  },
  'parfums': {
    heroTitle: 'Parfumerie | Haute Couture',
    heroDescription: 'Sillages d’exception et fragrances iconiques. Les plus grandes maisons de parfumerie sélectionnées pour vous.',
    seoDescription: 'Parfums de Luxe en Solde : Chanel, Dior, YSL, Guerlain. Eaux de Parfum, Coffrets cadeaux. Jusqu\'à -50% sur les best-sellers parfumerie.',
    keywords: ['parfum femme pas cher', 'black opium ysl promo', 'la vie est belle lancome solde', 'parfum homme moins cher', 'coffret parfum sephora promo', 'parfum niche pas cher'],
    tips: [
      'Ne jetez pas vos flacons vides : Sephora et Nocibé offrent -20% sur votre prochain parfum si vous rapportez un flacon vide (même d\'une autre marque).',
      'Les "Testers" sont un mythe en ligne, mais les coffrets sont la réalité. Un coffret (Parfum + Lait Corps) coûte souvent le même prix, voire moins cher, que le parfum seul.',
      'Eau de Parfum vs Toilette : Calculez le prix au "pschitt". Une Eau de Parfum tient 8h, une Eau de Toilette 4h. L\'EDP est souvent plus économique à l\'usage.',
    ],
    richContent: {
      intro: 'Le parfum est l\'accessoire invisible le plus puissant. City Baddies vous aide à accéder aux plus belles créations olfactives sans payer le prix fort. Des classiques indémodables (Chanel N°5, J\'adore Dior) aux nouveautés désirables (Libre YSL, Good Girl Carolina Herrera), découvrez comment économiser sur votre signature parfumée.',
      sections: [
        { title: 'Eau de Toilette, Eau de Parfum, Parfum : quelles différences ?', content: 'La concentration en huiles essentielles détermine la tenue et le prix. Eau de Toilette (5-15%) : légère, 3-4h de tenue, idéale pour le quotidien. Eau de Parfum (15-20%) : plus intense, 6-8h, le meilleur rapport qualité-prix. Parfum/Extrait (20-40%) : très concentré, tenue maximale, luxe absolu. Calculez le prix par heure de tenue pour comparer objectivement.' },
        { title: 'Les coffrets : la stratégie gagnante', content: 'Les coffrets parfum (flacon + lait corps + miniature voyage) sont vendus au même prix, voire moins cher, que le flacon seul à Noël et pour la Fête des Mères. C\'est le meilleur moment pour acheter. Le lait corps assorti prolonge la tenue du parfum et renforce le sillage.' },
        { title: 'Parfumerie niche : le luxe accessible en promo', content: 'Les maisons niches (Maison Francis Kurkdjian, Byredo, Diptyque, Jo Malone) sont rarement soldées. Exception : les coffrets découverte et les ventes privées exclusives. City Baddies surveille ces opportunités rares pour vous. Alternative : les dupes de qualité (Dossier, Zara Emotions) offrent des expériences similaires à prix mini.' }
      ],
      faq: [
        { question: 'Comment faire durer son parfum plus longtemps ?', answer: 'Appliquez sur peau hydratée (après une crème ou huile non parfumée). Ciblez les points de chaleur : poignets, cou, derrière les oreilles, plis des coudes. Ne frottez pas vos poignets, cela "casse" les molécules. Vaporisez aussi dans les cheveux (pas directement, sur la brosse).' },
        { question: 'Un parfum peut-il tourner ou périmer ?', answer: 'Oui. Conservez vos parfums à l\'abri de la lumière et de la chaleur (pas dans la salle de bain). Un parfum bien conservé dure 3-5 ans. Les notes de tête (agrumes) s\'évaporent en premier. Si l\'odeur change ou devient vinaigrée, il est temps de le remplacer.' },
        { question: 'Où acheter des parfums moins cher ?', answer: 'Les meilleures sources : ventes privées Sephora/Nocibé, soldes d\'hiver (janvier) et d\'été (juillet), Black Friday, et l\'offre "flacon vide" (-20%). Évitez les sites douteux promettant -70% : risque élevé de contrefaçons. City Baddies ne référence que les offres légitimes.' }
      ]
    }
  },
  'ongles': {
    heroTitle: 'Ongles | Manucure Pro',
    heroDescription: 'L’élégance jusqu’au bout des doigts. Vernis semi-permanents, soins fortifiants et lampes LED pour un résultat salon.',
    seoDescription: 'Manucure à la maison : OPI, Essie, Manucurist, Le Mini Macaron. Vernis semi-permanents, Lampes LED, Kits complets à prix réduits.',
    keywords: ['vernis semi permanent pas cher', 'kit manucure led promo', 'vernis opi solde', 'manucurist green flash reduction', 'lampe uv ongles pas cher'],
    tips: [
      'Le Semi-Permanent est rentable dès la 2ème pose : Un kit complet (Lampe + Vernis) coûte le prix d\'une seule pose en institut. C\'est l\'investissement beauté le plus vite amorti.',
      'La base est le secret : Vous pouvez utiliser des vernis couleur "drugstore" si vous avez une excellente Base et un excellent Top Coat (OPI ou Manucurist). Mettez le prix là-dessus.',
      'Les dissolvants avec acétone abîment tout. Profitez des promos pour acheter des dissolvants doux ou des "clips" de dépose réutilisables, plus écologiques et économiques.',
    ],
    richContent: {
      intro: 'La manucure professionnelle à domicile n\'est plus un rêve. Avec les bons outils et produits, vous pouvez obtenir un résultat salon qui tient 2 semaines. City Baddies compare les prix sur les meilleures marques : OPI, Essie, Manucurist, Le Mini Macaron, ainsi que les lampes LED et kits complets.',
      sections: [
        { title: 'Semi-permanent maison : par où commencer ?', content: 'Un kit de démarrage complet comprend : une lampe LED/UV (48W minimum), une base, un top coat, des vernis couleur, un dégraissant, et des accessoires de dépose. Marques recommandées : Le Mini Macaron (compact, voyage), Manucurist Green Flash (formule clean), OPI GelColor (qualité salon). Budget : 50-80€ le kit, rentabilisé en 2 poses vs institut.' },
        { title: 'OPI vs Essie vs Manucurist : le match', content: 'OPI : la référence salon, palette de couleurs immense, formules iconiques (Big Apple Red, Bubble Bath). Tenue exceptionnelle. Essie : couleurs sophistiquées, formules respectueuses. Le ballet slippers rose est un classique. Manucurist : marque française "clean", formule Green Flash sans ingrédients controversés. Prix plus élevé mais éco-responsable.' },
        { title: 'Prendre soin de ses ongles au quotidien', content: 'Des ongles sains = une meilleure tenue du vernis. Hydratez vos cuticules quotidiennement (huile d\'amande douce). Évitez de couper vos cuticules (repoussez-les doucement). Limez toujours dans le même sens. Faites des "pauses" entre les poses de semi-permanent pour laisser l\'ongle respirer.' }
      ],
      faq: [
        { question: 'Le semi-permanent abîme-t-il les ongles ?', answer: 'C\'est surtout la dépose qui abîme, pas le produit lui-même. Ne grattez jamais votre vernis. Utilisez toujours un dissolvant adapté et des clips de dépose. Faites une pause d\'une semaine tous les 2-3 mois avec un soin fortifiant.' },
        { question: 'Combien de temps dure une manucure semi-permanente ?', answer: 'En moyenne 2 à 3 semaines sans écailler. La tenue dépend de la qualité des produits, de la préparation de l\'ongle (dégraissage++) et de votre mode de vie (le contact fréquent avec l\'eau réduit la tenue).' },
        { question: 'Lampe LED ou UV, quelle différence ?', answer: 'Les lampes LED polymérisent plus vite (30-60 secondes vs 2-3 minutes pour UV) et durent plus longtemps. Elles sont compatibles avec la plupart des vernis modernes. Prix similaire aujourd\'hui, la LED est le meilleur choix.' }
      ]
    }
  },
  'accessoires': {
    heroTitle: 'Accessoires | Tools of Trade',
    heroDescription: 'Les outils des makeup artists. Pinceaux de précision, éponges HD et gadgets high-tech pour sublimer votre routine.',
    seoDescription: 'Accessoires Beauté Pro : Pinceaux Zoeva, Real Techniques, Beauty Blender, Foreo. Brosses nettoyantes, Miroirs LED, Trousses de voyage. Promos exclusives.',
    keywords: ['kit pinceaux maquillage pro', 'beauty blender original pas cher', 'brosse nettoyante visage promo', 'miroir led maquillage', 'trousse toilette femme luxe'],
    tips: [
      'Les Kits de Pinceaux sont une évidence mathématique : Un kit Zoeva de 8 pinceaux coûte le prix de 2 pinceaux achetés à l\'unité. N\'achetez jamais à l\'unité.',
      'Lavez vos éponges, ne les jetez pas : Avec un savon solide basique, un Beauty Blender peut durer 3 mois. En promo par lot de 2, c\'est encore mieux.',
      'Les gadgets Tech (Foreo, NuFace) sont des investissements lourds. Attendez impérativement le Black Friday, c\'est la seule période où ils sont soldés à -30% ou -40%.',
    ],
    richContent: {
      intro: 'Les bons outils font toute la différence. Un pinceau de qualité, une éponge HD, un miroir grossissant bien éclairé : ces accessoires transforment l\'application de vos produits. City Baddies surveille les promotions sur les marques pro : Zoeva, Real Techniques, Beauty Blender, Sigma, ainsi que les gadgets tech comme Foreo et NuFace.',
      sections: [
        { title: 'Pinceaux : les indispensables de votre trousse', content: 'Les 5 pinceaux essentiels : 1) Pinceau poudre (kabuki ou large) pour le teint. 2) Pinceau estompeur (blending) pour les yeux. 3) Pinceau plat shader pour appliquer les fards. 4) Pinceau biseauté pour les sourcils. 5) Pinceau lèvres pour la précision. Un kit Zoeva ou Real Techniques couvre tous ces besoins pour 30-50€.' },
        { title: 'Beauty Blender et éponges : mode d\'emploi', content: 'L\'éponge humide est la clé d\'un teint "seconde peau". Mouillez-la abondamment, essorez-la, puis tapotez (ne frottez jamais). L\'éponge originale Beauty Blender reste la référence, mais Real Techniques et EcoTools proposent d\'excellentes alternatives à moitié prix. Remplacez toutes les 3 mois pour l\'hygiène.' },
        { title: 'Gadgets beauté : Foreo, NuFace, et autres', content: 'Le Foreo Luna nettoie en profondeur grâce aux pulsations soniques (100-200€). Le NuFace tonifie les muscles du visage via micro-courants (300-400€). Ces investissements ne s\'achètent qu\'en promo (Black Friday, soldes). Attention aux contrefaçons : achetez sur les sites officiels ou Sephora.' }
      ],
      faq: [
        { question: 'À quelle fréquence laver ses pinceaux ?', answer: 'Les pinceaux yeux : toutes les semaines (risque d\'infection). Les pinceaux teint : tous les 15 jours. Utilisez un nettoyant doux (savon de Marseille, nettoyant spécial pinceaux) et laissez sécher tête en bas pour préserver les poils.' },
        { question: 'Pinceaux naturels ou synthétiques ?', answer: 'Les poils naturels (chèvre, écureuil) sont doux et idéaux pour les poudres. Les poils synthétiques sont parfaits pour les produits crémeux et liquides (fond de teint, concealer). Aujourd\'hui, les synthétiques de qualité (Zoeva, Sigma) rivalisent avec les naturels.' },
        { question: 'Le Foreo vaut-il son prix ?', answer: 'Oui, si vous l\'utilisez quotidiennement. Le nettoyage sonique est plus efficace et plus doux que le nettoyage manuel. La batterie dure des mois. En promo à -30% (Black Friday), c\'est un investissement rentable pour les peaux à problèmes ou celles qui se maquillent quotidiennement.' }
      ]
    }
  },
};

// Génération des métadonnées dynamiques
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const category = await prisma.category.findUnique({
    where: { slug },
  });

  if (!category) {
    return {
      title: 'Catégorie non trouvée',
    };
  }

  const content = CATEGORY_CONTENT[slug] || {
    seoDescription: `Découvrez les meilleurs deals ${category.name} avec des réductions jusqu'à -70%.`,
    keywords: [`${category.name} pas cher`, `${category.name} promo`],
  };

  return {
    title: `Deals ${category.name} | Promotions jusqu'à -70%`,
    description: content.seoDescription,
    keywords: content.keywords,
    alternates: {
      canonical: `${BASE_URL}/categories/${slug}`,
    },
    openGraph: {
      title: `Deals ${category.name} | City Baddies`,
      description: content.seoDescription,
      url: `${BASE_URL}/categories/${slug}`,
      type: 'website',
    },
  };
}

// Récupérer les deals de la catégorie
async function getCategoryDeals(slug: string) {
  const category = await prisma.category.findUnique({
    where: { slug },
  });

  if (!category) return null;

  // Récupérer les deals de cette catégorie
  const rawDeals = await (prisma.deal as any).findMany({
    where: {
      status: 'ACTIVE',
      product: {
        categoryId: category.id,
      },
    },
    include: {
      merchant: true,
      product: {
        include: {
          brandRef: true,
          category: true,
        },
      },
    },
    orderBy: {
      score: 'desc',
    },
  });

  // Transformer les données pour correspondre au type Deal
  const deals: Deal[] = rawDeals.map((d: any) => ({
    id: d.id,
    product: {
      id: d.product.id,
      name: d.product.name,
      slug: d.product.slug,
      brand: d.product.brandRef?.name || d.product.brand,
      category: d.product.category,
      currentPrice: d.dealPrice,
    },
    merchant: d.merchant,
    imageUrl: d.imageUrl,
    productUrl: d.productUrl,
    title: d.title || d.product.name,
    refinedTitle: d.refinedTitle,
    dealPrice: d.dealPrice,
    originalPrice: d.originalPrice,
    discountPercent: d.discountPercent,
    discountAmount: d.originalPrice - d.dealPrice,
    volume: d.volume,
    volumeValue: d.volumeValue,
    volumeUnit: d.volumeUnit,
    pricePerUnit: d.pricePerUnit,
    score: d.score,
    tags: d.tags,
    promoCode: d.promoCode,
    startDate: d.startDate?.toISOString() || new Date().toISOString(),
    endDate: d.endDate?.toISOString(),
    isHot: d.isHot || false,
    status: d.status,
    votes: d.votes || 0,
    views: d.views || 0,
    createdAt: d.createdAt?.toISOString() || new Date().toISOString(),
  }));

  return { category, deals };
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getCategoryDeals(slug);

  if (!data) {
    notFound();
  }

  const { category, deals } = data;
  const topDeals = deals.slice(0, 6);
  const content = CATEGORY_CONTENT[slug];
  const headerImage = CATEGORY_IMAGES[slug];

  // Compter les deals actifs
  const totalDeals = deals.length;

  return (
    <div className="min-h-screen pb-16">
      
      {/* Hero Section Immersive */}
      <div className="relative mb-20">
        {/* Background Image Header - Ratio adapté aux images 1526x1024 (≈3:2) */}
        <div className="absolute left-0 right-0 top-0 w-full aspect-[3/2] max-h-[85vh] overflow-hidden">
          {/* Gradient Overlay moins agressif pour mieux voir l'image */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-[#0a0a0a] z-10" />
          
          {headerImage ? (
            <img 
              src={headerImage} 
              alt={content?.heroTitle || category.name}
              className="absolute inset-0 w-full h-full object-cover object-[center_25%]"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-neutral-800 to-neutral-900" />
          )}
        </div>

        {/* Hero Content - Positionné en bas de l'image */}
        <div className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col justify-end aspect-[3/2] max-h-[85vh] pb-24">
          <div className="max-w-3xl">
            <div className="flex items-center gap-3 text-[#d4a855] mb-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <span className="w-8 h-[1px] bg-[#d4a855] shadow-[0_0_10px_#d4a855]"></span>
              <span className="text-xs font-bold uppercase tracking-[0.2em] drop-shadow-md bg-black/20 backdrop-blur-sm px-2 py-1 rounded">{category.name}</span>
            </div>
            
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-4 tracking-tight leading-tight animate-in fade-in slide-in-from-bottom-5 duration-700 delay-100 drop-shadow-xl">
              {content?.heroTitle || `Deals ${category.name}`}
            </h1>
            
            <p className="text-lg md:text-xl text-white max-w-2xl font-light leading-relaxed animate-in fade-in slide-in-from-bottom-6 duration-700 delay-200 drop-shadow-lg shadow-black">
              {content?.heroDescription || `Découvrez les meilleures promotions ${category.name} du moment.`}
            </p>

            <div className="mt-5 flex items-center gap-2 text-white/90 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-300 bg-black/30 backdrop-blur-md w-fit px-4 py-2 rounded-full border border-white/10">
               <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.8)]"></span>
               <span className="text-sm font-medium">{totalDeals} offres actives vérifiées</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-12 relative z-30">
        {/* Top Deals Section */}
        {topDeals.length > 0 && (
          <section className="mb-20">
            <div className="flex items-end justify-between mb-8 border-b border-white/5 pb-4">
              <h2 className="text-3xl font-light text-white">
                Top Deals
              </h2>
              <Link 
                href={`/produits?category=${slug}&sortBy=discountPercent`}
                className="text-white hover:text-bordeaux-400 transition-colors flex items-center gap-2 text-sm font-medium uppercase tracking-wider"
              >
                Voir tout
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {topDeals.map((deal) => (
                <DealCard key={deal.id} deal={deal} />
              ))}
            </div>
          </section>
        )}

        {/* Tips Section */}
        {content?.tips && content.tips.length > 0 && (
          <section className="mb-20 bg-[#1a1a1a]/50 p-8 md:p-12">
            <h2 className="text-2xl font-light text-white mb-8 border-l-2 border-bordeaux-500 pl-4">
              Conseils d'expert
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
              {content.tips.map((tip, index) => (
                <div key={index} className="space-y-3">
                  <span className="text-bordeaux-500 font-serif italic text-4xl opacity-50">0{index + 1}</span>
                  <p className="text-slate-300 text-sm leading-relaxed font-light">{tip}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* CTA Section */}
        <section className="text-center py-24 border-t border-white/5">
          <h2 className="text-3xl font-light text-white mb-6">
            Plus de deals {category.name}
          </h2>
          <p className="text-slate-400 mb-10 max-w-2xl mx-auto font-light leading-relaxed">
            Nous comparons quotidiennement les offres de Sephora, Nocibé et Marionnaud pour vous garantir les meilleurs prix sur vos produits {category.name.toLowerCase()} favoris.
          </p>
          <Link
            href={`/produits?category=${slug}&sortBy=discountPercent`}
            className="inline-flex items-center gap-3 px-8 py-3 bg-white text-black text-sm font-bold uppercase tracking-wider hover:bg-slate-200 transition-colors"
          >
            Voir les {totalDeals} offres
            <ArrowRight className="h-4 w-4" />
          </Link>
        </section>

        {/* Rich Content SEO */}
        {content?.richContent && (
          <section className="mt-24 mb-20">
            
            {/* Header Section Guide */}
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 border-b border-white/5 pb-6 gap-6">
              <div>
                <span className="text-[#d4a855] text-sm uppercase tracking-widest font-medium mb-2 block">
                  Guide d'achat
                </span>
                <h2 className="text-3xl md:text-4xl font-serif text-white">
                  Acheter {category.name} moins cher
                </h2>
              </div>
              <p className="text-slate-400 text-sm max-w-md text-right hidden md:block">
                Nos experts analysent le marché quotidiennement pour vous dénicher les meilleures offres.
              </p>
            </div>

            <div className="grid lg:grid-cols-[1.5fr_1fr] gap-16 mb-20">
              {/* Main Content Column */}
              <div className="space-y-12">
                {/* Intro Block */}
                <div className="prose prose-invert max-w-none">
                  <p className="text-xl text-slate-200 leading-relaxed font-light mb-8 border-l-2 border-[#d4a855] pl-6 italic">
                    City Baddies compare chaque jour les prix des produits {category.name.toLowerCase()} chez les principales enseignes beauté françaises. 
                    Notre équipe déniche les meilleures promotions et sélectionne le meilleur rapport qualité-prix.
                  </p>
                  <div className="text-slate-300 leading-relaxed font-light space-y-6">
                    {content.richContent.intro.split('\n\n').map((paragraph, index) => (
                      <p key={index}>{paragraph}</p>
                    ))}
                    <p>
                      Les deals sont mis à jour en temps réel. Inscrivez-vous à notre newsletter pour ne manquer aucune offre exclusive.
                    </p>
                  </div>
                </div>

                {/* Article Image or Highlight could go here */}
              </div>

              {/* Side Column / Additional Info */}
              <div className="space-y-8">
                <div className="bg-[#1a1a1a] p-8 border border-white/5 sticky top-24">
                  <h3 className="text-lg font-medium text-white mb-6 flex items-center gap-3">
                    <Star className="w-5 h-5 text-[#d4a855]" />
                    Points clés
                  </h3>
                  <ul className="space-y-4">
                    {content.richContent.sections.map((section, idx) => (
                       <li key={idx} className="text-slate-400 text-sm pb-4 border-b border-white/5 last:border-0">
                         <strong className="block text-slate-200 mb-1">{section.title}</strong>
                         <span className="line-clamp-2">{section.content}</span>
                       </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* Detailed Sections Grid */}
            <div className="grid md:grid-cols-2 gap-8 mb-24">
              {content.richContent.sections.map((section, index) => (
                <div key={index} className="bg-gradient-to-br from-[#111] to-black border border-white/10 p-8 hover:border-[#d4a855]/30 transition-colors group">
                  <h3 className="text-xl font-serif text-[#d4a855] mb-4 group-hover:text-[#e5bf75] transition-colors">
                    {section.title}
                  </h3>
                  <div className="w-12 h-[1px] bg-white/10 mb-6 group-hover:w-24 group-hover:bg-[#d4a855]/50 transition-all duration-500"></div>
                  <p className="text-slate-400 leading-relaxed font-light text-sm md:text-base">
                    {section.content}
                  </p>
                </div>
              ))}
            </div>

            {/* FAQ */}
            <div className="mt-16">
              <div className="text-center mb-12">
                <h2 className="text-2xl md:text-3xl font-light text-white mb-2 tracking-tight">
                  QUESTIONS <span className="font-semibold text-[#d4a855]">FRÉQUENTES</span>
                </h2>
                <p className="text-neutral-500 text-sm tracking-widest uppercase">Tout savoir sur {category.name}</p>
              </div>

              <div className="space-y-4 max-w-3xl mx-auto">
                {content.richContent.faq.map((item, index) => (
                  <div key={index} className="group border border-white/10 bg-white/5 rounded-none overflow-hidden transition-all hover:bg-white/10">
                    <details className="group [&_summary::-webkit-details-marker]:hidden">
                      <summary className="flex items-center justify-between p-6 cursor-pointer text-white">
                        <span className="text-lg font-light tracking-wide">{item.question}</span>
                        <span className="text-[#d4a855] text-2xl font-light transition-transform duration-300 group-open:rotate-45">+</span>
                      </summary>
                      <div className="px-6 pb-6 text-neutral-400 font-light leading-relaxed border-t border-white/5 pt-4">
                        {item.answer}
                      </div>
                    </details>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Removed old hardcoded SEO Text section since it is now integrated above */}

      </div>
    </div>
  );
}
