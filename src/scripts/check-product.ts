import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Chercher Chanel Douceur
  const products = await prisma.product.findMany({
    where: { 
      OR: [
        { name: { contains: 'Douceur' } },
        { name: { contains: 'Anti-poches' } },
      ]
    },
    include: { 
      deals: true, 
      merchant: true,
      priceHistory: {
        orderBy: { date: 'desc' },
        take: 5,
      },
    },
  });

  for (const p of products) {
    if (!p.name.toLowerCase().includes('chanel') && !p.name.toLowerCase().includes('clinique')) continue;
    
    console.log('=== PRODUIT ===');
    console.log('Nom:', p.name);
    console.log('Marque:', p.brand);
    console.log('Merchant:', p.merchant.name);
    console.log('URL:', p.productUrl);
    
    for (const d of p.deals) {
      console.log('\n=== DEAL ===');
      console.log('Prix actuel (dealPrice):', d.dealPrice);
      console.log('Prix original:', d.originalPrice);
      console.log('Discount:', d.discountPercent + '%');
      console.log('Volume:', d.volume);
      console.log('Créé le:', d.createdAt);
      console.log('Mis à jour le:', d.updatedAt);
    }
    
    if (p.priceHistory.length > 0) {
      console.log('\n=== HISTORIQUE PRIX ===');
      for (const h of p.priceHistory) {
        console.log(`  ${h.date.toISOString().slice(0, 16)}: ${h.price}€`);
      }
    }
    
    console.log('\n-------------------\n');
  }
}

main().finally(() => prisma.$disconnect());
