import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔥 TOP 5 DEALS SEPHORA — Les mieux notés\n');
  console.log('='.repeat(120));

  const deals = await prisma.deal.findMany({
    where: {
      status: 'ACTIVE',
      product: {
        merchant: { slug: 'sephora' },
      },
    },
    include: {
      product: {
        include: {
          category: true,
          merchant: true,
          brandRef: true,
        },
      },
      variant: true,
      competitorPrices: {
        include: { merchant: true },
      },
    },
    orderBy: { score: 'desc' },
    take: 5,
  });

  if (deals.length === 0) {
    console.log('\n❌ Aucun deal Sephora actif trouvé.');
    return;
  }

  for (let i = 0; i < deals.length; i++) {
    const deal = deals[i];
    const p = deal.product;

    console.log(`\n${'─'.repeat(120)}`);
    console.log(`  #${i + 1} — SCORE: ${deal.score}/100`);
    console.log(`${'─'.repeat(120)}`);

    // --- Deal ---
    console.log('\n  📦 DEAL');
    console.log(`     ID:              ${deal.id}`);
    console.log(`     Titre:           ${deal.refinedTitle || deal.title}`);
    console.log(`     Titre brut:      ${deal.title}`);
    console.log(`     Description:     ${deal.description || '—'}`);
    console.log(`     Why good deal:   ${deal.whyGoodDeal ? deal.whyGoodDeal.substring(0, 150) + '...' : '—'}`);
    console.log(`     Type:            ${deal.type}`);
    console.log(`     Statut:          ${deal.status}`);
    console.log(`     Tags:            ${deal.tags || '—'}`);
    console.log(`     Code promo:      ${deal.promoCode || '—'}`);
    console.log(`     Source URL:      ${deal.sourceUrl || '—'}`);

    // --- Prix ---
    console.log('\n  💰 PRIX');
    console.log(`     Prix deal:       ${deal.dealPrice}€`);
    console.log(`     Prix original:   ${deal.originalPrice}€`);
    console.log(`     Réduction:       -${deal.discountPercent}% (${deal.discountAmount}€ d'économie)`);
    console.log(`     Prix/unité:      ${deal.pricePerUnit ? `${deal.pricePerUnit.toFixed(2)}€/ml` : '—'}`);

    // --- Volume ---
    if (deal.variant) {
      console.log(`     Volume:          ${deal.variant.volumeValue}${deal.variant.volumeUnit} (EAN: ${deal.variant.ean || '—'})`);
    } else if (deal.volume) {
      console.log(`     Volume (legacy): ${deal.volume}`);
    }

    // --- Produit ---
    console.log('\n  🧴 PRODUIT');
    console.log(`     ID:              ${p.id}`);
    console.log(`     Nom:             ${p.name}`);
    console.log(`     Slug:            ${p.slug}`);
    console.log(`     Marque:          ${p.brand || '—'} ${p.brandRef ? `(${p.brandRef.name}, Tier ${p.brandRef.tier})` : ''}`);
    console.log(`     Catégorie:       ${p.category?.name || '—'} (${p.category?.slug || '—'})`);
    console.log(`     Sous-catégorie:  ${p.subcategory || '—'}`);
    console.log(`     Sous-sous-cat:   ${p.subsubcategory || '—'}`);
    console.log(`     Marchand:        ${p.merchant.name}`);
    console.log(`     URL produit:     ${p.productUrl}`);
    console.log(`     Image:           ${p.imageUrl || '—'}`);
    console.log(`     Labels:          ${p.labels || '—'}`);
    console.log(`     Tailles dispo:   ${p.availableSizes || '—'}`);

    // --- Métriques ---
    console.log('\n  📊 MÉTRIQUES');
    console.log(`     Score:           ${deal.score}/100`);
    console.log(`     Brand Tier:      ${deal.brandTier} (1=Luxe, 2=Moyen, 3=Entrée)`);
    console.log(`     Hot:             ${deal.isHot ? '🔥 OUI' : 'Non'}`);
    console.log(`     Trending:        ${deal.isTrending ? '📈 OUI' : 'Non'}`);
    console.log(`     Votes:           ${deal.votes}`);
    console.log(`     Vues:            ${deal.views}`);

    // --- Dates ---
    console.log('\n  📅 DATES');
    console.log(`     Créé:            ${deal.createdAt.toLocaleDateString('fr-FR')} ${deal.createdAt.toLocaleTimeString('fr-FR')}`);
    console.log(`     Mis à jour:      ${deal.updatedAt.toLocaleDateString('fr-FR')} ${deal.updatedAt.toLocaleTimeString('fr-FR')}`);
    console.log(`     Dernier vu:      ${deal.lastSeenAt.toLocaleDateString('fr-FR')} ${deal.lastSeenAt.toLocaleTimeString('fr-FR')}`);
    console.log(`     Début promo:     ${deal.startDate.toLocaleDateString('fr-FR')}`);
    console.log(`     Fin promo:       ${deal.endDate ? deal.endDate.toLocaleDateString('fr-FR') : '—'}`);

    // --- Prix concurrents ---
    if (deal.competitorPrices.length > 0) {
      console.log('\n  🏷️ PRIX CONCURRENTS');
      for (const cp of deal.competitorPrices) {
        const cpDiscount = cp.discountPercent ? ` (-${cp.discountPercent}%)` : '';
        console.log(`     ${cp.merchantName.padEnd(15)} ${cp.currentPrice}€${cpDiscount} — ${cp.productUrl}`);
      }
    }
  }

  console.log(`\n${'='.repeat(120)}`);
  console.log(`\n✅ ${deals.length} deals Sephora affichés (triés par score décroissant)\n`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
