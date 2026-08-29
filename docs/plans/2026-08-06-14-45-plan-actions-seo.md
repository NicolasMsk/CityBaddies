# Plan d'actions SEO / GEO / édito / dev — CityBaddies

**Date** : 6 août 2026
**Dérivé de** : [rapport GSC + GA4](../seo/2026-08-06-rapport-seo-gsc.md)
**Objectif** : industrialiser le seul angle qui convertit (« quelle enseigne est la moins chère »), arrêter d'alimenter celui qui ne peut pas gagner, et rendre l'ensemble mesurable.

---

## Corrections préalables à mes recommandations initiales

Trois affirmations que j'ai faites en cours d'analyse sont fausses. Vérifié en base ce 6 août :

**1. `aggregateRating` ne peut PAS venir des votes utilisateurs.** J'avais annoncé que les modèles `Vote` et `Comment` fourniraient la matière. Faux à deux titres : la base contient **0 vote et 0 commentaire**, et surtout `Vote` porte sur un `dealId` avec une valeur `+1/-1` — c'est un pouce haut/bas sur une offre, pas une note de produit sur une échelle. Aucune transformation ne rend ça conforme à schema.org.

**Ce qui existe réellement** : `BuyingGuideProduct.rating` (Float sur 5) et `miniReview` (texte), remplis pour **15 produits sur 15**, avec des notes de 4,5 à 4,7 rédigées par la rédaction. C'est de la matière valide pour un `Review` éditorial signé City Baddies — pas pour un `aggregateRating` d'utilisateurs. L'action change de nature : ce n'est plus du câblage, c'est un balisage éditorial (voir action 4.1).

**2. La surface marque × enseigne est plus petite que les 100-120 pages annoncées.** Chiffres réels : 64 marques en base, mais **49 produits seulement ont au moins un deal** (sur 183), et 217 combinaisons marque × enseigne brutes — un total gonflé par des doublons de casse.

**3. Les noms de marque ne sont pas normalisés**, et c'est bloquant pour tout le chantier :

```
DIOR (7 produits, 5 enseignes)   /  dior (5 produits, 1 enseigne)
CHANEL (6, 4 enseignes)
Guerlain (5, 5 enseignes)        /  GUERLAIN (3, 3 enseignes)
lancôme (5, 1)                   /  LANCÔME (4, 3)
kérastase (7, 1)                 /  Kérastase (6, 1)
yves saint laurent (4, 1)
```

Conséquences : la surface est fragmentée artificiellement, les pages `/marques/[slug]` risquent de se dédoubler, et le paramètre `brand` que j'envoie déjà à GA4 crée `CHANEL` et `Chanel` comme deux valeurs distinctes — donc des rapports de conversion éclatés dès maintenant. **La normalisation devient le prérequis n°1, pas un nettoyage cosmétique.**

À noter aussi : `kérastase` et `Clarins` sont des marques de soin capillaire, alors que le site est positionné 100 % parfums. Il y a une dérive de catalogue à arbitrer (action 1.4).

---

## Chantier 0 — Fondations de données (prérequis, bloquant)

### 0.1 Normaliser les noms de marque

