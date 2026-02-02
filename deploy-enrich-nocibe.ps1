# Deploiement Cloud Run Job - Enrichissement Nocibe
$ErrorActionPreference = "Stop"

Write-Host "Deploiement Enrichissement Nocibe..." -ForegroundColor Cyan

$REGION = "europe-west1"
$PROJECT = "city-baddies"
$REGISTRY = "$REGION-docker.pkg.dev/$PROJECT/citybaddies-scrapers"
$JOB_NAME = "enrich-nocibe"

# Recuperer les secrets depuis .env
$DATABASE_URL = (Get-Content .env | Select-String "DATABASE_URL" | ForEach-Object { $_.Line -replace 'DATABASE_URL="?([^"]+)"?', '$1' })
$OPENAI_KEY = (Get-Content .env | Select-String "OPENAI_API_KEY" | ForEach-Object { $_.Line -replace 'OPENAI_API_KEY="?([^"]+)"?', '$1' })

$env:PATH = "C:\Users\nicol\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin;" + $env:PATH

Write-Host "  Build Docker..." -ForegroundColor Gray
docker build -f Dockerfile.enrich-nocibe -t "$REGISTRY/${JOB_NAME}:latest" .

Write-Host "  Push vers Artifact Registry..." -ForegroundColor Gray
docker push "$REGISTRY/${JOB_NAME}:latest"

# Verifier si le job existe
$jobExists = gcloud run jobs describe $JOB_NAME --region=$REGION 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "  Mise a jour du job existant..." -ForegroundColor Gray
    gcloud run jobs update $JOB_NAME `
        --image="$REGISTRY/${JOB_NAME}:latest" `
        --region=$REGION `
        --memory=2Gi `
        --cpu=1 `
        --task-timeout=60m `
        --max-retries=1 `
        --set-env-vars="DATABASE_URL=$DATABASE_URL,OPENAI_API_KEY=$OPENAI_KEY"
} else {
    Write-Host "  Creation du job..." -ForegroundColor Gray
    gcloud run jobs create $JOB_NAME `
        --image="$REGISTRY/${JOB_NAME}:latest" `
        --region=$REGION `
        --memory=2Gi `
        --cpu=1 `
        --task-timeout=60m `
        --max-retries=1 `
        --set-env-vars="DATABASE_URL=$DATABASE_URL,OPENAI_API_KEY=$OPENAI_KEY"
}

# Creer/mettre a jour le scheduler pour 8h tous les jours
Write-Host "  Configuration du scheduler (8h tous les jours)..." -ForegroundColor Gray
$schedulerExists = gcloud scheduler jobs describe $JOB_NAME-scheduler --location=$REGION 2>$null
if ($LASTEXITCODE -eq 0) {
    gcloud scheduler jobs update http $JOB_NAME-scheduler `
        --location=$REGION `
        --schedule="0 8 * * *" `
        --time-zone="Europe/Paris" `
        --uri="https://$REGION-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/$PROJECT/jobs/${JOB_NAME}:run" `
        --http-method=POST `
        --oauth-service-account-email="$PROJECT@appspot.gserviceaccount.com"
} else {
    gcloud scheduler jobs create http $JOB_NAME-scheduler `
        --location=$REGION `
        --schedule="0 8 * * *" `
        --time-zone="Europe/Paris" `
        --uri="https://$REGION-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/$PROJECT/jobs/${JOB_NAME}:run" `
        --http-method=POST `
        --oauth-service-account-email="$PROJECT@appspot.gserviceaccount.com"
}

Write-Host ""
Write-Host "Enrichissement Nocibe deploye!" -ForegroundColor Green
Write-Host ""
Write-Host "Commandes utiles:" -ForegroundColor Yellow
Write-Host "  - Executer maintenant: gcloud run jobs execute $JOB_NAME --region=$REGION"
Write-Host "  - Voir les logs: gcloud run jobs executions list --job=$JOB_NAME --region=$REGION"
Write-Host "  - Scheduler: gcloud scheduler jobs describe $JOB_NAME-scheduler --location=$REGION"
