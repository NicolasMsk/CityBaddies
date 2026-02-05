/**
 * 📊 Monitoring Daily - Rapport KPI quotidien → Google Sheets
 * 
 * Script complet de Data Analytics pour suivre la santé de la plateforme
 * 
 * Usage:
 *   npx tsx src/scripts/monitoring-daily.ts
 * 
 * Variables d'environnement:
 *   - DATABASE_URL
 *   - GOOGLE_SHEETS_CREDENTIALS
 *   - GOOGLE_SHEETS_SPREADSHEET_ID
 */

import { PrismaClient } from '@prisma/client';
import { google } from 'googleapis';

const prisma = new PrismaClient();

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
const SHEET_NAME = 'Job_KPI';

// ============================================================
// INTERFACE DES MÉTRIQUES
// ============================================================

interface DailyMetrics {
  // Date & Timestamp
  date: string;
  timestamp: string;
  
  // KPIs Business
  totalActiveDeals: number;
  totalPendingDeals: number;
  totalExpiredDeals: number;
  activationRate: number;
  
  // Par Merchant
  nocibeActive: number;
  nocibePending: number;
  nocibeExpired: number;
  nocibeTotalProducts: number;
  
  sephoraActive: number;
  sephoraPending: number;
  sephoraExpired: number;
  sephoraTotalProducts: number;
  
  marionnaudActive: number;
  marionnaudPending: number;
  marionnaudExpired: number;
  marionnaudTotalProducts: number;
  
  // Variations 24h
  newDeals24h: number;
  activatedDeals24h: number;
  expiredDeals24h: number;
  netGrowth24h: number;
  
  // Variations 7j
  newDeals7d: number;
  expiredDeals7d: number;
  netGrowth7d: number;
  
  // Qualité données
  dealsWithImages: number;
  dealsWithoutImages: number;
  imageCompletionRate: number;
  
  dealsEnriched: number;
  dealsFullyEnriched: number;
  enrichmentRate: number;
  fullEnrichmentRate: number;
  
  dealsWithVariants: number;
  variantCompletionRate: number;
  
  // Performance
  avgDiscountPercent: number;
  avgScore: number;
  dealsHot: number;
  dealsTrending: number;
  
  // Produits
  totalProducts: number;
  productsWithDeals: number;
  productsWithoutDeals: number;
  productCoverageRate: number;
  
  // Prix
  avgDealPrice: number;
  avgOriginalPrice: number;
  avgSavings: number;
  
  // Fraîcheur
  dealsSeenToday: number;
  dealsNotSeenSince24h: number;
  dealsNotSeenSince7d: number;
  freshnessRate: number;
  
  // Top Deals
  topDealByDiscount: string;
  topDiscountValue: number;
  topDealByScore: string;
  topScoreValue: number;
  
  // Alertes
  alerts: string[];
  criticalAlerts: number;
  warningAlerts: number;
}

// ============================================================
// GOOGLE SHEETS CLIENT
// ============================================================

async function getGoogleSheetsClient() {
  const credentials = process.env.GOOGLE_SHEETS_CREDENTIALS;
  
  if (!credentials) {
    throw new Error('GOOGLE_SHEETS_CREDENTIALS non défini dans .env');
  }

  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(credentials),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return google.sheets({ version: 'v4', auth });
}

// ============================================================
// COLLECTE DES MÉTRIQUES
// ============================================================

