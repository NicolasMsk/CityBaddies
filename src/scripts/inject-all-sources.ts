/**
 * Script pour injecter toutes les sources de category-links.json dans la DB
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// Mapping des catégories URL vers catégories DB
function getCategoryFromUrl(url: string): string {
  if (url.includes('/cheveux')) return 'cheveux';
  if (url.includes('/corps-et-bain')) return 'soins-corps';
  if (url.includes('/maquillage')) return 'maquillage';
  if (url.includes('/parfum')) return 'parfums';
  if (url.includes('/soin-visage')) return 'soins-visage';
  if (url.includes('/ongles')) return 'ongles';
  if (url.includes('/accessoires')) return 'accessoires';
  if (url.includes('/promotion') || url.includes('/promo') || url.includes('/bons-plans')) return 'promo';
  if (url.includes('/nouveaute')) return 'nouveautes';
  return 'autres';
}

// Extraire un nom lisible depuis l'URL
function getNameFromUrl(url: string, merchant: string): string {
  const parts = url.split('/').filter(p => p && !p.includes('http') && !p.includes('.fr') && !p.includes('.com'));
  const lastPart = parts[parts.length - 1] || parts[parts.length - 2] || 'catalogue';
  
  // Nettoyer le nom
  let name = lastPart
    .replace(/-c\d+\/?$/, '') // Enlever les IDs de catégorie Sephora
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Capitaliser
  name = name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  
  return `${merchant} - ${name}`;
}

// Déterminer le type de source
function getSourceType(url: string): string {
  if (url.includes('promotion') || url.includes('promo') || url.includes('bons-plans') || url.includes('offre')) return 'promo';
  if (url.includes('nouveaute') || url.includes('nouveau')) return 'nouveaute';
  if (url.includes('trending') || url.includes('stars') || url.includes('best')) return 'trending';
  return 'catalogue';
}

async function main() {
  console.log('🚀 Injection des sources depuis category-links.json...\n');

  // Lire le fichier JSON
  const jsonPath = path.join(process.cwd(), 'data', 'category-links.json');
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

  // Récupérer ou créer les merchants
  let sephoraMerchant = await prisma.merchant.findFirst({ where: { slug: 'sephora' } });
  if (!sephoraMerchant) {
    sephoraMerchant = await prisma.merchant.create({
      data: {
        name: 'Sephora',
        slug: 'sephora',
        website: 'https://www.sephora.fr',
        logoUrl: '/images/sephora_logo.png',
      }
    });
    console.log('✅ Merchant Sephora créé');
  }

  let nocibeMerchant = await prisma.merchant.findFirst({ where: { slug: 'nocibe' } });
  if (!nocibeMerchant) {
    nocibeMerchant = await prisma.merchant.create({
      data: {
        name: 'Nocibé',
        slug: 'nocibe',
        website: 'https://www.nocibe.fr',
        logoUrl: '/images/nocibe_logo.png',
      }
    });
    console.log('✅ Merchant Nocibé créé');
  }

  let created = 0;
  let skipped = 0;

  // Traiter Sephora
  if (data.sephora && Array.isArray(data.sephora)) {
    console.log(`\n📦 Sephora: ${data.sephora.length} URLs`);
    
    for (const url of data.sephora) {
      const existing = await prisma.scrapingSource.findFirst({ where: { url } });
      if (existing) {
        skipped++;
        continue;
      }

      const name = getNameFromUrl(url, 'Sephora');
      const category = getCategoryFromUrl(url);
      const sourceType = getSourceType(url);
      
      // Priorité plus haute pour les promos
      const priority = sourceType === 'promo' ? 10 : sourceType === 'trending' ? 8 : 5;

      await prisma.scrapingSource.create({
        data: {
          name,
          url,
          merchantId: sephoraMerchant.id,
          category,
          type: sourceType,
          isActive: true,
          priority,
          maxProducts: 100,
        }
      });
      created++;
    }
  }

  // Traiter Nocibé
  if (data.nocibe && Array.isArray(data.nocibe)) {
    console.log(`📦 Nocibé: ${data.nocibe.length} URLs`);
    
    for (const url of data.nocibe) {
      const existing = await prisma.scrapingSource.findFirst({ where: { url } });
      if (existing) {
        skipped++;
        continue;
      }

      const name = getNameFromUrl(url, 'Nocibé');
      const category = getCategoryFromUrl(url);
      const sourceType = getSourceType(url);
      
      const priority = sourceType === 'promo' ? 10 : sourceType === 'nouveaute' ? 8 : 5;

      await prisma.scrapingSource.create({
        data: {
          name,
          url,
          merchantId: nocibeMerchant.id,
          category,
          type: sourceType,
          isActive: true,
          priority,
          maxProducts: 100,
        }
      });
      created++;
    }
  }

  // Résumé
  const totalSources = await prisma.scrapingSource.count();
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 RÉSUMÉ');
  console.log('='.repeat(50));
  console.log(`✅ Sources créées: ${created}`);
  console.log(`⏭️  Sources ignorées (déjà existantes): ${skipped}`);
  console.log(`📦 Total sources en DB: ${totalSources}`);
  console.log('='.repeat(50));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
