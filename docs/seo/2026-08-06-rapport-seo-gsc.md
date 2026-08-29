# Rapport SEO CityBaddies — 6 août 2026

**Source** : Google Search Console API, propriété `sc-domain:citybaddies.com` (accès *siteOwner*).
**Fenêtres** : P1 = 7 juil → 3 août 2026 (28 j) · P0 = 9 juin → 6 juil 2026 (28 j).
**GA4** : propriété `521392484` (« City Baddies »), API Data — voir section 8.

---

## 1. Vue d'ensemble

| | P0 (9 juin–6 juil) | P1 (7 juil–3 août) | Δ |
|---|---|---|---|
| Clics | 0 | **21** | +21 |
| Impressions | 211 | **2 672** | **×12,7** |
| CTR | 0,00 % | 0,79 % | — |
| Position moyenne | 19,2 | **16,7** | −2,5 |
| Pages générant des impressions | 49 | **104** | ×2,1 |

Tendance hebdomadaire (impressions) : plateau à 40–65/sem de début mai au 6 juillet, puis **326 → 879 → 1 235**. Le 3 août seul fait 180 impressions, soit un rythme maintenu à ~1 260/sem.

L'inflexion est datée et attribuable : la page `/sephora-vs-nocibe-vs-marionnaud` a été crawlée pour la première fois le 16 juillet. Elle pèse **1 302 impressions (49 % du total) et 12 clics (57 %) à la position moyenne 9,0**.

**Lecture** : le site n'a pas « progressé en SEO », il a trouvé **un** angle qui fonctionne. Tout le reste est encore sous le seuil de visibilité.

---

## 2. Ce qui marche

### 2.1 L'intention « comparaison d'enseignes » — le seul actif réel

132 requêtes contenant un nom d'enseigne : **546 impressions, position moyenne 13,6**, dont **89 requêtes déjà en position ≤ 10** (212 impressions, position moyenne **7,2**).

Une seule page absorbe une vingtaine de variantes, toutes en page 1 ou en haut de page 2 :

| Requête | Impr. | Position |
|---|---|---|
| nocibe ou sephora | 22 | 10,2 |
| sephora vs nocibe | 19 | 12,7 |
| marionnaud sephora | 17 | 10,7 |
| nocibé ou sephora | 15 | 8,9 |
| sephora nocibé | 13 | 9,2 |
| sephora marionnaud | 11 | 9,8 |
| qui est le moins cher entre sephora nocibé et marionnaud | 9 | 8,1 |
| sephora ou nocibé | 9 | 7,9 |
| sephora ou nocibe moins cher | 8 | **5,8** |
| nocibe vs sephora | 6 | 7,5 |
| nocibe sephora | 5 | **5,4** |
| pourquoi nocibé est moins cher que sephora | 3 | 8,0 |

C'est une intention commerciale, à faible concurrence éditoriale (les enseignes ne se comparent pas entre elles) et **exactement là où la donnée prix du site constitue un avantage défendable**.

### 2.2 Les pages marque : la meilleure position moyenne du site

24 pages marque → 203 impressions, **position 12,3**, CTR 0,99 %. Deuxième meilleur type de page, avec la moitié moins d'impressions que les fiches produit mais un positionnement deux fois meilleur.

### 2.3 Le mobile

| Appareil | Impr. | Clics | CTR | Position |
|---|---|---|---|---|
| Mobile | 1 207 | 15 | **1,24 %** | **10,4** |
| Desktop | 1 426 | 6 | 0,42 % | 22,3 |
| Tablette | 39 | 0 | — | 7,8 |

Le desktop génère **plus** d'impressions pour une position deux fois pire. Le site est structurellement mieux classé sur mobile — cohérent avec un crawl `crawledAs=MOBILE` et un contenu conçu mobile-first.

### 2.4 Indexation : rien à corriger

106 URL au sitemap, **104 génèrent des impressions**. Les 3 pages inspectées sont toutes `PASS` / « Envoyée et indexée », canoniques propres, `robotsTxtState=ALLOWED`. Le problème du site n'est pas technique, il est de **surface éditoriale**.

---

## 3. Ce qui ne marche pas

### 3.1 Le trafic hors-enseignes : 0 clic sur 521 impressions

| Segment | Requêtes | Impr. | Clics | Position |
|---|---|---|---|---|
| Contient une enseigne | 132 | 546 | 2 | **13,6** |
| Ne contient pas d'enseigne | 176 | 521 | **0** | **36,3** |

Volume d'impressions quasi identique, position 2,7× pire, zéro clic. Le verdict est net : **le site est invisible sur l'intention parfum générique**.

