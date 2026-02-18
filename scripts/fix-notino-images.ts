/**
 * Migration : Upgrade les images Notino de list_2k (5KB, flou) vers detail_zoom (30KB, HD)
 * 
 * Usage: npx tsx scripts/fix-notino-images.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🖼️  Migration images Notino : list_2k → detail_zoom\n');

  // Récupérer tous les produits Notino avec une image list_2k ou list
  const products = await prisma.product.findMany({
    where: {
      imageUrl: { contains: 'cdn.notinoimg.com' },
    },
    select: { id: true, imageUrl: true, name: true },
  });

  console.log(`📦 ${products.length} produits Notino trouvés`);

  let upgraded = 0;
  let alreadyHD = 0;
  let errors = 0;

  for (const product of products) {
    const oldUrl = product.imageUrl || '';

    // Déjà en detail_zoom ?
    if (oldUrl.includes('/detail_zoom/')) {
      alreadyHD++;
      continue;
    }

    // Upgrade list, list_2k, ou detail vers detail_zoom
    if (oldUrl.match(/\/(list|list_2k|detail)\//)) {
      const newUrl = oldUrl.replace(/\/(list|list_2k|detail)\//, '/detail_zoom/');

      // Vérifier que l'URL HD existe
      try {
        const res = await fetch(newUrl, { method: 'HEAD' });
        if (res.ok) {
          await prisma.product.update({
            where: { id: product.id },
            data: { imageUrl: newUrl },
          });
          upgraded++;
          if (upgraded <= 5) {
            console.log(`  ✅ ${product.name?.substring(0, 40)}`);
            console.log(`     ${oldUrl}`);
            console.log(`     → ${newUrl}`);
          }
        } else {
          // L'image HD n'existe pas, on garde l'ancienne
          errors++;
        }
      } catch {
        errors++;
      }
    }
  }

  console.log(`\n${'═'.repeat(50)}`);
  console.log(`✅ Upgradés: ${upgraded}`);
  console.log(`🔵 Déjà HD: ${alreadyHD}`);
  console.log(`⚠️  Pas de HD dispo: ${errors}`);
  console.log(`${'═'.repeat(50)}`);

  await prisma.$disconnect();
}

main().catch(console.error);
