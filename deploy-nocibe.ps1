# Deploiement rapide Nocibe
$ErrorActionPreference = "Stop"

Write-Host "Deploiement Nocibe..." -ForegroundColor Cyan

$REGION = "europe-west1"
$PROJECT = "city-baddies"
$REGISTRY = "$REGION-docker.pkg.dev/$PROJECT/citybaddies-scrapers"

$env:PATH = "C:\Users\nicol\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin;" + $env:PATH

Write-Host "  Build..." -ForegroundColor Gray
docker build -f Dockerfile.nocibe -t "$REGISTRY/scrape-nocibe:latest" . --quiet

Write-Host "  Push..." -ForegroundColor Gray
docker push "$REGISTRY/scrape-nocibe:latest" --quiet

Write-Host "  Update job..." -ForegroundColor Gray
gcloud run jobs update scrape-nocibe --image="$REGISTRY/scrape-nocibe:latest" --region=$REGION --quiet

Write-Host "Nocibe deploye!" -ForegroundColor Green
Write-Host ""
Write-Host "Pour tester: gcloud run jobs execute scrape-nocibe --region=$REGION"
