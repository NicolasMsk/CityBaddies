# 📥 Documentation des Jobs d'Import (Scraping)

> **Dernière mise à jour** : 4 février 2026

Cette documentation décrit les jobs d'import qui récupèrent les produits en promotion depuis les sites marchands.

---

## 📋 Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [scrape-nocibe](#-scrape-nocibe)
3. [scrape-sephora](#-scrape-sephora)
4. [scrape-marionnaud](#-scrape-marionnaud)
5. [ImportEngine](#-importengine)
6. [Sources de scraping](#-sources-de-scraping)
7. [Déploiement](#-déploiement)

---

## Vue d'ensemble

Les jobs d'import parcourent les pages promotions de chaque enseigne et enregistrent les produits en promotion dans la base de données.

### Planning d'exécution

| Job | Horaire | Durée estimée |
|-----|---------|---------------|
| `scrape-nocibe` | 05:00 | 20-30 min |
| `scrape-sephora` | 05:00 | 30-45 min |
| `scrape-marionnaud` | 05:00 | 15-25 min |

### Architecture commune

```
┌─────────────────────┐
│   Scraper spécialisé │  (NocibeScraper, SephoraScraper, MarionnaudScraper)
│   (Strategy Pattern) │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│    ImportEngine     │  Moteur unifié de traitement
│    (batch de 3)     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   Base de données   │  Product, Deal, Brand, Variant
│   (Prisma/Supabase) │
└─────────────────────┘
```

---

## 🟣 scrape-nocibe

### Informations générales

| Propriété | Valeur |
|-----------|--------|
| **Fichier source** | `src/scripts/cloud-jobs/scrape-nocibe.ts` |
| **Dockerfile** | `Dockerfile.nocibe` |
| **Script déploiement** | `deploy-nocibe.ps1` |
| **Mémoire** | 2 Gi |
| **CPU** | 2 |
| **Timeout** | 60 min |
| **Horaire** | 05:00 (Europe/Paris) |

### Fonctionnement

1. Initialise le `NocibeScraper` (Cheerio + fetch)
2. Récupère les sources actives depuis la table `ScrapingSource`
3. Scrape chaque URL source (2 pages max par catégorie)
4. Passe les produits à l'`ImportEngine`
5. Mise à jour de `lastScraped` pour chaque source

### Variables d'environnement

| Variable | Description | Défaut |
|----------|-------------|--------|
| `DATABASE_URL` | URL Prisma PostgreSQL | (requis) |
| `MAX_PRODUCTS` | Limite de produits | 5000 |

### Commandes

```bash
# Exécution locale
npx tsx src/scripts/import-nocibe.ts

# Déploiement GCP
.\deploy-nocibe.ps1

# Exécution manuelle du job
gcloud run jobs execute scrape-nocibe --region=europe-west1
```

### Particularités

- **Volume important** : ~5000 produits (le plus gros des 3)
- Délai de 2 secondes entre les requêtes
- Timeout de 10 secondes par page
- Dédoublonnage par URL produit

---

## 🟠 scrape-sephora

### Informations générales

| Propriété | Valeur |
|-----------|--------|
| **Fichier source** | `src/scripts/cloud-jobs/scrape-sephora.ts` |
| **Dockerfile** | `Dockerfile.sephora` |
| **Script déploiement** | `deploy-sephora.ps1` |
| **Mémoire** | 4 Gi ⚠️ (Playwright) |
| **CPU** | 2 |
| **Timeout** | 60 min |
| **Horaire** | 05:00 (Europe/Paris) |

### Fonctionnement

1. Initialise le `SephoraScraper` (Playwright + Stealth)
2. Lance un navigateur headless Chrome
3. Récupère les sources actives depuis `ScrapingSource`
4. Scrape chaque URL avec scroll infini
5. Clique sur "Voir plus de produits" automatiquement
6. Passe les produits à l'`ImportEngine`

### Variables d'environnement

| Variable | Description | Défaut |
|----------|-------------|--------|
| `DATABASE_URL` | URL Prisma PostgreSQL | (requis) |
| `MAX_PRODUCTS` | Limite de produits | 500 |

### Commandes

```bash
# Exécution locale
npx tsx src/scripts/import-sephora.ts

# Déploiement GCP
.\deploy-sephora.ps1

# Exécution manuelle du job
gcloud run jobs execute scrape-sephora --region=europe-west1
```

### Particularités

- **Mémoire élevée** : 4 Gi nécessaire pour Playwright
- Utilise le **plugin Stealth** pour contourner les protections anti-bot
- Extraction depuis l'attribut `data-tcproduct` (JSON)
- Limite à 500 produits max pour éviter les timeouts

---

## 🔵 scrape-marionnaud

### Informations générales

| Propriété | Valeur |
|-----------|--------|
| **Fichier source** | `src/scripts/cloud-jobs/scrape-marionnaud.ts` |
| **Dockerfile** | `Dockerfile.marionnaud` |
| **Script déploiement** | `deploy-marionnaud.ps1` |
| **Mémoire** | 2 Gi |
| **CPU** | 2 |
| **Timeout** | 60 min |
| **Horaire** | 05:00 (Europe/Paris) |

### Fonctionnement

1. Initialise le `MarionnaudScraper` (Cheerio + fetch)
2. Récupère les sources actives depuis `ScrapingSource`
3. Scrape chaque URL avec rotation de User-Agent
4. Passe les produits à l'`ImportEngine`

### Variables d'environnement

| Variable | Description | Défaut |
|----------|-------------|--------|
| `DATABASE_URL` | URL Prisma PostgreSQL | (requis) |
| `MAX_PRODUCTS` | Limite de produits | Infinity |

### Commandes

```bash
# Exécution locale
npx tsx src/scripts/import-marionnaud.ts

# Déploiement GCP
.\deploy-marionnaud.ps1

# Exécution manuelle du job
gcloud run jobs execute scrape-marionnaud --region=europe-west1
```

### Particularités

- Rotation de 5 User-Agents différents
- Headers complets simulant un vrai navigateur
- Peut extraire les SKU au format `BP_XXXXXX`

---

## ⚙️ ImportEngine

L'`ImportEngine` est le moteur unifié qui traite les produits récupérés par tous les scrapers.

### Fichier

`src/lib/scraping/ImportEngine.ts`

### Configuration

```typescript
{
  batchSize: 50,          // Nombre de produits par batch de catégorisation
  minDiscountPercent: 5,  // Réduction minimum requise (5%)
  maxProducts: Infinity,  // Limite de produits
  verbose: true,          // Logs détaillés
}
```

### Pipeline de traitement

1. **Scraping** : Le scraper récupère les `ScrapedProduct[]`
2. **Filtrage** : Garde uniquement les produits avec volume et réduction ≥ 5%
3. **Catégorisation** : Batch de 50 produits via GPT pour catégorisation
4. **Traitement séquentiel** (batch de 3 max) :
   - Création/mise à jour de la marque (`Brand`)
   - Création/mise à jour du produit (`Product`)
   - Création/mise à jour du deal (`Deal`) avec `isActive: true`, `isExpired: false`
   - Création des variantes si applicable (`ProductVariant`)
   - Enregistrement de l'historique prix (`PriceHistory`)

### Statistiques générées

```typescript
interface ImportStats {
  scraped: number;      // Produits scrapés
  withVolume: number;   // Avec volume valide
  existing: number;     // Existants en BDD
  updated: number;      // Mis à jour
  created: number;      // Nouveaux créés
  priceChanges: number; // Changements de prix détectés
  duration: number;     // Durée en secondes
  errors: Array<{ product: string; error: string }>;
}
```

### ⚠️ Gestion du pool de connexions

Le traitement est fait par **batch de 3 produits maximum** pour éviter les timeouts de connexion Prisma/Supabase (limite de 5 connexions simultanées).

```typescript
const MAX_CONCURRENT_UPDATES = 3;

for (let i = 0; i < products.length; i += MAX_CONCURRENT_UPDATES) {
  const batch = products.slice(i, i + MAX_CONCURRENT_UPDATES);
  await Promise.all(batch.map(async (product) => {
    // Traitement du produit
  }));
}
```

---

## 📑 Sources de scraping

Les URLs à scraper sont stockées dans la table `ScrapingSource`.

### Structure

| Champ | Type | Description |
|-------|------|-------------|
| `id` | String | ID unique |
| `merchantId` | String | FK vers Merchant |
| `url` | String | URL de la page à scraper |
| `name` | String | Nom de la source |
| `category` | String | Catégorie (parfums, maquillage...) |
| `type` | String | "category" ou "trending" |
| `maxProducts` | Int | Limite de produits |
| `priority` | Int | Ordre de scraping |
| `isActive` | Boolean | Source active ou non |
| `lastScraped` | DateTime | Dernière exécution |

### Gestion des sources

```bash
# Initialiser/mettre à jour les sources
npx tsx src/scripts/seed-scraping-sources.ts
```

### Fichier de configuration

Les URLs sont également stockées dans `data/category-links.json` pour référence.

---

## ☁️ Déploiement

### Scripts de déploiement

| Script | Job |
|--------|-----|
| `deploy-nocibe.ps1` | scrape-nocibe |
| `deploy-sephora.ps1` | scrape-sephora |
| `deploy-marionnaud.ps1` | scrape-marionnaud |

### Processus de déploiement

1. Build de l'image Docker
2. Push vers Google Container Registry
3. Mise à jour du Cloud Run Job
4. Configuration du Cloud Scheduler

### Exemple de déploiement

```powershell
# Déployer le job Nocibé
.\deploy-nocibe.ps1

# Vérifier le statut
gcloud run jobs describe scrape-nocibe --region=europe-west1

# Voir les logs
gcloud logging read "resource.type=cloud_run_job AND resource.labels.job_name=scrape-nocibe" --limit=50
```

---

## 🔍 Dépannage

### Erreurs courantes

| Erreur | Cause | Solution |
|--------|-------|----------|
| `Connection pool timeout` | Trop de connexions simultanées | Réduire `MAX_CONCURRENT_UPDATES` |
| `Timeout` page | Site lent ou bloqué | Augmenter le timeout, vérifier les headers |
| `0 produits scrapés` | Sélecteurs CSS changés | Vérifier la structure HTML du site |
| `Aucune source trouvée` | Table `ScrapingSource` vide | Exécuter `seed-scraping-sources.ts` |

### Vérification des sources

```bash
# Vérifier les sources actives
npx prisma studio
# → Table ScrapingSource → Filtrer isActive = true
```

---

*Documentation générée le 4 février 2026*
