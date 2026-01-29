/**
 * Script pour mettre à jour le champ isActive des deals
 * 
 * Un deal est considéré actif si:
 * - isExpired = false
 * - score >= 60 (deals de haute qualité) OU score >= 50 (deals acceptables)
 * 
 * Usage: npx tsx src/scripts/update-is-active.ts [--threshold=60]
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateIsActive(scoreThreshold: number = 60) {
  console.log('🔄 Mise à jour du champ isActive...');
  console.log(`📊 Seuil de score: ${scoreThreshold}`);

  // Compter avant la mise à jour
  const beforeActive = await prisma.deal.count({ where: { isActive: true } });
  const beforeInactive = await prisma.deal.count({ where: { isActive: false } });
  console.log(`\n📈 Avant mise à jour:`);
  console.log(`   - Actifs: ${beforeActive}`);
  console.log(`   - Inactifs: ${beforeInactive}`);

  // Désactiver tous les deals expirés ou avec score trop bas
  const deactivated = await prisma.deal.updateMany({
    where: {
      OR: [
        { isExpired: true },
        { score: { lt: scoreThreshold } },
      ],
    },
    data: {
      isActive: false,
    },
  });
  console.log(`\n❌ Deals désactivés: ${deactivated.count}`);

  // Activer tous les deals non expirés avec score suffisant
  const activated = await prisma.deal.updateMany({
    where: {
      isExpired: false,
      score: { gte: scoreThreshold },
    },
    data: {
      isActive: true,
    },
  });
  console.log(`✅ Deals activés: ${activated.count}`);

  // Compter après la mise à jour
  const afterActive = await prisma.deal.count({ where: { isActive: true } });
  const afterInactive = await prisma.deal.count({ where: { isActive: false } });
  console.log(`\n📈 Après mise à jour:`);
  console.log(`   - Actifs: ${afterActive}`);
  console.log(`   - Inactifs: ${afterInactive}`);

  // Statistiques détaillées des deals actifs
  const activeByMerchant = await prisma.deal.groupBy({
    by: ['productId'],
    where: { isActive: true },
    _count: true,
  });

  const stats = await prisma.deal.aggregate({
    where: { isActive: true },
    _avg: { score: true, discountPercent: true },
    _min: { score: true },
    _max: { score: true },
  });

  console.log(`\n📊 Statistiques des deals actifs:`);
  console.log(`   - Score moyen: ${stats._avg.score?.toFixed(1)}`);
  console.log(`   - Score min: ${stats._min.score?.toFixed(1)}`);
  console.log(`   - Score max: ${stats._max.score?.toFixed(1)}`);
  console.log(`   - Réduction moyenne: ${stats._avg.discountPercent?.toFixed(1)}%`);

  console.log('\n✨ Mise à jour terminée!');
}

// Parse command line arguments
const args = process.argv.slice(2);
let threshold = 60;

for (const arg of args) {
  if (arg.startsWith('--threshold=')) {
    threshold = parseInt(arg.split('=')[1], 10);
  }
}

updateIsActive(threshold)
  .catch((e) => {
    console.error('❌ Erreur:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
