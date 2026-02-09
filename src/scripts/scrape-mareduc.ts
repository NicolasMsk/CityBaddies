/**
 * =============================================================================
 * SCRAPER MA-REDUC.COM — Générique tous marchands
 * =============================================================================
 *
 * Scrape n'importe quelle page marchand sur ma-reduc.com :
 *   1. Tous les codes promo actifs (code révélé + détails)
 *   2. Tous les bons plans / deals actifs
 *   3. Le rich content (description marchand, FAQ, astuces, SEO)
 *
 * Le résultat JSON est prêt à être envoyé au LLM pour structuration.
 *
 * Usage :
 *   npx tsx src/scripts/scrape-mareduc.ts --merchant sephora --url https://www.ma-reduc.com/reductions-pour-Sephora.php
 *   npx tsx src/scripts/scrape-mareduc.ts --merchant nocibe --url https://www.ma-reduc.com/reductions-pour-Nocibe.php
 *   npx tsx src/scripts/scrape-mareduc.ts --merchant marionnaud --url https://www.ma-reduc.com/reductions-pour-Marionnaud.php
 *   npx tsx src/scripts/scrape-mareduc.ts --merchant nocibe --url https://www.ma-reduc.com/reductions-pour-Nocibe.php --output results.json
 *
 * =============================================================================
 */

import { chromium, type Browser, type Page, type BrowserContext } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

// ══════════════════════════════════════════════════════════════════════
// CLI Arguments
// ══════════════════════════════════════════════════════════════════════

function parseArgs() {
  const args = process.argv.slice(2);
  const merchantIdx = args.indexOf('--merchant');
  const urlIdx = args.indexOf('--url');
  const outputIdx = args.indexOf('--output');

  const merchant = merchantIdx >= 0 && args[merchantIdx + 1] ? args[merchantIdx + 1] : null;
  const url = urlIdx >= 0 && args[urlIdx + 1] ? args[urlIdx + 1] : null;
  const output = outputIdx >= 0 && args[outputIdx + 1] ? args[outputIdx + 1] : null;

  if (!merchant || !url) {
    console.error(`
❌  Arguments manquants !

Usage :
  npx tsx src/scripts/scrape-mareduc.ts --merchant <slug> --url <ma-reduc-url>

Exemples :
  npx tsx src/scripts/scrape-mareduc.ts --merchant sephora --url https://www.ma-reduc.com/reductions-pour-Sephora.php
  npx tsx src/scripts/scrape-mareduc.ts --merchant nocibe --url https://www.ma-reduc.com/reductions-pour-Nocibe.php
  npx tsx src/scripts/scrape-mareduc.ts --merchant marionnaud --url https://www.ma-reduc.com/reductions-pour-Marionnaud.php
`);
    process.exit(1);
  }

  return { merchant, url, output };
}

// ══════════════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════════════

interface ScrapedOffer {
  type: 'code' | 'deal' | 'bon_plan' | 'info';
  title: string;
  code: string | null;
  description: string | null;
  conditions: string | null;
  conditionsTable: Record<string, string> | null;
  expiration: string | null;
  discount: string | null;
  discountBadge: string | null;
  isVerified: boolean;
  votesUp: number;
  votesDown: number;
  popupTitle: string | null;
  popupExpiration: string | null;
  popupDetails: string | null;
}

interface ScrapedRichContent {
  pageTitle: string | null;
  pageSubtitle: string | null;
  merchantDescription: string | null;
  merchantRating: string | null;
  merchantVotes: string | null;
  lastUpdateDate: string | null;
  trustSignals: string[];
  dealGuruNews: string[];
  summaryTable: { label: string; code: string; discount: string }[];
  seoSections: { heading: string; content: string }[];
  similarMerchants: { name: string; url: string }[];
  breadcrumb: string[];
}

interface ScrapeResult {
  merchant: string;
  url: string;
  scrapedAt: string;
  offers: ScrapedOffer[];
  richContent: ScrapedRichContent;
  stats: {
    totalOffers: number;
    codes: number;
    deals: number;
    codesRevealed: number;
    competitorExcluded: number;
    expiredExcluded: number;
  };
}

// ══════════════════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════════════════

