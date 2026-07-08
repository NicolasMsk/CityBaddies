# Scraping V2 — Design (minimal)

**Date** : 8 juillet 2026
**Statut** : Validé
**Objectif** : Un scraper le plus simple possible qui scrape proprement Sephora, Marionnaud et Nocibé chaque matin et stocke les données correctement dans la base Supabase.

---

## Contexte

- L'infrastructure de scraping V1 (3 scrapers + `ImportEngine` + ~20 jobs GCP Cloud Run avec pipeline import → validation → enrichissement GPT) a été entièrement supprimée le 20 février 2026 lors du "V2 reset" (commit `7f7367c`).
- L'ancien code est récupérable au commit `d164158` ("Save all work before V2 reset").
- La base a été resetée en gardant catégories, marchands, marques.
- Les utilitaires clés ont survécu : `src/lib/brands/` (`findOrCreateBrand` + normalisation alias) et `src/lib/utils/volume.ts` (`findOrCreateVariant`, `calculatePricePerUnit`).
- L'ancien `ImportEngine` est **incompatible avec le schéma actuel** : il écrivait `merchantId`/`productUrl` sur `Product`, champs qui n'existent plus. Aujourd'hui un `Product` est partagé entre enseignes ; c'est le `Deal` qui porte le marchand (contrainte unique `[variantId, merchantId]`).
- Il n'existe **aucun système externe** (n8n / Product_Scraper) à prendre en compte — la table `ScrapingQueue` du schéma est un vestige à ignorer.

## Décisions de cadrage (validées)

| Question | Décision |
|---|---|
| Périmètre | **Minimal** : scrape → deals `ACTIVE` directement. Pas de validation, pas d'enrichissement GPT, pas de catégorisation IA. Expiration intégrée au job avec garde-fou. |
| Exécution quotidienne | **GitHub Actions** (cron ~04h30 UTC), zéro infra. |
| Base de code | **Récupérer les scrapers V1** depuis git (`d164158`), les simplifier, les tester en live. |
| Système V2 externe | Aucun — le nouveau scraper est la seule source d'alimentation. |

## Architecture

```
GitHub Actions (cron 04h30 UTC ≈ 5h30-6h30 Paris + workflow_dispatch)
   │  matrix: sephora / nocibe / marionnaud (3 jobs indépendants)
   ▼
scripts/scrape.ts <merchant>            ← point d'entrée unique CLI
   │
   ├── src/lib/scraping/sephora.ts      Playwright + Stealth (récupéré V1)
   ├── src/lib/scraping/nocibe.ts       Cheerio + fetch (récupéré V1)
   ├── src/lib/scraping/marionnaud.ts   Cheerio + rotation UA (récupéré V1)
   │        ▼  ScrapedProduct[]
   └── src/lib/scraping/import.ts       NOUVEAU moteur simple (~150 lignes)
            ▼
   Supabase : Brand → Product → ProductVariant → Deal (ACTIVE) + PriceHistory
```

**Supprimé par rapport à la V1** : Docker, GCP, jobs de validation, enrichissement GPT, catégorisation IA, table `ScrapingSource` (les URLs vivent dans `data/scrape-sources.json`, versionné, ~6-8 pages catégorie principales par enseigne).

## Composants

### `src/lib/scraping/types.ts`
Version allégée du contrat V1 : `ScrapedProduct`, interface `Scraper` (init / scrape / close), `ScraperConfig`.

### Scrapers (`sephora.ts`, `nocibe.ts`, `marionnaud.ts`)
Récupérés du commit `d164158`, nettoyés (suppression trending/search/enrichissement HD), testés en live un par un — les sélecteurs ont pu changer depuis février. Sephora garde Playwright + Stealth ; Nocibé et Marionnaud restent en Cheerio.

### `src/lib/scraping/import.ts` (nouveau)
Pour chaque produit scrapé :
1. **Filtre** : réduction ≥ 15 %, prix > 1 €, volume présent, `originalPrice > currentPrice`
2. **Brand** : `findOrCreateBrand()` (existant)
3. **Product** : match par slug normalisé `marque-nom` ; création si absent (catégorie = celle de la source, mapping mot-clé en fallback)
4. **Variant** : `findOrCreateVariant()` (existant)
5. **Deal** : `upsert` sur `[variantId, merchantId]` → `status: ACTIVE`, `lastSeenAt: now`, prix/URLs/image
6. **PriceHistory** : ajout seulement si le prix a changé
7. **Expiration** : en fin de run, les deals de l'enseigne avec `lastSeenAt < début du run` passent `EXPIRED` — **seulement si** le run a ramené ≥ 50 produits (garde-fou anti-blocage)

Écritures par batch de 3 en parallèle (limite pool Supabase).

### `scripts/scrape.ts`
CLI : `npx tsx scripts/scrape.ts <sephora|nocibe|marionnaud>` avec option `--limit N` pour les tests. Exit code 1 si 0 produit importé.

### `.github/workflows/scrape.yml`
- Cron quotidien + `workflow_dispatch`
- Matrix 3 enseignes, `fail-fast: false`
- Secrets : `DATABASE_URL`, `DIRECT_URL`
- `npx playwright install chromium --with-deps` pour le job Sephora uniquement
- Job rouge sur GitHub = alerte gratuite en cas d'échec

## Gestion des erreurs

- Try/catch par page source et par produit : une page ou un produit en erreur ne fait pas échouer le run.
- Le garde-fou d'expiration protège la base si une enseigne bloque le scraper.
- 0 produit importé → exit 1 → job GitHub rouge.

## Risque identifié

Les IP GitHub Actions sont des IP datacenter — Sephora (anti-bot fort) pourrait les bloquer alors que le scraping marche en local. À vérifier au premier `workflow_dispatch`. **Plan B** : GitHub Actions pour Nocibé/Marionnaud + un unique job Cloud Run pour Sephora (ou proxy résidentiel).

## Plan de test

1. Chaque scraper en local avec `--limit 20` → vérifier les données extraites (nom, marque, prix, volume, image, URL).
2. Import complet en local sur une enseigne → vérifier en base : Brand/Product/Variant/Deal/PriceHistory cohérents, pas de doublons, upsert idempotent (relancer 2× = pas de doublons).
3. Vérifier l'expiration : deal absent du scrape suivant → `EXPIRED` ; garde-fou : run tronqué → pas d'expiration massive.
4. `workflow_dispatch` sur GitHub Actions → vérifier les 3 jobs, en particulier Sephora (anti-bot).
5. Vérifier le lendemain que le cron a tourné et que le site affiche les deals frais.

## Prérequis

- `DATABASE_URL` et `DIRECT_URL` Supabase (pas de `.env` dans le projet actuellement) — nécessaires en local et en secrets GitHub.
