import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const deal = await prisma.deal.findFirst({
    where: { pricePerUnit: { not: null } },
    select: {
      title: true,
      volume: true,
      volumeValue: true,
      volumeUnit: true,
      pricePerUnit: true,
      dealPrice: true,
    },
  });

  console.log('Exemple deal avec pricePerUnit:');
  console.log(JSON.stringify(deal, null, 2));

  // Calculer le prix au 100ml
  if (deal?.pricePerUnit && deal?.volumeUnit) {
    const pricePer100 = deal.pricePerUnit * 100;
    console.log(`\n=> Prix au 100${deal.volumeUnit}: ${pricePer100.toFixed(2)} €`);
  }

  // Stats
  const stats = await prisma.deal.aggregate({
    _count: { pricePerUnit: true },
  });
  console.log(`\nDeals avec pricePerUnit: ${stats._count.pricePerUnit}`);
}

main().finally(() => prisma.$disconnect());