### 3.2 Les guides ciblent des head terms hors de portée

3 guides → 465 impressions, **1 clic**, position moyenne 27,9.

| Requête | Impr. | Position | Page |
|---|---|---|---|
| meilleur parfum femme | 114 | **37,5** | /guides/meilleurs-parfums-femme |
| meilleur parfum pour femme | 18 | 39,6 | idem |
| meilleurs parfums pour femmes | 13 | 41,3 | idem |
| parfum femme best seller | 12 | 37,2 | idem |
| parfum femme les plus vendus | 8 | 47,8 | idem |
| parfum femme longue tenue | 19 | 30,8 | /guides/parfums-qui-tiennent-longtemps |
| parfum femme qui tient longtemps | 12 | 39,5 | idem |

Ce sont les requêtes les plus disputées du secteur (Marie Claire, Sephora, Nocibé, Cosmopolitan). Position 37 à 48 = page 4-5. Il n'y a pas de chemin crédible vers la page 1 sans autorité de domaine. **L'effort éditorial est mal alloué.**

Une exception à conserver : `parfums qui tiennent` (35 impressions, **position 17,0**) et `les meilleurs parfums femme qui tiennent longtemps` (position 6,0). La longue traîne « tenue » est atteignable, le head term non.

### 3.3 Les fiches produit : 496 impressions, 0 clic

49 fiches → 496 impressions (19 % du total), **0 clic**, position moyenne 26,3.

Cause identifiée : l'apparence SERP `PRODUCT_SNIPPETS` totalise 508 impressions à la **position 27,4 pour 0 clic**. L'inspection d'URL sur la home remonte, pour chaque produit du balisage `ProductGroup`, deux avertissements systématiques :

```
Champ "review" manquant          → WARNING
Champ "aggregateRating" manquant → WARNING
```

Sans étoiles, un extrait produit en position 27 ne prend aucun clic. À noter : le schéma Prisma contient déjà les modèles `Vote` et `Comment` — la matière première pour un `aggregateRating` **légitime** existe déjà en base.

### 3.4 La requête de marque est cassée

`citybaddies.com` : 19 impressions, **position 44,1**, 0 clic. Et surtout, cette requête est servie par **22 pages différentes** — sans que la home apparaisse :

| Page servant « citybaddies.com » | Impr. | Position |
|---|---|---|
| /about | 4 | 12,5 |
| /categories | 3 | 18,0 |
| /codes-promo | 3 | 18,3 |
| /guides | 3 | 31,7 |
| /marques | 1 | 92,0 |
| … 17 autres fiches produit | 1 chacune | 22 → 96 |

Idem pour `baddies.com` : servi par `/contact` (position 9,7) et non par la home. `baddies site` → `/legal` (position 14,7).

Google n'a pas construit l'entité « City Baddies » et ne sait pas quelle page représente la marque. C'est le signal de cannibalisation le plus franc du jeu de données. Pour un site de 3 mois c'est normal, mais ça se corrige.

### 3.5 Bruit et URL parasites

- **`nocibe marianne parfum` : 188 impressions (7 % du total), position 18,4, 0 clic** — la page comparateur matche cette requête par accident. Elle plombe mécaniquement le CTR global et fausse la lecture de la position moyenne.
- **13 URL à paramètres indexées** (`/produits?category=parfums&brand=NINA%20RICCI`, `/produits?tier=1`…) → 55 impressions, position 22. Le `robots.txt` bloque `search`, `sortBy`, `minPrice`, `page`, `merchant`… mais **pas** `brand`, `category` ni `tier`.
- `code promo sephora` en position **89** : la page existe mais n'est pas prise au sérieux.

### 3.6 Fraîcheur de crawl

La page qui fait 49 % des impressions a été crawlée pour la dernière fois le **16 juillet** — il y a 3 semaines — alors que les prix sont relevés quotidiennement et que le sitemap déclare `changefreq: daily`. Au moment de ce crawl, GSC ne détectait pas de canonique auto-déclarée sur cette page (`userCanonical` absent). La balise est présente aujourd'hui : elle a été ajoutée après le dernier passage de Google. **Rien n'a été revalidé depuis.**

---

## 4. Où aller chercher des positions

Classé par rapport impact / effort.

### Priorité 1 — Industrialiser le pattern `{marque|produit} + {enseigne}`

C'est le gisement le plus important du rapport. **106 requêtes déjà en position moyenne 15,6, sans aucune page dédiée** :

