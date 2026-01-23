import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Chercher les sources contenant "soin" ou "contour"
  const sources = await prisma.scrapingSource.findMany({
    where: {
      merchant: { slug: 'nocibe' },
      OR: [
        { url: { contains: 'soin' } },
        { url: { contains: 'contour' } },
        { url: { contains: 'yeux' } },
      ],
    },
    select: { url: true, name: true },
  });

  console.log(`Sources Nocibé "soin/contour/yeux" (${sources.length}):\n`);
  sources.forEach(s => console.log(s.url));
  
  // Chercher aussi les sources "bons-plans" qui peuvent contenir ce produit
  const promoSources = await prisma.scrapingSource.findMany({
    where: {
      merchant: { slug: 'nocibe' },
      url: { contains: 'bons-plans' },
    },
    select: { url: true, name: true },
  });
  
  console.log(`\nSources "bons-plans" (${promoSources.length}):\n`);
  promoSources.forEach(s => console.log(s.url));
}

main().finally(() => prisma.$disconnect());
