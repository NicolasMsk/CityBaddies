# 🛒 Documentation des Scrapers (V2 — minimal)

> **Dernière mise à jour** : 9 juillet 2026

Pipeline de scraping quotidien des promotions beauté sur **Nocibé**, **Marionnaud** et **Sephora**, réécrit en version minimale (juillet 2026) après la suppression de la V1.

---

## Vue d'ensemble

Chaque matin, un job par enseigne :
1. **scrape** les pages catégories (uniquement les produits en promotion nous intéressent),
2. **normalise + filtre** les produits (réduction ≥ 15 %, prix > 1 €, volume parsable, réduction < 90 %),
3. **upsert** en base : `Brand` → `Product` (partagé entre enseignes) → `ProductVariant` → `Deal` (statut `ACTIVE`) → `PriceHistory` (uniquement si le prix a changé),
4. **expire** les deals de l'enseigne qui n'ont pas été revus (avec garde-fous anti-blocage).

Un seul point d'entrée pour les 3 enseignes : `src/scripts/scrape.ts`.

### Différences avec la V1 (supprimée)

La V1 (pipeline import → validation → enrichissement GPT + ~20 jobs GCP Cloud Run, `ImportEngine`, table `ScrapingSource`) a été supprimée au « V2 reset » (commit `7f7367c`, récupérable à `d164158`). La V2 supprime : Docker/GCP, validation, enrichissement GPT, catégorisation IA, table `ScrapingSource`. Tout est en **fetch + Cheerio** (plus aucun navigateur / Playwright).

---

## Architecture

```
GitHub Actions (cron 04:30 UTC)  ou  exécution locale/résidentielle
        │  matrix: nocibe / marionnaud / sephora
        ▼
src/scripts/scrape.ts <merchant> [--limit N] [--dry-run]
        │
        ├── src/lib/scraping/nocibe.ts        fetch + cheerio (UA mobile)
        ├── src/lib/scraping/marionnaud.ts    fetch + cheerio
        ├── src/lib/scraping/sephora.ts       fetch + cheerio (UA mobile + anti-Akamai)
        │        ▼  ScrapedProduct[]
        ├── src/lib/scraping/validate.ts      normalizePrices + isValidDeal + productSlug (pur, testé)
        └── src/lib/scraping/import.ts        upsert Brand/Product/Variant/Deal/PriceHistory + expiration
        ▼
   Supabase (Prisma) : Brand · Product · ProductVariant · Deal(ACTIVE) · PriceHistory
```

### Fichiers

| Fichier | Rôle |
|---|---|
| `data/scrape-sources.json` | URLs des pages catégorie par enseigne (versionné) |
| `src/lib/scraping/types.ts` | Interfaces `Scraper` et `ScrapedProduct` |
| `src/lib/scraping/{nocibe,marionnaud,sephora}.ts` | Scrapers (un par enseigne) |
| `src/lib/scraping/validate.ts` | Filtrage/normalisation pur (tests : `validate.test.ts`) |
| `src/lib/scraping/import.ts` | Moteur d'import + expiration |
| `src/scripts/scrape.ts` | CLI unique |
| `scripts/netcheck.mjs` | Diagnostic d'accès réseau aux 3 sites |

---

## ⚠️ Anti-bot : Akamai et le User-Agent mobile

**Nocibé et Sephora sont derrière Akamai.** Point crucial découvert en juillet 2026 :

- Un **User-Agent desktop** (même un vrai Chrome non-headless) reçoit un **403 « Access Denied »** immédiat.
- Un **User-Agent mobile** (iOS Safari / Android Chrome) passe en **HTTP 200** avec la page complète — les données produit sont dans le HTML statique (Sephora : attribut `data-tcproduct` JSON ; Nocibé : tuiles `.product-tile`).

Les scrapers Nocibé et Sephora utilisent donc un **UA mobile**. ⚠️ **Ne pas repasser en UA desktop** sans revérifier l'accès.

**Sephora fait en plus du rate-limiting / réputation IP** : une rafale de requêtes depuis une même IP finit flaggée (403) même en UA mobile. Le scraper Sephora est donc « poli » : cookies de session persistants, pool d'UA mobiles, espacement minimum de 8 s entre requêtes, et backoff sur 403/429. Les IP datacenter (GitHub Actions) sont plus susceptibles d'être bloquées qu'une IP résidentielle — voir *Déploiement*.

Marionnaud n'est pas sous Akamai (fetch direct classique).

---

## Filtrage d'un deal (`validate.ts`)