| Requête | Impr. | Position | Page qui répond aujourd'hui |
|---|---|---|---|
| boucheron sephora | 15 | 13,7 | /marques/boucheron |
| coco mademoiselle nocibé | 7 | 13,7 | /produits/chanel-coco-mademoiselle |
| sephora boucheron | 7 | 11,6 | /marques/boucheron |
| nocibe jimmy choo | 3 | 12,0 | /marques/jimmy-choo |
| prada paradoxe nocibé | 2 | **8,0** | /produits/prada-paradoxe |
| nocibe prada paradoxe | 2 | **8,5** | idem |
| good girl carolina herrera nocibe | 2 | 12,0 | /produits/carolina-herrera-good-girl |
| nocibe boucheron | 2 | 10,0 | /marques/boucheron |
| miss dior nocibé | 2 | 11,0 | /produits/miss-dior |

Le pattern est mécanique, la concurrence est faible, et le site possède la seule donnée qui compte (le prix réel chez ce marchand). Avec 24 marques × 4-5 enseignes, la surface adressable est de **~100 à 120 pages** générables par template, contre 106 URL au total aujourd'hui.

Deux formes possibles : sections marchand ancrées et indexables sur les pages marque/produit existantes, ou routes dédiées `/marques/{marque}/{enseigne}`. La seconde capte l'exact match ; elle exige un contenu réellement différencié par marchand (prix, disponibilité, historique, écart vs concurrents) pour ne pas produire du thin content.

### Priorité 2 — Éclater le comparateur en paires

Une page sert aujourd'hui 20+ variantes en position 5,4 à 13,7. Les paires exactes méritent leur page :

- `sephora vs nocibé` (déjà 19+15+13+9+9+6+5 ≈ 76 impressions sur variantes)
- `nocibé vs marionnaud` (6+4+4+3 ≈ 17)
- `sephora vs marionnaud` (17+11+5+4 ≈ 37)
- `sephora vs my-origines`, `notino vs sephora` (non encore couverts, même intention)

La page pivot reste, en hub, avec maillage vers chaque paire. Gain attendu : passer de position ~9 (bas de page 1 / haut de page 2) à top 5 sur l'exact match.

### Priorité 3 — Récupérer le CTR déjà acquis

**212 impressions en position moyenne 7,2 pour 2 clics.** À un CTR normal de 3-5 % pour cette tranche, c'est 7 à 11 clics au lieu de 2, sans gagner une seule position. Leviers :

- Les titles sont bons (71-87 caractères, bien construits) mais génériques face à une intention « qui est le moins cher ». Y injecter le **chiffre** : écart moyen constaté, nombre de relevés, date de mise à jour.
- Le balisage `Dataset` + `FAQPage` est déjà en place sur le comparateur (`richResults=PASS`). Étendre le `FAQPage` aux questions exactes tapées : « pourquoi nocibé est moins cher que sephora », « qui est le moins cher entre sephora nocibé et marionnaud ».

### Priorité 4 — Débloquer les extraits produit

Alimenter `aggregateRating` depuis les `Vote`/`Comment` existants, en n'exposant le balisage que **là où il y a de vrais votes** (sinon c'est une violation des règles Google et un risque d'action manuelle). 508 impressions d'extraits produit à 0 clic attendent ça.

### Priorité 5 — Les seuils de prix

`parfum moins de 50 euros` (11 impr, position 25,8) et `parfums pas chers guerlain` (8 impr, position 27,3) montrent une intention prix vivante mal servie. Une page existe pour < 50 €. Le pattern se décline : `< 30 €`, `< 20 €`, `< 100 €`, et croisé marque × prix (« parfum guerlain pas cher »). Même moteur de données, coût marginal quasi nul.

### Priorité 6 — Réparer la SERP de marque

- Ancrer l'entité : `Organization` avec `sameAs` vers les profils sociaux (TikTok existe déjà via le studio), `logo`, `foundingDate`.
- Faire de la home la réponse évidente sur « City Baddies » : le H1 actuel (« Ton Parfum. Meilleur Prix. ») ne contient pas le nom de marque.
- Sortir `/legal`, `/contact` et les fiches produit de la course sur la requête de marque via maillage interne (moins de liens montants vers `/contact` depuis le footer global).

### Correctifs techniques rapides

