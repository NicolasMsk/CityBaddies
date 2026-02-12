/**
 * Expire les deals ACTIVE/PENDING avec un score < 6
 * Usage: npx tsx scripts/expire-low-scores.ts [--dry-run]
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  const deals = await prisma.deal.findMany({
    where: {
      status: { in: ['ACTIVE', 'PENDING'] },
      score: { lt: 6, gt: 0 },
    },
    select: { id: true, score: true, title: true, status: true },
  });

  console.log(`📋 ${deals.length} deals avec score < 6 à expirer\n`);

  for (const deal of deals) {
    console.log(`  🚫 score=${deal.score} | ${deal.status} | ${(deal.title || '').substring(0, 70)}`);
    
    if (!DRY_RUN) {
      await prisma.deal.update({
        where: { id: deal.id },
        data: { status: 'EXPIRED' },
      });
    }
  }

  if (DRY_RUN) {
    console.log(`\n🧪 Mode dry-run — rien modifié`);
  } else {
    console.log(`\n✅ ${deals.length} deals passés en EXPIRED`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