async function collectMetrics(): Promise<DailyMetrics> {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  
  console.log('========================================');
  console.log('   📊 COLLECTE DES MÉTRIQUES KPI');
  console.log('========================================\n');

  // ============ 1. KPIs Business ============
  console.log('📈 KPIs Business...');
  
  const [totalActiveDeals, totalPendingDeals, totalExpiredDeals, totalDeals] = await Promise.all([
    prisma.deal.count({ where: { status: 'ACTIVE' } }),
    prisma.deal.count({ where: { status: 'PENDING' } }),
    prisma.deal.count({ where: { status: 'EXPIRED' } }),
    prisma.deal.count(),
  ]);

  const activationRate = totalDeals > 0 ? Math.round((totalActiveDeals / totalDeals) * 100) : 0;
  
  console.log(`  ✅ Deals actifs: ${totalActiveDeals}`);
  console.log(`  ⏸️  Deals pending: ${totalPendingDeals}`);
  console.log(`  ❌ Deals expirés: ${totalExpiredDeals}`);
  console.log(`  📊 Taux d'activation: ${activationRate}%\n`);

  // ============ 2. KPIs par Merchant ============
  console.log('🏪 KPIs par Merchant...');
  
  const dealsByMerchant = await prisma.deal.findMany({
    include: { product: { include: { merchant: true } } },
  });

  const merchantStats = dealsByMerchant.reduce((acc, deal) => {
    const slug = deal.product.merchant.slug;
    if (!acc[slug]) acc[slug] = { active: 0, pending: 0, expired: 0 };
    if (deal.status === 'ACTIVE') acc[slug].active++;
    else if (deal.status === 'PENDING') acc[slug].pending++;
    else if (deal.status === 'EXPIRED') acc[slug].expired++;
    return acc;
  }, {} as Record<string, { active: number; pending: number; expired: number }>);

  const nocibeActive = merchantStats['nocibe']?.active || 0;
  const nocibePending = merchantStats['nocibe']?.pending || 0;
  const nocibeExpired = merchantStats['nocibe']?.expired || 0;
  
  const sephoraActive = merchantStats['sephora']?.active || 0;
  const sephoraPending = merchantStats['sephora']?.pending || 0;
  const sephoraExpired = merchantStats['sephora']?.expired || 0;
  
  const marionnaudActive = merchantStats['marionnaud']?.active || 0;
  const marionnaudPending = merchantStats['marionnaud']?.pending || 0;
  const marionnaudExpired = merchantStats['marionnaud']?.expired || 0;

  const [nocibeTotalProducts, sephoraTotalProducts, marionnaudTotalProducts] = await Promise.all([
    prisma.product.count({ where: { merchant: { slug: 'nocibe' } } }),
    prisma.product.count({ where: { merchant: { slug: 'sephora' } } }),
    prisma.product.count({ where: { merchant: { slug: 'marionnaud' } } }),
  ]);
  
  console.log(`  🟣 Nocibé: ${nocibeActive} actifs | ${nocibePending} pending | ${nocibeExpired} expirés`);
  console.log(`  🟠 Sephora: ${sephoraActive} actifs | ${sephoraPending} pending | ${sephoraExpired} expirés`);
  console.log(`  🔵 Marionnaud: ${marionnaudActive} actifs | ${marionnaudPending} pending | ${marionnaudExpired} expirés\n`);

  // ============ 3. KPIs Variations ============
  console.log('📅 KPIs Variations temporelles...');
  
  const [newDeals24h, activatedDeals24h, expiredDeals24h, newDeals7d, expiredDeals7d] = await Promise.all([
    prisma.deal.count({ where: { createdAt: { gte: yesterday } } }),
    prisma.deal.count({ where: { status: 'ACTIVE', updatedAt: { gte: yesterday } } }),
    prisma.deal.count({ where: { status: 'EXPIRED', updatedAt: { gte: yesterday } } }),
    prisma.deal.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.deal.count({ where: { status: 'EXPIRED', updatedAt: { gte: sevenDaysAgo } } }),
  ]);

  const netGrowth24h = newDeals24h - expiredDeals24h;
  const netGrowth7d = newDeals7d - expiredDeals7d;
  
  console.log(`  ➕ Nouveaux (24h): ${newDeals24h}`);
  console.log(`  ✅ Activés (24h): ${activatedDeals24h}`);
  console.log(`  ➖ Expirés (24h): ${expiredDeals24h}`);
  console.log(`  📊 Croissance nette (24h): ${netGrowth24h >= 0 ? '+' : ''}${netGrowth24h}`);
  console.log(`  📈 Croissance nette (7j): ${netGrowth7d >= 0 ? '+' : ''}${netGrowth7d}\n`);

  // ============ 4. KPIs Qualité ============
  console.log('✨ KPIs Qualité des données...');
  
  const [dealsWithImages, dealsWithoutImages, dealsEnriched, dealsFullyEnriched, dealsWithVariants] = await Promise.all([
    prisma.deal.count({ where: { status: 'ACTIVE', product: { imageUrl: { not: null } } } }),
    prisma.deal.count({ where: { status: 'ACTIVE', product: { imageUrl: null } } }),
    prisma.deal.count({ 
      where: { 
        status: 'ACTIVE',
        OR: [{ refinedTitle: { not: null } }, { whyGoodDeal: { not: null } }] 
      } 
    }),
    prisma.deal.count({ 
      where: { 
        status: 'ACTIVE',
        AND: [{ refinedTitle: { not: null } }, { whyGoodDeal: { not: null } }] 
      } 
    }),
    prisma.deal.count({ where: { status: 'ACTIVE', variantId: { not: null } } }),
  ]);

  const imageCompletionRate = totalActiveDeals > 0 ? Math.round((dealsWithImages / totalActiveDeals) * 100) : 0;
  const enrichmentRate = totalActiveDeals > 0 ? Math.round((dealsEnriched / totalActiveDeals) * 100) : 0;
  const fullEnrichmentRate = totalActiveDeals > 0 ? Math.round((dealsFullyEnriched / totalActiveDeals) * 100) : 0;
  const variantCompletionRate = totalActiveDeals > 0 ? Math.round((dealsWithVariants / totalActiveDeals) * 100) : 0;
  
  console.log(`  🖼️  Images: ${dealsWithImages}/${totalActiveDeals} (${imageCompletionRate}%)`);
  console.log(`  ✍️  Enrichissement partiel: ${dealsEnriched}/${totalActiveDeals} (${enrichmentRate}%)`);
  console.log(`  ✅ Enrichissement complet: ${dealsFullyEnriched}/${totalActiveDeals} (${fullEnrichmentRate}%)`);
  console.log(`  📦 Variantes: ${dealsWithVariants}/${totalActiveDeals} (${variantCompletionRate}%)\n`);

  // ============ 5. KPIs Performance ============
  console.log('🎯 KPIs Performance...');
  
  const performanceStats = await prisma.deal.aggregate({
    where: { status: 'ACTIVE' },
    _avg: { discountPercent: true, score: true, dealPrice: true, originalPrice: true },
  });

  const [dealsHot, dealsTrending] = await Promise.all([
    prisma.deal.count({ where: { status: 'ACTIVE', isHot: true } }),
    prisma.deal.count({ where: { status: 'ACTIVE', isTrending: true } }),
  ]);

  const avgDiscountPercent = performanceStats._avg.discountPercent || 0;
  const avgScore = performanceStats._avg.score || 0;
  const avgDealPrice = performanceStats._avg.dealPrice || 0;
  const avgOriginalPrice = performanceStats._avg.originalPrice || 0;
  const avgSavings = avgOriginalPrice - avgDealPrice;
  
  console.log(`  💰 Remise moyenne: ${avgDiscountPercent.toFixed(1)}%`);
  console.log(`  ⭐ Score moyen: ${avgScore.toFixed(1)}/100`);
  console.log(`  🔥 Deals HOT: ${dealsHot}`);
  console.log(`  📈 Deals TRENDING: ${dealsTrending}`);
  console.log(`  💸 Économie moyenne: ${avgSavings.toFixed(2)}€\n`);

  // ============ 6. KPIs Produits ============
  console.log('📦 KPIs Produits...');
  
  const [totalProducts, productsWithDeals] = await Promise.all([
    prisma.product.count(),
    prisma.product.count({
      where: { deals: { some: { status: 'ACTIVE' } } },
    }),
  ]);

  const productsWithoutDeals = totalProducts - productsWithDeals;
  const productCoverageRate = totalProducts > 0 ? Math.round((productsWithDeals / totalProducts) * 100) : 0;
  
  console.log(`  📊 Produits totaux: ${totalProducts}`);
  console.log(`  ✅ Produits avec deals: ${productsWithDeals} (${productCoverageRate}%)`);
  console.log(`  ❌ Produits sans deals: ${productsWithoutDeals}\n`);

  // ============ 7. KPIs Fraîcheur ============
  console.log('⏰ KPIs Fraîcheur des données...');
  
  const [dealsSeenToday, dealsNotSeenSince24h, dealsNotSeenSince7d] = await Promise.all([
    prisma.deal.count({ where: { status: 'ACTIVE', lastSeenAt: { gte: startOfToday } } }),
    prisma.deal.count({ where: { status: 'ACTIVE', lastSeenAt: { lt: yesterday } } }),
    prisma.deal.count({ where: { status: 'ACTIVE', lastSeenAt: { lt: sevenDaysAgo } } }),
  ]);

  const freshnessRate = totalActiveDeals > 0 ? Math.round((dealsSeenToday / totalActiveDeals) * 100) : 0;
  
  console.log(`  ✅ Vus aujourd'hui: ${dealsSeenToday} (${freshnessRate}%)`);
  console.log(`  ⚠️  Non vus depuis 24h: ${dealsNotSeenSince24h}`);
  console.log(`  🚨 Non vus depuis 7j: ${dealsNotSeenSince7d}\n`);

  // ============ 8. Top Deals ============
  console.log('🏆 Top Deals...');
  
  const [topByDiscount, topByScore] = await Promise.all([
    prisma.deal.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: { discountPercent: 'desc' },
      select: { title: true, discountPercent: true },
    }),
    prisma.deal.findFirst({
      where: { status: 'ACTIVE' },
      orderBy: { score: 'desc' },
      select: { title: true, score: true },
    }),
  ]);

  const topDealByDiscount = topByDiscount?.title || 'N/A';
  const topDiscountValue = topByDiscount?.discountPercent || 0;
  const topDealByScore = topByScore?.title || 'N/A';
  const topScoreValue = topByScore?.score || 0;
  
  console.log(`  🎯 Meilleure remise: ${topDiscountValue}% - ${topDealByDiscount.substring(0, 50)}...`);
  console.log(`  ⭐ Meilleur score: ${topScoreValue}/100 - ${topDealByScore.substring(0, 50)}...\n`);

  // ============ 9. Alertes ============
  console.log('🚨 Analyse des alertes...');
  
  const alerts: string[] = [];
  let criticalAlerts = 0;
  let warningAlerts = 0;

  // Alertes critiques
  if (newDeals24h === 0) {
    alerts.push('🔴 CRITIQUE: Aucun nouveau deal depuis 24h');
    criticalAlerts++;
  }
  if (nocibeActive === 0) { alerts.push('🔴 CRITIQUE: 0 deals Nocibé actifs'); criticalAlerts++; }
  if (sephoraActive === 0) { alerts.push('🔴 CRITIQUE: 0 deals Sephora actifs'); criticalAlerts++; }
  if (marionnaudActive === 0) { alerts.push('🔴 CRITIQUE: 0 deals Marionnaud actifs'); criticalAlerts++; }

  // Alertes warning
  if (totalActiveDeals > 0 && expiredDeals24h / totalActiveDeals > 0.5) {
    alerts.push(`🟠 WARNING: Taux expiration élevé (${Math.round(expiredDeals24h / totalActiveDeals * 100)}%)`);
    warningAlerts++;
  }
  if (fullEnrichmentRate < 50) { alerts.push(`🟠 WARNING: Enrichissement faible (${fullEnrichmentRate}%)`); warningAlerts++; }
  if (imageCompletionRate < 80) { alerts.push(`🟠 WARNING: Images manquantes (${imageCompletionRate}%)`); warningAlerts++; }
  if (freshnessRate < 50) { alerts.push(`🟠 WARNING: Fraîcheur faible (${freshnessRate}%)`); warningAlerts++; }
  if (dealsNotSeenSince7d > 0) { alerts.push(`🟠 WARNING: ${dealsNotSeenSince7d} deals non vus 7j`); warningAlerts++; }
  if (activationRate < 30) { alerts.push(`🟠 WARNING: Activation faible (${activationRate}%)`); warningAlerts++; }

  if (alerts.length > 0) {
    console.log(`  🚨 ${criticalAlerts} critiques | ⚠️ ${warningAlerts} warnings`);
    alerts.forEach(a => console.log(`  ${a}`));
  } else {
    console.log('  ✅ Aucune alerte');
  }
  console.log('');

  return {
    date: now.toLocaleDateString('fr-FR'),
    timestamp: now.toISOString(),
    totalActiveDeals, totalPendingDeals, totalExpiredDeals, activationRate,
    nocibeActive, nocibePending, nocibeExpired, nocibeTotalProducts,
    sephoraActive, sephoraPending, sephoraExpired, sephoraTotalProducts,
    marionnaudActive, marionnaudPending, marionnaudExpired, marionnaudTotalProducts,
    newDeals24h, activatedDeals24h, expiredDeals24h, netGrowth24h,
    newDeals7d, expiredDeals7d, netGrowth7d,
    dealsWithImages, dealsWithoutImages, imageCompletionRate,
    dealsEnriched, dealsFullyEnriched, enrichmentRate, fullEnrichmentRate,
    dealsWithVariants, variantCompletionRate,
    avgDiscountPercent: Number(avgDiscountPercent.toFixed(1)),
    avgScore: Number(avgScore.toFixed(1)),
    dealsHot, dealsTrending,
    totalProducts, productsWithDeals, productsWithoutDeals, productCoverageRate,
    avgDealPrice: Number(avgDealPrice.toFixed(2)),
    avgOriginalPrice: Number(avgOriginalPrice.toFixed(2)),
    avgSavings: Number(avgSavings.toFixed(2)),
    dealsSeenToday, dealsNotSeenSince24h, dealsNotSeenSince7d, freshnessRate,
    topDealByDiscount, topDiscountValue, topDealByScore, topScoreValue,
    alerts, criticalAlerts, warningAlerts,
  };
}

