const { PrismaClient } = require('./node_modules/.prisma/client');
const p = new PrismaClient();

async function main() {
  const deals = await p.deal.findMany({
    where: { merchant: { slug: 'sephora' }, status: 'ACTIVE' },
    select: { imageUrl: true },
    take: 10,
  });
  const urls = deals.map(x => x.imageUrl).filter(Boolean);
  const domains = [...new Set(urls.map(u => new URL(u).hostname))];
  console.log('Domaines Sephora:', domains);
  console.log('Exemples:', urls.slice(0, 3));
}

main().finally(() => p.$disconnect());
