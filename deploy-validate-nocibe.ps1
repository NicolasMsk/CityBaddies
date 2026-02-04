# Deploiement Cloud Run Job - Validation Nocibe (via Cloud Build)
$ErrorActionPreference = "Stop"

Write-Host "Deploiement Validation Nocibe..." -ForegroundColor Cyan

$REGION = "europe-west1"
$PROJECT = "city-baddies"
$REGISTRY = "$REGION-docker.pkg.dev/$PROJECT/citybaddies-scrapers"
$JOB_NAME = "validate-nocibe"

# Recuperer les secrets depuis .env (avec Trim pour eviter les espaces)
$envContent = Get-Content .env -Raw
if ($envContent -match 'DATABASE_URL="([^"]+)"') { $DATABASE_URL = $matches[1].Trim() }

$env:PATH = "C:\Users\nicol\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin;" + $env:PATH

Write-Host "  Build & Push (Cloud Build)..." -ForegroundColor Gray
gcloud builds submit --config=cloudbuild-validate-nocibe.yaml --substitutions=_IMAGE_TAG="$REGISTRY/${JOB_NAME}:latest"

# Verifier si le job existe
$jobExists = gcloud run jobs describe $JOB_NAME --region=$REGION 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "  Mise a jour du job existant..." -ForegroundColor Gray
    gcloud run jobs update $JOB_NAME `
        --image="$REGISTRY/${JOB_NAME}:latest" `
        --region=$REGION `
        --memory=512Mi `
        --cpu=1 `
        --task-timeout=30m `
        --max-retries=1 `
        --set-env-vars="DATABASE_URL=$DATABASE_URL"
} else {
    Write-Host "  Creation du job..." -ForegroundColor Gray
    gcloud run jobs create $JOB_NAME `
        --image="$REGISTRY/${JOB_NAME}:latest" `
        --region=$REGION `
        --memory=512Mi `
        --cpu=1 `
        --task-timeout=30m `
        --max-retries=1 `
        --set-env-vars="DATABASE_URL=$DATABASE_URL"
}

# Creer/mettre a jour le scheduler pour 10h tous les jours (1h apres Sephora)
Write-Host "  Configuration du scheduler (10h tous les jours)..." -ForegroundColor Gray
$SCHEDULER_NAME = "$JOB_NAME-daily"
$SERVICE_ACCOUNT = "241509965456-compute@developer.gserviceaccount.com"
$schedulerExists = gcloud scheduler jobs describe $SCHEDULER_NAME --location=$REGION 2>$null
if ($LASTEXITCODE -eq 0) {
    gcloud scheduler jobs update http $SCHEDULER_NAME `
        --location=$REGION `
        --schedule="0 10 * * *" `
        --time-zone="Europe/Paris" `
        --uri="https://$REGION-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/$PROJECT/jobs/${JOB_NAME}:run" `
        --http-method=POST `
        --oauth-service-account-email="$SERVICE_ACCOUNT"
} else {
    gcloud scheduler jobs create http $SCHEDULER_NAME `
        --location=$REGION `
        --schedule="0 10 * * *" `
        --time-zone="Europe/Paris" `
        --uri="https://$REGION-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/$PROJECT/jobs/${JOB_NAME}:run" `
        --http-method=POST `
        --oauth-service-account-email="$SERVICE_ACCOUNT"
}

Write-Host ""
Write-Host "Validation Nocibe deploye!" -ForegroundColor Green
Write-Host ""
Write-Host "Commandes utiles:" -ForegroundColor Yellow
Write-Host "  - Executer maintenant: gcloud run jobs execute $JOB_NAME --region=$REGION"
Write-Host "  - Voir les logs: gcloud run jobs executions list --job=$JOB_NAME --region=$REGION"
Write-Host "  - Scheduler: gcloud scheduler jobs describe $JOB_NAME-scheduler --location=$REGION"
