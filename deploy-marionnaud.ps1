# Deploiement rapide Marionnaud (via Cloud Build)
$ErrorActionPreference = "Stop"

Write-Host "Deploiement Marionnaud..." -ForegroundColor Cyan

$REGION = "europe-west1"
$PROJECT = "city-baddies"
$REGISTRY = "$REGION-docker.pkg.dev/$PROJECT/citybaddies-scrapers"

$env:PATH = "C:\Users\nicol\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin;" + $env:PATH

Write-Host "  Build & Push (Cloud Build)..." -ForegroundColor Gray
gcloud builds submit --config=cloudbuild-marionnaud.yaml --substitutions=_IMAGE_TAG="$REGISTRY/scrape-marionnaud:latest" --quiet

Write-Host "  Update job..." -ForegroundColor Gray
gcloud run jobs update scrape-marionnaud --image="$REGISTRY/scrape-marionnaud:latest" --region=$REGION --quiet

Write-Host "Marionnaud deploye!" -ForegroundColor Green
Write-Host ""
Write-Host "Pour tester: gcloud run jobs execute scrape-marionnaud --region=$REGION"
