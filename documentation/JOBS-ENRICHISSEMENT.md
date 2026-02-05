# ✨ Documentation des Jobs d'Enrichissement

> **Dernière mise à jour** : 5 février 2026

Cette documentation décrit les jobs d'enrichissement qui génèrent du **rich content** (descriptions SEO, conseils d'utilisation, ingrédients) pour améliorer l'expérience utilisateur.

---

## 📋 Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [enrich-nocibe](#-enrich-nocibe)
3. [enrich-sephora](#-enrich-sephora)
4. [enrich-marionnaud](#-enrich-marionnaud)
5. [enrich-competitor-prices](#-enrich-competitor-prices)
6. [Déploiement](#-déploiement)

---

## Vue d'ensemble

Les jobs d'enrichissement ajoutent du **contenu riche** aux deals existants : descriptions SEO, images HD, ingrédients, conseils d'application, etc.

> **⚠️ Important** : Ces jobs ne vérifient PAS les prix ni ne désactivent les deals. Cette responsabilité appartient aux **jobs de validation**.

### Planning d'exécution

| Job | Horaire | Durée estimée | Rôle |
|-----|---------|---------------|------|
| `enrich-competitor-prices` | 07:00 | 30-60 min | Prix concurrents |
| `enrich-nocibe` | 08:00 | 45-90 min | Rich content Nocibé |
| `enrich-sephora` | 08:30 | 45-90 min | Rich content Sephora |
| `enrich-marionnaud` | 09:00 | 45-90 min | Rich content Marionnaud |

### Prérequis

- Les jobs d'import doivent avoir été exécutés (deals existants en BDD)
- Clé API OpenAI configurée (`OPENAI_API_KEY`)
- Playwright installé pour le scraping headless

### Technologies utilisées

| Job | Scraping | IA |
|-----|----------|-----|
| enrich-nocibe | Playwright | GPT-4o-mini |
| enrich-sephora | Playwright | GPT-4o-mini |
| enrich-marionnaud | Playwright | GPT-4o-mini |
| enrich-competitor-prices | Playwright | GPT-4o-mini Vision |

---

## 🟣 enrich-nocibe

### Informations générales

| Propriété | Valeur |
|-----------|--------|
| **Fichier source** | `src/scripts/enrich-deals-nocibe.ts` |
| **Fichier cloud** | `src/scripts/cloud-jobs/enrich-nocibe.ts` |
| **Dockerfile** | `Dockerfile.enrich-nocibe` |
| **Script déploiement** | `deploy-enrich-nocibe.ps1` |
| **Mémoire** | Configuré manuellement (GCP Console) |
| **CPU** | Configuré manuellement (GCP Console) |
| **Timeout** | Configuré manuellement (GCP Console) |
| **Horaire** | 08:00 (Europe/Paris) |

### Données enrichies

| Champ | Table | Description |
|-------|-------|-------------|
| `seoDescription` | Deal | Description SEO réécrite |
| `ingredients` | Deal | Liste des ingrédients INCI |
| `application` | Deal | Conseils d'utilisation |
| `whyGoodDeal` | Deal | Pourquoi c'est un bon deal |
| `availableSizes` | Product | Tailles disponibles (CSV) |

### Rôle du job

**Ce job génère du rich content uniquement** :
- ✅ Scrape les descriptions, ingrédients, conseils d'application
- ✅ Génère du contenu SEO avec GPT
- ❌ Ne vérifie PAS les prix
- ❌ Ne désactive PAS les deals
- ❌ Ne met PAS à jour les prix/remises

> **Note** : La vérification des prix et la désactivation des deals sans promo se fait dans les **jobs de validation** (validate-nocibe, validate-sephora, validate-marionnaud).

### Fonctionnement

1. Récupère les deals Nocibé actifs **sans `whyGoodDeal`**
2. Pour chaque deal :
   - Scrape la page produit Nocibé (Playwright)
   - Extrait : titre, variantes, labels, description, ingrédients, conseils
   - Appelle GPT-4o-mini pour réécrire le contenu en style "City Baddies"
3. Met à jour uniquement les champs de rich content

### Données scrapées depuis la page produit

```typescript
interface ScrapedData {
  // Informations produit
  brandNameSeo: string;
  brandLine: string;
  productName: string;
  fullName: string;
  
  // Variantes (pour availableSizes uniquement)
  variants: VariantData[];
  selectedVariant: VariantData | null;
  availableSizes: string[];
  
  // Rich content
  details: {
    description: string;        // Description longue
    application: string;        // Conseils d'utilisation
    ingredients: string;        // Liste INCI
    labels: string[];           // "Bio", "Vegan", etc.
    classifications: Record<string, string>;  // Famille, sous-famille...
  };
}
```

### Prompt GPT utilisé

Le contenu est réécrit avec un ton :
- 💅 Girly et accessible
- 🎯 Focus sur les bénéfices
- 💰 Met en avant l'économie
- ✨ Style influenceuse beauté

### Commandes

```bash
# Exécution locale - tous les deals
npx tsx src/scripts/enrich-deals-nocibe.ts

# Limiter à 5 deals
npx tsx src/scripts/enrich-deals-nocibe.ts --limit 5

# Déploiement GCP
.\deploy-enrich-nocibe.ps1
```

---

## 🟠 enrich-sephora

### Informations générales

| Propriété | Valeur |
|-----------|--------|
| **Fichier source** | `src/scripts/enrich-sephora.ts` |
| **Fichier cloud** | `src/scripts/cloud-jobs/enrich-sephora.ts` |
| **Dockerfile** | `Dockerfile.enrich-sephora` |
| **Script déploiement** | `deploy-enrich-sephora.ps1` |
| **Mémoire** | Configuré manuellement (GCP Console) |
| **CPU** | Configuré manuellement (GCP Console) |
| **Timeout** | Configuré manuellement (GCP Console) |
| **Horaire** | 08:30 (Europe/Paris) |

### Données enrichies

| Champ | Table | Description |
|-------|-------|-------------|
| `seoDescription` | Deal | Description SEO réécrite |
| `ingredients` | Deal | Liste des ingrédients |
| `application` | Deal | Conseils d'utilisation |
| `whyGoodDeal` | Deal | Pourquoi c'est un bon deal |

### Rôle du job

**Ce job génère du rich content uniquement** :
- ✅ Scrape les descriptions, ingrédients, conseils d'application
- ✅ Génère du contenu SEO avec GPT
- ❌ Ne vérifie PAS les prix
- ❌ Ne désactive PAS les deals
- ❌ Ne met PAS à jour les prix/remises

### Fonctionnement

1. Récupère les deals Sephora actifs **sans `whyGoodDeal`**
2. Pour chaque deal :
   - Scrape la page produit Sephora (Playwright + Stealth)
   - Gère les cookies TC Privacy
   - Extrait : marque, nom, SKU, labels, description, ingrédients
   - Appelle GPT-4o-mini pour réécrire le contenu
3. Met à jour uniquement les champs de rich content

### Données scrapées depuis la page produit

```typescript
interface ScrapedData {
  // Informations produit
  brand: string;
  name: string;
  fullTitle: string;
  variant: string;           // "50 ml"
  sku: string;
  rating: string;            // "4.5"
  reviewCount: string;       // "123"
  
  // Rich content
  labels: string[];          // "Exclusivité", "Vegan"...
  description: string;
  application: string;
  testResults: string;       // Résultats de tests cliniques
  moreInfos: string;
  ingredients: string;
  category: string;
  nature: string;            // Type de produit
  section: string;           // Rayon
}
```

### Gestion des cookies

Sephora utilise TC Privacy. Le script tente plusieurs sélecteurs :

```typescript
const cookieSelectors = [
  '#footer_tc_privacy_button_3',
  'button.tc-privacy-button[title="Tout accepter"]',
  '.tc-privacy-button',
  '#onetrust-accept-btn-handler',
];
```

### Commandes

```bash
# Exécution locale - tous les deals
npx tsx src/scripts/enrich-sephora.ts

# Test sur 1 deal
npx tsx src/scripts/enrich-sephora.ts --test

# Limiter à 5 deals
npx tsx src/scripts/enrich-sephora.ts --limit 5

# Déploiement GCP
.\deploy-enrich-sephora.ps1
```

---

## 🔵 enrich-marionnaud

### Informations générales

| Propriété | Valeur |
|-----------|--------|
| **Fichier source** | `src/scripts/cloud-jobs/enrich-marionnaud.ts` |
| **Dockerfile** | `Dockerfile.enrich-marionnaud` |
| **Script déploiement** | `deploy-enrich-marionnaud.ps1` |
| **Mémoire** | Configuré manuellement (GCP Console) |
| **CPU** | Configuré manuellement (GCP Console) |
| **Timeout** | Configuré manuellement (GCP Console) |
| **Horaire** | 09:00 (Europe/Paris) |

### Données enrichies

| Champ | Table | Description |
|-------|-------|-------------|
| `seoDescription` | Deal | Description SEO réécrite |
| `ingredients` | Deal | Liste des ingrédients |
| `application` | Deal | Conseils d'utilisation |
| `whyGoodDeal` | Deal | Pourquoi c'est un bon deal |

### Rôle du job

**Ce job génère du rich content uniquement** :
- ✅ Scrape les descriptions, ingrédients, conseils d'utilisation
- ✅ Génère du contenu SEO avec GPT
- ❌ Ne vérifie PAS les prix
- ❌ Ne désactive PAS les deals
- ❌ Ne met PAS à jour les prix/remises

### Fonctionnement

1. Récupère les deals Marionnaud actifs **sans `whyGoodDeal`**
2. Pour chaque deal :
   - Scrape la page produit Marionnaud (Playwright)
   - Extrait : marque, gamme, nom, badge promo, description, usage, ingrédients
   - Appelle GPT-4o-mini pour réécrire le contenu
3. Met à jour uniquement les champs de rich content

### Données scrapées depuis la page produit

```typescript
interface ScrapedData {
  brand: string;
  range: string;             // Gamme (ex: "J'adore")
  name: string;
  fullTitle: string;
  variant: string | null;    // "50 ml"
  promoBadge: string | null; // "-30%"
  promoDuration: string | null; // "Jusqu'au 15/02"
  description: string;
  usage: string;             // Conseils d'utilisation
  ingredients: string;
  articleNumber: string | null; // SKU
}
```

### Images HD

Marionnaud propose des images en très haute résolution (2000x2000). Le script les extrait depuis le `srcset` :

```typescript
// Cherche l'image qui contient le SKU et la résolution 2000x2000
if (srcset.includes('2000x2000') && srcset.includes(sku)) {
  // Extrait l'URL HD
}
```

### Commandes

```bash
# Déploiement GCP
.\deploy-enrich-marionnaud.ps1

# Exécution manuelle
gcloud run jobs execute enrich-marionnaud --region=europe-west1
```

---

## 💰 enrich-competitor-prices

### Informations générales

| Propriété | Valeur |
|-----------|--------|
| **Fichier source** | `src/scripts/enrich-competitor-prices.ts` |
| **Fichier cloud** | `src/scripts/cloud-jobs/enrich-competitor-prices.ts` |
| **Mémoire** | 4 Gi (Playwright) |
| **CPU** | 2 |
| **Timeout** | 60 min |
| **Horaire** | 07:00 (Europe/Paris) |

### Objectif

Pour chaque deal avec un bon score, rechercher le même produit chez les concurrents pour comparer les prix.

### Logique de recherche

| Source du deal | Concurrents recherchés |
|----------------|------------------------|
| Nocibé | Sephora + Marionnaud |
| Sephora | Nocibé + Marionnaud |
| Marionnaud | Sephora + Nocibé |

### Technologie : GPT-4o-mini Vision

Plutôt que de maintenir des sélecteurs CSS par site, le script :
1. Prend un **screenshot** de la page produit concurrente
2. Envoie l'image à **GPT-4o-mini Vision**
3. Le LLM extrait le prix, le volume, la disponibilité

### Données récupérées

```typescript
interface CompetitorPriceResult {
  found: boolean;
  currentPrice?: number;
  originalPrice?: number;
  discountPercent?: number;
  productName?: string;
  productUrl?: string;
  volume?: string;
  inStock?: boolean;
  error?: string;
}
```

### Nettoyage de la query de recherche

Le script optimise la recherche Google/Serper :

1. Supprime les mentions de promo (`-50% :`)
2. Supprime les volumes entre parenthèses
3. Supprime les doublons de marque (`"Lancôme - Lancôme -"` → `"Lancôme"`)
4. Ajoute la marque si absente

### Commandes

```bash
# Exécution locale - tous les deals avec score >= 70
npx tsx src/scripts/enrich-competitor-prices.ts

# Avec score minimum personnalisé
npx tsx src/scripts/enrich-competitor-prices.ts --min-score=8

# Limiter le nombre de deals
npx tsx src/scripts/enrich-competitor-prices.ts --limit=10

# Filtrer par source
npx tsx src/scripts/enrich-competitor-prices.ts --source=sephora
```

---

## ☁️ Déploiement

### Scripts de déploiement

| Script | Job |
|--------|-----|
| `deploy-enrich-nocibe.ps1` | enrich-nocibe |
| `deploy-enrich-sephora.ps1` | enrich-sephora |
| `deploy-enrich-marionnaud.ps1` | enrich-marionnaud |

### Variables d'environnement requises

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | URL Prisma PostgreSQL |
| `OPENAI_API_KEY` | Clé API OpenAI |
| `SERPER_API_KEY` | Clé API Serper (pour competitor-prices) |

### Configuration des ressources

> **⚠️ Important** : Les ressources (mémoire, CPU, timeout, retries) sont configurées **manuellement** dans la console GCP Cloud Run. Les scripts de déploiement ne spécifient pas ces paramètres, permettant de les ajuster sans redéployer.

**Configuration recommandée** :
- **Nocibé** : 2 Gi RAM, 1 CPU, 60 min timeout
- **Sephora** : 4 Gi RAM, 2 CPU, 60 min timeout (Playwright)
- **Marionnaud** : 4 Gi RAM, 2 CPU, 60 min timeout (Playwright)

### Processus de déploiement

```powershell
# Déployer le job d'enrichissement Nocibé
.\deploy-enrich-nocibe.ps1

# Vérifier le statut
gcloud run jobs describe enrich-nocibe --region=europe-west1

# Voir les logs
gcloud logging read "resource.type=cloud_run_job AND resource.labels.job_name=enrich-nocibe" --limit=50
```

---

## 📊 Comparatif des jobs d'enrichissement

| Critère | Nocibé | Sephora | Marionnaud | Competitor Prices |
|---------|--------|---------|------------|-------------------|
| **Technologie** | Playwright | Playwright + Stealth | Playwright | Playwright + Vision |
| **Mémoire recommandée** | 2 Gi | 4 Gi | 4 Gi | 4 Gi |
| **Durée** | 45-90 min | 45-90 min | 45-90 min | 30-60 min |
| **IA** | GPT-4o-mini | GPT-4o-mini | GPT-4o-mini | GPT-4o-mini Vision |
| **Rôle** | Rich content | Rich content | Rich content | Prix concurrents |
| **Vérification prix** | ❌ (Job validation) | ❌ (Job validation) | ❌ (Job validation) | N/A |

---

## 🔍 Dépannage

### Erreurs courantes

| Erreur | Cause | Solution |
|--------|-------|----------|
| `Rate limit exceeded` | Trop d'appels GPT | Ajouter des délais entre les deals |
| `Navigation timeout` | Page trop lente | Augmenter le timeout Playwright |
| `Cookie banner blocking` | Cookie non accepté | Vérifier les sélecteurs de cookies |
| `No deals found` | Tous les deals ont déjà `whyGoodDeal` | Normal si déjà enrichis |

### Vérification de l'enrichissement

```sql
-- Deals non enrichis
SELECT COUNT(*) FROM "Deal" WHERE "whyGoodDeal" IS NULL AND "isActive" = true;

-- Deals enrichis par marchand
SELECT m.name, COUNT(*) 
FROM "Deal" d 
JOIN "Product" p ON d."productId" = p.id 
JOIN "Merchant" m ON p."merchantId" = m.id 
WHERE d."whyGoodDeal" IS NOT NULL 
GROUP BY m.name;
```

---

## 🔄 Séparation des responsabilités

Les jobs d'enrichissement font partie d'une architecture en 3 couches :

1. **Jobs d'import** : Importent les nouveaux deals depuis les APIs/flux
2. **Jobs de validation** : Vérifient prix, volumes, et désactivent les deals invalides
3. **Jobs d'enrichissement** : Ajoutent uniquement du rich content (SEO, ingrédients, conseils)

> **⚠️ Note** : La vérification des prix et la désactivation des deals sans promo se font dans les jobs de validation (`validate-nocibe`, `validate-sephora`, `validate-marionnaud`), PAS dans les jobs d'enrichissement.

---

*Documentation générée le 5 février 2026*
