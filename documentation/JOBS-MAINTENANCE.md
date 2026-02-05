# 🔧 Documentation des Jobs de Maintenance

> **Dernière mise à jour** : 4 février 2026

Cette documentation décrit les jobs de maintenance qui gèrent le cycle de vie des deals.

---

## 📋 Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [expire-deals](#-expire-deals)
3. [update-is-active](#-update-is-active)
4. [clean-db](#-clean-db)
5. [Déploiement](#-déploiement)

---

## Vue d'ensemble

Les jobs de maintenance gèrent le cycle de vie des deals et assurent la qualité des données.

> **Note** : Le job `expire-deals` a été supprimé car redondant avec la validation. Les jobs de validation (`validate-nocibe`, `validate-sephora`) gèrent désormais l'expiration des deals.

### Planning d'exécution

| Job | Horaire | Description |
|-----|---------|-------------|
| `update-is-active` | À la demande | Met à jour `isActive` selon le score |
| `clean-db` | À la demande | Nettoie les données orphelines |

---

## 🎯 update-is-active

### Informations générales

| Propriété | Valeur |
|-----------|--------|
| **Fichier source** | `src/scripts/update-is-active.ts` |
| **Exécution** | Manuelle ou après import |

### Objectif

Mettre à jour le champ `isActive` des deals selon leur score et statut.

### Règles d'activation

Un deal est **actif** si :
- `isExpired = false`
- `score >= seuil` (défaut: 60)

Un deal est **inactif** si :
- `isExpired = true` OU
- `score < seuil`

### Fonctionnement

```typescript
// 1. Désactiver les deals expirés ou avec score bas
await prisma.deal.updateMany({
  where: {
    OR: [
      { isExpired: true },
      { score: { lt: scoreThreshold } },
    ],
  },
  data: { isActive: false },
});

// 2. Activer les deals valides avec bon score
await prisma.deal.updateMany({
  where: {
    isExpired: false,
    score: { gte: scoreThreshold },
  },
  data: { isActive: true },
});
```

### Commandes

```bash
# Avec seuil par défaut (60)
npx tsx src/scripts/update-is-active.ts

# Avec seuil personnalisé
npx tsx src/scripts/update-is-active.ts --threshold=50
```

### Rapport généré

```
🔄 Mise à jour du champ isActive...
📊 Seuil de score: 60

📈 Avant mise à jour:
   - Actifs: 450
   - Inactifs: 150

❌ Deals désactivés: 25
✅ Deals activés: 10

📈 Après mise à jour:
   - Actifs: 435
   - Inactifs: 165

📊 Statistiques des deals actifs:
   - Score moyen: 72.5
   - Score min: 60.0
   - Score max: 95.0
   - Réduction moyenne: 35.2%

✨ Mise à jour terminée!
```

---

## 🧹 clean-db

### Informations générales

| Propriété | Valeur |
|-----------|--------|
| **Fichier source** | `src/scripts/clean-db.ts` |
| **Exécution** | Manuelle uniquement |

### Objectif

Nettoyer la base de données des données orphelines ou obsolètes.

### Actions possibles

1. **Supprimer les produits sans deals**
2. **Supprimer les marques sans produits**
3. **Supprimer l'historique de prix ancien** (> 30 jours)
4. **Supprimer les variantes orphelines**

### ⚠️ Précautions

Ce script modifie la base de données de manière destructive. Toujours :
1. Faire une sauvegarde avant
2. Tester en local d'abord
3. Vérifier les compteurs avant suppression

### Commandes

```bash
# Exécution avec confirmation
npx tsx src/scripts/clean-db.ts

# Mode dry-run (affiche sans supprimer)
npx tsx src/scripts/clean-db.ts --dry-run
```

---

## ☁️ Déploiement

### expire-deals

```powershell
# Contenu de deploy-expire-deals.ps1
$PROJECT_ID = "city-baddies"
$JOB_NAME = "expire-deals"
$REGION = "europe-west1"

# Build et push
docker build -f Dockerfile.expire-deals -t gcr.io/$PROJECT_ID/$JOB_NAME .
docker push gcr.io/$PROJECT_ID/$JOB_NAME

# Mise à jour du job
gcloud run jobs update $JOB_NAME `
  --image=gcr.io/$PROJECT_ID/$JOB_NAME `
  --region=$REGION `
  --memory=1Gi `
  --cpu=1 `
  --timeout=1800

# Scheduler à 07:00
gcloud scheduler jobs update http "$JOB_NAME-daily" `
  --location=$REGION `
  --schedule="0 7 * * *" `
  --time-zone="Europe/Paris"
```

### Variables d'environnement

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | URL Prisma PostgreSQL |
| `DAYS_BEFORE_DELETION` | Jours avant suppression (défaut: 7) |

---

## 📊 Métriques à surveiller

### KPIs de santé des données

| Métrique | Seuil d'alerte |
|----------|----------------|
| Deals actifs | > 100 |
| Taux d'expiration quotidien | < 20% |
| Deals sans score | = 0 |
| Produits orphelins | = 0 |

### Requêtes de monitoring

```sql
-- Nombre de deals actifs par marchand
SELECT m.name, COUNT(*) 
FROM "Deal" d 
JOIN "Product" p ON d."productId" = p.id 
JOIN "Merchant" m ON p."merchantId" = m.id 
WHERE d."isActive" = true 
GROUP BY m.name;

-- Deals expirés cette semaine
SELECT COUNT(*), DATE(d."updatedAt") as date
FROM "Deal" d
WHERE d."isExpired" = true
  AND d."updatedAt" >= NOW() - INTERVAL '7 days'
GROUP BY DATE(d."updatedAt")
ORDER BY date;

-- Score moyen par marchand
SELECT m.name, AVG(d.score) as avg_score
FROM "Deal" d
JOIN "Product" p ON d."productId" = p.id
JOIN "Merchant" m ON p."merchantId" = m.id
WHERE d."isActive" = true
GROUP BY m.name;
```

---

## 📅 Flux quotidien complet

```
05:00 ─── IMPORT ──────────────────────────────────────
         │
         ├── scrape-nocibe     (~5000 produits)
         ├── scrape-sephora    (~500 produits)
         └── scrape-marionnaud (~1500 produits)
         
07:00 ─── MAINTENANCE ─────────────────────────────────
         │
         ├── expire-deals       (marque les deals expirés)
         └── enrich-competitor-prices (prix concurrents)

08:00 ─── ENRICHISSEMENT ──────────────────────────────
         │
         ├── enrich-nocibe      (08:00)
         ├── enrich-sephora     (08:30)
         └── enrich-marionnaud  (09:00)

09:00 ─── VALIDATION ──────────────────────────────────
         │
         ├── validate-sephora   (09:00)
         └── validate-nocibe    (10:00)

         ✅ Site à jour avec données fraîches
```

---

*Documentation générée le 4 février 2026*
