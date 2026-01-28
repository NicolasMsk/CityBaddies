# Script de déploiement rapide des jobs de scraping
# Usage: .\deploy-scrapers.ps1

$ErrorActionPreference = "Stop"

Write-Host "Deploiement des scrapers Sephora, Nocibe, Marionnaud" -ForegroundColor Cyan
Write-Host ""

$REGION = "europe-west1"
$PROJECT = "city-baddies"
$REGISTRY = "$REGION-docker.pkg.dev/$PROJECT/citybaddies-scrapers"

# Configurer l'environnement
$env:PATH = "C:\Users\nicol\AppData\Local\Google\Cloud SDK\google-cloud-sdk\bin;" + $env:PATH

# Variables d'environnement
$DATABASE_URL = "postgresql://postgres:A9%21fQ7%40Zr%23L2xM%24P8K%25vE@db.vehgwkgceocqcyakwxsc.supabase.co:5432/postgres"
$OPENAI_KEY = (Get-Content .env | Select-String "OPENAI_API_KEY" | ForEach-Object { $_.Line -replace 'OPENAI_API_KEY="?([^"]+)"?', '$1' })
$SERPER_KEY = (Get-Content .env | Select-String "SERPER_API_KEY" | ForEach-Object { $_.Line -replace 'SERPER_API_KEY\s*=\s*"?([^"]+)"?', '$1' })

Write-Host "SEPHORA" -ForegroundColor Yellow
Write-Host "  Build..." -ForegroundColor Gray
docker build -f Dockerfile.sephora -t "$REGISTRY/scrape-sephora:latest" . --quiet
Write-Host "  Push..." -ForegroundColor Gray
docker push "$REGISTRY/scrape-sephora:latest" --quiet
Write-Host "  Update job..." -ForegroundColor Gray
gcloud run jobs update scrape-sephora `
    --image="$REGISTRY/scrape-sephora:latest" `
    --region=$REGION `
    --quiet
Write-Host "  Sephora deploye!" -ForegroundColor Green
Write-Host ""

Write-Host "NOCIBE" -ForegroundColor Yellow
Write-Host "  Build..." -ForegroundColor Gray
docker build -f Dockerfile.nocibe -t "$REGISTRY/scrape-nocibe:latest" . --quiet
Write-Host "  Push..." -ForegroundColor Gray
docker push "$REGISTRY/scrape-nocibe:latest" --quiet
Write-Host "  Update job..." -ForegroundColor Gray
gcloud run jobs update scrape-nocibe `
    --image="$REGISTRY/scrape-nocibe:latest" `
    --region=$REGION `
    --quiet
Write-Host "  Nocibe deploye!" -ForegroundColor Green
Write-Host ""

Write-Host "MARIONNAUD" -ForegroundColor Yellow
Write-Host "  Build..." -ForegroundColor Gray
docker build -f Dockerfile.marionnaud -t "$REGISTRY/scrape-marionnaud:latest" . --quiet
Write-Host "  Push..." -ForegroundColor Gray
docker push "$REGISTRY/scrape-marionnaud:latest" --quiet
Write-Host "  Update job..." -ForegroundColor Gray
gcloud run jobs update scrape-marionnaud `
    --image="$REGISTRY/scrape-marionnaud:latest" `
    --region=$REGION `
    --quiet
Write-Host "  Marionnaud deploye!" -ForegroundColor Green
Write-Host ""

Write-Host "Tous les scrapers sont deployes!" -ForegroundColor Green
Write-Host ""
Write-Host "Pour tester:" -ForegroundColor Cyan
Write-Host "  gcloud run jobs execute scrape-sephora --region=$REGION"
Write-Host "  gcloud run jobs execute scrape-nocibe --region=$REGION"
Write-Host "  gcloud run jobs execute scrape-marionnaud --region=$REGION"
