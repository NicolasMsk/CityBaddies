import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// Charger les URLs depuis le fichier JSON
const categoryLinksPath = path.join(process.cwd(), 'data', 'category-links.json');
const categoryLinks = JSON.parse(fs.readFileSync(categoryLinksPath, 'utf-8'));

// Fonction pour détecter la catégorie depuis l'URL
function detectCategory(url: string): string {
  const urlLower = url.toLowerCase();
  if (urlLower.includes('parfum') || urlLower.includes('/p/') || urlLower.includes('/p0')) return 'parfums';
  if (urlLower.includes('maquillage') || urlLower.includes('/m/') || urlLower.includes('/m0')) return 'maquillage';
  if (urlLower.includes('soin-visage') || urlLower.includes('/v/') || urlLower.includes('/v0')) return 'soins-visage';
  if (urlLower.includes('soin-corps') || urlLower.includes('corps') || urlLower.includes('/s0') || urlLower.includes('/b0')) return 'soins-corps';
  if (urlLower.includes('cheveux') || urlLower.includes('/c0')) return 'cheveux';
  if (urlLower.includes('accessoire') || urlLower.includes('/a0')) return 'accessoires';
  if (urlLower.includes('parapharmacie') || urlLower.includes('/f0')) return 'parapharmacie';
  if (urlLower.includes('solaire') || urlLower.includes('/uv')) return 'solaires';
  if (urlLower.includes('solde') || urlLower.includes('/so')) return 'soldes';
  return 'autres';
}

// Fonction pour détecter le type depuis l'URL
function detectType(url: string): string {
  const urlLower = url.toLowerCase();
  if (urlLower.includes('meilleures-ventes') || urlLower.includes('best-seller')) return 'trending';
  if (urlLower.includes('promo') || urlLower.includes('bons-plans') || urlLower.includes('solde') || urlLower.includes('black-friday')) return 'promo';
  if (urlLower.includes('nouveaute') || urlLower.includes('nouveau')) return 'nouveaute';
  return 'catalogue';
}

// Fonction pour générer un nom depuis l'URL
function generateName(url: string): string {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(p => p && p !== 'c' && p !== 'fr' && !p.match(/^[A-Z0-9]+$/));
    if (pathParts.length === 0) return 'Catalogue';
    // Prendre les 2-3 derniers segments et les formater
    const relevantParts = pathParts.slice(-3);
    return relevantParts
      .map(p => p.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()))
      .join(' > ');
  } catch {
    return 'Source';
  }
}

// Fonction pour déterminer la priorité
function detectPriority(url: string, type: string): number {
  if (type === 'promo' || type === 'trending') return 10;
  if (type === 'nouveaute') return 8;
  // Les URLs courtes (catégories principales) ont plus de priorité
  const depth = url.split('/').filter(p => p).length;
  if (depth <= 5) return 7;
  if (depth <= 6) return 5;
  return 3;
}

// Générer les sources depuis le JSON pour chaque marchand
function generateSourcesFromJson(merchantSlug: string, urls: string[]) {
  return urls.map(url => ({
    url,
    category: detectCategory(url),
    name: generateName(url),
    type: detectType(url),
    priority: detectPriority(url, detectType(url)),
  }));
}

// Sources générées automatiquement depuis le JSON
const SEPHORA_SOURCES = generateSourcesFromJson('sephora', categoryLinks.sephora || []);
const NOCIBE_SOURCES = generateSourcesFromJson('nocibe', categoryLinks.nocibe || []);
const MARIONNAUD_SOURCES = generateSourcesFromJson('marionnaud', categoryLinks.marionnaud || []);

