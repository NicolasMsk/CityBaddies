# Deploy Expire Deals Job to Google Cloud Run (via Cloud Build)
# Usage: .\deploy-expire-deals.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  DEPLOYING EXPIRE-DEALS JOB" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$PROJECT_ID = "city-baddies"
$REGION = "europe-west1"
$JOB_NAME = "expire-deals"
$IMAGE_NAME = "expire-deals"
$REGISTRY = "europe-west1-docker.pkg.dev/$PROJECT_ID/citybaddies-scrapers/$IMAGE_NAME"

# Read DATABASE_URL from .env file
$envFile = Get-Content .env | Where-Object { $_ -match '^DATABASE_URL=' }
$DATABASE_URL = ($envFile -replace '^DATABASE_URL="?|"?$', '')
if (-not $DATABASE_URL) {
    Write-Host "[ERROR] DATABASE_URL not found in .env file" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] DATABASE_URL loaded from .env" -ForegroundColor Green

# Build and Push via Cloud Build
Write-Host "[1/2] Building and pushing via Cloud Build..." -ForegroundColor Yellow
gcloud builds submit --config=cloudbuild-expire-deals.yaml --substitutions=_IMAGE_TAG=$REGISTRY
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Cloud Build failed" -ForegroundColor Red
    exit 1
}

# Deploy to Cloud Run Jobs
Write-Host "[2/2] Deploying to Cloud Run Jobs..." -ForegroundColor Yellow
gcloud run jobs update $JOB_NAME `
    --image=$REGISTRY `
    --region=$REGION `
    --project=$PROJECT_ID `
    --set-env-vars="DATABASE_URL=$DATABASE_URL,DAYS_BEFORE_DELETION=3"

if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Cloud Run deployment failed" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  DEPLOYMENT COMPLETE!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "To execute the job:" -ForegroundColor Cyan
Write-Host "  gcloud run jobs execute $JOB_NAME --region=$REGION --project=$PROJECT_ID" -ForegroundColor White
