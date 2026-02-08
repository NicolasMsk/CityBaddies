# Deploiement Cloud Run Job - Rafraichissement Guides d'Achat (via Cloud Build)
# Usage: .\deploy-refresh-guides.ps1
# Schedule: 08h05 (apres generate-guide a 08h00)

$ErrorActionPreference = "Stop"

Write-Host "Deploiement Refresh Buying Guides..." -ForegroundColor Cyan

$REGION = "europe-west1"
$PROJECT = "city-baddies"
$REGISTRY = "$REGION-docker.pkg.dev/$PROJECT/citybaddies-scrapers"
$JOB_NAME = "refresh-buying-guides"

# Recuperer les secrets depuis .env
$envContent = Get-Content .env -Raw
if ($envContent -match 'DATABASE_URL="([^"]+)"') { $DATABASE_URL = $matches[1].Trim() }
if ($envContent -match 'OPENAI_API_KEY="?([^"\s]+)"?') { $OPENAI_KEY = $matches[1].Trim() }

$env:PATH = "C:\Users\nicol\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin;" + $env:PATH

Write-Host "  Build & Push (Cloud Build)..." -ForegroundColor Gray
gcloud builds submit --config=cloudbuild-refresh-guides.yaml --substitutions=_IMAGE_TAG="$REGISTRY/${JOB_NAME}:latest"

# Verifier si le job existe
$jobExists = gcloud run jobs describe $JOB_NAME --region=$REGION 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "  Mise a jour du job existant..." -ForegroundColor Gray
    gcloud run jobs update $JOB_NAME `
        --image="$REGISTRY/${JOB_NAME}:latest" `
        --region=$REGION `
        --memory=512Mi `
        --task-timeout=600s `
        --set-env-vars="DATABASE_URL=$DATABASE_URL,OPENAI_API_KEY=$OPENAI_KEY"
} else {
    Write-Host "  Creation du job..." -ForegroundColor Gray
    gcloud run jobs create $JOB_NAME `
        --image="$REGISTRY/${JOB_NAME}:latest" `
        --region=$REGION `
        --memory=512Mi `
        --task-timeout=600s `
        --set-env-vars="DATABASE_URL=$DATABASE_URL,OPENAI_API_KEY=$OPENAI_KEY"
}

# Creer le scheduler SEULEMENT s'il n'existe pas
Write-Host "  Verification du scheduler..." -ForegroundColor Gray
$schedulerExists = gcloud scheduler jobs describe $JOB_NAME-daily --location=$REGION 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "  Scheduler existe deja - horaire conserve" -ForegroundColor Yellow
} else {
    Write-Host "  Creation du scheduler (08h05 tous les jours)..." -ForegroundColor Gray
    gcloud scheduler jobs create http $JOB_NAME-daily `
        --location=$REGION `
        --schedule="5 8 * * *" `
        --time-zone="Europe/Paris" `
        --uri="https://$REGION-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/$PROJECT/jobs/${JOB_NAME}:run" `
        --http-method=POST `
        --oauth-service-account-email="$PROJECT@appspot.gserviceaccount.com"
}

Write-Host ""
Write-Host "Deploy termine avec succes!" -ForegroundColor Green
Write-Host "  Schedule: tous les jours a 08:30 (apres expiration deals + generation guides)" -ForegroundColor Gray
Write-Host "  Run manuel: gcloud run jobs execute $JOB_NAME --region=$REGION" -ForegroundColor Gray
