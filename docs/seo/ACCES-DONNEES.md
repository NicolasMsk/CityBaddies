# Accès aux données SEO / Analytics — CityBaddies

Fiche de référence. Tout ce qu'il faut pour re-tirer les données sans rien rechercher.

## Identifiants

| Quoi | Valeur |
|---|---|
| **GA4 — ID de propriété** | **`521392484`** (nom affiché : « City Baddies ») |
| GA4 — ID de mesure | `G-LWMBWRFKF2` (en dur dans `src/components/analytics/GoogleAnalytics.tsx`) |
| GA4 — endpoint API Data | `POST https://analyticsdata.googleapis.com/v1beta/properties/521392484:runReport` |
| **Search Console — propriété** | **`sc-domain:citybaddies.com`** (permission `siteOwner`) |
| Search Console — endpoint | `POST https://www.googleapis.com/webmasters/v3/sites/sc-domain%3Acitybaddies.com/searchAnalytics/query` |
| Projet GCP du client OAuth | `582668706428` |

## Token OAuth

Fichier : `C:/Users/nmusicki/Downloads/token_seo.json`
Créé le 2026-08-06. Scopes : `webmasters.readonly` + `analytics.readonly`.
Contient `client_id`, `client_secret`, `refresh_token`.

Échange refresh → access token :

```
POST https://oauth2.googleapis.com/token
Content-Type: application/x-www-form-urlencoded
client_id=…&client_secret=…&refresh_token=…&grant_type=refresh_token
```

## Pièges connus

- **L'app OAuth est en mode *Testing*** : Google révoque tout refresh token après ~7 jours d'inactivité. Si tu reçois `{"error":"invalid_grant"}`, il n'y a rien à débuguer dans le code — il faut relancer un consentement (script `reauth.mjs`, boucle localhost sur le port 8731, scopes ci-dessus, `access_type=offline` + `prompt=consent`). Publier l'app en mode *Production* dans la console OAuth supprimerait ce problème.
- **L'Analytics Admin API est désactivée** dans le projet `582668706428`. C'est elle qui liste les propriétés — donc l'ID `521392484` n'est **pas** découvrable par API. D'où cette fiche. Pour l'activer : `https://console.developers.google.com/apis/api/analyticsadmin.googleapis.com/overview?project=582668706428`
- Les anciens `Downloads/token_gsc.json` et `Downloads/token_ga4.json` (nov. 2025) sont morts. Ne pas les réutiliser.
- GSC a un décalage de 2-3 jours sur les données récentes. Utiliser `dataState: 'final'` pour les totaux.
- GSC anonymise les requêtes à faible volume : sur août 2026, 1 618 impressions sur 2 672 et 19 clics sur 21 sont dans des requêtes masquées. Les sommes par requête ne recollent jamais au total.

## Rapports produits

- [2026-08-06-rapport-seo-gsc.md](2026-08-06-rapport-seo-gsc.md) — premier rapport complet (GSC + GA4)