1. Ajouter `brand`, `category`, `tier` aux `Disallow` du `robots.txt`, ou canoniser `/produits?*` vers `/produits`.
2. Vérifier que la canonique auto-déclarée du comparateur est bien vue par Google (demander une réindexation — la page n'a pas été recrawlée depuis 3 semaines).
3. Faire remonter le `lastmod` du sitemap à chaque relevé de prix pour les pages dont les données changent, afin de solliciter un recrawl.

---

## 5. Ce qu'il faut arrêter

- **Écrire des guides sur les head terms parfum.** `meilleur parfum femme` en position 37,5 après plusieurs semaines : ce n'est pas un problème de qualité de contenu, c'est un problème d'autorité. Reporter de 6-12 mois.
- **Produire des fiches produit sans données de notation.** 49 fiches, 0 clic. Chaque nouvelle fiche ajoute des impressions non converties et dilue le CTR moyen.

---

## 6. Limites de cette analyse

- **21 clics sur 28 jours.** Tout ratio calculé sur cette base est fragile. Les conclusions sur les *positions* et les *volumes d'impressions* (2 672) sont solides ; celles sur le CTR sont indicatives.
- **19 des 21 clics sont sur des requêtes anonymisées par GSC** (1 618 impressions masquées sur 2 672). Impossible d'attribuer 90 % des clics à une requête. La longue traîne réelle est probablement composée de noms de produits — ce qui renforce la priorité 1, mais n'en constitue pas la preuve directe.
- **`nocibe marianne parfum` (188 impr.) est un match accidentel** qui gonfle les impressions et écrase le CTR global. Le CTR « propre » du site est meilleur que les 0,79 % affichés.
- **Aucune donnée comportementale exploitable.** GA4 est branché mais l'échantillon (16 utilisateurs, dont toi et un crawler d'audit) et l'absence totale d'événements personnalisés interdisent toute conclusion sur la qualité du trafic. Voir section 8.

---

## 7. Notes d'accès

Les tokens `Downloads/token_ga4.json` et `token_gsc.json` (nov. 2025) étaient **révoqués** (`invalid_grant` — app OAuth en mode *Testing*, refresh token expiré à 7 jours). Réautorisés le 6 août 2026 → `Downloads/token_seo.json`. L'Analytics Admin API étant désactivée dans le projet GCP `582668706428`, l'ID de propriété GA4 n'est pas découvrable par API : il est consigné dans [ACCES-DONNEES.md](ACCES-DONNEES.md).

---

## 8. GA4 — comportement et mesure

Propriété `521392484`, mêmes fenêtres que GSC.

| | P0 | P1 | |
|---|---|---|---|
| Sessions | 2 | **52** | ×26 |
| Utilisateurs | 2 | **16** | ×8 |
| Pages vues | 21 | 188 | ×9 |
| Taux d'engagement | 100 % | 55,8 % | — |
| Durée moy. session | 68 s | 199 s | — |

### 8.1 Le trafic mesuré est trop pollué pour conclure sur le comportement

52 sessions pour **16 utilisateurs sur un mois**, dont 15 `first_visit`. Décomposition par source :

| Source / Medium | Sessions | Engagement | Nature |
|---|---|---|---|
| google / organic | 21 | 66,7 % | mais **2 utilisateurs seulement** |
| (direct) / (none) | 15 | 26,7 % | 9 users, 32 s, 73 % de rebond |
| **online.seranking.com / referral** | **11** | 63,6 % | **ton propre outil d'audit SEO** |
| chatgpt.com / ai-assistant | 5 | 80,0 % | réel, et intéressant |

Trois anomalies qui invalident toute lecture comportementale :

1. **21 sessions organiques pour 2 utilisateurs.** GSC compte 21 clics sur la même période. Si ces clics venaient de 21 personnes, GA4 en verrait une quinzaine. Deux users pour 21 sessions signifie soit de l'auto-trafic, soit une identification utilisateur cassée (bandeau de consentement → `first_visit` répété). Dans les deux cas, la coïncidence 21 clics = 21 sessions est fortuite.
2. **`online.seranking.com` = 21 % de toutes les sessions.** C'est un crawler d'audit, pas un visiteur.
3. **Sessions aberrantes** : `/marques` avec 2 960 s de durée moyenne (49 min), `/sephora-vs-nocibe-vs-marionnaud` à 1 042 s sur 3 sessions, desktop à 276 s et 152 pages vues pour 3 utilisateurs. C'est un onglet laissé ouvert pendant le développement.

Contradiction directe avec GSC, qui confirme la pollution : GSC attribue **15 des 21 clics au mobile** (position 10,4), GA4 attribue **35 des 52 sessions au desktop**. Les sessions desktop longues sont du trafic interne.

Autre bruit à filtrer : Nigeria 7 sessions à 14,3 % d'engagement, et `/produits?tier=1` en landing page — une URL à paramètre qui n'aurait jamais dû être atteignable.

### 8.2 Le funnel de monétisation n'est pas mesuré — du tout

Événements enregistrés sur P1 :