Un produit scrapé devient un deal importable seulement si :
- marque, nom et URL présents ;
- volume présent et parsable (ex. `50ml`, `100 g`) ;
- prix courant > 1 € ;
- prix barré > prix courant ;
- réduction ≥ **15 %** et < **90 %** (au-delà = donnée aberrante).

`normalizePrices` corrige au préalable les incohérences fréquentes (prix barré manquant recalculé depuis le %, ou % recalculé depuis les prix).

---

## Expiration des deals (`import.ts`)

En fin de run, les deals `ACTIVE` de l'enseigne non revus (`lastSeenAt < début du run`) passent `EXPIRED`, protégés par deux garde-fous **plus** une échappatoire :

1. **Plancher** : n'expire rien si moins de **10** deals importés (run probablement raté / site bloqué).
2. **Ratio** : n'expire que si le run couvre ≥ **50 %** des deals `ACTIVE` existants du marchand (protège d'un blocage partiel).
3. **Échappatoire** : quels que soient les garde-fous, tout deal non revu depuis **7 jours** est expiré (borne le blocage des garde-fous après une baisse légitime du catalogue, ex. fin de soldes).

---

## Enrichissement (2ᵉ passe quotidienne)

Le scrape de listing ne fournit qu'une image et les prix. Une seconde passe
(`src/scripts/enrich.ts`, step « Enrich » du workflow) visite les fiches produit
des deals `ACTIVE` pas encore enrichis (whyGoodDeal manquant ou produit sans
images), avec le même throttling anti-Akamai, et remplit :

| Donnée | Source | Champ |
|---|---|---|
| Images multiples (max 5, HD) | fiche produit | `ProductImage[]` |
| Description brute | fiche produit | alimente l'IA |
| Ingrédients INCI | fiche produit | `Product.ingredients` |
| Conditions de prix / code promo | fiche produit | `Deal.priceConditions` / `Deal.promoCode` |
| Description SEO (ton City Baddies) | IA gpt-4o-mini | `Product.seoDescription` |
| « Notre analyse » | IA gpt-4o-mini | `Deal.whyGoodDeal` |

À l'import (scrape), en plus : `Deal.score` + `Deal.tags` calculés **localement**
(`src/lib/utils/scoring.ts`, sans IA) pour chaque deal, et les **nouveaux**
produits passent par `categorizeProductsBatch` (IA) → sous-catégories,
`brandTier`, `refinedTitle`. Échec OpenAI toléré partout (fallbacks, retry au
run suivant). Coût IA ≈ quelques centimes/jour.

Fichiers : `src/lib/scraping/details.ts` (extracteurs fiches), `src/lib/ai/enrich-content.ts` (IA), `src/scripts/enrich.ts` (CLI).

```bash
npx tsx src/scripts/enrich.ts marionnaud --limit 5 --dry-run   # sans écrire
npx tsx src/scripts/enrich.ts nocibe --limit 40                # réel
```

---

## Commandes

```bash
# Dry-run : scrape + affiche un échantillon, n'écrit RIEN en base (pas besoin de DB)
npx tsx src/scripts/scrape.ts nocibe --limit 30 --dry-run

# Import réel en base (nécessite DATABASE_URL / DIRECT_URL dans .env)
npx tsx src/scripts/scrape.ts marionnaud
npx tsx src/scripts/scrape.ts nocibe
npx tsx src/scripts/scrape.ts sephora

# Tests unitaires (validate.ts)
npx vitest run

# Diagnostic d'accès réseau (à lancer depuis différentes IP)
node scripts/netcheck.mjs
```

Exit code : `0` si au moins 1 deal importé, `1` sinon (→ job GitHub rouge = alerte).

---

## ☁️ Déploiement

**Par défaut : GitHub Actions** (`.github/workflows/scrape.yml`) — cron quotidien 04:30 UTC + `workflow_dispatch`, matrice sur les 3 enseignes, `fail-fast: false`. Secrets requis : `DATABASE_URL`, `DIRECT_URL`. Aucun navigateur à installer (tout est fetch + cheerio).

**Risque Sephora/Nocibé sur GitHub Actions** : les IP datacenter de GHA peuvent être bloquées par Akamai même en UA mobile. Si un job ressort systématiquement à 0 produit importé (rouge), exécuter ce marchand depuis une **IP résidentielle** :
- une machine perso / VPS résidentiel avec un cron `npx tsx src/scripts/scrape.ts <merchant>` ;
- ou via un proxy résidentiel.

Le CLI est identique partout — seuls `DATABASE_URL`/`DIRECT_URL` (fichier `.env`) sont nécessaires.

---

*Documentation V2 — 9 juillet 2026*
