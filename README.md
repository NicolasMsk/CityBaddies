# 🏋️ DealFit - Fitness Deals Aggregator

**La référence française pour les promotions sur l'équipement de fitness et musculation.**

![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38bdf8?style=flat-square&logo=tailwindcss)
![Prisma](https://img.shields.io/badge/Prisma-5-2D3748?style=flat-square&logo=prisma)
![Playwright](https://img.shields.io/badge/Playwright-1.49-45ba4b?style=flat-square&logo=playwright)

---

## 📋 Table des matières

- [Fonctionnalités](#-fonctionnalités)
- [Stack Technique](#-stack-technique)
- [Installation](#️-installation)
- [Scripts disponibles](#-scripts-disponibles)
- [Structure du projet](#-structure-du-projet)
- [API Endpoints](#-api-endpoints)
- [Journal de développement](#-journal-de-développement-changelog)

---

## 🚀 Fonctionnalités

- ✅ **Scraping automatique** - Récupération des produits Decathlon avec Playwright + Stealth
- ✅ **Détection de deals** - Agrégation automatique des meilleures promotions fitness
- ✅ **Historique des prix** - Suivi des prix pour chaque produit
- ✅ **Filtres avancés** - Par catégorie, marchand, % de réduction (dropdowns custom)
- ✅ **Hot Deals** - Mise en avant des meilleures offres
- ✅ **Système de votes** - La communauté note les deals
- ✅ **Design responsive** - Optimisé mobile et desktop avec thème dark
- ✅ **Icônes Lucide** - Système d'icônes dynamiques par catégorie
- 🔜 **Alertes de prix** - Notification quand un prix cible est atteint
- 🔜 **Multi-marchands** - Amazon, Fitness Boutique, etc.

---

## 📦 Stack Technique

| Technologie | Usage |
|-------------|-------|
| **Next.js 15** | Framework React avec App Router + Turbopack |
| **TypeScript** | Typage statique |
| **Tailwind CSS 4** | Styling utilitaire |
| **Prisma** | ORM pour la base de données |
| **SQLite** | Base de données (POC) |
| **Playwright** | Scraping web headless |
| **playwright-extra** | Plugin stealth anti-détection |
| **Recharts** | Graphiques de prix |
| **Lucide React** | Icônes |
| **date-fns** | Manipulation des dates |

---

## 🛠️ Installation

### Prérequis

- Node.js 20.19+ (recommandé: 22+)
- npm ou yarn

### 1. Cloner et installer

```bash
cd fitness-deals
npm install
```

### 2. Configuration de l'environnement

Le fichier `.env` est déjà créé avec la configuration SQLite par défaut:

```env
DATABASE_URL="file:./dev.db"
```

### 3. Initialiser la base de données

```bash
npx prisma db push
```

### 4. Lancer le serveur de développement

```bash
npm run dev
```

### 5. Initialiser les données de démo

Ouvrez votre navigateur et visitez:
```
http://localhost:3000/api/seed
```

Cela va créer:
- 8 catégories fitness
- 4 marchands (Decathlon, Fitness Boutique, Amazon, Gorilla Sports)
- 12 produits avec historique de prix
- Deals avec votes et statistiques

### 6. Profiter de l'app ! 🎉

Visitez `http://localhost:3000`

## 📂 Structure du Projet

```
fitness-deals/
├── prisma/
│   └── schema.prisma      # Schéma de la base de données
├── src/
│   ├── app/
│   │   ├── api/           # Routes API
│   │   │   ├── deals/     # CRUD deals
│   │   │   ├── products/  # CRUD produits
│   │   │   ├── categories/# Liste catégories
│   │   │   └── seed/      # Initialisation BDD
│   │   ├── deals/         # Pages deals
│   │   ├── categories/    # Page catégories
│   │   ├── layout.tsx     # Layout principal
│   │   └── page.tsx       # Page d'accueil
│   ├── components/
│   │   ├── deals/         # Composants deals
│   │   ├── categories/    # Composants catégories
│   │   └── layout/        # Header, Footer
│   ├── lib/
│   │   ├── prisma.ts      # Client Prisma
│   │   └── scraping/      # Logique de scraping
│   └── types/
│       └── index.ts       # Types TypeScript
└── package.json
```

## 🔌 API Endpoints

| Endpoint | Méthode | Description |
|----------|---------|-------------|
| `/api/deals` | GET | Liste des deals avec filtres |
| `/api/deals/[id]` | GET | Détail d'un deal |
| `/api/deals/[id]` | POST | Voter sur un deal |
| `/api/products` | GET | Liste des produits |
| `/api/products/[slug]` | GET | Détail d'un produit avec historique |
| `/api/categories` | GET | Liste des catégories |
| `/api/seed` | GET | Initialiser les données de démo |

### Paramètres de filtrage (GET /api/deals)

| Paramètre | Type | Description |
|-----------|------|-------------|
| `category` | string | Slug de la catégorie |
| `merchant` | string | Slug du marchand |
| `search` | string | Recherche textuelle |
| `sortBy` | string | `createdAt`, `discountPercent`, `votes`, `dealPrice` |
| `sortOrder` | string | `asc` ou `desc` |
| `hotOnly` | boolean | Filtrer les hot deals uniquement |
| `page` | number | Numéro de page |
| `limit` | number | Nombre de résultats par page |

## 🔧 Ce que VOUS devez faire

### Pour le POC (gratuit)

1. **Rien !** Le POC fonctionne out-of-the-box avec SQLite.

### Pour la production (évolutions)

#### 1. Base de données

Remplacez SQLite par PostgreSQL (gratuit sur Supabase, Neon, etc.):

```env
# .env
DATABASE_URL="postgresql://user:password@host:5432/dbname"
```

Modifiez `prisma/schema.prisma`:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

#### 2. Scraping réel

Pour implémenter le scraping des vrais sites:

- **Decathlon**: API publique disponible
- **Amazon**: Utilisez l'API Product Advertising
- **Autres**: Cheerio + Puppeteer pour le scraping HTML

⚠️ **Attention**: Respectez les conditions d'utilisation et les robots.txt

#### 3. Alertes email

Intégrez un service d'email:
- **Resend** (gratuit jusqu'à 3000 emails/mois)
- **SendGrid** (gratuit jusqu'à 100 emails/jour)

#### 4. Hébergement

Options gratuites/pas chères:
- **Vercel** - Parfait pour Next.js (gratuit)
- **Railway** - Backend + BDD (5$/mois)
- **Supabase** - PostgreSQL gratuit

## 📈 Évolutions Futures

- [ ] Système d'authentification utilisateur
- [ ] Alertes de prix personnalisées
- [ ] Comparateur multi-marchands
- [ ] Extension navigateur
- [ ] Application mobile (React Native)
- [ ] Scraping automatique avec CRON
- [ ] Dashboard admin
- [ ] Système d'affiliation

## 🎨 Design

Le design utilise:
- Thème dark moderne
- Gradients orange/pink/purple
- Glassmorphism
- Animations subtiles
- Responsive mobile-first

## 📝 Licence

MIT License - Utilisez comme vous voulez !

---

Fait avec 💪 pour les passionnés de fitness

---

## 📝 Journal de développement (Changelog)

Ce journal documente toutes les modifications apportées au projet par l'assistant IA.

---

### 📅 10 Décembre 2025 - Session principale

#### 🔧 Infrastructure de Scraping

**Fichier créé : `src/lib/scraping/decathlon.ts`**
- Classe `DecathlonScraper` complète avec Playwright
- Méthodes :
  - `scrapeSearch(query, maxProducts)` - Recherche de produits
  - `scrapeCategoryPage(url, maxProducts)` - Scrape une page catégorie
  - `scrapeProductPage(url)` - Détails d'un produit individuel
- Options configurables : `headless`, `delayBetweenRequests`
- Gestion des cookies RGPD automatique
- Extraction : nom, prix actuel, prix barré, % réduction, image, URL

**Problème rencontré** : Le mode headless était bloqué par Cloudflare/Decathlon
**Solution** : Intégration de `playwright-extra` avec `puppeteer-extra-plugin-stealth`

```typescript
// Utilisation du stealth plugin pour éviter la détection
import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
chromium.use(StealthPlugin());
```

**Packages installés** :
```bash
npm install playwright playwright-extra puppeteer-extra-plugin-stealth
```

---

#### 📥 Script d'import Decathlon

**Fichier créé : `src/scripts/import-decathlon.ts`**
- Import automatique des produits Decathlon dans la BDD
- Crée le merchant "Decathlon" s'il n'existe pas
- Crée la catégorie "Musculation" par défaut
- Gère les doublons (mise à jour si produit existe déjà)
- Crée l'historique des prix à chaque import
- Crée un Deal uniquement si le produit a une réduction > 0

**Pages catégories scrapées** (7 pages, 20 produits max chacune) :
1. `appareils-de-fitness`
2. `poids-et-equipements`
3. `accessoires-de-fitness`
4. `tenue-de-fitness-femme`
5. `tenue-de-fitness-homme`
6. `nutrition-sportive`
7. `collections-specifiques`

**Commande** : `npx tsx src/scripts/import-decathlon.ts`

**Résultat** : 109 produits scrapés, 83 créés, 26 mis à jour, 66 deals créés

---

#### 🧹 Nettoyage des données

**Fichier créé : `src/scripts/clean-fake-data.ts`**
- Supprime tous les produits qui ne viennent pas de Decathlon
- Supprime les deals orphelins
- Supprime l'historique de prix orphelin
- Utilisé pour retirer les données de test/seed

**Commande** : `npx tsx src/scripts/clean-fake-data.ts`

---

#### 🎨 Migration des icônes (Emojis → Lucide)

**Fichier créé : `src/scripts/update-icons.ts`**
- Met à jour les icônes des catégories dans la BDD
- Remplace les emojis par des noms d'icônes Lucide

**Mapping des icônes** :
| Catégorie | Ancienne (emoji) | Nouvelle (Lucide) |
|-----------|------------------|-------------------|
| Musculation | 💪 | Dumbbell |
| Cardio | 🏃 | Activity |
| Yoga | 🧘 | PersonStanding |
| Accessoires | 🎽 | Trophy |
| Nutrition | 🥗 | Apple |
| Vêtements | 👕 | Shirt |
| Récupération | 🧊 | Snowflake |
| Électronique | ⌚ | Watch |

**Fichier créé : `src/components/ui/CategoryIcon.tsx`**
- Composant React pour afficher dynamiquement les icônes Lucide
- Props : `iconName`, `size`, `className`
- Fallback sur `HelpCircle` si icône inconnue

```tsx
<CategoryIcon iconName="Dumbbell" size={24} className="text-orange-500" />
```

**Fichiers modifiés** :
- `src/components/deals/DealCard.tsx` - Utilise `CategoryIcon`
- `src/components/categories/CategoryCard.tsx` - Utilise `CategoryIcon`

---

#### 🎯 Refonte des filtres (Dropdowns custom)

**Fichier modifié : `src/components/deals/DealFilters.tsx`**

**Problème** : Les `<select>` natifs ne supportent pas les icônes et ont un style limité

**Solution** : Création d'un composant `CustomDropdown` from scratch

**Caractéristiques** :
- Dropdown avec animation d'ouverture/fermeture
- Icônes Lucide dans les options
- Checkmark sur l'option sélectionnée
- Hover effects
- Fermeture au clic extérieur
- Support clavier (Escape pour fermer)
- Style cohérent avec le thème dark

---

#### 🔗 API de redirection (bypass Cloudflare)

**Fichier créé : `src/app/api/redirect/route.ts`**

**Problème** : Les liens directs vers Decathlon retournaient une erreur 500 (Cloudflare)

**Solution** : Page intermédiaire avec redirection JavaScript

```typescript
// Retourne une page HTML qui redirige après 500ms
// Le délai permet de passer les vérifications Cloudflare
```

**Usage** : `/api/redirect?url=https://www.decathlon.fr/...`

---

#### ⚙️ Configuration Next.js

**Fichier modifié : `next.config.ts`**
- Ajout de `contents.mediadecathlon.com` aux `remotePatterns` pour les images

```typescript
images: {
  remotePatterns: [
    { hostname: 'contents.mediadecathlon.com' },
    // ... autres domaines
  ]
}
```

---

### 📊 État actuel de la base de données

| Table | Nombre d'entrées |
|-------|------------------|
| Products | ~109 |
| Deals | ~66 |
| PriceHistory | ~109+ |
| Categories | 8 |
| Merchants | 1 (Decathlon) |

---

### 🚀 Prochaines étapes suggérées

- [ ] Ajouter plus de marchands (Amazon, Fitness Boutique)
- [ ] Mettre en place un CRON pour le scraping automatique
- [ ] Créer des graphiques d'historique de prix (Recharts)
- [ ] Système d'alertes de prix par email
- [ ] Déploiement sur Vercel + migration PostgreSQL
- [ ] Ajouter l'authentification utilisateur

---

### 📁 Fichiers créés/modifiés (résumé)

```
src/
├── lib/
│   └── scraping/
│       └── decathlon.ts          ✨ CRÉÉ - Scraper Decathlon
├── scripts/
│   ├── import-decathlon.ts       ✨ CRÉÉ - Import BDD
│   ├── clean-fake-data.ts        ✨ CRÉÉ - Nettoyage
│   └── update-icons.ts           ✨ CRÉÉ - Migration icônes
├── components/
│   ├── ui/
│   │   └── CategoryIcon.tsx      ✨ CRÉÉ - Icônes dynamiques
│   ├── deals/
│   │   ├── DealCard.tsx          📝 MODIFIÉ - CategoryIcon
│   │   └── DealFilters.tsx       📝 MODIFIÉ - Custom dropdowns
│   └── categories/
│       └── CategoryCard.tsx      📝 MODIFIÉ - CategoryIcon
├── app/
│   └── api/
│       └── redirect/
│           └── route.ts          ✨ CRÉÉ - Redirect API
next.config.ts                    📝 MODIFIÉ - Image domains
package.json                      📝 MODIFIÉ - Dépendances scraping
```

---

## 📝 Licence

MIT License - Utilisez comme vous voulez !
