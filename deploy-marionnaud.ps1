# Deploiement rapide Marionnaud
$ErrorActionPreference = "Stop"

Write-Host "Deploiement Marionnaud..." -ForegroundColor Cyan

$REGION = "europe-west1"
$PROJECT = "city-baddies"
$REGISTRY = "$REGION-docker.pkg.dev/$PROJECT/citybaddies-scrapers"

$env:PATH = "C:\Users\nicol\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin;" + $env:PATH

Write-Host "  Build..." -ForegroundColor Gray
docker build -f Dockerfile.marionnaud -t "$REGISTRY/scrape-marionnaud:latest" . --quiet

Write-Host "  Push..." -ForegroundColor Gray
docker push "$REGISTRY/scrape-marionnaud:latest" --quiet

Write-Host "  Update job..." -ForegroundColor Gray
gcloud run jobs update scrape-marionnaud --image="$REGISTRY/scrape-marionnaud:latest" --region=$REGION --quiet

Write-Host "Marionnaud deploye!" -ForegroundColor Green
Write-Host ""
Write-Host "Pour tester: gcloud run jobs execute scrape-marionnaud --region=$REGION"
