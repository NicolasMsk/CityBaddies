/**
 * Script pour désactiver tous les deals Marionnaud
 * Marionnaud a changé sa stratégie promo (bundle -30% sur 2ème article)
 * donc les deals individuels ne sont plus valides
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔴 Désactivation des deals Marionnaud...');
  
  const result = await prisma.deal.updateMany({
    where: {
      product: {
        productUrl: { contains: 'marionnaud.fr' }
      }
    },
    data: {
      status: 'EXPIRED'
    }
  });
  
  console.log(`✅ ${result.count} deal(s) Marionnaud désactivé(s)`);
  
  await prisma.$disconnect();
}

main().catch(err => {
  console.error('❌ Erreur:', err);
  process.exit(1);
});
