import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// URLs de scraping pour Sephora
const SEPHORA_SOURCES = [
  // Catégories principales (catalogue complet)
  { url: 'https://www.sephora.fr/shop/maquillage-c302/', category: 'maquillage', name: 'Catalogue Maquillage', type: 'catalogue', priority: 5 },
  { url: 'https://www.sephora.fr/shop/parfum-c301/', category: 'parfums', name: 'Catalogue Parfums', type: 'catalogue', priority: 5 },
  { url: 'https://www.sephora.fr/shop/soin-visage-c303/', category: 'soins-visage', name: 'Catalogue Soins Visage', type: 'catalogue', priority: 5 },
  { url: 'https://www.sephora.fr/shop/corps-et-bain-c304/', category: 'soins-corps', name: 'Catalogue Corps & Bain', type: 'catalogue', priority: 5 },
  { url: 'https://www.sephora.fr/shop/cheveux-c307/', category: 'cheveux', name: 'Catalogue Cheveux', type: 'catalogue', priority: 5 },
  // Promos/Bons plans
  { url: 'https://www.sephora.fr/promotion-exclu-web-maquillage/', category: 'maquillage', name: 'Promos Maquillage', type: 'promo', priority: 10 },
  { url: 'https://www.sephora.fr/promotion-exclu-web-parfum/', category: 'parfums', name: 'Promos Parfums', type: 'promo', priority: 10 },
  { url: 'https://www.sephora.fr/promotion-exclu-web-soin-cheveux-mup/', category: 'soins-visage', name: 'Promos Soins', type: 'promo', priority: 10 },
  { url: 'https://www.sephora.fr/promotion-exclu-web-cheveux/', category: 'cheveux', name: 'Promos Cheveux', type: 'promo', priority: 10 },
  { url: 'https://www.sephora.fr/haircare-heroes/', category: 'cheveux', name: 'Haircare Heroes', type: 'promo', priority: 5 },
  // Tendances réseaux sociaux
  { url: 'https://www.sephora.fr/tous-produits-stars-reseaux-sociaux/', category: 'maquillage', name: 'Stars Réseaux Sociaux', type: 'trending', priority: 15 },
];

// URLs de scraping pour Nocibé
const NOCIBE_SOURCES = [
  // Bons plans par catégorie
  { url: 'https://www.nocibe.fr/fr/c/bons-plans/parfum/0501', category: 'parfums', name: 'Bons plans Parfum', type: 'promo', priority: 10 },
  { url: 'https://www.nocibe.fr/fr/c/bons-plans/maquillages/0510', category: 'maquillage', name: 'Bons plans Maquillage', type: 'promo', priority: 10 },
  { url: 'https://www.nocibe.fr/fr/c/bons-plans/soin-visage/0502', category: 'soins-visage', name: 'Bons plans Soin Visage', type: 'promo', priority: 10 },
  { url: 'https://www.nocibe.fr/fr/c/bons-plans/cheveux/0512', category: 'cheveux', name: 'Bons plans Cheveux', type: 'promo', priority: 10 },
  // Nouveautés par catégorie
  { url: 'https://www.nocibe.fr/fr/c/nouveautes/parfums/0901', category: 'parfums', name: 'Nouveautés Parfums', type: 'nouveaute', priority: 8 },
  { url: 'https://www.nocibe.fr/fr/c/nouveautes/maquillage/0903', category: 'maquillage', name: 'Nouveautés Maquillage', type: 'nouveaute', priority: 8 },
  { url: 'https://www.nocibe.fr/fr/c/nouveautes/soin-visage/0912', category: 'soins-visage', name: 'Nouveautés Soin Visage', type: 'nouveaute', priority: 8 },
  { url: 'https://www.nocibe.fr/fr/c/nouveautes/soin-corps/0913', category: 'soins-corps', name: 'Nouveautés Soin Corps', type: 'nouveaute', priority: 8 },
  { url: 'https://www.nocibe.fr/fr/c/nouveautes/cheveux/0904', category: 'cheveux', name: 'Nouveautés Cheveux', type: 'nouveaute', priority: 8 },
];