async function seedScrapingSources() {
  console.log('🌱 Seeding des sources de scraping...\n');

  // Créer ou récupérer les marchands
  let sephora = await prisma.merchant.findFirst({ where: { slug: 'sephora' } });
  if (!sephora) {
    sephora = await prisma.merchant.create({
      data: {
        name: 'Sephora',
        slug: 'sephora',
        logoUrl: 'https://www.sephora.fr/favicon.ico',
        website: 'https://www.sephora.fr',
      },
    });
    console.log('✅ Marchand Sephora créé');
  }

  let nocibe = await prisma.merchant.findFirst({ where: { slug: 'nocibe' } });
  if (!nocibe) {
    nocibe = await prisma.merchant.create({
      data: {
        name: 'Nocibé',
        slug: 'nocibe',
        logoUrl: 'https://www.nocibe.fr/favicon.ico',
        website: 'https://www.nocibe.fr',
      },
    });
    console.log('✅ Marchand Nocibé créé');
  }

  let marionnaud = await prisma.merchant.findFirst({ where: { slug: 'marionnaud' } });
  if (!marionnaud) {
    marionnaud = await prisma.merchant.create({
      data: {
        name: 'Marionnaud',
        slug: 'marionnaud',
        logoUrl: 'https://www.marionnaud.fr/favicon.ico',
        website: 'https://www.marionnaud.fr',
      },
    });
    console.log('✅ Marchand Marionnaud créé');
  }

  // Ajouter les sources Sephora
  console.log('\n📦 Sources Sephora:');
  for (const source of SEPHORA_SOURCES) {
    await prisma.scrapingSource.upsert({
      where: { url: source.url },
      update: {
        name: source.name,
        category: source.category,
        type: source.type,
        priority: source.priority,
        isActive: true,
      },
      create: {
        merchantId: sephora.id,
        url: source.url,
        name: source.name,
        category: source.category,
        type: source.type,
        priority: source.priority,
        maxProducts: 100,
        isActive: true,
      },
    });
    console.log(`   ✓ ${source.name} (${source.type})`);
  }

  // Ajouter les sources Nocibé
  console.log('\n📦 Sources Nocibé:');
  for (const source of NOCIBE_SOURCES) {
    await prisma.scrapingSource.upsert({
      where: { url: source.url },
      update: {
        name: source.name,
        category: source.category,
        type: source.type,
        priority: source.priority,
        isActive: true,
      },
      create: {
        merchantId: nocibe.id,
        url: source.url,
        name: source.name,
        category: source.category,
        type: source.type,
        priority: source.priority,
        maxProducts: 30,
        isActive: true,
      },
    });
    console.log(`   ✓ ${source.name} (${source.type})`);
  }

  // Ajouter les sources Marionnaud
  console.log('\n📦 Sources Marionnaud:');
  for (const source of MARIONNAUD_SOURCES) {
    await prisma.scrapingSource.upsert({
      where: { url: source.url },
      update: {
        name: source.name,
        category: source.category,
        type: source.type,
        priority: source.priority,
        isActive: true,
      },
      create: {
        merchantId: marionnaud.id,
        url: source.url,
        name: source.name,
        category: source.category,
        type: source.type,
        priority: source.priority,
        maxProducts: 50,
        isActive: true,
      },
    });
    console.log(`   ✓ ${source.name} (${source.type})`);
  }

  // Afficher le résumé
  const totalSources = await prisma.scrapingSource.count();
  const sephoraSources = await prisma.scrapingSource.count({ where: { merchantId: sephora.id } });
  const nocibeSources = await prisma.scrapingSource.count({ where: { merchantId: nocibe.id } });
  const marionnaudSources = await prisma.scrapingSource.count({ where: { merchantId: marionnaud.id } });

  console.log('\n📊 Résumé:');
  console.log(`   Total: ${totalSources} sources`);
  console.log(`   Sephora: ${sephoraSources} sources`);
  console.log(`   Nocibé: ${nocibeSources} sources`);
  console.log(`   Marionnaud: ${marionnaudSources} sources`);
  console.log(`   Nocibé: ${nocibeSources} sources`);
  console.log('\n✅ Seeding terminé!');
}

// Fonction pour lister toutes les sources
async function listSources() {
  const sources = await prisma.scrapingSource.findMany({
    include: { merchant: true },
    orderBy: [{ merchant: { name: 'asc' } }, { priority: 'desc' }],
  });

  console.log('\n📋 Sources de scraping configurées:\n');
  
  let currentMerchant = '';
  for (const source of sources) {
    if (source.merchant.name !== currentMerchant) {
      currentMerchant = source.merchant.name;
      console.log(`\n🏪 ${currentMerchant}:`);
    }
    const status = source.isActive ? '✅' : '❌';
    const lastScraped = source.lastScraped 
      ? source.lastScraped.toLocaleDateString('fr-FR')
      : 'Jamais';
    console.log(`   ${status} [${source.type}] ${source.name}`);
    console.log(`      URL: ${source.url}`);
    console.log(`      Catégorie: ${source.category} | Max: ${source.maxProducts} | Dernier: ${lastScraped}`);
  }
}

// Exécution
const args = process.argv.slice(2);

if (args.includes('--list')) {
  listSources()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
} else {
  seedScrapingSources()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
}
