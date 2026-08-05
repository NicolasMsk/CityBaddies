# 📲 Activer le dépôt automatique en brouillon TikTok

Le code est prêt. Il reste **3 étapes à faire une seule fois** (moi je ne peux pas :
ça demande TON compte TikTok). Ensuite, chaque matin la vidéo arrive toute seule
dans tes **brouillons TikTok** — tu ouvres l'app, ajoutes un son tendance, tu postes.

---

## 1. Créer une app sur le portail développeur TikTok
1. Va sur **developers.tiktok.com** → connecte-toi avec ton compte TikTok → **Manage apps** → **Create app**.
2. Dans l'app :
   - Ajoute le produit **« Content Posting API »**.
   - Active le scope **`video.upload`**.
   - Dans **Redirect URI**, ajoute EXACTEMENT : `http://localhost:4567/callback`
   - Ajoute ton compte TikTok comme **Target User** (mode Sandbox) — ça suffit pour un usage perso, pas besoin de l'audit public.
3. Note le **Client key** et le **Client secret**.

## 2. Obtenir le refresh token (une fois)
Dans `.env` (local), ajoute :
```
TIKTOK_CLIENT_KEY=xxx
TIKTOK_CLIENT_SECRET=xxx
```
Puis lance :
```
npx tsx src/scripts/studio/tiktok-auth.ts
```
- Ouvre l'URL affichée, autorise l'accès avec **ton compte TikTok**.
- Le script affiche un **`TIKTOK_REFRESH_TOKEN`** → copie-le.

## 3. Ajouter les 3 secrets sur GitHub
Repo → **Settings → Secrets and variables → Actions → New repository secret** :
- `TIKTOK_CLIENT_KEY`
- `TIKTOK_CLIENT_SECRET`
- `TIKTOK_REFRESH_TOKEN`

C'est tout. Dès que ces 3 secrets existent, le cron quotidien **dépose la vidéo en
brouillon TikTok** en plus de l'email. S'ils sont absents, l'étape est simplement
sautée (aucune erreur).

---

## Tester tout de suite (en local)
```
npx tsx src/scripts/studio/make-video.ts --no-email    # dépose juste le brouillon TikTok
```
Puis ouvre l'app TikTok → **Brouillons / Boîte de réception** : la vidéo doit y être.

## Bon à savoir
- **Le son** : l'API ne peut PAS ajouter de son tendance (limite TikTok). C'est
  pour ça qu'on dépose en **brouillon** : tu ajoutes le son dans l'app (le vrai
  levier de reach) puis tu publies. ~30 s, zéro réflexion.
- **Le refresh token** dure ~365 jours ; il se renouvelle à chaque usage. Si un
  jour le dépôt échoue avec une erreur de token, relance l'étape 2.
- Pour désactiver ponctuellement : ajoute `--no-tiktok` à la commande.
