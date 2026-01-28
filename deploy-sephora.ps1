# Deploiement rapide Sephora
$ErrorActionPreference = "Stop"

Write-Host "Deploiement Sephora..." -ForegroundColor Cyan

$REGION = "europe-west1"
$PROJECT = "city-baddies"
$REGISTRY = "$REGION-docker.pkg.dev/$PROJECT/citybaddies-scrapers"

$env:PATH = "C:\Users\nicol\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin;" + $env:PATH

Write-Host "  Build..." -ForegroundColor Gray
docker build -f Dockerfile.sephora -t "$REGISTRY/scrape-sephora:latest" . --quiet

Write-Host "  Push..." -ForegroundColor Gray
docker push "$REGISTRY/scrape-sephora:latest" --quiet

Write-Host "  Update job..." -ForegroundColor Gray
gcloud run jobs update scrape-sephora --image="$REGISTRY/scrape-sephora:latest" --region=$REGION --quiet

Write-Host "Sephora deploye!" -ForegroundColor Green
Write-Host ""
Write-Host "Pour tester: gcloud run jobs execute scrape-sephora --region=$REGION"
