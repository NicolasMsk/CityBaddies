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

> ⚠️ **Cette page décrit en partie l'ancienne V1 (GCP Cloud Run + validation +
> enrichissement GPT), supprimée en février 2026.** Pour le pipeline de scraping
> actuel (V2 minimal), la référence à jour est **[SCRAPERS.md](SCRAPERS.md)**.

## 🗓️ Planning quotidien (V2)

Un seul job par enseigne, chaque matin, via **GitHub Actions** (`.github/workflows/scrape.yml`, cron 04:30 UTC) :

```
04:30 UTC ─── SCRAPE (matrice) ────────────────────────
         ├── scrape nocibe      (fetch + cheerio, UA mobile)
         ├── scrape marionnaud  (fetch + cheerio)
         └── scrape sephora     (fetch + cheerio, UA mobile + anti-Akamai)
              → normalise, filtre (≥15 %), upsert Deal(ACTIVE), expire les non-revus
```

Plus de validation ni d'enrichissement GPT : les deals sont créés directement en `ACTIVE`.

---

## 📊 Récapitulatif (V2)

| Job | Horaire | Technologie | Notes |
|-----|---------|-------------|-------|
| `scrape nocibe` | 04:30 UTC | fetch + cheerio | UA mobile (Akamai) |
| `scrape marionnaud` | 04:30 UTC | fetch + cheerio | direct |
| `scrape sephora` | 04:30 UTC | fetch + cheerio | UA mobile + cookies/spacing/backoff (Akamai + rate-limit) |

> Détails complets, garde-fous d'expiration et anti-bot : **[SCRAPERS.md](SCRAPERS.md)**.

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

### Exécution locale (V2)

```bash
# Dry-run (n'écrit rien en base, pas besoin de DB)
npx tsx src/scripts/scrape.ts nocibe --limit 30 --dry-run

# Import réel (nécessite .env avec DATABASE_URL / DIRECT_URL)
npx tsx src/scripts/scrape.ts nocibe
npx tsx src/scripts/scrape.ts marionnaud
npx tsx src/scripts/scrape.ts sephora

# Tests unitaires
npx vitest run

# Diagnostic d'accès réseau aux 3 sites
node scripts/netcheck.mjs
```

### Déploiement (V2)

GitHub Actions (`.github/workflows/scrape.yml`) : cron quotidien + déclenchement manuel.

```bash
# Lancer manuellement (nécessite gh CLI authentifié)
gh workflow run "Daily scrape"                 # les 3 enseignes
gh workflow run "Daily scrape" -f merchant=nocibe
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
