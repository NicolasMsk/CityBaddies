# Script de déploiement Google Cloud Run Jobs
# Usage: .\deploy-cloud-jobs.ps1 -ProjectId "votre-project-id" -OpenAIKey "sk-xxx" -SerperKey "xxx"

param(
    [Parameter(Mandatory=$true)]
    [string]$ProjectId,
    
    [Parameter(Mandatory=$true)]
    [string]$OpenAIKey,
    
    [string]$SerperKey = "",
    
    [string]$Region = "europe-west1"
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 Déploiement City Baddies Cloud Jobs" -ForegroundColor Cyan
Write-Host "Project: $ProjectId" -ForegroundColor Gray
Write-Host "Region: $Region" -ForegroundColor Gray
Write-Host ""

# Configuration
$REPO_NAME = "citybaddies-scrapers"
$REGISTRY = "$Region-docker.pkg.dev/$ProjectId/$REPO_NAME"
$DATABASE_URL = "postgresql://postgres:A9%21fQ7%40Zr%23L2xM%24P8K%25vE@db.vehgwkgceocqcyakwxsc.supabase.co:5432/postgres"

# Étape 1: Configurer le projet
Write-Host "📌 Configuration du projet..." -ForegroundColor Yellow
gcloud config set project $ProjectId

# Étape 2: Activer les APIs
Write-Host "🔧 Activation des APIs..." -ForegroundColor Yellow
gcloud services enable run.googleapis.com
gcloud services enable artifactregistry.googleapis.com
gcloud services enable cloudscheduler.googleapis.com

# Étape 3: Créer le repository Artifact Registry (ignore si existe)
Write-Host "📦 Création du repository Artifact Registry..." -ForegroundColor Yellow
gcloud artifacts repositories create $REPO_NAME `
    --repository-format=docker `
    --location=$Region `
    --description="Images Docker pour les scrapers City Baddies" 2>$null

# Étape 4: Configurer Docker
Write-Host "🐳 Configuration Docker..." -ForegroundColor Yellow
gcloud auth configure-docker "$Region-docker.pkg.dev" --quiet

# Étape 5: Build et push Sephora
Write-Host "🏗️ Build image Sephora..." -ForegroundColor Yellow
docker build -f Dockerfile.sephora -t "$REGISTRY/scrape-sephora:latest" .
Write-Host "⬆️ Push image Sephora..." -ForegroundColor Yellow
docker push "$REGISTRY/scrape-sephora:latest"

# Étape 6: Build et push Nocibé
Write-Host "🏗️ Build image Nocibé..." -ForegroundColor Yellow
docker build -f Dockerfile.nocibe -t "$REGISTRY/scrape-nocibe:latest" .
Write-Host "⬆️ Push image Nocibé..." -ForegroundColor Yellow
docker push "$REGISTRY/scrape-nocibe:latest"

# Étape 7: Créer/Mettre à jour les jobs
Write-Host "☁️ Création du job Sephora..." -ForegroundColor Yellow
$sephoraEnvVars = "DATABASE_URL=$DATABASE_URL,OPENAI_API_KEY=$OpenAIKey"
if ($SerperKey) { $sephoraEnvVars += ",SERPER_API_KEY=$SerperKey" }

gcloud run jobs create scrape-sephora `
    --image="$REGISTRY/scrape-sephora:latest" `
    --region=$Region `
    --memory=2Gi `
    --cpu=2 `
    --max-retries=1 `
    --task-timeout=30m `
    --set-env-vars=$sephoraEnvVars `
    --quiet 2>$null

# Update si existe déjà
gcloud run jobs update scrape-sephora `
    --image="$REGISTRY/scrape-sephora:latest" `
    --region=$Region `
    --memory=2Gi `
    --cpu=2 `
    --set-env-vars=$sephoraEnvVars `
    --quiet 2>$null

Write-Host "☁️ Création du job Nocibé..." -ForegroundColor Yellow
$nocibeEnvVars = "DATABASE_URL=$DATABASE_URL,OPENAI_API_KEY=$OpenAIKey"

gcloud run jobs create scrape-nocibe `
    --image="$REGISTRY/scrape-nocibe:latest" `
    --region=$Region `
    --memory=1Gi `
    --cpu=1 `
    --max-retries=1 `
    --task-timeout=20m `
    --set-env-vars=$nocibeEnvVars `
    --quiet 2>$null

# Update si existe déjà
gcloud run jobs update scrape-nocibe `
    --image="$REGISTRY/scrape-nocibe:latest" `
    --region=$Region `
    --memory=1Gi `
    --cpu=1 `
    --set-env-vars=$nocibeEnvVars `
    --quiet 2>$null

Write-Host ""
Write-Host "✅ Déploiement terminé!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Pour tester les jobs:" -ForegroundColor Cyan
Write-Host "  gcloud run jobs execute scrape-sephora --region=$Region"
Write-Host "  gcloud run jobs execute scrape-nocibe --region=$Region"
Write-Host ""
Write-Host "📋 Pour créer les schedulers (cron):" -ForegroundColor Cyan
Write-Host "  Voir docs/GOOGLE_CLOUD_DEPLOY.md - Étape 4"
Write-Host ""
Write-Host "📋 Pour voir les logs:" -ForegroundColor Cyan
Write-Host "  https://console.cloud.google.com/run/jobs?project=$ProjectId"
