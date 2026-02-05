# 🛒 Documentation des Scrapers

> **Dernière mise à jour** : 4 février 2026

Cette documentation décrit le fonctionnement des 3 scrapers utilisés pour récupérer les promotions beauté.

---

## 📋 Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Nocibé](#-nocibé)
3. [Sephora](#-sephora)
4. [Marionnaud](#-marionnaud)
5. [Comparatif](#-comparatif)
6. [Flux de données](#-flux-de-données)
7. [Jobs GCP associés](#-jobs-gcp-associés)

---

## Vue d'ensemble

Tous les scrapers parcourent les **pages promotions/catégories** de chaque enseigne et récupèrent uniquement les **produits en promotion** (avec un prix barré).

### Architecture

- **Pattern utilisé** : Strategy Pattern
- **Moteur commun** : `ImportEngine.ts`
- **Interface commune** : `Scraper` (définie dans `types.ts`)

### Fichiers sources

| Fichier | Rôle |
|---------|------|
| `src/lib/scraping/nocibe.ts` | Scraper Nocibé |
| `src/lib/scraping/sephora.ts` | Scraper Sephora |
| `src/lib/scraping/marionnaud.ts` | Scraper Marionnaud |
| `src/lib/scraping/ImportEngine.ts` | Moteur d'import unifié |
| `src/lib/scraping/types.ts` | Interfaces communes |
| `data/category-links.json` | URLs des catégories à scraper |

---

## 🟣 Nocibé

### Informations générales

| Propriété | Valeur |
|-----------|--------|
| **Fichier** | `nocibe.ts` |
| **Technologie** | Cheerio + fetch (HTML statique) |
| **Raison** | Nocibé rend le HTML côté serveur, pas de JavaScript nécessaire |
| **Volume estimé** | ~5000 produits |

### Catégories scrapées

- Parfums
- Maquillage
- Soins visage
- Soins corps
- Cheveux

### Données récupérées par produit

| Donnée | Type | Description |
|--------|------|-------------|
| `name` | string | Nom du produit |
| `brand` | string | Marque (ex: Dior, Chanel) |
| `currentPrice` | number | Prix soldé |
| `originalPrice` | number | Prix barré |
| `discountPercent` | number | Pourcentage de réduction |
| `productUrl` | string | Lien vers la fiche produit |
| `imageUrl` | string | URL de l'image produit |
| `category` | string | parfums, maquillage, soins-visage, soins-corps, cheveux |
| `size` | string | Volume (50ml, 100ml, etc.) |
| `rating` | number | Note étoiles (ex: 4.5/5) |
| `reviewCount` | number | Nombre de reviews |
| `sku` | string | Identifiant interne Nocibé |

### Configuration

```typescript
{
  headless: true,
  timeout: 15000,        // 15 secondes
  delayBetweenRequests: 500  // 500ms entre chaque requête
}
```

### Particularités

- Scrape **2 pages maximum** par catégorie
- Timeout de **10 secondes** par page
- Dédoublonnage automatique par URL produit
- Mapping automatique des catégories Nocibé → catégories internes

---

## 🟠 Sephora

### Informations générales

| Propriété | Valeur |
|-----------|--------|
| **Fichier** | `sephora.ts` |
| **Technologie** | Playwright + Stealth Plugin |
| **Raison** | Sephora a des protections anti-bot |
| **Volume estimé** | ~1000-2000 produits |

### Catégories scrapées

- Cheveux (C307)
- Corps et bain (C304)
- Maquillage (C302)
- Parfums (C301)
- Skincare (C303)
- Ongles (C305)

### Données récupérées par produit

| Donnée | Type | Description |
|--------|------|-------------|
| `name` | string | Nom du produit |
| `brand` | string | Marque |
| `currentPrice` | number | Prix soldé |
| `originalPrice` | number | Prix barré |
| `discountPercent` | number | Pourcentage de réduction |
| `productUrl` | string | Lien vers la fiche |
| `imageUrl` | string | Image haute qualité (amélioration auto) |
| `category` | string | maquillage, parfums, soins-visage, cheveux, ongles |
| `volume` | string | Taille du produit |
| `sku` | string | Identifiant Sephora |

### Configuration

```typescript
{
  headless: true,
  timeout: 30000,        // 30 secondes
  delayBetweenRequests: 2000  // 2 secondes entre chaque requête
}
```

### Particularités

- Utilise le **plugin Stealth** pour éviter la détection bot
- Clique automatiquement sur "Voir plus de produits" pour charger plus d'offres
- Extrait les données depuis l'attribut `data-tcproduct` (JSON embarqué)
- Amélioration automatique de la qualité des images
- Headers personnalisés pour simuler un navigateur réel

### Anti-bot contourné

```typescript
args: [
  '--disable-blink-features=AutomationControlled',
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-web-security',
  '--disable-features=IsolateOrigins,site-per-process',
]
```

---

## 🔵 Marionnaud

### Informations générales

| Propriété | Valeur |
|-----------|--------|
| **Fichier** | `marionnaud.ts` |
| **Technologie** | Cheerio + fetch (HTML statique) |
| **Raison** | Pages rendues côté serveur |
| **Volume estimé** | ~1500 produits |

### Catégories scrapées

- Parfums
- Maquillage
- Soins
- Corps
- Cheveux

### Données récupérées par produit

| Donnée | Type | Description |
|--------|------|-------------|
| `name` | string | Nom du produit |
| `brand` | string | Marque |
| `productLine` | string | Gamme du produit (ex: "J'adore") |
| `productType` | string | Type (Eau de Parfum, Mascara, etc.) |
| `currentPrice` | number | Prix soldé |
| `originalPrice` | number | Prix barré |
| `discountPercent` | number | Pourcentage de réduction |
| `promoCode` | string? | Code promo si applicable |
| `priceWithCode` | number? | Prix après application du code |
| `productUrl` | string | Lien vers la fiche |
| `imageUrl` | string | Image produit |
| `category` | string | Catégorie mappée |
| `size` | string | Volume |
| `rating` | number | Note étoiles |
| `reviewCount` | number | Nombre de reviews |
| `sku` | string | Identifiant Marionnaud (format BP_XXXXXX) |

### Configuration

```typescript
{
  headless: true,
  timeout: 30000,        // 30 secondes
  delayBetweenRequests: 2000  // 2 secondes entre chaque requête
}
```

### Particularités

- **Rotation de User-Agents** (5 différents) pour éviter la détection
- Headers complets pour simuler un vrai navigateur (Sec-Ch-Ua, Sec-Fetch-*, etc.)
- Peut récupérer les **images HD (2000x2000)** via `enrichProductsWithHDImages()`
- Gestion des codes promo
- Extraction du SKU depuis l'URL produit

### User-Agents utilisés

```typescript
[
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/121.0.0.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/121.0.0.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15',
]
```

---

## 📊 Comparatif

| Critère | Nocibé | Sephora | Marionnaud |
|---------|--------|---------|------------|
| **Technologie** | Cheerio (léger) | Playwright (lourd) | Cheerio (léger) |
| **Volume estimé** | ~5000 produits | ~1000-2000 produits | ~1500 produits |
| **Niveau anti-bot** | Basique | Fort | Modéré |
| **Contournement** | Headers simples | Stealth Plugin | User-Agent rotation |
| **Images HD** | ❌ Non | ✅ Automatique | ✅ Enrichissement séparé |
| **Codes promo** | ❌ Non | ❌ Non | ✅ Oui |
| **Timeout** | 15s | 30s | 30s |
| **Délai entre requêtes** | 500ms | 2s | 2s |
| **Pages par catégorie** | 2 max | Scroll infini | Variable |

---

## 🔄 Flux de données

```
┌─────────────────────────────────────────────────────────────────┐
│                        SCRAPING (5h00)                          │
├─────────────────────────────────────────────────────────────────┤
│  1. Scraper récupère les pages catégories                       │
│  2. Extraction des produits en promotion                        │
│  3. Normalisation vers ScrapedProduct                           │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                     IMPORT ENGINE                                │
├─────────────────────────────────────────────────────────────────┤
│  1. Filtrage (réduction min 15%, prix > 1€)                     │
│  2. Création/MAJ des Brands                                      │
│  3. Création/MAJ des Products                                    │
│  4. Création/MAJ des Deals (isActive: true, isExpired: false)   │
│  5. Traitement par batch de 3 (évite timeout pool connexion)    │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ENRICHISSEMENT (8h-9h)                        │
├─────────────────────────────────────────────────────────────────┤
│  • enrich-nocibe : Catégories + images HD                       │
│  • enrich-sephora : Catégories + images HD                      │
│  • enrich-marionnaud : Catégories + images HD                   │
│  • enrich-competitor-prices : Prix concurrents                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## ☁️ Jobs GCP associés

| Job | Horaire | Description |
|-----|---------|-------------|
| `scrape-nocibe` | 05:00 | Import produits Nocibé |
| `scrape-sephora` | 05:00 | Import produits Sephora |
| `scrape-marionnaud` | 05:00 | Import produits Marionnaud |
| `expire-deals` | 07:00 | Marque les deals expirés |
| `enrich-competitor-prices` | 07:00 | Compare les prix entre enseignes |
| `enrich-nocibe` | 08:00 | Enrichit catégories + images HD |
| `enrich-sephora` | 08:30 | Enrichit catégories + images HD |
| `enrich-marionnaud` | 09:00 | Enrichit catégories + images HD |
| `validate-sephora` | 09:00 | Vérifie validité des deals Sephora |
| `validate-nocibe` | 10:00 | Vérifie validité des deals Nocibé |

### Ressources allouées

- **Mémoire** : 2Gi (4Gi pour Sephora car Playwright)
- **CPU** : 2
- **Timeout** : 30-60 minutes selon le job
- **Région** : europe-west1

---

## 📁 Structure des fichiers

```
src/lib/scraping/
├── ImportEngine.ts          # Moteur d'import unifié
├── index.ts                  # Exports
├── types.ts                  # Interfaces communes
├── nocibe.ts                 # Scraper Nocibé
├── nocibe-search.ts          # Recherche produit spécifique
├── sephora.ts                # Scraper Sephora
├── sephora-search.ts         # Recherche produit spécifique
├── marionnaud.ts             # Scraper Marionnaud
├── marionnaud-search.ts      # Recherche produit spécifique
├── competitor-price-search.ts # Comparaison prix
└── search-utils.ts           # Utilitaires recherche

src/scripts/
├── import-nocibe.ts          # Script import Nocibé
├── import-sephora.ts         # Script import Sephora
├── import-marionnaud.ts      # Script import Marionnaud
├── enrich-nocibe.ts          # Script enrichissement
├── enrich-sephora.ts         # Script enrichissement
└── enrich-competitor-prices.ts # Script prix concurrents
```

---

## ⚠️ Points d'attention

### Connection Pool

L'ImportEngine utilise un batch de **3 produits maximum** en parallèle pour éviter les timeouts de connexion Prisma/Supabase (limite de 5 connexions).

### Détection anti-bot

- **Sephora** : Le plus restrictif, nécessite Playwright + Stealth
- **Marionnaud** : Rotation User-Agent obligatoire
- **Nocibé** : Le moins restrictif

### Images HD

Les images haute définition ne sont pas récupérées pendant le scraping initial mais lors de l'étape d'enrichissement (jobs `enrich-*`).

---

*Documentation générée le 4 février 2026*
