# Deploiement Cloud Run Job - Scoring LLM des deals (via Cloud Build)
$ErrorActionPreference = "Stop"

Write-Host "Deploiement Score Deals (LLM)..." -ForegroundColor Cyan

$REGION = "europe-west1"
$PROJECT = "city-baddies"
$REGISTRY = "$REGION-docker.pkg.dev/$PROJECT/citybaddies-scrapers"
$JOB_NAME = "score-deals"

# Recuperer les secrets depuis .env (avec Trim pour eviter les espaces)
$envContent = Get-Content .env -Raw
if ($envContent -match 'DATABASE_URL="([^"]+)"') { $DATABASE_URL = $matches[1].Trim() }
if ($envContent -match 'OPENAI_API_KEY="?([^"\s]+)"?') { $OPENAI_KEY = $matches[1].Trim() }

$env:PATH = "C:\Users\nicol\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin;" + $env:PATH

Write-Host "  Build & Push (Cloud Build)..." -ForegroundColor Gray
gcloud builds submit --config=cloudbuild-score-deals.yaml --substitutions=_IMAGE_TAG="$REGISTRY/${JOB_NAME}:latest"

# Verifier si le job existe
$ErrorActionPreference = "Continue"
$jobExists = gcloud run jobs describe $JOB_NAME --region=$REGION 2>$null
$ErrorActionPreference = "Stop"
if ($LASTEXITCODE -eq 0) {
    Write-Host "  Mise a jour du job existant..." -ForegroundColor Gray
    gcloud run jobs update $JOB_NAME `
        --image="$REGISTRY/${JOB_NAME}:latest" `
        --region=$REGION `
        --memory=1Gi `
        --task-timeout=1800 `
        --set-env-vars="DATABASE_URL=$DATABASE_URL,OPENAI_API_KEY=$OPENAI_KEY"
} else {
    Write-Host "  Creation du job..." -ForegroundColor Gray
    gcloud run jobs create $JOB_NAME `
        --image="$REGISTRY/${JOB_NAME}:latest" `
        --region=$REGION `
        --memory=1Gi `
        --task-timeout=1800 `
        --set-env-vars="DATABASE_URL=$DATABASE_URL,OPENAI_API_KEY=$OPENAI_KEY"
}

# Creer le scheduler SEULEMENT s'il n'existe pas
Write-Host "  Verification du scheduler..." -ForegroundColor Gray
$ErrorActionPreference = "Continue"
$schedulerExists = gcloud scheduler jobs describe $JOB_NAME-daily --location=$REGION 2>$null
$ErrorActionPreference = "Stop"
if ($LASTEXITCODE -eq 0) {
    Write-Host "  Scheduler existe deja - horaire conserve" -ForegroundColor Yellow
} else {
    # Apres les scrapers (7h) et les validators (~7h30), scoring a 9h
    Write-Host "  Creation du scheduler (9h tous les jours)..." -ForegroundColor Gray
    gcloud scheduler jobs create http $JOB_NAME-daily `
        --location=$REGION `
        --schedule="0 9 * * *" `
        --time-zone="Europe/Paris" `
        --uri="https://$REGION-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/$PROJECT/jobs/${JOB_NAME}:run" `
        --http-method=POST `
        --oauth-service-account-email="$PROJECT@appspot.gserviceaccount.com"
}

Write-Host ""
Write-Host "Score Deals deploye!" -ForegroundColor Green
Write-Host ""
Write-Host "Pipeline quotidien:" -ForegroundColor Yellow
Write-Host "  7h00 - Scrapers (import sephora/nocibe/marionnaud)" -ForegroundColor Gray
Write-Host "  7h00 - Validators (validate sephora/nocibe/marionnaud)" -ForegroundColor Gray
Write-Host "  9h00 - Score Deals (scoring LLM + auto-expire < 6)" -ForegroundColor Gray
Write-Host ""
Write-Host "Commandes utiles:" -ForegroundColor Yellow
Write-Host "  - Executer maintenant: gcloud run jobs execute $JOB_NAME --region=$REGION"
Write-Host "  - Voir les logs: gcloud run jobs executions list --job=$JOB_NAME --region=$REGION"
Write-Host "  - Scheduler: gcloud scheduler jobs describe $JOB_NAME-daily --location=$REGION"