**Pourquoi** : sans ça, les actions 2.x génèrent des pages en double et la mesure est fragmentée.
**Quoi** : champ `brand` normalisé à l'écriture (casse canonique par marque, table de correspondance pour les variantes : `YSL` → `Yves Saint Laurent`, `dior`/`DIOR` → `Dior`), migration des 183 produits existants, et normalisation dans le pipeline de scraping pour que ça ne régresse pas.
**Fichiers** : `src/lib/scraping/` (normalisation à l'ingestion), `prisma/migrations/` (script de backfill), `src/app/marques/[slug]/page.tsx` (vérifier la résolution de slug après fusion).
**Effort** : moyen. **Décision** : aucune, c'est une correction de bug.
**Risque** : la fusion de `dior` et `DIOR` change les slugs — prévoir des redirections 301 pour les URL déjà indexées.

### 0.2 Gate anti-thin-content sur la génération de pages

**Pourquoi** : sur 217 combinaisons, beaucoup n'ont qu'un seul produit. Une page « Guerlain chez Notino » avec un parfum est du thin content, et à cette échelle ça peut déclencher une dévaluation de tout le pattern.
**Quoi** : une règle explicite et testée — pas de page générée sous un seuil (proposition : ≥ 2 produits **et** le marchand couvre réellement la marque). Les combinaisons sous le seuil restent servies par la page marque.
**Effort** : petit. **Décision** : le seuil, à valider.

---

## Chantier 1 — SEO technique (rapide, aucun arbitrage)

### 1.1 Fermer les URL à paramètres

**Preuve** : 13 URL à paramètres indexées, 55 impressions, position 22 — dont `/produits?tier=1` qui remonte comme landing page dans GA4.
**Quoi** : ajouter `brand`, `category`, `tier` aux `Disallow`, et poser une canonique `/produits?*` → `/produits`. Le `robots.txt` couvre déjà `sortBy`, `minPrice`, `merchant`, `page`.
**Fichiers** : `src/app/robots.ts:18`, plus la canonique sur `src/app/produits/page.tsx`.
**Effort** : 15 min.

### 1.2 Réparer la SERP de marque

**Preuve** : `citybaddies.com` en position 44,1, servie par 22 pages sans que la home apparaisse. `baddies.com` → `/contact`. `baddies site` → `/legal`.
**Quoi** : enrichir `Organization` (`sameAs` vers TikTok et les réseaux, `logo`, `foundingDate`, `description`), faire apparaître « City Baddies » dans le H1 de la home — il dit aujourd'hui « Ton Parfum. Meilleur Prix. » — et réduire les liens montants globaux vers `/contact` et `/legal`.
**Fichiers** : `src/lib/seo-config.ts`, `src/components/seo/JsonLd.tsx`, `src/app/page.tsx`, le footer.
**Effort** : petit. **Décision** : le H1 touche la ligne éditoriale → à valider (action 3.4).

### 1.3 Fraîcheur de crawl

**Preuve** : la page qui fait 49 % des impressions n'avait pas été recrawlée depuis le 16 juillet, malgré des relevés de prix quotidiens.
**Quoi** : `lastmod` du sitemap aligné sur la date du dernier relevé réel **par page** (aujourd'hui le sitemap met un `lastmod` global à l'heure de génération, ce qui est un signal que Google finit par ignorer).
**Fichiers** : `src/app/sitemap.ts`.
**Effort** : petit.

### 1.4 Arbitrer la dérive de catalogue

**Preuve** : `kérastase` (13 produits toutes casses confondues) et `Clarins` (6) sont du soin capillaire, sur un site positionné 100 % parfums. 134 produits sur 183 n'ont aucun deal et ne sont donc pas indexés.
**Quoi** : décider si ces marques sortent du catalogue ou justifient une catégorie assumée. En l'état elles diluent la cohérence sémantique du domaine.
**Effort** : dépend de la décision. **Décision** : à toi.

---

## Chantier 2 — Le gisement principal : marque × enseigne

**Preuve** : 106 requêtes se positionnent déjà à 15,6 de moyenne **sans page dédiée**. Certaines sont très hautes : `prada paradoxe nocibé` 8,0 · `nocibe prada paradoxe` 8,5 · `nocibe boucheron` 10,0 · `miss dior nocibé` 11,0 · `sephora boucheron` 11,6 · `nocibe jimmy choo` 12,0 · `coco mademoiselle nocibé` 13,7 · `boucheron sephora` 13,7.

Le pattern est mécanique, la concurrence faible, et le site détient la seule donnée qui compte : le prix réel constaté chez ce marchand.

### 2.1 Sections marchand indexables sur les pages marque (étape prudente)

**Quoi** : sur `/marques/[slug]`, une section par enseigne avec ancre, titre, et le contenu qui justifie la requête — prix relevés, écarts, disponibilité, historique. Zéro nouvelle URL, donc zéro risque de thin content.
**Fichiers** : `src/app/marques/[slug]/page.tsx`.
**Effort** : moyen. **Prérequis** : 0.1.

### 2.2 Routes dédiées `/marques/[marque]/[enseigne]` (étape suivante, conditionnelle)

**Quoi** : ne générer que les combinaisons passant le gate 0.2. Sur les données actuelles et après normalisation, les candidats solides sont Dior (5 enseignes), Guerlain (5), Chanel (4), Lancôme (3) — soit une vingtaine de pages, pas cent.
**À décider après** avoir mesuré l'effet de 2.1. C'est l'ordre correct : on valide le pattern là où c'est gratuit avant de créer des URL.

### 2.3 Éclater le comparateur en paires

**Preuve** : une seule page sert 20+ variantes en position 5,4 à 13,7. Les paires exactes n'ont pas leur page : `sephora vs nocibé` (~76 impressions de variantes), `sephora vs marionnaud` (~37), `nocibé vs marionnaud` (~17), et `sephora vs my-origines` / `notino vs sephora` non couverts du tout.
**Quoi** : une page par paire, la page actuelle devenant le hub avec maillage descendant.
**Fichiers** : nouvelle route paramétrée, réutilisant le moteur de `src/app/sephora-vs-nocibe-vs-marionnaud/page.tsx`.
**Effort** : moyen-élevé. C'est le chantier au meilleur rapport impact/risque après 2.1.

---

## Chantier 3 — Édito

### 3.1 Geler les guides sur head terms

**Preuve** : `meilleur parfum femme` position 37,5 (114 impressions, 0 clic), et 4 variantes entre 37 et 48. Mur d'autorité, pas problème de contenu.
**Quoi** : ne plus produire de contenu sur ces requêtes pendant 6-12 mois. **Décision** : à toi.

### 3.2 Garder et étendre la traîne « tenue »

**Preuve** : `parfums qui tiennent` position **17,0** et `les meilleurs parfums femme qui tiennent longtemps` position **6,0** — la seule zone hors-enseignes où le site respire.
**Quoi** : étendre ce guide plutôt qu'en créer d'autres ailleurs.

### 3.3 Décliner les seuils de prix

**Preuve** : `parfum moins de 50 euros` position 25,8, `parfums pas chers guerlain` position 27,3.
**Quoi** : `< 30 €`, `< 20 €`, `< 100 €`, et le croisement marque × prix. Même moteur de données que la page existante, coût marginal quasi nul.
**Fichiers** : généraliser `src/app/parfums-moins-de-50-euros/page.tsx` en route paramétrée.

### 3.4 Titles : injecter le chiffre

**Preuve** : **212 impressions en position 7,2 pour 2 clics.** À un CTR normal de 3-5 %, c'est 7 à 11 clics **sans gagner une seule position**.
**Quoi** : intégrer l'écart moyen constaté et la date du dernier relevé dans les titles du cluster enseignes. Les titles actuels sont bien construits mais génériques face à une intention « qui est le moins cher ».
**Décision** : ça touche ta voix → je propose des variantes avant de pousser.

---

## Chantier 4 — Données structurées

### 4.1 `Review` éditorial sur les 15 produits notés

**Preuve** : 15 produits ont une note rédactionnelle (4,5-4,7) et un `miniReview` rédigé.
**Quoi** : émettre un `Review` schema.org avec `author: Organization` (City Baddies), `reviewRating`, `reviewBody` — **pas** un `aggregateRating`, qui exigerait de vraies notes d'utilisateurs qui n'existent pas.
**Fichiers** : `src/components/seo/JsonLd.tsx`, `src/app/produits/[slug]/page.tsx`.
**Effort** : petit. **Garde-fou** : n'émettre que si `rating != null`, jamais de balisage à vide.
**Attente réaliste** : ça ne débloquera pas les étoiles sur les 49 fiches, seulement sur 15. Les 508 impressions d'extraits produit à 0 clic ne se résoudront pas entièrement par là — c'est une amélioration partielle, pas la solution.

### 4.2 `BreadcrumbList` sur les guides

**Preuve** : les guides émettent `Article`, `FAQPage`, `ItemList` mais pas de `BreadcrumbList`, contrairement au comparateur et aux fiches produit.
**Effort** : 15 min.

---

## Chantier 5 — GEO (le canal le plus sous-estimé)

**Preuve** : `chatgpt.com` en `ai-assistant` → 5 sessions à **80 % d'engagement**, le meilleur de tous les canaux, et déjà présent sur la période précédente (1 session, 20 pages vues).

Sur un site de 106 pages sans autorité de domaine, être cité par un assistant est un chemin d'acquisition plus court que la page 1 de Google. Et le corpus « prix réels relevés, datés, sourcés » est exactement ce qu'un assistant cherche à citer.

### 5.1 Enrichir `llms.txt`

**Existant** : `public/llms.txt`.
**Quoi** : y exposer explicitement la méthodologie de relevé, la fréquence, les enseignes couvertes, et pointer les pages à fort contenu factuel (comparateur, observatoire des prix, seuils de prix).

### 5.2 Rendre les chiffres citables

**Quoi** : sur le comparateur et l'observatoire, des affirmations autoportantes et datées — « au 6 août 2026, sur N relevés, Nocibé est moins cher que Sephora dans X % des cas, écart moyen Y € ». Un assistant cite une phrase qui contient sa propre source et sa propre date.
**Note** : le balisage `Dataset` est déjà en place sur le comparateur, c'est le bon socle.

### 5.3 Suivre le canal

**Quoi** : segment GA4 dédié aux référents assistants (`chatgpt.com`, `perplexity.ai`, `claude.ai`, `gemini.google.com`) pour arrêter de le lire au hasard.

---

## Chantier 6 — Mesure (en cours)

### 6.1 Fait aujourd'hui

Événement `select_merchant` côté serveur depuis `/api/redirect`, vérifié en production ; garde-fou d'hôte contre la pollution de développement ; 3 dimensions + 1 métrique enregistrées ; événement marqué comme clé.

### 6.2 Ouvert — fidélité du prix

Correction `currency: 'EUR'` déployée (`8978cee`). Vérification **non concluante à ce stade** : le clic de contrôle à 100 € est bien parti (HTTP 200) mais GA4 n'a pas traité les événements de l'après-midi dans la fenêtre de 18 minutes surveillée. À revérifier le 7 août : si la valeur remonte à 100, c'est réglé ; si elle remonte à 86,78, la correction n'était pas encore déployée au moment du clic.

### 6.3 À faire — conversions douces

Événements sur l'inscription newsletter (`NewsletterSubscription`) et la création d'alerte prix (`PriceAlert`). Une alerte prix vaut cher : c'est un visiteur qui revient de lui-même.

### 6.4 À faire — attribution du comparateur

La page qui fait 49 % des impressions n'a **aucun lien marchand** : les clics sortants s'attribueront toujours à `/produits/…`. Sa contribution reste lisible via les landing pages, mais il faut le documenter dans les rapports pour ne pas conclure qu'elle ne convertit pas.

---

## Ordre d'exécution défendu

```
0.1 normalisation marques  ──┬─→ 2.1 sections marchand ──→ 2.2 routes dédiées (si 2.1 marche)
0.2 gate thin content    ────┘
1.1 URL à paramètres      (indépendant, immédiat)
1.3 lastmod sitemap       (indépendant, immédiat)
4.1 Review éditorial      (indépendant, immédiat)
4.2 BreadcrumbList        (indépendant, immédiat)
6.2 vérif prix            (indépendant, demain)
                          ↓
2.3 comparateur en paires (après 2.1, gros chantier)
3.3 seuils de prix        (après 2.1)
5.1/5.2 GEO               (indépendant, quand tu veux)
```

**Ce qui attend une décision de ta part** : 1.2/3.4 (H1 et titles → ligne éditoriale), 1.4 (dérive catalogue), 3.1 (gel des guides), 0.2 (seuil anti-thin), et l'arbitrage liens marchands sur le comparateur.

**Ce que je peux lancer sans rien te demander** : 0.1, 0.2, 1.1, 1.3, 4.1, 4.2, 5.1, 5.3, 6.3, 6.4.
