# Deploiement Cloud Run Job - Monitoring Daily (via Cloud Build)
$ErrorActionPreference = "Stop"

Write-Host "Deploiement Monitoring Daily..." -ForegroundColor Cyan

$REGION = "europe-west1"
$PROJECT = "city-baddies"
$REGISTRY = "$REGION-docker.pkg.dev/$PROJECT/citybaddies-scrapers"
$JOB_NAME = "monitoring-daily"

# Recuperer les secrets depuis .env (avec Trim pour eviter les espaces)
$envContent = Get-Content .env -Raw
if ($envContent -match 'DATABASE_URL="([^"]+)"') { $DATABASE_URL = $matches[1].Trim() }
if ($envContent -match 'GOOGLE_SHEETS_CREDENTIALS=(.+)') { 
    # Credentials JSON sur une seule ligne
    $GOOGLE_SHEETS_CREDENTIALS = $matches[1].Trim()
    # Supprimer les guillemets entourants si présents
    $GOOGLE_SHEETS_CREDENTIALS = $GOOGLE_SHEETS_CREDENTIALS -replace '^"|"$', ''
}
if ($envContent -match 'GOOGLE_SHEETS_SPREADSHEET_ID="?([^"\s]+)"?') { 
    $GOOGLE_SHEETS_SPREADSHEET_ID = $matches[1].Trim() 
}

$env:PATH = "C:\Users\nicol\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin;" + $env:PATH

Write-Host "  Build & Push (Cloud Build)..." -ForegroundColor Gray
gcloud builds submit --config=cloudbuild-monitoring.yaml --substitutions=_IMAGE_TAG="$REGISTRY/${JOB_NAME}:latest"

# Verifier si le job existe (ignorer les erreurs)
$ErrorActionPreference = "SilentlyContinue"
$jobExists = gcloud run jobs describe $JOB_NAME --region=$REGION 2>$null
$ErrorActionPreference = "Stop"

# Échapper le JSON pour gcloud (remplacer : par =)
$GOOGLE_SHEETS_CREDENTIALS_ESCAPED = $GOOGLE_SHEETS_CREDENTIALS -replace ':', '='

if ($LASTEXITCODE -eq 0) {
    Write-Host "  Mise a jour du job existant..." -ForegroundColor Gray
    gcloud run jobs update $JOB_NAME `
        --image="$REGISTRY/${JOB_NAME}:latest" `
        --region=$REGION `
        --memory=512Mi `
        --cpu=1 `
        --task-timeout=10m `
        --max-retries=1 `
        --set-env-vars="DATABASE_URL=$DATABASE_URL,GOOGLE_SHEETS_SPREADSHEET_ID=$GOOGLE_SHEETS_SPREADSHEET_ID,GOOGLE_SHEETS_CREDENTIALS=$GOOGLE_SHEETS_CREDENTIALS_ESCAPED"
} else {
    Write-Host "  Creation du job..." -ForegroundColor Gray
    gcloud run jobs create $JOB_NAME `
        --image="$REGISTRY/${JOB_NAME}:latest" `
        --region=$REGION `
        --memory=512Mi `
        --cpu=1 `
        --task-timeout=10m `
        --max-retries=1 `
        --set-env-vars="DATABASE_URL=$DATABASE_URL,GOOGLE_SHEETS_SPREADSHEET_ID=$GOOGLE_SHEETS_SPREADSHEET_ID,GOOGLE_SHEETS_CREDENTIALS=$GOOGLE_SHEETS_CREDENTIALS_ESCAPED"
}

# Creer le scheduler SEULEMENT s'il n'existe pas (ne modifie pas l'horaire existant)
Write-Host "  Verification du scheduler..." -ForegroundColor Gray
$SCHEDULER_NAME = "$JOB_NAME-scheduler"
$SERVICE_ACCOUNT = "241509965456-compute@developer.gserviceaccount.com"

$ErrorActionPreference = "SilentlyContinue"
$schedulerExists = gcloud scheduler jobs describe $SCHEDULER_NAME --location=$REGION 2>$null
$schedulerExitCode = $LASTEXITCODE
$ErrorActionPreference = "Stop"

if ($schedulerExitCode -eq 0) {
    Write-Host "  Scheduler existe deja - horaire conserve" -ForegroundColor Yellow
} else {
    Write-Host "  Creation du scheduler (9h30 tous les jours)..." -ForegroundColor Gray
    gcloud scheduler jobs create http $SCHEDULER_NAME `
        --location=$REGION `
        --schedule="30 9 * * *" `
        --time-zone="Europe/Paris" `
        --uri="https://$REGION-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/$PROJECT/jobs/${JOB_NAME}:run" `
        --http-method=POST `
        --oauth-service-account-email="$SERVICE_ACCOUNT"
}

Write-Host ""
Write-Host "Monitoring Daily deploye!" -ForegroundColor Green
Write-Host ""
Write-Host "Commandes utiles:" -ForegroundColor Yellow
Write-Host "  - Executer maintenant: gcloud run jobs execute $JOB_NAME --region=$REGION"
Write-Host "  - Voir les logs: gcloud run jobs executions list --job=$JOB_NAME --region=$REGION"
Write-Host "  - Scheduler: gcloud scheduler jobs describe $SCHEDULER_NAME --location=$REGION"