// ============================================================
// EXPORT GOOGLE SHEETS
// ============================================================

async function ensureSheetHeaders() {
  if (!SPREADSHEET_ID) return;

  const sheets = await getGoogleSheetsClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A1:BK1`,
  });

  if (!response.data.values || response.data.values.length === 0) {
    console.log('📝 Création des en-têtes...');
    
    const headers = [
      'Date', 'Timestamp',
      // Business
      'Deals Actifs', 'Deals Inactifs', 'Deals Expirés', 'Taux Activation',
      // Nocibé
      'Nocibé Actifs', 'Nocibé Inactifs', 'Nocibé Expirés', 'Nocibé Produits',
      // Sephora
      'Sephora Actifs', 'Sephora Inactifs', 'Sephora Expirés', 'Sephora Produits',
      // Marionnaud
      'Marionnaud Actifs', 'Marionnaud Inactifs', 'Marionnaud Expirés', 'Marionnaud Produits',
      // Variations 24h
      'Nouveaux 24h', 'Activés 24h', 'Expirés 24h', 'Croissance 24h',
      // Variations 7j
      'Nouveaux 7j', 'Expirés 7j', 'Croissance 7j',
      // Qualité
      'Avec Images', 'Sans Images', 'Taux Images',
      'Enrichis Partiel', 'Enrichis Complet', 'Taux Enrichi Partiel', 'Taux Enrichi Complet',
      'Avec Variantes', 'Taux Variantes',
      // Performance
      'Remise Moyenne', 'Score Moyen', 'Deals HOT', 'Deals TRENDING',
      // Produits
      'Produits Total', 'Produits Avec Deals', 'Produits Sans Deals', 'Taux Couverture',
      // Prix
      'Prix Deal Moyen', 'Prix Original Moyen', 'Économie Moyenne',
      // Fraîcheur
      'Vus Aujourd\'hui', 'Non Vus 24h', 'Non Vus 7j', 'Taux Fraîcheur',
      // Top
      'Top Remise Titre', 'Top Remise %', 'Top Score Titre', 'Top Score',
      // Alertes
      'Alertes Critiques', 'Alertes Warning', 'Détail Alertes',
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [headers] },
    });

    console.log('✅ En-têtes créés\n');
  }
}

async function appendToSheet(m: DailyMetrics) {
  if (!SPREADSHEET_ID) {
    console.log('⚠️ GOOGLE_SHEETS_SPREADSHEET_ID non défini - skip export');
    return;
  }

  console.log('📤 Export vers Google Sheets...');
  const sheets = await getGoogleSheetsClient();

  const row = [
    m.date, m.timestamp,
    m.totalActiveDeals, m.totalPendingDeals, m.totalExpiredDeals, `${m.activationRate}%`,
    m.nocibeActive, m.nocibePending, m.nocibeExpired, m.nocibeTotalProducts,
    m.sephoraActive, m.sephoraPending, m.sephoraExpired, m.sephoraTotalProducts,
    m.marionnaudActive, m.marionnaudPending, m.marionnaudExpired, m.marionnaudTotalProducts,
    m.newDeals24h, m.activatedDeals24h, m.expiredDeals24h, m.netGrowth24h,
    m.newDeals7d, m.expiredDeals7d, m.netGrowth7d,
    m.dealsWithImages, m.dealsWithoutImages, `${m.imageCompletionRate}%`,
    m.dealsEnriched, m.dealsFullyEnriched, `${m.enrichmentRate}%`, `${m.fullEnrichmentRate}%`,
    m.dealsWithVariants, `${m.variantCompletionRate}%`,
    `${m.avgDiscountPercent}%`, m.avgScore, m.dealsHot, m.dealsTrending,
    m.totalProducts, m.productsWithDeals, m.productsWithoutDeals, `${m.productCoverageRate}%`,
    `${m.avgDealPrice}€`, `${m.avgOriginalPrice}€`, `${m.avgSavings}€`,
    m.dealsSeenToday, m.dealsNotSeenSince24h, m.dealsNotSeenSince7d, `${m.freshnessRate}%`,
    m.topDealByDiscount, `${m.topDiscountValue}%`, m.topDealByScore, m.topScoreValue,
    m.criticalAlerts, m.warningAlerts, m.alerts.join(' | ') || 'OK',
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET_NAME}!A:BK`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  });

  console.log('✅ Données exportées\n');
}

