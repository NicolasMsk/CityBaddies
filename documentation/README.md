# 📚 Documentation City Baddies

> **Dernière mise à jour** : 4 février 2026

Bienvenue dans la documentation technique de City Baddies, la plateforme de bons plans beauté.

---

## 📂 Structure de la documentation

| Fichier | Description |
|---------|-------------|
| [SCRAPERS.md](SCRAPERS.md) | Documentation des 3 scrapers (Nocibé, Sephora, Marionnaud) |
| [JOBS-IMPORT.md](JOBS-IMPORT.md) | Jobs d'import quotidien des produits |
| [JOBS-ENRICHISSEMENT.md](JOBS-ENRICHISSEMENT.md) | Jobs d'enrichissement (GPT, images HD, prix concurrents) |
| [JOBS-VALIDATION.md](JOBS-VALIDATION.md) | Jobs de validation des deals |
| [JOBS-MAINTENANCE.md](JOBS-MAINTENANCE.md) | Jobs de maintenance (expiration, nettoyage) |

---

## 🗓️ Planning quotidien des jobs

```
05:00 ─── IMPORT ──────────────────────────────────────
         │
         ├── scrape-nocibe     (~5000 produits, isActive=false)
         ├── scrape-sephora    (~500 produits, isActive=false)
         └── scrape-marionnaud (~1500 produits, isActive=false)
         
07:00 ─── VALIDATION ──────────────────────────────────
         │
         ├── validate-nocibe    (07:00) → active les deals OK
         └── validate-sephora   (07:00) → active les deals OK

08:30 ─── ENRICHISSEMENT ───────────────────────────────
         │
         ├── enrich-nocibe           (08:30)
         ├── enrich-sephora          (08:30)
         ├── enrich-marionnaud       (08:30)
         └── enrich-competitor-prices (08:30)
```

---

## 📊 Tableau récapitulatif des jobs

| Job | Type | Horaire | Mémoire | Timeout | Technologie |
|-----|------|---------|---------|---------|-------------|
| `scrape-nocibe` | Import | 05:00 | 2 Gi | 60 min | Cheerio |
| `scrape-sephora` | Import | 05:00 | 4 Gi | 60 min | Playwright |
| `scrape-marionnaud` | Import | 05:00 | 2 Gi | 60 min | Cheerio |
| `validate-nocibe` | Validation | 07:00 | 2 Gi | 60 min | Cheerio |
| `validate-sephora` | Validation | 07:00 | 4 Gi | 60 min | Playwright |
| `enrich-nocibe` | Enrichissement | 08:30 | 2 Gi | 60 min | Playwright + GPT |
| `enrich-sephora` | Enrichissement | 08:30 | 4 Gi | 60 min | Playwright + GPT |
| `enrich-marionnaud` | Enrichissement | 08:30 | 4 Gi | 60 min | Playwright + GPT |
| `enrich-competitor-prices` | Enrichissement | 08:30 | 4 Gi | 60 min | Playwright + GPT Vision |

> **Note** : Le job `expire-deals` a été supprimé car redondant avec la validation.

---

## 🏗️ Architecture technique

### Stack technologique

| Composant | Technologie |
|-----------|-------------|
| **Frontend** | Next.js 14 (App Router) |
| **Base de données** | PostgreSQL (Supabase) |
| **ORM** | Prisma |
| **Scraping** | Playwright + Cheerio |
| **IA** | OpenAI GPT-4o-mini |
| **Hébergement App** | Vercel |
| **Jobs** | Google Cloud Run Jobs |
| **Scheduler** | Google Cloud Scheduler |

### Pattern de scraping

```
┌─────────────────────┐
│   Scraper spécialisé │  NocibeScraper, SephoraScraper, MarionnaudScraper
│   (Strategy Pattern) │  Implémente l'interface Scraper
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│    ImportEngine     │  Moteur unifié
│    (batch de 3)     │  Gère catégorisation, création, mise à jour
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   Base de données   │  Product, Deal, Brand, Variant, PriceHistory
│   (Prisma/Supabase) │
└─────────────────────┘
```

---

## 🔧 Commandes utiles

### Exécution locale

```bash
# Import
npx tsx src/scripts/import-nocibe.ts
npx tsx src/scripts/import-sephora.ts
npx tsx src/scripts/import-marionnaud.ts

# Enrichissement
npx tsx src/scripts/enrich-nocibe.ts --limit 5
npx tsx src/scripts/enrich-sephora.ts --limit 5
npx tsx src/scripts/enrich-competitor-prices.ts --limit 10

# Validation
npx tsx src/scripts/validate-deals-nocibe.ts --limit 10
npx tsx src/scripts/validate-deals-sephora.ts --limit 10

# Maintenance
npx tsx src/scripts/update-is-active.ts
```

### Gestion GCP

```bash
# Déployer un job
.\deploy-nocibe.ps1

# Exécuter un job manuellement
gcloud run jobs execute scrape-nocibe --region=europe-west1

# Voir les logs
gcloud logging read "resource.type=cloud_run_job AND resource.labels.job_name=scrape-nocibe" --limit=50

# Lister tous les jobs
gcloud run jobs list --region=europe-west1
```

### Base de données

```bash
# Ouvrir Prisma Studio
npx prisma studio

# Générer le client Prisma
npx prisma generate

# Appliquer les migrations
npx prisma migrate deploy
```

---

## 📁 Structure des fichiers

```
src/
├── lib/
│   └── scraping/
│       ├── ImportEngine.ts      # Moteur d'import unifié
│       ├── types.ts             # Interfaces communes
│       ├── nocibe.ts            # Scraper Nocibé
│       ├── sephora.ts           # Scraper Sephora
│       ├── marionnaud.ts        # Scraper Marionnaud
│       ├── *-search.ts          # Recherche de produits spécifiques
│       └── competitor-price-search.ts
│
└── scripts/
    ├── import-*.ts              # Scripts d'import
    ├── enrich-*.ts              # Scripts d'enrichissement
    ├── validate-deals-*.ts      # Scripts de validation
    ├── update-is-active.ts      # Mise à jour isActive
    ├── clean-db.ts              # Nettoyage BDD
    └── cloud-jobs/              # Versions Cloud Run
        ├── scrape-*.ts
        ├── enrich-*.ts
        ├── expire-deals.ts
        └── validate-deals-*.ts
```

---

## ⚠️ Points d'attention

### Connection Pool Prisma/Supabase

La limite est de **5 connexions simultanées**. L'ImportEngine traite les produits par **batch de 3** pour éviter les timeouts.

### Mémoire pour Playwright

Les jobs utilisant Playwright (Sephora, enrichissement) nécessitent **4 Gi de mémoire**.

### Anti-bot

- **Sephora** : Le plus restrictif → Playwright + Stealth Plugin obligatoire
- **Marionnaud** : Modéré → Rotation de User-Agents
- **Nocibé** : Le moins restrictif → Cheerio suffit

---

## 🔗 Liens utiles

- [Google Cloud Console](https://console.cloud.google.com/run/jobs?project=city-baddies)
- [Supabase Dashboard](https://supabase.com/dashboard)
- [Vercel Dashboard](https://vercel.com/dashboard)
- [OpenAI Platform](https://platform.openai.com)

---

*Documentation City Baddies - Générée le 4 février 2026*
