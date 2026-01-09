import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function stats() {
  const products = await prisma.product.count();
  const deals = await prisma.deal.count();
  const history = await prisma.priceHistory.count();
  console.log(`📊 Stats: ${products} produits, ${deals} deals, ${history} historiques`);
  
  // Vérifier les produits avec plusieurs deals
  const multiDeals = await prisma.$queryRaw`
    SELECT productId, COUNT(*) as count 
    FROM Deal 
    GROUP BY productId 
    HAVING count > 1
  ` as any[];
  if (multiDeals.length > 0) {
    console.log(`\n⚠️ ${multiDeals.length} produits avec plusieurs deals !`);
  } else {
    console.log(`\n✅ Chaque produit a un seul deal (pas de duplicatas)`);
  }
  
  // Vérifier l'historique des prix
  const historyStats = await prisma.$queryRaw`
    SELECT productId, COUNT(*) as entries
    FROM PriceHistory 
    GROUP BY productId 
    ORDER BY entries DESC
    LIMIT 5
  ` as any[];
  console.log(`\n📈 Historique des prix (top 5):`);
  for (const h of historyStats) {
    const product = await prisma.product.findUnique({ where: { id: h.productId }, select: { name: true } });
    console.log(`  ${product?.name?.substring(0, 40)}... : ${h.entries} entrées`);
  }
  
  // Voir les variantes de taille (même nom, volumes différents)
  const variants = await prisma.deal.findMany({
    where: { product: { name: { contains: 'Lancôme' } } },
    select: { volume: true, dealPrice: true, product: { select: { name: true, id: true } } },
  });
  if (variants.length > 0) {
    console.log(`\n🔍 Exemple variantes Lancôme:`);
    for (const v of variants.slice(0, 5)) {
      console.log(`  ${v.product.name.substring(0, 35)}... | ${v.volume} | ${v.dealPrice}€`);
    }
  }
}

async function clean() {
  console.log('Nettoyage de la base...');
  await prisma.priceHistory.deleteMany();
  await prisma.deal.deleteMany();
  await prisma.product.deleteMany();
  console.log('✅ Base nettoyée (produits, deals, historique)');
}

// Trouver et supprimer les produits dupliqués (même URL)
async function dedupe() {
  console.log('🔍 Recherche des produits dupliqués par URL...\n');
  
  const products = await prisma.product.findMany({
    include: { deals: true, priceHistory: true },
    orderBy: { createdAt: 'asc' }, // Garder le plus ancien
  });
  
  const seen = new Map<string, string>(); // URL -> premier productId
  const toDelete: string[] = [];
  
  for (const product of products) {
    if (seen.has(product.productUrl)) {
      toDelete.push(product.id);
      console.log(`  ❌ Duplicata: ${product.name.substring(0, 50)}...`);
      console.log(`     URL: ${product.productUrl.substring(0, 70)}...`);
    } else {
      seen.set(product.productUrl, product.id);
    }
  }
  
  if (toDelete.length === 0) {
    console.log('✅ Aucun produit dupliqué trouvé !');
    return;
  }
  
  console.log(`\n📊 ${toDelete.length} produits dupliqués à supprimer`);
  console.log('Suppression en cours...');
  
  // Supprimer les deals et historique associés, puis les produits
  await prisma.priceHistory.deleteMany({ where: { productId: { in: toDelete } } });
  await prisma.deal.deleteMany({ where: { productId: { in: toDelete } } });
  await prisma.product.deleteMany({ where: { id: { in: toDelete } } });
  
  console.log(`✅ ${toDelete.length} produits dupliqués supprimés !`);
}

const args = process.argv.slice(2);
if (args.includes('--stats')) {
  stats().catch(console.error).finally(() => prisma.$disconnect());
} else if (args.includes('--dedupe')) {
  dedupe().catch(console.error).finally(() => prisma.$disconnect());
} else {
  clean().catch(console.error).finally(() => prisma.$disconnect());
}
