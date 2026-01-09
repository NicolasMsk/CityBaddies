import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const deals = await prisma.deal.findMany({
    where: { score: { gte: 70 } },
    select: { 
      score: true,
      dealPrice: true,
      volume: true, // Volume est sur Deal, pas Product
      product: {
        select: {
          name: true,
          merchant: { select: { slug: true } }
        }
      }
    },
    orderBy: { score: 'desc' },
    take: 20,
  });
  
  console.log('Deals avec score >= 70:');
  deals.forEach((d, i) => console.log(`${i + 1}. Score: ${d.score} | Volume: "${d.volume || 'VIDE'}" | ${d.product.name.substring(0, 50)}`));
}

main().finally(() => prisma.$disconnect());
