# City Baddies → Comparateur de prix — Design

**Date** : 9 juillet 2026
**Pivot** : City Baddies n'est PAS un site de bons plans mais un **comparateur de prix beauté**. Les « promos » des marchands ne sont pas de vraies promos ; la valeur = comparer le **vrai prix** d'un produit entre Sephora / Nocibé / Marionnaud, par contenance, avec historique.

## Ce qui change vs le modèle « deals » actuel
- On ne filtre plus sur « réduction ≥ 15 % » : on capte **tous les produits listés et tous les prix** (promo ou non).
- L'unité de valeur devient : **produit canonique → offres par (marchand, contenance) → prix + historique**.
- Le « deal » (réduction) devient un simple attribut d'une offre, plus le critère central.

## Faisabilité vérifiée en direct (à ne pas reperdre)
- **Anti-bot** : Nocibé & Sephora bloquent les UA desktop (Akamai 403) ; UA **mobile** passe. Sephora rate-limite par IP ; Playwright (navigateur réel) franchit le blocage. Marionnaud = fetch direct.
- **EAN (clé de matching cross-marchand)** :
  - **Marionnaud** : EAN + prix + contenance **sur le listing** (JSON `"ean":"3614274656978"`). Cheap.
  - **Nocibé** : prix sur le listing, **EAN sur la fiche produit uniquement** → 1 visite/produit.
  - **Sephora** : **aucun EAN récupérable** (HTML, ld+json, data layers vides ; API produit 403). Matching par EAN impossible.
- Atout repo : `data/openbeautyfacts-cache.json` (Open Beauty Facts, base publique EAN↔produit) — utilisable pour fiabiliser.

## Architecture cible

### Identité produit
- **Produit canonique = EAN** (une variante/contenance = un EAN).
- Nocibé ↔ Marionnaud : matchés **par EAN exact** (fiable, zéro erreur).
- **Sephora** : rattaché en best-effort (marque + nom normalisé + contenance) **avec seuil de confiance**. En dessous du seuil → l'offre Sephora est affichée **seule** (prix visible) mais **jamais présentée comme « même produit »**. Règle d'or : « pas comparé » vaut mieux que « mal comparé ».

### Modèle de données (Prisma)
- `Product` (canonique) : identité produit, indépendante du marchand.
- `ProductVariant` : contenance + **`ean`** (déjà dans le schéma). L'EAN est la clé d'unicité cross-marchand quand disponible.
- **`Offer`** (nouveau, ou `Deal` repensé) : `(variantId, merchantId)` → `price`, `wasPrice?`, `discountPercent` (0 si pas de promo), `productUrl`, `inStock`, `lastSeenAt`. Contrainte unique `[variantId, merchantId]`.
- `PriceHistory` : déjà par (variant, prix, date) — on ajoute `merchantId` pour un historique par marchand.
- Les surfaces « liste » du front filtrent sur `discountPercent > 0` (garde-fou déjà posé sur homepage + catégories) OU basculent vers une logique « meilleurs écarts de prix » ; la **fiche produit** montre toutes les offres/contenances.

### Pipeline de scraping (par marchand)
- **Marionnaud** : listing → produits + EAN + prix + contenance. 1 fetch/catégorie.
- **Nocibé** : listing → produits + prix + contenance ; puis fiche produit → EAN (fetch mobile ou Playwright si SPA). 
- **Sephora** : listing (data-tcproduct) → produits + prix + contenance (pas d'EAN) → rattachement best-effort.
- Matching : upsert du produit canonique par EAN ; création/màj des offres par marchand.

## Découpage en phases
- **Phase 1 — Fondation matchable (Nocibé + Marionnaud par EAN)** :
  1. Schéma : `Offer` (ou `Deal` sans exigence de réduction) + `ProductVariant.ean` clé de matching + `PriceHistory.merchantId`.
  2. Marionnaud : capter tous les produits + EAN + prix depuis le listing.
  3. Nocibé : capter produits + prix (listing) + EAN (fiche).
  4. Matching par EAN → produit canonique avec offres Nocibé + Marionnaud.
  5. Vérif live : un produit présent chez les 2 affiche 2 prix comparés correctement.
- **Phase 2 — Sephora best-effort** : rattachement marque+nom+contenance avec seuil ; OBF en appui ; offres Sephora affichées (comparées si fiable, sinon seules).
- **Phase 3 — Front comparateur** : fiche produit = tableau des offres par marchand + contenances + prix/unité + historique ; surfaces liste repensées (meilleurs écarts, pas « promos »).
- **Phase 4 — Échelle & cron** : élargir le catalogue (catégories/marques prioritaires d'abord), Playwright dans le job quotidien pour Nocibé (EAN) et Sephora, coût maîtrisé.

## Principes
- Construire **sur une branche**, ne pas casser le site live tant que le comparateur n'est pas validé.
- Jamais de comparaison fausse : sans identité fiable, on n'affiche pas « même produit ».
- Réutiliser l'existant : infra scraping, anti-Akamai (UA mobile + Playwright), enrichissement IA, base.