// ============================================================
// MAIN
// ============================================================

async function main() {
  console.log('\n========================================');
  console.log('   📊 MONITORING DAILY - City Baddies');
  console.log('========================================\n');

  try {
    const metrics = await collectMetrics();
    await ensureSheetHeaders();
    await appendToSheet(metrics);

    // Résumé final
    console.log('========================================');
    console.log('   ✅ MONITORING TERMINÉ');
    console.log('========================================\n');
    
    console.log('📊 RÉSUMÉ DES KPIs CLÉS');
    console.log('------------------------');
    console.log(`  📅 Date: ${metrics.date}`);
    console.log('');
    console.log('💼 Business:');
    console.log(`  • Deals actifs: ${metrics.totalActiveDeals}`);
    console.log(`  • Taux activation: ${metrics.activationRate}%`);
    console.log(`  • Croissance 24h: ${metrics.netGrowth24h >= 0 ? '+' : ''}${metrics.netGrowth24h}`);
    console.log(`  • Croissance 7j: ${metrics.netGrowth7d >= 0 ? '+' : ''}${metrics.netGrowth7d}`);
    console.log('');
    console.log('🏪 Merchants:');
    console.log(`  • Nocibé: ${metrics.nocibeActive} | Sephora: ${metrics.sephoraActive} | Marionnaud: ${metrics.marionnaudActive}`);
    console.log('');
    console.log('✨ Qualité:');
    console.log(`  • Images: ${metrics.imageCompletionRate}%`);
    console.log(`  • Enrichissement complet: ${metrics.fullEnrichmentRate}%`);
    console.log(`  • Fraîcheur: ${metrics.freshnessRate}%`);
    console.log('');
    console.log('🎯 Performance:');
    console.log(`  • Remise moyenne: ${metrics.avgDiscountPercent}%`);
    console.log(`  • Score moyen: ${metrics.avgScore}/100`);
    console.log(`  • Économie moyenne: ${metrics.avgSavings}€`);
    console.log('');
    console.log('🚨 Alertes:');
    console.log(`  • ${metrics.criticalAlerts} critiques | ${metrics.warningAlerts} warnings`);
    console.log('');

  } catch (error) {
    console.error('❌ Erreur monitoring:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
