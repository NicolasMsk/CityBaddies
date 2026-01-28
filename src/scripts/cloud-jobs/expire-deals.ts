/**
 * Cloud Run Job - Expirer les deals inactifs
 * Exécuté quotidiennement à 7h du matin
 * 
 * Supprime les deals qui n'ont pas été vus depuis 3 jours
 * (absents des pages de promotions lors des scrapes)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Configuration
const DAYS_BEFORE_EXPIRATION = parseInt(process.env.DAYS_BEFORE_EXPIRATION || '3');

async function main() {
  const startTime = Date.now();
  console.log('🧹 [CLOUD JOB] Nettoyage des deals expirés...');
  console.log(`📅 Date: ${new Date().toISOString()}`);
  console.log(`⚙️ Seuil d'expiration: ${DAYS_BEFORE_EXPIRATION} jours`);

  try {
    // Calculer la date limite (maintenant - 3 jours)
    const expirationThreshold = new Date();
    expirationThreshold.setDate(expirationThreshold.getDate() - DAYS_BEFORE_EXPIRATION);
    
    console.log(`📆 Suppression des deals non vus depuis: ${expirationThreshold.toISOString()}`);

    // Compter d'abord combien de deals vont être supprimés
    const dealsToDelete = await prisma.deal.findMany({
      where: {
        isExpired: false, // Seulement les deals actifs
        lastSeenAt: {
          lt: expirationThreshold, // Non vu depuis 3+ jours
        },
      },
      select: {
        id: true,
        title: true,
        lastSeenAt: true,
        product: {
          select: {
            merchant: {
              select: { name: true },
            },
          },
        },
      },
    });

    console.log(`\n🔍 ${dealsToDelete.length} deals à supprimer:`);

    // Afficher un résumé par merchant
    const byMerchant = new Map<string, number>();
    for (const deal of dealsToDelete) {
      const merchant = deal.product?.merchant?.name || 'Inconnu';
      byMerchant.set(merchant, (byMerchant.get(merchant) || 0) + 1);
    }
    
    Array.from(byMerchant.entries()).forEach(([merchant, count]) => {
      console.log(`   📦 ${merchant}: ${count} deals`);
    });

    // Afficher quelques exemples
    console.log('\n📋 Exemples de deals à supprimer:');
    dealsToDelete.slice(0, 5).forEach(deal => {
      console.log(`   ❌ "${deal.title?.substring(0, 50)}..." (lastSeen: ${deal.lastSeenAt?.toISOString()})`);
    });

    if (dealsToDelete.length === 0) {
      console.log('\n✅ Aucun deal à supprimer!');
      process.exit(0);
    }

    // SUPPRIMER les deals expirés (pas seulement marquer isExpired)
    // On supprime car on ne veut pas polluer la DB
    const deleteResult = await prisma.deal.deleteMany({
      where: {
        isExpired: false,
        lastSeenAt: {
          lt: expirationThreshold,
        },
      },
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('\n' + '='.repeat(50));
    console.log('📊 RÉSUMÉ NETTOYAGE');
    console.log('='.repeat(50));
    console.log(`🗑️ Deals supprimés: ${deleteResult.count}`);
    console.log(`⏱️ Durée: ${elapsed}s`);
    console.log(`📅 Terminé: ${new Date().toISOString()}`);

    console.log('\n✅ [CLOUD JOB] Nettoyage terminé!');
    process.exit(0);

  } catch (error) {
    console.error('❌ [CLOUD JOB] Erreur fatale:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(err => {
  console.error('❌ [CLOUD JOB] Erreur non gérée:', err);
  process.exit(1);
});