function log(emoji: string, msg: string) {
  console.log(`${emoji}  ${msg}`);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ══════════════════════════════════════════════════════════════════════
// Accepter les cookies
// ══════════════════════════════════════════════════════════════════════

async function acceptCookies(page: Page) {
  try {
    const consentBtn = page.locator(
      'button:has-text("Tout accepter"), button:has-text("Accepter"), button:has-text("Accept"), #didomi-notice-agree-button, .didomi-continue-without-agreeing'
    );

    if (await consentBtn.first().isVisible({ timeout: 5_000 })) {
      await consentBtn.first().click();
      log('🍪', 'Cookies acceptés');
      await sleep(1_000);
    }
  } catch {
    log('🍪', 'Pas de bannière cookies détectée');
  }
}

// ══════════════════════════════════════════════════════════════════════
// Scroll toute la page
// ══════════════════════════════════════════════════════════════════════

async function scrollFullPage(page: Page) {
  log('📜', 'Scroll de la page pour charger tout le contenu...');
  await page.evaluate(`(async () => {
    const distance = 400;
    const scrollHeight = document.body.scrollHeight;
    for (let i = 0; i < scrollHeight; i += distance) {
      window.scrollBy(0, distance);
      await new Promise(r => setTimeout(r, 150));
    }
    window.scrollTo(0, 0);
  })()`);
  await sleep(1_000);
}

// ══════════════════════════════════════════════════════════════════════
// Révéler les codes en cliquant sur le premier
// ══════════════════════════════════════════════════════════════════════

async function revealAllCodes(page: Page, context: BrowserContext): Promise<Page> {
  log('🔓', 'Clic sur le premier code pour tout révéler...');

  let workPage = page;

  try {
    const firstCodeBtn = page.locator(
      'div.m-offer[data-offer-type="code"]:not(.-disabled) button.a-btnSlide, div.m-offer[data-offer-type="code"]:not(.-disabled) a.a-btnSlide'
    ).first();

    if (!(await firstCodeBtn.isVisible({ timeout: 5_000 }).catch(() => false))) {
      log('⚠️', 'Aucun bouton de code trouvé, on continue sans révélation');
      return workPage;
    }

    await firstCodeBtn.scrollIntoViewIfNeeded();
    await sleep(500);

    const newPagePromise = context.waitForEvent('page', { timeout: 10_000 }).catch(() => null);
    await firstCodeBtn.click();

    const newPage = await newPagePromise;
    if (newPage) {
      await newPage.waitForLoadState('domcontentloaded').catch(() => {});
      await sleep(2_000);

      const newUrl = newPage.url();
      if (newUrl.includes('ma-reduc')) {
        workPage = newPage;
        log('🔄', `Nouvel onglet Ma-Reduc détecté → on travaille dessus (${newUrl.substring(0, 60)}...)`);
      } else {
        await newPage.close().catch(() => {});
        log('🔒', 'Onglet marchand fermé, on reste sur la page originale');
      }
    }

    await sleep(2_000);

    // Fermer le popup de code
    try {
      const closeBtn = workPage.locator('i.fa-xmark, button:has(i.fa-xmark), .o-dialog__close, .o-offerDialog__close, [aria-label="Fermer"], .m-modal__close').first();
      if (await closeBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await closeBtn.click();
        await sleep(1_500);
        log('✖️', 'Popup code fermé');
      } else {
        await workPage.keyboard.press('Escape');
        await sleep(1_500);
      }
    } catch {
      await workPage.keyboard.press('Escape');
      await sleep(1_000);
    }

    // Scroll complet de la workPage
    log('📜', 'Scroll de la workPage pour tout charger...');
    await workPage.evaluate(`(async () => {
      var lastHeight = document.body.scrollHeight;
      while (true) {
        window.scrollTo(0, document.body.scrollHeight);
        await new Promise(r => setTimeout(r, 1000));
        var newHeight = document.body.scrollHeight;
        if (newHeight === lastHeight) break;
        lastHeight = newHeight;
      }
      window.scrollTo(0, 0);
    })()`);
    await sleep(1_000);

    log('✅', 'Tous les codes sont maintenant révélés dans le DOM');
  } catch (err) {
    log('⚠️', `Erreur révélation codes: ${(err as Error).message}`);
  }

  return workPage;
}

// ══════════════════════════════════════════════════════════════════════
// Extraire toutes les offres
// ══════════════════════════════════════════════════════════════════════

async function scrapeOffers(page: Page, context: BrowserContext): Promise<{
  offers: ScrapedOffer[];
  stats: ScrapeResult['stats'];
  workPage: Page;
}> {
  const workPage = await revealAllCodes(page, context);

  log('🔍', `Extraction de toutes les offres sur ${workPage === page ? 'page originale' : 'nouvel onglet'}...`);

  const rawOffers: ScrapedOffer[] = await workPage.evaluate(`(() => {
    var offers = [];
    var allOffers = document.querySelectorAll('div.m-offer');

    allOffers.forEach(function(offerEl) {
      if (offerEl.classList.contains('-disabled')) return;

      var dataLayer = offerEl.getAttribute('data-layer-push-on-click') || '';
      if (dataLayer.includes('competitor')) return;

      var footer = offerEl.querySelector('.m-offer__footer');
      if (footer && footer.textContent && footer.textContent.includes("Plus d'offres")) return;

      var offerType = offerEl.getAttribute('data-offer-type') || 'deal';
      if (offerType === 'cashback') return;

      var badgeEl = offerEl.querySelector('.m-offer__preamble .m-offer__preambleTitle span');
      var badge = badgeEl ? badgeEl.textContent.trim() : '';
      var type = offerType;
      if (badge.toLowerCase().includes('bon plan')) type = 'bon_plan';
      if (badge.toLowerCase().includes('info')) type = 'info';

      var titleEl = offerEl.querySelector('h2.m-offer__title');
      var title = titleEl ? titleEl.textContent.trim() : '';

      var code = null;
      var codeInput = offerEl.querySelector('input.a-revealedCode__inputCode');
      if (codeInput) {
        code = codeInput.getAttribute('value') || null;
      }

      var sidebarEl = offerEl.querySelector('.m-offer__sidebar');
      var discountBadge = null;
      if (sidebarEl) {
        var coloredEl = sidebarEl.querySelector('.m-offer__colored');
        discountBadge = coloredEl ? coloredEl.textContent.trim() : sidebarEl.textContent.trim();
      }

      var tooltipData = null;
      var tooltipEl = offerEl.querySelector('[data-tooltip]');
      if (tooltipEl) {
        try {
          tooltipData = atob(tooltipEl.getAttribute('data-tooltip'));
        } catch(e) {}
      }

      var detailsEl = offerEl.querySelector('.m-offer__details');
      var detailsText = detailsEl ? detailsEl.textContent : '';

      var descEl = detailsEl ? detailsEl.querySelector('p') : null;
      var description = descEl ? descEl.textContent.trim() : null;

      var fullDetails = '';
      if (detailsEl) {
        var clone = detailsEl.cloneNode(true);
        clone.querySelectorAll('table, .o-offerComment').forEach(function(el) { el.remove(); });
        fullDetails = clone.textContent.trim().replace(/\\s+/g, ' ');
      }

      var conditionsTable = null;
      var tableEl = offerEl.querySelector('[id^="m-offer__description_table_"] table, .m-offer__details table');
      if (tableEl) {
        conditionsTable = {};
        tableEl.querySelectorAll('tr').forEach(function(row) {
          var cells = row.querySelectorAll('td');
          if (cells.length >= 2) {
            var key = cells[0].textContent.trim().replace(/ :$/, '');
            var val = cells[1].textContent.trim();
            if (key) conditionsTable[key] = val;
          }
        });
        if (Object.keys(conditionsTable).length === 0) conditionsTable = null;
      }

      var expiration = null;
      if (detailsText) {
        var expMatch = detailsText.match(/Expire le (\\d{2}\\/\\d{2}\\/\\d{4})/);
        if (expMatch) expiration = expMatch[1];
        else if (detailsText.includes('Validité permanente')) expiration = 'Validité permanente';
      }

      var trustEl = offerEl.querySelector('.m-offer__trustSignals');
      var isVerified = trustEl ? trustEl.textContent.includes('Vérifié') : false;

      var votesUpEl = offerEl.querySelector('.o-offerComment__voteButton.-yes span');
      var votesDownEl = offerEl.querySelector('.o-offerComment__voteButton.-no span');
      var votesUp = votesUpEl ? parseInt(votesUpEl.textContent.replace(/[^0-9]/g, '')) || 0 : 0;
      var votesDown = votesDownEl ? parseInt(votesDownEl.textContent.replace(/[^0-9]/g, '')) || 0 : 0;

      var preambleSubEl = offerEl.querySelector('.m-offer__preambleSubtitle');
      var preambleSub = preambleSubEl ? preambleSubEl.textContent.trim() : null;

      var badgesEls = offerEl.querySelectorAll('.m-offer__badges .a-badge');
      var badges = [];
      badgesEls.forEach(function(b) { badges.push(b.textContent.trim()); });

      offers.push({
        type: type,
        title: title,
        code: code,
        description: fullDetails || description,
        conditions: tooltipData,
        conditionsTable: conditionsTable,
        expiration: expiration,
        discount: discountBadge,
        discountBadge: discountBadge,
        isVerified: isVerified,
        votesUp: votesUp,
        votesDown: votesDown,
        popupTitle: null,
        popupExpiration: preambleSub,
        popupDetails: badges.length > 0 ? badges.join(', ') : null
      });
    });

    return offers;
  })()`);

  const stats = {
    totalOffers: rawOffers.length,
    codes: rawOffers.filter((o) => o.type === 'code').length,
    deals: rawOffers.filter((o) => o.type !== 'code').length,
    codesRevealed: rawOffers.filter((o) => o.type === 'code' && o.code).length,
    competitorExcluded: 0,
    expiredExcluded: 0,
  };

  const countResult = await workPage.evaluate(`(() => {
    var disabled = 0;
    var competitor = 0;
    document.querySelectorAll('div.m-offer').forEach(function(el) {
      if (el.classList.contains('-disabled')) { disabled++; return; }
      var dl = el.getAttribute('data-layer-push-on-click') || '';
      if (dl.includes('competitor')) competitor++;
      var footer = el.querySelector('.m-offer__footer');
      if (footer && footer.textContent && footer.textContent.includes("Plus d'offres")) competitor++;
    });
    return { disabled: disabled, competitor: competitor };
  })()`);

  stats.expiredExcluded = (countResult as any).disabled;
  stats.competitorExcluded = (countResult as any).competitor;

  for (const o of rawOffers) {
    log(
      o.type === 'code' ? '🔑' : '🏷️',
      `[${o.type.toUpperCase()}] ${o.title.substring(0, 60)}${o.title.length > 60 ? '...' : ''}${o.code ? ` → CODE: ${o.code}` : ''}`
    );
  }

  return { offers: rawOffers, stats, workPage };
}

// ══════════════════════════════════════════════════════════════════════
// Scraper le rich content
// ══════════════════════════════════════════════════════════════════════

async function scrapeRichContent(page: Page): Promise<ScrapedRichContent> {
  log('📝', 'Extraction du rich content...');

  const richContent: ScrapedRichContent = {
    pageTitle: null,
    pageSubtitle: null,
    merchantDescription: null,
    merchantRating: null,
    merchantVotes: null,
    lastUpdateDate: null,
    trustSignals: [],
    dealGuruNews: [],
    summaryTable: [],
    seoSections: [],
    similarMerchants: [],
    breadcrumb: [],
  };

  richContent.pageTitle = await page.locator('h1.m-pageHeader__title, h1')
    .first()
    .textContent()
    .then((t) => t?.trim() || null)
    .catch(() => null);

  richContent.pageSubtitle = await page.locator('h2.m-pageHeader__subtitle, .m-pageHeader__subtitle')
    .first()
    .textContent()
    .then((t) => t?.trim() || null)
    .catch(() => null);

  richContent.merchantDescription = await page.locator('.m-trustSignalsSidebar__about .m-shortDesc, .m-shortDesc')
    .first()
    .evaluate((el) => el.innerHTML?.trim() || null)
    .catch(() => null);

  richContent.merchantRating = await page.locator('.m-sidebarReviews .m-sidebarReviews__score, .m-sidebarReviews')
    .first()
    .textContent()
    .then((t) => t?.trim() || null)
    .catch(() => null);

  richContent.merchantVotes = await page.locator('.m-sidebarReviews__votesCount, .m-sidebarReviews .m-sidebarReviews__text')
    .first()
    .textContent()
    .then((t) => t?.trim() || null)
    .catch(() => null);

  richContent.lastUpdateDate = await page.locator('.m-trustSignalsSidebar__lastUpdateDate')
    .first()
    .textContent()
    .then((t) => {
      if (!t) return null;
      const match = t.match(/(\d{2}\/\d{2}\/\d{4})/);
      return match ? match[1] : t.trim();
    })
    .catch(() => null);

  richContent.trustSignals = await page.locator('.m-trustSignalsSidebar__engagementItem, .m-trustSignalsSidebar li')
    .allTextContents()
    .then((items) => items.map((t) => t.trim()).filter(Boolean))
    .catch(() => []);

  richContent.dealGuruNews = await page.locator('.m-DealGuruMerchant .m-DealGuruMerchant__item, .m-DealGuruMerchant li')
    .allTextContents()
    .then((items) => items.map((t) => t.trim()).filter(Boolean))
    .catch(() => []);

  richContent.summaryTable = await page.evaluate(`(() => {
    var table = document.querySelector('.m-summaryTable table, table.m-summaryTable');
    if (!table) return [];
    var rows = [];
    table.querySelectorAll('tbody tr, tr').forEach(function(row) {
      var cells = row.querySelectorAll('td, th');
      if (cells.length >= 2) {
        rows.push({
          label: cells[0] ? cells[0].textContent.trim() : '',
          code: cells[1] ? cells[1].textContent.trim() : '',
          discount: cells[2] ? cells[2].textContent.trim() : ''
        });
      }
    });
    return rows;
  })()`);

  richContent.seoSections = await page.evaluate(`(() => {
    var sections = [];
    var seoContainer = document.querySelector('.o-mainContent__seo, .m-seoContent, [class*="seoContent"]');
    var container = seoContainer || document.querySelector('main') || document.body;
    var headings = container.querySelectorAll('h2');
    headings.forEach(function(h2) {
      var heading = h2.textContent ? h2.textContent.trim() : '';
      if (!heading) return;
      if (h2.closest('.m-offer')) return;
      if (h2.classList.contains('m-pageHeader__subtitle')) return;
      var content = '';
      var sibling = h2.nextElementSibling;
      while (sibling && sibling.tagName !== 'H2') {
        content += (sibling.textContent ? sibling.textContent.trim() : '') + '\\n';
        sibling = sibling.nextElementSibling;
      }
      if (content.trim()) {
        sections.push({ heading: heading, content: content.trim() });
      }
    });
    return sections;
  })()`);

  richContent.similarMerchants = await page.evaluate(`(() => {
    var merchants = [];
    document.querySelectorAll('.m-similarMerchants a, ul.m-similarMerchants li a').forEach(function(a) {
      merchants.push({
        name: a.textContent ? a.textContent.trim() : '',
        url: a.href || ''
      });
    });
    return merchants;
  })()`);

  richContent.breadcrumb = await page.locator('.a-breadcrumb li, ul.a-breadcrumb li')
    .allTextContents()
    .then((items) => items.map((t) => t.trim()).filter(Boolean))
    .catch(() => []);

  return richContent;
}

// ══════════════════════════════════════════════════════════════════════
// Fonction principale
// ══════════════════════════════════════════════════════════════════════

async function scrapeMaReduc(merchant: string, url: string): Promise<ScrapeResult> {
  log('🚀', `Démarrage du scraping Ma-Reduc — ${merchant}`);
  log('🌐', url);

  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      viewport: { width: 1440, height: 900 },
      locale: 'fr-FR',
    });

    const page = await context.newPage();
    page.setDefaultTimeout(60_000);
    page.setDefaultNavigationTimeout(30_000);

    log('🌐', 'Navigation vers la page...');
    await page.goto(url, { waitUntil: 'networkidle' });

    await acceptCookies(page);
    await scrollFullPage(page);

    const { offers, stats, workPage } = await scrapeOffers(page, context);
    const richContent = await scrapeRichContent(workPage);

    if (workPage !== page) {
      await workPage.close().catch(() => {});
      log('🔒', 'Onglet de travail fermé');
    }

    const result: ScrapeResult = {
      merchant,
      url,
      scrapedAt: new Date().toISOString(),
      offers,
      richContent,
      stats,
    };

    log('✅', '═══════════════════════════════════════════');
    log('📊', `Résultats du scraping — ${merchant} :`);
    log('📊', `  Total offres actives : ${stats.totalOffers}`);
    log('📊', `  Codes promo : ${stats.codes} (${stats.codesRevealed} révélés)`);
    log('📊', `  Deals / Bons plans : ${stats.deals}`);
    log('📊', `  Offres concurrentes exclues : ${stats.competitorExcluded}`);
    log('📊', `  Offres expirées exclues : ${stats.expiredExcluded}`);
    log('📊', `  Sections SEO : ${richContent.seoSections.length}`);
    log('📊', `  Marchands similaires : ${richContent.similarMerchants.length}`);
    log('✅', '═══════════════════════════════════════════');

    await context.close();
    return result;
  } finally {
    if (browser) await browser.close();
  }
}

// ══════════════════════════════════════════════════════════════════════
// Main — CLI
// ══════════════════════════════════════════════════════════════════════

async function main() {
  const { merchant, url, output } = parseArgs();

  try {
    const result = await scrapeMaReduc(merchant, url);

    // Sauvegarder le JSON brut
    const rawOutputPath = output || `data/mareduc-${merchant}-${new Date().toISOString().split('T')[0]}.json`;
    const fullPath = path.resolve(rawOutputPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, JSON.stringify(result, null, 2), 'utf-8');
    log('💾', `Résultat brut sauvegardé → ${fullPath}`);

    log('🎉', `Scraping ${merchant} terminé avec succès !`);
    log('💡', `Prochaine étape : npx tsx src/scripts/import-mareduc-to-db.ts --merchant ${merchant}`);
  } catch (error) {
    log('❌', `Erreur fatale : ${(error as Error).message}`);
    console.error(error);
    process.exit(1);
  }
}

main();