// URLs de scraping pour Marionnaud
const MARIONNAUD_SOURCES = [
  // Parfums - Bons plans et meilleures ventes
  { url: 'https://www.marionnaud.fr/parfums/femme/c/P0100', category: 'parfums', name: 'Parfums Femme', type: 'catalogue', priority: 5 },
  { url: 'https://www.marionnaud.fr/parfums/homme/c/P0200', category: 'parfums', name: 'Parfums Homme', type: 'catalogue', priority: 5 },
  { url: 'https://www.marionnaud.fr/parfums/nos-selections/meilleures-ventes/c/P0502', category: 'parfums', name: 'Parfums Meilleures Ventes', type: 'trending', priority: 10 },
  
  // Maquillage
  { url: 'https://www.marionnaud.fr/maquillage/teint/c/M0100', category: 'maquillage', name: 'Maquillage Teint', type: 'catalogue', priority: 5 },
  { url: 'https://www.marionnaud.fr/maquillage/yeux/c/M0200', category: 'maquillage', name: 'Maquillage Yeux', type: 'catalogue', priority: 5 },
  { url: 'https://www.marionnaud.fr/maquillage/levres/c/M0300', category: 'maquillage', name: 'Maquillage Lèvres', type: 'catalogue', priority: 5 },
  { url: 'https://www.marionnaud.fr/maquillage/nos-selections/meilleures-ventes/c/M0902', category: 'maquillage', name: 'Maquillage Meilleures Ventes', type: 'trending', priority: 10 },
  
  // Soins visage
  { url: 'https://www.marionnaud.fr/soin-visage/type-de-produit/serum/c/V0105', category: 'soins-visage', name: 'Sérums Visage', type: 'catalogue', priority: 5 },
  { url: 'https://www.marionnaud.fr/soin-visage/type-de-produit/creme-hydratante/c/V0101', category: 'soins-visage', name: 'Crèmes Hydratantes', type: 'catalogue', priority: 5 },
  { url: 'https://www.marionnaud.fr/soin-visage/type-de-produit/masque/c/V0106', category: 'soins-visage', name: 'Masques Visage', type: 'catalogue', priority: 5 },
  { url: 'https://www.marionnaud.fr/soin-visage/nos-selections/meilleures-ventes/c/V0802', category: 'soins-visage', name: 'Soins Visage Meilleures Ventes', type: 'trending', priority: 10 },
  
  // Soins corps
  { url: 'https://www.marionnaud.fr/soin-corps/hydratant-et-nourrissant/lait-et-creme/c/B0201', category: 'soins-corps', name: 'Laits & Crèmes Corps', type: 'catalogue', priority: 5 },
  { url: 'https://www.marionnaud.fr/soin-corps/hygiene-et-bain/gel-douche/c/B0102', category: 'soins-corps', name: 'Gels Douche', type: 'catalogue', priority: 5 },
  { url: 'https://www.marionnaud.fr/soin-corps/nos-selections/meilleures-ventes/c/B0602', category: 'soins-corps', name: 'Soins Corps Meilleures Ventes', type: 'trending', priority: 10 },
  
  // Cheveux
  { url: 'https://www.marionnaud.fr/cheveux/type-de-produit/shampooing/c/C0101', category: 'cheveux', name: 'Shampoings', type: 'catalogue', priority: 5 },
  { url: 'https://www.marionnaud.fr/cheveux/type-de-produit/masque/c/C0103', category: 'cheveux', name: 'Masques Cheveux', type: 'catalogue', priority: 5 },
  { url: 'https://www.marionnaud.fr/cheveux/nos-selections/meilleures-ventes/c/C0902', category: 'cheveux', name: 'Cheveux Meilleures Ventes', type: 'trending', priority: 10 },
];

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
