# ✅ Documentation des Jobs de Validation

> **Dernière mise à jour** : 4 février 2026

Cette documentation décrit les jobs de validation qui vérifient que les deals correspondent toujours à la réalité sur les sites marchands.

---

## 📋 Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [validate-sephora](#-validate-sephora)
3. [validate-nocibe](#-validate-nocibe)
4. [Actions de validation](#-actions-de-validation)
5. [Déploiement](#-déploiement)

---

## Vue d'ensemble

Les jobs de validation vérifient que les prix et promotions des deals en base correspondent toujours à la réalité sur les sites marchands.

> **Important** : La validation s'exécute **AVANT** l'enrichissement. Les nouveaux deals sont créés avec `isActive: false` et ne sont activés qu'après validation réussie.

### Planning d'exécution

| Job | Horaire | Durée estimée |
|-----|---------|---------------|
| `validate-nocibe` | 07:00 | 30-60 min |
| `validate-sephora` | 07:00 | 30-60 min |

### Workflow de validation

```
Import (05:00)           Validation (07:00)         Enrichissement (08:30)
    │                         │                           │
    ▼                         ▼                           ▼
isActive: false  ───►  isActive: true (si OK)  ───►  Deals actifs enrichis
                       isActive: false (si KO)
```

### Pourquoi valider ?

Les promotions peuvent changer à tout moment :
- **Fin de promo** : Le produit n'est plus soldé
- **Changement de prix** : Le prix a augmenté ou diminué
- **Changement de volume** : La contenance en promo a changé
- **Produit indisponible** : Rupture de stock

### Actions possibles

| Statut | Action |
|--------|--------|
| `VALID` | `isActive = true` (deal confirmé et visible) |
| `PRICE_CHANGED` | `isActive = true` + mise à jour du prix |
| `VOLUME_CHANGED` | `isActive = true` + mise à jour du volume |
| `EXPIRED` | `isExpired = true`, `isActive = false` |
| `NOT_FOUND` | `isExpired = true`, `isActive = false` |
| `ERROR` | Log de l'erreur, deal conservé (reste inactif) |

---

## 🟠 validate-sephora

### Informations générales

| Propriété | Valeur |
|-----------|--------|
| **Fichier source** | `src/scripts/validate-deals-sephora.ts` |
| **Fichier cloud** | `src/scripts/cloud-jobs/validate-deals-sephora.ts` |
| **Dockerfile** | À créer si besoin |
| **Mémoire** | 4 Gi (Playwright) |
| **CPU** | 2 |
| **Timeout** | 60 min |
| **Horaire** | 07:00 (Europe/Paris) |

### Fonctionnement

1. Récupère tous les deals Sephora non expirés (`isExpired = false`)
2. Pour chaque deal :
   - Ouvre la page produit avec Playwright
   - Gère les cookies TC Privacy
   - Extrait toutes les variantes avec leurs prix
   - Compare avec le deal en base
   - Applique l'action appropriée

### Données scrapées

```typescript
interface ProductVariant {
  name: string;            // "01 Light Glow (10 g)"
  volume: string;          // "10 g"
  volumeValue: number;     // 10
  volumeUnit: string;      // "g"
  currentPrice: number;    // Prix actuel
  originalPrice: number;   // Prix barré (si promo)
  discountPercent: number; // % de réduction
  isPromo: boolean;        // true si en promo
  sku: string;             // data-pid
}
```

### Résultat de validation

```typescript
interface ValidationResult {
  dealId: number;
  productName: string;
  dealVolume: string;
  status: 'VALID' | 'PRICE_CHANGED' | 'VOLUME_CHANGED' | 'EXPIRED' | 'NOT_FOUND' | 'ERROR';
  oldPrice?: number;
  newPrice?: number;
  oldDiscount?: number;
  newDiscount?: number;
  message: string;
  matchedVariant?: ProductVariant;
}
```

### Algorithme de matching

Le script cherche la variante qui correspond au deal en base :

1. **Match exact** : Même volume normalisé (`50ml` = `50 ml`)
2. **Match approximatif** : Volume proche (±10%)
3. **Fallback** : Première variante en promo

### Commandes

```bash
# Exécution locale - tous les deals
npx tsx src/scripts/validate-deals-sephora.ts

# Limiter à N deals
npx tsx src/scripts/validate-deals-sephora.ts --limit 10

# Valider un deal spécifique
npx tsx src/scripts/validate-deals-sephora.ts --deal-id 123

# Mode visible (pas headless)
npx tsx src/scripts/validate-deals-sephora.ts --headless false
```

---

## 🟣 validate-nocibe

### Informations générales

| Propriété | Valeur |
|-----------|--------|
| **Fichier source** | `src/scripts/validate-deals-nocibe.ts` |
| **Fichier cloud** | `src/scripts/cloud-jobs/validate-deals-nocibe.ts` |
| **Dockerfile** | `Dockerfile.validate-nocibe` |
| **Mémoire** | 2 Gi |
| **CPU** | 2 |
| **Timeout** | 60 min |
| **Horaire** | 07:00 (Europe/Paris) |

### Fonctionnement

1. Récupère tous les deals Nocibé non expirés (`isExpired = false`)
2. Pour chaque deal :
   - Fetch la page produit (Cheerio, pas de Playwright nécessaire)
   - Parse le HTML pour extraire les variantes
   - Compare avec le deal en base
   - Applique l'action appropriée

### Avantage : Pas de Playwright

Contrairement à Sephora, Nocibé rend le HTML côté serveur. Le script utilise simplement `fetch` + `cheerio`, ce qui est :
- Plus rapide
- Moins gourmand en mémoire (2 Gi vs 4 Gi)
- Plus fiable (pas de problèmes de rendu JS)

### Données scrapées

```typescript
interface ProductVariant {
  name: string;            // "30 ml"
  volume: string;          // "30 ml"
  volumeValue: number;     // 30
  volumeUnit: string;      // "ml"
  currentPrice: number;
  originalPrice: number;
  discountPercent: number;
  isPromo: boolean;
  promoCode?: string;      // Code promo si applicable
  priceWithCode?: number;  // Prix après code promo
  discountWithCode?: number;
}
```

### Gestion des codes promo

Nocibé propose parfois des codes promo en plus des réductions affichées. Le script détecte :
- Prix barré classique
- Code promo applicable
- Prix final après code

### Commandes

```bash
# Exécution locale - tous les deals
npx tsx src/scripts/validate-deals-nocibe.ts

# Limiter à N deals
npx tsx src/scripts/validate-deals-nocibe.ts --limit 10

# Valider un deal spécifique
npx tsx src/scripts/validate-deals-nocibe.ts --deal-id abc123
```

---

## ⚡ Actions de validation

### VALID ✅

Le deal est toujours valide avec le même prix → on l'active.

```typescript
await prisma.deal.update({
  where: { id: dealId },
  data: {
    isActive: true,  // Deal validé et visible
  }
});
```

### PRICE_CHANGED 💰

Le prix a changé (augmentation ou diminution) → on l'active avec le nouveau prix.

```typescript
await prisma.deal.update({
  where: { id: dealId },
  data: {
    isActive: true,   // Deal validé et visible
    dealPrice: newPrice,
    discountPercent: newDiscount,
    discountAmount: originalPrice - newPrice,
  }
});
```

### EXPIRED ⏰

Le produit n'est plus en promotion.

```typescript
await prisma.deal.update({
  where: { id: dealId },
  data: {
    isExpired: true,
    isActive: false,
  }
});
```

### NOT_FOUND 🔍

La page produit n'existe plus ou le produit est introuvable.

```typescript
await prisma.deal.update({
  where: { id: dealId },
  data: {
    isExpired: true,
    isActive: false,
  }
});
```

### ERROR ⚠️

Une erreur s'est produite lors du scraping.

```typescript
// Le deal est conservé, l'erreur est loguée
console.error(`❌ Erreur validation ${dealId}: ${error.message}`);
```

---

## 📊 Rapport de validation

À la fin de l'exécution, un rapport récapitulatif est affiché :

```
========================================
   RAPPORT DE VALIDATION - NOCIBÉ
========================================

📊 Statistiques:
   - Total traités: 150
   - Valides: 120 (80%)
   - Prix modifiés: 15 (10%)
   - Expirés: 10 (7%)
   - Erreurs: 5 (3%)

⏱️ Durée: 25 min 30 sec

📈 Détails des changements:
   ↗️ Augmentations de prix: 8
   ↘️ Baisses de prix: 7
```

---

## ☁️ Déploiement

### Configuration GCP

```powershell
# Créer le job
gcloud run jobs create validate-nocibe \
  --image=gcr.io/city-baddies/validate-nocibe:latest \
  --region=europe-west1 \
  --memory=2Gi \
  --cpu=2 \
  --timeout=3600 \
  --set-env-vars="DATABASE_URL=..." \
  --max-retries=1

# Créer le scheduler
gcloud scheduler jobs create http validate-nocibe-daily \
  --location=europe-west1 \
  --schedule="0 10 * * *" \
  --time-zone="Europe/Paris" \
  --http-method=POST \
  --uri="https://europe-west1-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/city-baddies/jobs/validate-nocibe:run" \
  --oauth-service-account-email="241509965456-compute@developer.gserviceaccount.com"
```

### Variables d'environnement

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | URL Prisma PostgreSQL (requis) |

### Exécution manuelle

```bash
# Exécuter le job Nocibé
gcloud run jobs execute validate-nocibe --region=europe-west1

# Exécuter le job Sephora
gcloud run jobs execute validate-sephora --region=europe-west1
```

---

## 🔍 Dépannage

### Erreurs courantes

| Erreur | Cause | Solution |
|--------|-------|----------|
| `Navigation timeout` | Page trop lente | Augmenter le timeout |
| `404 Not Found` | Produit supprimé | Normal, le deal sera marqué expiré |
| `Rate limited` | Trop de requêtes | Augmenter le délai entre les deals |
| `Cookie blocking` | Cookie non accepté | Mettre à jour les sélecteurs |

### Vérification des deals expirés

```sql
-- Deals expirés aujourd'hui
SELECT d.title, p.name, m.name as merchant
FROM "Deal" d
JOIN "Product" p ON d."productId" = p.id
JOIN "Merchant" m ON p."merchantId" = m.id
WHERE d."isExpired" = true
  AND d."updatedAt" >= CURRENT_DATE;
```

### Réactiver un deal expiré par erreur

```sql
-- ⚠️ À utiliser avec précaution
UPDATE "Deal"
SET "isExpired" = false, "isActive" = true
WHERE id = 'deal-id-ici';
```

---

## 📅 Planning recommandé

```
05:00 - Import des produits (scrape-*)
07:00 - Expiration automatique (expire-deals)
07:00 - Prix concurrents (enrich-competitor-prices)
08:00-09:00 - Enrichissement (enrich-*)
09:00 - Validation Sephora (validate-sephora)
10:00 - Validation Nocibé (validate-nocibe)
```

Cette séquence garantit que :
1. Les nouveaux deals sont importés
2. Les anciens deals non vus sont expirés
3. Les deals sont enrichis avec du contenu
4. Les deals sont validés avec les prix actuels

---

*Documentation générée le 4 février 2026*
