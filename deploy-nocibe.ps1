# Deploiement rapide Nocibe (via Cloud Build)
$ErrorActionPreference = "Stop"

Write-Host "Deploiement Nocibe..." -ForegroundColor Cyan

$REGION = "europe-west1"
$PROJECT = "city-baddies"
$REGISTRY = "$REGION-docker.pkg.dev/$PROJECT/citybaddies-scrapers"

$env:PATH = "C:\Users\nicol\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin;" + $env:PATH

Write-Host "  Build & Push (Cloud Build)..." -ForegroundColor Gray
gcloud builds submit --tag "$REGISTRY/scrape-nocibe:latest" --dockerfile Dockerfile.nocibe --quiet

Write-Host "  Update job..." -ForegroundColor Gray
gcloud run jobs update scrape-nocibe --image="$REGISTRY/scrape-nocibe:latest" --region=$REGION --quiet

Write-Host "Nocibe deploye!" -ForegroundColor Green
Write-Host ""
Write-Host "Pour tester: gcloud run jobs execute scrape-nocibe --region=$REGION"
