# Deploiement rapide Notino (via Cloud Build)
$ErrorActionPreference = "Stop"

Write-Host "Deploiement Notino..." -ForegroundColor Cyan

$REGION = "europe-west1"
$PROJECT = "city-baddies"
$REGISTRY = "$REGION-docker.pkg.dev/$PROJECT/citybaddies-scrapers"

$env:PATH = "C:\Users\nicol\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin;" + $env:PATH

# Récupérer DATABASE_URL depuis le job Sephora existant (même DB)
$yamlOutput = gcloud run jobs describe scrape-sephora --region=$REGION --format=yaml 2>$null
$dbLine = ($yamlOutput | Select-String "DATABASE_URL" -Context 0,1).Context.PostContext[0]
$DATABASE_URL = ($dbLine -replace '^\s*value:\s*','').Trim()
if (-not $DATABASE_URL) {
    Write-Host "  ERREUR: Impossible de lire DATABASE_URL depuis scrape-sephora" -ForegroundColor Red
    exit 1
}

# Récupérer OPENAI_API_KEY depuis le job Sephora
$oaiLine = ($yamlOutput | Select-String "OPENAI_API_KEY" -Context 0,1).Context.PostContext[0]
$OPENAI_API_KEY = ($oaiLine -replace '^\s*value:\s*','').Trim()
if (-not $OPENAI_API_KEY) {
    Write-Host "  WARNING: OPENAI_API_KEY non trouvé" -ForegroundColor Yellow
}
Write-Host "  DATABASE_URL + OPENAI_API_KEY recuperes depuis scrape-sephora" -ForegroundColor Gray

Write-Host "  Build & Push (Cloud Build)..." -ForegroundColor Gray
gcloud builds submit --config=cloudbuild-notino.yaml --substitutions=_IMAGE_TAG="$REGISTRY/scrape-notino:latest" --quiet

# Vérifier si le job existe déjà
$ErrorActionPreference = "Continue"
$jobExists = gcloud run jobs describe scrape-notino --region=$REGION 2>$null
$ErrorActionPreference = "Stop"

if ($jobExists) {
    Write-Host "  Update job..." -ForegroundColor Gray
    gcloud run jobs update scrape-notino `
        --image="$REGISTRY/scrape-notino:latest" `
        --region=$REGION `
        --set-env-vars="NODE_ENV=production,DATABASE_URL=$DATABASE_URL,OPENAI_API_KEY=$OPENAI_API_KEY" `
        --quiet
} else {
    Write-Host "  Create job..." -ForegroundColor Gray
    gcloud run jobs create scrape-notino `
        --image="$REGISTRY/scrape-notino:latest" `
        --region=$REGION `
        --task-timeout=3600s `
        --memory=2Gi `
        --cpu=1 `
        --max-retries=1 `
        --set-env-vars="NODE_ENV=production,DATABASE_URL=$DATABASE_URL,OPENAI_API_KEY=$OPENAI_API_KEY" `
        --quiet
}

Write-Host "Notino deploye!" -ForegroundColor Green
Write-Host ""
Write-Host "Pour tester: gcloud run jobs execute scrape-notino --region=$REGION"
