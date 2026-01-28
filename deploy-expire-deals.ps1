# Deploy Expire Deals Job to Google Cloud Run
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

# Build Docker image
Write-Host "[1/3] Building Docker image..." -ForegroundColor Yellow
docker build -f Dockerfile.expire-deals -t $IMAGE_NAME .
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Docker build failed" -ForegroundColor Red
    exit 1
}

# Push to Artifact Registry
Write-Host "[2/3] Pushing to Artifact Registry..." -ForegroundColor Yellow
docker tag $IMAGE_NAME $REGISTRY
docker push $REGISTRY
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Docker push failed" -ForegroundColor Red
    exit 1
}

# Deploy to Cloud Run Jobs
Write-Host "[3/3] Deploying to Cloud Run Jobs..." -ForegroundColor Yellow
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