| Événement | Occurrences | Users |
|---|---|---|
| page_view | 188 | 16 |
| user_engagement | 55 | 10 |
| session_start | 52 | 16 |
| scroll | 34 | 4 |
| first_visit | 15 | 15 |

**Ce sont les cinq événements automatiques de GA4. Il n'y a aucun événement personnalisé.**

Or le point de sortie est déjà centralisé et parfaitement instrumentable : tous les liens marchands passent par `/api/redirect?url=…` — depuis [DealCard.tsx:415](../../src/components/deals/DealCard.tsx#L415), [ProductPricing.tsx:266](../../src/components/deals/ProductPricing.tsx#L266) et [guides/[slug]/page.tsx:421](../../src/app/guides/[slug]/page.tsx#L421). Et `gtag` n'est appelé que pour `config` dans [GoogleAnalytics.tsx:29](../../src/components/analytics/GoogleAnalytics.tsx#L29).

Conséquence : sur un site dont le modèle économique est le clic sortant affilié, **100 % de la conversion est invisible**. Impossible de dire quelle page, quelle marque ou quelle enseigne génère de la valeur. Toute priorisation SEO au-delà de ce rapport se fait à l'aveugle.

Le chokepoint existant rend le correctif trivial : émettre un événement `select_merchant` (paramètres : produit, marque, enseigne, prix, page d'origine) au clic, ou l'envoyer côté serveur depuis la route `/api/redirect` via le Measurement Protocol — cette seconde option résiste aux bloqueurs de publicité et au refus de cookies.

### 8.3 Le seul enseignement solide de GA4 : ChatGPT est déjà un canal

`chatgpt.com` en `ai-assistant` : 5 sessions à **80 % d'engagement** sur P1, et le canal était déjà présent sur P0 (1 session, 20 pages vues, 110 s). C'est le meilleur taux d'engagement de tous les canaux, sur le plus petit volume.

Le travail GEO déjà commité (`llms.txt`, JSON-LD natif, `/methodologie`, réponse directe citable) produit un effet mesurable. Sur un site de 106 pages sans autorité, être cité par un assistant est un chemin d'acquisition plus court que la page 1 de Google — et le corpus « prix réels relevés » est exactement ce qu'un assistant cherche à citer. À traiter comme un canal à part entière, pas comme un effet de bord.

### 8.4 Actions de mesure, avant tout le reste

1. **Tracker les clics sortants** (`select_merchant`), idéalement en Measurement Protocol depuis `/api/redirect`.
2. **Exclure `online.seranking.com`** des données (liste d'exclusion de référents) et **filtrer le trafic interne** par IP. Sans ça, 21 % à 40 % de chaque futur rapport est du bruit auto-généré.
3. **Vérifier le bandeau de consentement** : 21 sessions pour 2 utilisateurs et 15 `first_visit` sur 16 utilisateurs pointent une identification cassée. Implémenter Consent Mode v2 correctement plutôt que de ne rien envoyer en cas de refus.
4. **Marquer un repère** : ces chiffres ne sont pas une baseline exploitable. La vraie baseline commence après les points 1-3.

### 8.5 Le comparateur n'a aucun chemin de monétisation direct

Constaté en inspectant le HTML servi en production : `/sephora-vs-nocibe-vs-marionnaud` contient **zéro lien marchand**. Elle mentionne les domaines des enseignes 24 fois (texte et JSON-LD `Dataset`), et propose 11 liens internes vers des fiches produit et des pages marque.

C'est la page qui fait **49 % des impressions et 57 % des clics** du site. Le visiteur doit donc cliquer deux fois pour atteindre un marchand : comparateur → fiche produit → marchand.

Ce n'est pas nécessairement un défaut — router vers la fiche produit avant l'achat est défendable, et c'est là que se trouve le comparateur de prix par marchand. Mais deux conséquences :

1. **Sur la mesure** : les clics sortants s'attribueront toujours à `/produits/…`, jamais au comparateur. Sa contribution reste lisible via le rapport des *landing pages* (la session a atterri sur lui), pas via le `page_location` de l'événement. À ne pas oublier en lisant les premiers chiffres de conversion.
2. **Sur le revenu** : un clic de friction supplémentaire sur la page la plus fréquentée du site.

Décision à prendre après deux semaines de données de conversion, pas avant.

### 8.6 Ce que GA4 ne permet PAS de dire

Avec 16 utilisateurs dont toi et un crawler d'audit, aucune conclusion sur le taux de rebond, la durée de session, la qualité par landing page ou la conversion n'est défendable. Les 10 sessions organiques arrivant sur `/` contredisent d'ailleurs GSC, qui donne **0 clic** sur la home. Cette section documente l'état de l'instrumentation, pas le comportement des visiteurs.
