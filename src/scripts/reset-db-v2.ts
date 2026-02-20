/**
 * Reset complet de la DB pour la V2
 * Supprime tous les deals, products, price history, competitor prices, etc.
 * Garde uniquement les structures (categories, merchants, brands)
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔥 RESET DB V2 - Suppression de toutes les données scraping\n');
  console.log('⚠️  Cette action va supprimer TOUTES les données de deals/products/prices');
  console.log('    Les catégories, marchands et marques seront conservés.\n');

  // Suppression en cascade (ordre important pour respecter les relations)
  console.log('1️⃣  Suppression des votes/favoris/commentaires...');
  await prisma.vote.deleteMany({});
  await prisma.favorite.deleteMany({});
  await prisma.comment.deleteMany({});
  await prisma.promoCodeVote.deleteMany({});
  
  console.log('2️⃣  Suppression des guides d\'achat...');
  await prisma.buyingGuideProduct.deleteMany({});
  await prisma.buyingGuide.deleteMany({});
  
  console.log('3️⃣  Suppression des deals...');
  const dealsDeleted = await prisma.deal.deleteMany({});
  console.log(`   ✅ ${dealsDeleted.count} deals supprimés`);
  
  console.log('5️⃣  Suppression de l\'historique des prix...');
  const priceHistoryDeleted = await prisma.priceHistory.deleteMany({});
  console.log(`   ✅ ${priceHistoryDeleted.count} prix supprimés`);
  
  console.log('6️⃣  Suppression des variantes produits...');
  const variantsDeleted = await prisma.productVariant.deleteMany({});
  console.log(`   ✅ ${variantsDeleted.count} variantes supprimées`);
  
  console.log('7️⃣  Suppression des produits...');
  const productsDeleted = await prisma.product.deleteMany({});
  console.log(`   ✅ ${productsDeleted.count} produits supprimés`);
  
  console.log('8️⃣  Suppression des sources de scraping...');
  const sourcesDeleted = await prisma.scrapingSource.deleteMany({});
  console.log(`   ✅ ${sourcesDeleted.count} sources supprimées`);
  
  console.log('9️⃣  Suppression des codes promo...');
  const promoCodesDeleted = await prisma.promoCode.deleteMany({});
  console.log(`   ✅ ${promoCodesDeleted.count} codes promo supprimés`);
  
  console.log('🔟 Suppression des pages promo marchands...');
  const promoPages = await prisma.merchantPromoPage.deleteMany({});
  console.log(`   ✅ ${promoPages.count} pages promo supprimées`);

  console.log('\n✅ BASE DE DONNÉES RESET COMPLÈTE');
  console.log('\n📊 Ce qui reste:');
  const categoriesCount = await prisma.category.count();
  const merchantsCount = await prisma.merchant.count();
  const brandsCount = await prisma.brand.count();
  const usersCount = await prisma.user.count();
  
  console.log(`   - ${categoriesCount} catégories`);
  console.log(`   - ${merchantsCount} marchands`);
  console.log(`   - ${brandsCount} marques`);
  console.log(`   - ${usersCount} utilisateurs`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('❌ Erreur:', err);
  process.exit(1);
});
