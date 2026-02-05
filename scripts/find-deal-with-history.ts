/**
 * Script pour trouver un deal avec au moins 3 points dans PriceHistory
 * avec des variations de prix
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function findDealWithHistory() {
  console.log('🔍 Recherche de deals avec historique de prix...\n');

  // Récupérer tous les produits avec leur historique de prix
  const products = await prisma.product.findMany({
    where: {
      priceHistory: {
        some: {}
      },
      deals: {
        some: {
          status: 'ACTIVE'
        }
      }
    },
    include: {
      priceHistory: {
        orderBy: { date: 'asc' }
      },
      deals: {
        where: { status: 'ACTIVE' },
        take: 1
      }
    }
  });

  console.log(`📊 ${products.length} produits trouvés avec historique\n`);

  // Filtrer les produits avec au moins 3 points et variation de prix
  const validProducts = products.filter(product => {
    const history = product.priceHistory;
    if (history.length <= 2) return false;

    // Vérifier qu'il y a variation de prix
    const firstPrice = history[0].price;
    const hasVariation = history.some(ph => Math.abs(ph.price - firstPrice) >= 0.01);
    
    return hasVariation;
  });

  console.log(`✅ ${validProducts.length} produits avec historique valide (3+ points, avec variation)\n`);

  if (validProducts.length === 0) {
    console.log('❌ Aucun deal trouvé avec les critères requis');
    console.log('\n💡 Suggestions:');
    console.log('   1. Créer manuellement des points dans PriceHistory');
    console.log('   2. Attendre que les scrapings quotidiens créent plus de données');
    console.log('   3. Exécuter plusieurs fois les scrapers pour générer des variations\n');
    return;
  }

  // Afficher les 10 premiers
  console.log('🎯 Top 10 deals avec le meilleur historique:\n');
  
  validProducts
    .sort((a, b) => b.priceHistory.length - a.priceHistory.length)
    .slice(0, 10)
    .forEach((product, index) => {
      const deal = product.deals[0];
      const history = product.priceHistory;
      const prices = history.map(ph => ph.price);
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      
      console.log(`${index + 1}. Product ID: ${product.id}`);
      console.log(`   Deal ID: ${deal.id}`);
      console.log(`   Produit: ${product.name.substring(0, 60)}...`);
      console.log(`   Points: ${history.length}`);
      console.log(`   Prix min: ${minPrice}€ | max: ${maxPrice}€ | variation: ${((maxPrice - minPrice) / minPrice * 100).toFixed(1)}%`);
      console.log(`   URL: http://localhost:3000/deals/${deal.id}`);
      console.log('');
    });

  // Afficher la commande pour voir le premier
  const firstDeal = validProducts[0].deals[0];
  console.log(`\n🌐 Pour voir le graphique, visitez:`);
  console.log(`   http://localhost:3000/deals/${firstDeal.id}\n`);
}

findDealWithHistory()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
