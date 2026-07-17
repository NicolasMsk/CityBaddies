/**
 * Expire les offres suivies qui ne sont PLUS vues sur les fiches marchandes.
 *
 * Problème résolu : le tracker n'expire jamais un Deal. Quand un parfum quitte
 * une enseigne (404) ou qu'Akamai bloque durablement un marchand, l'offre reste
 * ACTIVE avec un prix mort + un lien vers une 404, étiquetée « prix vérifié
 * le [vieille date] » — le pire défaut pour un comparateur.
 *
 * Règle : une offre ACTIVE/tracked dont `lastSeenAt` remonte à plus de
 * STALE_DAYS jours passe en EXPIRED. Seuil généreux (3 j) : les crons tournent
 * 6×/jour, donc 3 jours sans être revue = la fiche échoue/absente de façon
 * persistante, pas un simple blocage ponctuel. Réversible : si la fiche
 * réapparaît, track-prices repasse le deal en ACTIVE au relevé suivant
 * (track-prices.ts écrit status:'ACTIVE' à chaque écriture).
 *
 * Idempotent. Usage : npx tsx src/scripts/expire-stale-deals.ts [--days N] [--dry-run]
 * Branché dans track-prices.yml (1×/run, job marionnaud), après le sync.
 */
import 'dotenv/config';
import prisma from '../lib/prisma';

async function main() {
  const args = process.argv.slice(2);
  const daysIdx = args.indexOf('--days');
  const STALE_DAYS = daysIdx >= 0 ? parseInt(args[daysIdx + 1], 10) : 3;
  const dryRun = args.includes('--dry-run');

  const cutoff = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000);

  const stale = await prisma.deal.findMany({
    where: {
      status: 'ACTIVE',
      type: 'tracked',
      lastSeenAt: { lt: cutoff },
    },
    select: {
      id: true,
      dealPrice: true,
      lastSeenAt: true,
      product: { select: { name: true } },
      merchant: { select: { slug: true } },
    },
  });

  console.log(`Offres ACTIVE/tracked non revues depuis > ${STALE_DAYS} j : ${stale.length}`);
  for (const d of stale.slice(0, 30)) {
    const days = d.lastSeenAt ? Math.round((Date.now() - d.lastSeenAt.getTime()) / 864e5) : '?';
    console.log(`  ${dryRun ? '~' : '✗'} ${d.product.name} | ${d.merchant.slug} | ${d.dealPrice}€ | vue il y a ${days} j`);
  }
  if (stale.length > 30) console.log(`  … +${stale.length - 30} autres`);

  if (!dryRun && stale.length > 0) {
    const res = await prisma.deal.updateMany({
      where: { id: { in: stale.map((d) => d.id) } },
      data: { status: 'EXPIRED' },
    });
    console.log(`→ ${res.count} offre(s) passée(s) en EXPIRED.`);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
