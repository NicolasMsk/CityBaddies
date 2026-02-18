# Deploiement Cloud Run Job - Validation Notino (via Cloud Build)
$ErrorActionPreference = "Stop"

Write-Host "Deploiement Validation Notino..." -ForegroundColor Cyan

$REGION = "europe-west1"
$PROJECT = "city-baddies"
$REGISTRY = "$REGION-docker.pkg.dev/$PROJECT/citybaddies-scrapers"
$JOB_NAME = "validate-notino"

$env:PATH = "C:\Users\nicol\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin;" + $env:PATH

# Recuperer DATABASE_URL depuis le job scrape-sephora (meme DB)
$yamlOutput = gcloud run jobs describe scrape-sephora --region=$REGION --format=yaml 2>$null
$dbLine = ($yamlOutput | Select-String "DATABASE_URL" -Context 0,1).Context.PostContext[0]
$DATABASE_URL = ($dbLine -replace '^\s*value:\s*','').Trim()
if (-not $DATABASE_URL) {
    Write-Host "  ERREUR: Impossible de lire DATABASE_URL depuis scrape-sephora" -ForegroundColor Red
    exit 1
}
Write-Host "  DATABASE_URL recupere depuis scrape-sephora" -ForegroundColor Gray

Write-Host "  Build & Push (Cloud Build)..." -ForegroundColor Gray
gcloud builds submit --config=cloudbuild-validate-notino.yaml --substitutions=_IMAGE_TAG="$REGISTRY/${JOB_NAME}:latest" --quiet

# Verifier si le job existe deja
$ErrorActionPreference = "Continue"
$jobExists = gcloud run jobs describe $JOB_NAME --region=$REGION 2>$null
$ErrorActionPreference = "Stop"

if ($jobExists) {
    Write-Host "  Mise a jour du job existant..." -ForegroundColor Gray
    gcloud run jobs update $JOB_NAME `
        --image="$REGISTRY/${JOB_NAME}:latest" `
        --region=$REGION `
        --set-env-vars="NODE_ENV=production,DATABASE_URL=$DATABASE_URL" `
        --quiet
} else {
    Write-Host "  Creation du job..." -ForegroundColor Gray
    gcloud run jobs create $JOB_NAME `
        --image="$REGISTRY/${JOB_NAME}:latest" `
        --region=$REGION `
        --memory=2Gi `
        --cpu=1 `
        --task-timeout=60m `
        --max-retries=1 `
        --set-env-vars="NODE_ENV=production,DATABASE_URL=$DATABASE_URL" `
        --quiet
}

# Creer le scheduler SEULEMENT s'il n'existe pas
Write-Host "  Verification du scheduler..." -ForegroundColor Gray
$SCHEDULER_NAME = "$JOB_NAME-daily"
$SERVICE_ACCOUNT = "241509965456-compute@developer.gserviceaccount.com"
$ErrorActionPreference = "Continue"
$schedulerExists = gcloud scheduler jobs describe $SCHEDULER_NAME --location=$REGION 2>$null
$ErrorActionPreference = "Stop"

if ($LASTEXITCODE -eq 0) {
    Write-Host "  Scheduler existe deja - horaire conserve" -ForegroundColor Yellow
} else {
    Write-Host "  Creation du scheduler (8h tous les jours)..." -ForegroundColor Gray
    gcloud scheduler jobs create http $SCHEDULER_NAME `
        --location=$REGION `
        --schedule="0 8 * * *" `
        --time-zone="Europe/Paris" `
        --uri="https://$REGION-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/$PROJECT/jobs/${JOB_NAME}:run" `
        --http-method=POST `
        --oauth-service-account-email="$SERVICE_ACCOUNT"
}

Write-Host ""
Write-Host "Validation Notino deploye!" -ForegroundColor Green
Write-Host ""
Write-Host "Commandes utiles:" -ForegroundColor Yellow
Write-Host "  - Executer maintenant: gcloud run jobs execute $JOB_NAME --region=$REGION"
Write-Host "  - Voir les logs: gcloud run jobs executions list --job=$JOB_NAME --region=$REGION"

