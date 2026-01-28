/**
 * Cloud Job: Expire Deals
 * 
 * Ce script analyse les deals affichés sur le site et détecte :
 * 1. Les deals qui n'ont plus de promo (originalPrice = dealPrice)
 * 2. Les changements de prix significatifs
 * 3. Les deals non vus depuis X jours (suppression)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Configuration
const DAYS_BEFORE_DELETION = parseInt(process.env.DAYS_BEFORE_DELETION || '7');
const PRICE_CHANGE_THRESHOLD = 0.05; // 5% de changement pour être significatif

interface DealChange {
  id: string;
  name: string;
  merchant: string;
  changeType: 'PROMO_ENDED' | 'PRICE_INCREASE' | 'PRICE_DECREASE' | 'NOT_SEEN';
  oldPrice?: number;
  newPrice?: number;
  originalPrice?: number;
}

async function main() {
  console.log('========================================');
  console.log('   EXPIRE DEALS - Analyse des promos   ');
  console.log('========================================\n');

  const now = new Date();
  const deletionThreshold = new Date(now.getTime() - DAYS_BEFORE_DELETION * 24 * 60 * 60 * 1000);

  const changes: DealChange[] = [];
  
  // 1. Récupérer tous les deals actifs
  const activeDeals = await prisma.deal.findMany({
    include: {
      product: {
        include: {
          merchant: true,
          priceHistory: {
            orderBy: { date: 'desc' },
            take: 2, // Dernier prix et avant-dernier
          }
        }
      }
    }
  });

  console.log(`[INFO] ${activeDeals.length} deals actifs trouvés\n`);

  // 2. Analyser chaque deal
  for (const deal of activeDeals) {
    const merchantName = deal.product?.merchant?.name || 'Unknown';
    const dealName = deal.title;
    
    // Vérifier si le deal n'a plus de promo (originalPrice = dealPrice)
    if (deal.originalPrice && deal.dealPrice) {
      const priceDiff = Math.abs(deal.originalPrice - deal.dealPrice);
      const isNoLongerOnSale = priceDiff < 0.01; // Moins de 1 centime de différence
      
      if (isNoLongerOnSale) {
        changes.push({
          id: deal.id,
          name: dealName,
          merchant: merchantName,
          changeType: 'PROMO_ENDED',
          oldPrice: deal.dealPrice,
          newPrice: deal.originalPrice,
          originalPrice: deal.originalPrice,
        });
        continue; // Pas besoin d'analyser plus
      }
    }

    // Vérifier les changements de prix significatifs via l'historique du produit
    if (deal.product?.priceHistory && deal.product.priceHistory.length >= 2) {
      const latestPrice = deal.product.priceHistory[0].price;
      const previousPrice = deal.product.priceHistory[1].price;
      
      if (previousPrice > 0) {
        const priceChange = (latestPrice - previousPrice) / previousPrice;
        
        if (Math.abs(priceChange) >= PRICE_CHANGE_THRESHOLD) {
          changes.push({
            id: deal.id,
            name: dealName,
            merchant: merchantName,
            changeType: priceChange > 0 ? 'PRICE_INCREASE' : 'PRICE_DECREASE',
            oldPrice: previousPrice,
            newPrice: latestPrice,
            originalPrice: deal.originalPrice || undefined,
          });
        }
      }
    }

    // Vérifier si le deal n'a pas été vu depuis longtemps
    if (deal.lastSeenAt && deal.lastSeenAt < deletionThreshold) {
      changes.push({
        id: deal.id,
        name: dealName,
        merchant: merchantName,
        changeType: 'NOT_SEEN',
      });
    }
  }

  // 3. Afficher les résultats
  console.log('========================================');
  console.log('        RESULTATS DE L\'ANALYSE         ');
  console.log('========================================\n');

  // Promos terminées
  const promoEnded = changes.filter(c => c.changeType === 'PROMO_ENDED');
  if (promoEnded.length > 0) {
    console.log(`\n[PROMO TERMINEE] ${promoEnded.length} deal(s) sans promo:\n`);
    for (const change of promoEnded) {
      console.log(`  - ${change.merchant} | ${change.name}`);
      console.log(`    Prix actuel: ${change.newPrice}EUR = Prix original: ${change.originalPrice}EUR (plus de remise)`);
    }
  }

  // Augmentations de prix
  const priceIncreases = changes.filter(c => c.changeType === 'PRICE_INCREASE');
  if (priceIncreases.length > 0) {
    console.log(`\n[HAUSSE DE PRIX] ${priceIncreases.length} deal(s) avec augmentation:\n`);
    for (const change of priceIncreases) {
      const increase = change.newPrice && change.oldPrice 
        ? ((change.newPrice - change.oldPrice) / change.oldPrice * 100).toFixed(1) 
        : '?';
      console.log(`  - ${change.merchant} | ${change.name}`);
      console.log(`    ${change.oldPrice}EUR -> ${change.newPrice}EUR (+${increase}%)`);
    }
  }

  // Baisses de prix
  const priceDecreases = changes.filter(c => c.changeType === 'PRICE_DECREASE');
  if (priceDecreases.length > 0) {
    console.log(`\n[BAISSE DE PRIX] ${priceDecreases.length} deal(s) avec baisse:\n`);
    for (const change of priceDecreases) {
      const decrease = change.newPrice && change.oldPrice 
        ? ((change.oldPrice - change.newPrice) / change.oldPrice * 100).toFixed(1) 
        : '?';
      console.log(`  - ${change.merchant} | ${change.name}`);
      console.log(`    ${change.oldPrice}EUR -> ${change.newPrice}EUR (-${decrease}%)`);
    }
  }

  // Deals non vus
  const notSeen = changes.filter(c => c.changeType === 'NOT_SEEN');
  if (notSeen.length > 0) {
    console.log(`\n[NON VU] ${notSeen.length} deal(s) non vus depuis ${DAYS_BEFORE_DELETION} jours:\n`);
    for (const change of notSeen) {
      console.log(`  - ${change.merchant} | ${change.name}`);
    }
  }

  // 4. Actions à effectuer
  console.log('\n========================================');
  console.log('            ACTIONS                    ');
  console.log('========================================\n');

  // Marquer comme expiré les deals avec promo terminée
  if (promoEnded.length > 0) {
    console.log(`[ACTION] Marquage expire de ${promoEnded.length} deal(s) sans promo...`);
    await prisma.deal.updateMany({
      where: {
        id: { in: promoEnded.map(c => c.id) }
      },
      data: {
        isExpired: true
      }
    });
    console.log(`[OK] ${promoEnded.length} deal(s) sans promo marques comme expires`);
  }

  // Marquer comme expiré les deals avec hausse de prix significative (promo terminée)
  if (priceIncreases.length > 0) {
    console.log(`[ACTION] Marquage expire de ${priceIncreases.length} deal(s) avec hausse de prix (promo terminee)...`);
    await prisma.deal.updateMany({
      where: {
        id: { in: priceIncreases.map(c => c.id) }
      },
      data: {
        isExpired: true
      }
    });
    console.log(`[OK] ${priceIncreases.length} deal(s) avec hausse de prix marques comme expires`);
  }

  // Marquer comme expiré les deals non vus
  if (notSeen.length > 0) {
    console.log(`[ACTION] Marquage expire de ${notSeen.length} deal(s) non vus...`);
    await prisma.deal.updateMany({
      where: {
        id: { in: notSeen.map(c => c.id) }
      },
      data: {
        isExpired: true
      }
    });
    console.log(`[OK] ${notSeen.length} deal(s) non vus marques comme expires`);
  }

  // Résumé final
  const totalExpired = promoEnded.length + priceIncreases.length + notSeen.length;
  console.log('\n========================================');
  console.log('            RESUME                     ');
  console.log('========================================');
  console.log(`  Promos terminees:    ${promoEnded.length}`);
  console.log(`  Hausses de prix:     ${priceIncreases.length} (expires)`);
  console.log(`  Baisses de prix:     ${priceDecreases.length} (gardes)`);
  console.log(`  Non vus (${DAYS_BEFORE_DELETION}j):       ${notSeen.length}`);
  console.log(`  ----------------------------`);
  console.log(`  Total expire:        ${totalExpired}`);
  console.log(`  Deals restants:      ${activeDeals.length - totalExpired}`);
  console.log('========================================\n');
}

main()
  .catch((error) => {
    console.error('[ERREUR]', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
