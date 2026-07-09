# Enrichissement V2 — remplir tout ce que le site affiche

**Date** : 9 juillet 2026 · **Statut** : validé (option « Complet : fiches produit + IA »)
**Contexte** : le pipeline V2 minimal (scrape → Deal ACTIVE) est live pour Nocibé/Marionnaud (Sephora en validation IP). Inventaire frontend complet réalisé : le site affiche des champs que le scrape de listing ne fournit pas. Objectif : les remplir tous.

## Écarts à combler (inventaire frontend vérifié)

| Champ affiché | Source | Tâche |
|---|---|---|
| `Deal.promoCode` (pilule « Code: ») | Déjà extrait par Nocibé, perdu dans la conversion | A |
| `Deal.score` + `Deal.tags` (jauge + pilules) | **Local, sans IA** : `calculateDealScore`/`getDealTags` (src/lib/utils/scoring.ts) | B |
| `Deal.refinedTitle`, `Deal.brandTier`, `Product.subcategory`/`subsubcategory` | IA existante : `categorizeProductsBatch` (src/lib/ai/categorize.ts, gpt batch 50) | B |
| `ProductImage[]` (carrousels multi-images) | Fiche produit marchand | C |
| `Product.description` (brute) + `Product.ingredients` (INCI) | Fiche produit marchand | C |
| `Deal.priceConditions` | Fiche produit marchand | C |
| `Product.seoDescription` (section Description) + `Deal.whyGoodDeal` (« Notre analyse ») | IA (gpt-4o-mini) à partir des données scrapées | C |
| `Brand.logoUrl` (bandeau marques homepage) | Hors périmètre deal — suivi séparé | — |

## Tâches

### A. Câblage promoCode / priceConditions (petit)
- `types.ts` : ajouter `promoCode?: string` et `priceConditions?: string` à `ScrapedProduct`.
- `nocibe.ts` : `scrape()` transmet `p.promoCode` (déjà extrait des tuiles).
- `import.ts` : `dealData` écrit `promoCode` et `priceConditions` (null si absents).

### B. Catégorisation IA + score/tags dans l'import (moyen)
Dans `import.ts`, pour les produits **nouvellement créés** uniquement (batch ≤ 50) :
- `categorizeProductsBatch()` → `Product.subcategory`, `subsubcategory`, correction `categoryId`, `Deal.refinedTitle`, `Deal.brandTier`.
- Pour **chaque deal upserté** (nouveau ou mis à jour) : `calculateDealScore` + `getDealTags` (local) → `Deal.score`, `Deal.tags`.
- Tolérance panne : échec OpenAI → log warn, produits créés sans sous-catégorie/refinedTitle (le site a des fallbacks) ; le score local est toujours calculé.

### C. Enrichissement fiches produit + IA (`src/scripts/enrich.ts`) (gros)
Nouveau CLI : `npx tsx src/scripts/enrich.ts <merchant> [--limit N] [--dry-run]` (défaut limit 40).
- Sélection : deals ACTIVE du marchand dont le produit manque d'enrichissement (`product.images` vide OU `product.ingredients` null OU `deal.whyGoodDeal` null), plus récents d'abord.
- Par scraper, nouvelle méthode `scrapeProductDetails(productUrl)` → `{ description?, ingredients?, images: string[], priceConditions?, promoCode? }` :
  - UA mobile obligatoire (Akamai) ; Sephora réutilise le throttle 8s/cookies/backoff existant ; Nocibé/Marionnaud délai 1.5-2.5s.
  - Les extracteurs V1 (git `d164158` : `scrapeProductDetails` Nocibé, `scrapeProductPage` Sephora, images HD Marionnaud) servent de base de sélecteurs, à revalider en live sur le HTML mobile.
- Écriture : `ProductImage` upsert (`[productId, url]`, position, merchantId), `Product.description` (brut), `Product.ingredients`, `Deal.priceConditions`, `Deal.promoCode` si trouvés.
- IA (gpt-4o-mini, 1 appel/produit, JSON) à partir du scrapé : `Product.seoDescription` (150-250 mots, ton City Baddies) + `Deal.whyGoodDeal` (2-3 phrases HTML). Échec IA → champs laissés null, pas d'échec du run.
- Idempotent : re-run ne refait pas les produits déjà enrichis.

### D. Workflow + docs (petit)
- `.github/workflows/scrape.yml` : ajout step « Enrich » après le scrape (même job matrix) : `npx tsx src/scripts/enrich.ts ${{ matrix.merchant }} --limit 40` + secret `OPENAI_API_KEY`.
- `documentation/SCRAPERS.md` : section enrichissement.

## Vérification
- A/B : re-run import Nocibé → deals avec promoCode (ceux qui en ont), score>0, tags non null ; nouveaux produits avec subcategory + refinedTitle.
- C : enrich Marionnaud/Nocibé `--limit 5` → en base : ProductImage ≥2 pour les produits enrichis, ingredients non null quand dispo, whyGoodDeal/seoDescription remplis ; page produit locale affiche les sections.
- Idempotence : re-run enrich → 0 nouveau traitement.
- Coût IA estimé : ~50 produits/jour × (~1k tokens in / 400 out) sur gpt-4o-mini ≈ < 0,05 €/jour.
