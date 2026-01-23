# 🚀 Guide de déploiement Google Cloud Run Jobs
# Pour City Baddies - Scraping Sephora & Nocibé

## Prérequis

1. Installer Google Cloud CLI : https://cloud.google.com/sdk/docs/install
2. Se connecter : `gcloud auth login`
3. Créer un projet (si pas déjà fait)

---

## Étape 1 : Configuration initiale

```bash
# Définir votre projet (remplacez par votre ID de projet)
gcloud config set project VOTRE_PROJECT_ID

# Activer les APIs nécessaires
gcloud services enable run.googleapis.com
gcloud services enable artifactregistry.googleapis.com
gcloud services enable cloudscheduler.googleapis.com

# Créer un repository Artifact Registry pour les images Docker
gcloud artifacts repositories create citybaddies-scrapers \
    --repository-format=docker \
    --location=europe-west1 \
    --description="Images Docker pour les scrapers City Baddies"

# Configurer Docker pour push vers Artifact Registry
gcloud auth configure-docker europe-west1-docker.pkg.dev
```

---

## Étape 2 : Build et Push des images Docker

```bash
# Depuis le dossier du projet

# Build image Sephora
docker build -f Dockerfile.sephora -t europe-west1-docker.pkg.dev/VOTRE_PROJECT_ID/citybaddies-scrapers/scrape-sephora:latest .

# Build image Nocibé
docker build -f Dockerfile.nocibe -t europe-west1-docker.pkg.dev/VOTRE_PROJECT_ID/citybaddies-scrapers/scrape-nocibe:latest .

# Push les images
docker push europe-west1-docker.pkg.dev/VOTRE_PROJECT_ID/citybaddies-scrapers/scrape-sephora:latest
docker push europe-west1-docker.pkg.dev/VOTRE_PROJECT_ID/citybaddies-scrapers/scrape-nocibe:latest
```

---

## Étape 3 : Créer les Cloud Run Jobs

```bash
# Job Sephora
gcloud run jobs create scrape-sephora \
    --image=europe-west1-docker.pkg.dev/VOTRE_PROJECT_ID/citybaddies-scrapers/scrape-sephora:latest \
    --region=europe-west1 \
    --memory=2Gi \
    --cpu=2 \
    --max-retries=1 \
    --task-timeout=30m \
    --set-env-vars="DATABASE_URL=postgresql://postgres:A9%21fQ7%40Zr%23L2xM%24P8K%25vE@db.vehgwkgceocqcyakwxsc.supabase.co:5432/postgres" \
    --set-env-vars="OPENAI_API_KEY=VOTRE_OPENAI_API_KEY" \
    --set-env-vars="SERPER_API_KEY=VOTRE_SERPER_API_KEY"

# Job Nocibé
gcloud run jobs create scrape-nocibe \
    --image=europe-west1-docker.pkg.dev/VOTRE_PROJECT_ID/citybaddies-scrapers/scrape-nocibe:latest \
    --region=europe-west1 \
    --memory=1Gi \
    --cpu=1 \
    --max-retries=1 \
    --task-timeout=20m \
    --set-env-vars="DATABASE_URL=postgresql://postgres:A9%21fQ7%40Zr%23L2xM%24P8K%25vE@db.vehgwkgceocqcyakwxsc.supabase.co:5432/postgres" \
    --set-env-vars="OPENAI_API_KEY=VOTRE_OPENAI_API_KEY"
```

---

## Étape 4 : Créer les schedulers (Cron)

```bash
# Scheduler pour Sephora - Tous les jours à 6h00 (heure de Paris)
gcloud scheduler jobs create http scrape-sephora-daily \
    --location=europe-west1 \
    --schedule="0 6 * * *" \
    --time-zone="Europe/Paris" \
    --uri="https://europe-west1-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/VOTRE_PROJECT_ID/jobs/scrape-sephora:run" \
    --http-method=POST \
    --oauth-service-account-email=VOTRE_PROJECT_NUMBER-compute@developer.gserviceaccount.com

# Scheduler pour Nocibé - Tous les jours à 7h00 (heure de Paris)
gcloud scheduler jobs create http scrape-nocibe-daily \
    --location=europe-west1 \
    --schedule="0 7 * * *" \
    --time-zone="Europe/Paris" \
    --uri="https://europe-west1-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/VOTRE_PROJECT_ID/jobs/scrape-nocibe:run" \
    --http-method=POST \
    --oauth-service-account-email=VOTRE_PROJECT_NUMBER-compute@developer.gserviceaccount.com
```

---

## Étape 5 : Tester les jobs manuellement

```bash
# Lancer le job Sephora
gcloud run jobs execute scrape-sephora --region=europe-west1

# Lancer le job Nocibé  
gcloud run jobs execute scrape-nocibe --region=europe-west1

# Voir les logs
gcloud run jobs executions logs scrape-sephora --region=europe-west1
gcloud run jobs executions logs scrape-nocibe --region=europe-west1
```

---

## 📝 Notes importantes

1. **Remplacer les valeurs** :
   - `VOTRE_PROJECT_ID` : L'ID de votre projet Google Cloud
   - `VOTRE_PROJECT_NUMBER` : Le numéro de votre projet (visible dans la console)
   - `VOTRE_OPENAI_API_KEY` : Votre clé API OpenAI
   - `VOTRE_SERPER_API_KEY` : Votre clé API Serper (pour la recherche concurrente)

2. **Sécurité** : Pour les secrets sensibles, utilisez Secret Manager :
   ```bash
   # Créer un secret
   echo -n "votre-api-key" | gcloud secrets create openai-api-key --data-file=-
   
   # Utiliser le secret dans le job
   --set-secrets="OPENAI_API_KEY=openai-api-key:latest"
   ```

3. **Coûts estimés** :
   - Cloud Run Jobs : ~$0.00002400/vCPU-seconde + ~$0.00000250/GiB-seconde
   - Pour 2 jobs de 15-20 min/jour : ~$5-10/mois

4. **Monitoring** :
   - Console Cloud Run : https://console.cloud.google.com/run/jobs
   - Logs : https://console.cloud.google.com/logs
