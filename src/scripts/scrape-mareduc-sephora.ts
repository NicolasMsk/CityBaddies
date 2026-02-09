/**
 * =============================================================================
 * SCRAPER MA-REDUC.COM — Codes promo Sephora
 * =============================================================================
 *
 * Scrape la page https://www.ma-reduc.com/reductions-pour-Sephora.php
 * pour récupérer :
 *   1. Tous les codes promo actifs (code révélé + détails)
 *   2. Tous les bons plans / deals actifs
 *   3. Le rich content (description marchand, FAQ, astuces, SEO)
 *
 * Le résultat JSON est prêt à être envoyé à un LLM pour structuration
 * vers les modèles Prisma PromoCode + MerchantPromoPage.
 *
 * Usage :
 *   npx tsx src/scripts/scrape-mareduc-sephora.ts
 *   npx tsx src/scripts/scrape-mareduc-sephora.ts --output results.json
 *
 * =============================================================================
 */

import { chromium, type Browser, type Page, type BrowserContext } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

// ══════════════════════════════════════════════════════════════════════
// Configuration
// ══════════════════════════════════════════════════════════════════════

const CONFIG = {
  url: 'https://www.ma-reduc.com/reductions-pour-Sephora.php',
  merchant: 'sephora',
  timeout: 60_000,
  navigationTimeout: 30_000,
  codeRevealDelay: 2_000,
  scrollDelay: 500,
  maxRetries: 3,
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
};

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
  // En-tête
  pageTitle: string | null;
  pageSubtitle: string | null;

  // Description marchand (sidebar)
  merchantDescription: string | null;
  merchantRating: string | null;
  merchantVotes: string | null;
  lastUpdateDate: string | null;

  // Engagement / Trust signals
  trustSignals: string[];

  // Actu / Deal Guru
  dealGuruNews: string[];

  // Tableau récapitulatif des meilleurs codes
  summaryTable: { label: string; code: string; discount: string }[];

  // Contenu SEO / FAQ (articles en bas de page)
  seoSections: { heading: string; content: string }[];

  // Marchands similaires
  similarMerchants: { name: string; url: string }[];

  // Breadcrumb
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
    // Le bouton d'acceptation peut être dans un iframe ou directement dans la page
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
// Scroll toute la page pour charger le lazy content
// ══════════════════════════════════════════════════════════════════════

async function scrollFullPage(page: Page) {
  log('📜', 'Scroll de la page pour charger tout le contenu...');
  // String-based evaluate to avoid tsx/esbuild __name injection
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
// Étape 1 : Cliquer sur UN code pour déclencher la révélation de TOUS
// ══════════════════════════════════════════════════════════════════════

async function revealAllCodes(page: Page, context: BrowserContext): Promise<Page> {
  log('🔓', 'Clic sur le premier code pour tout révéler...');

  let workPage = page;

  try {
    // Trouver le premier bouton de code (non concurrent, non expiré)
    const firstCodeBtn = page.locator(
      'div.m-offer[data-offer-type="code"]:not(.-disabled) button.a-btnSlide, div.m-offer[data-offer-type="code"]:not(.-disabled) a.a-btnSlide'
    ).first();

    if (!(await firstCodeBtn.isVisible({ timeout: 5_000 }).catch(() => false))) {
      log('⚠️', 'Aucun bouton de code trouvé, on continue sans révélation');
      return workPage;
    }

    // Scroller jusqu'au bouton
    await firstCodeBtn.scrollIntoViewIfNeeded();
    await sleep(500);

    // Intercepter le nouvel onglet qui va s'ouvrir
    const newPagePromise = context.waitForEvent('page', { timeout: 10_000 }).catch(() => null);

    await firstCodeBtn.click();

    // Attendre le nouvel onglet
    const newPage = await newPagePromise;
    if (newPage) {
      // Attendre que le nouvel onglet charge
      await newPage.waitForLoadState('domcontentloaded').catch(() => {});
      await sleep(2_000);

      // Vérifier si c'est une page Ma-Reduc → c'est notre workPage !
      const newUrl = newPage.url();
      if (newUrl.includes('ma-reduc')) {
        workPage = newPage;
        log('🔄', `Nouvel onglet Ma-Reduc détecté → on travaille dessus (${newUrl.substring(0, 60)}...)`);
      } else {
        // C'est le site marchand, on le ferme et on reste sur la page originale
        await newPage.close().catch(() => {});
        log('🔒', 'Onglet marchand fermé, on reste sur la page originale');
      }
    }

    await sleep(2_000);

    // Fermer le popup/dialog de code s'il apparaît sur la workPage
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
      // Escape en fallback
      await workPage.keyboard.press('Escape');
      await sleep(1_000);
    }

    // Scroll complet de la workPage pour charger tous les codes
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
// Étape 2 : Extraire toutes les offres en une seule évaluation JS
// ══════════════════════════════════════════════════════════════════════

async function scrapeOffers(page: Page, context: BrowserContext): Promise<{
  offers: ScrapedOffer[];
  stats: ScrapeResult['stats'];
  workPage: Page;
}> {
  // D'abord, révéler tous les codes en un seul clic — retourne la workPage
  const workPage = await revealAllCodes(page, context);

  log('🔍', `Extraction de toutes les offres sur ${workPage === page ? 'page originale' : 'nouvel onglet'}...`);

  // Extraction batch via page.evaluate (string pour éviter __name de tsx)
  const rawOffers: ScrapedOffer[] = await workPage.evaluate(`(() => {
    var offers = [];
    var allOffers = document.querySelectorAll('div.m-offer');

    allOffers.forEach(function(offerEl) {
      // Filtrer les expirées
      if (offerEl.classList.contains('-disabled')) return;

      // Filtrer les concurrents
      var dataLayer = offerEl.getAttribute('data-layer-push-on-click') || '';
      if (dataLayer.includes('competitor')) return;

      // Double check : footer "Plus d'offres" = concurrent
      var footer = offerEl.querySelector('.m-offer__footer');
      if (footer && footer.textContent && footer.textContent.includes("Plus d'offres")) return;

      // Type
      var offerType = offerEl.getAttribute('data-offer-type') || 'deal';
      if (offerType === 'cashback') return;

      // Badge (Code promo, Bon plan, Info)
      var badgeEl = offerEl.querySelector('.m-offer__preamble .m-offer__preambleTitle span');
      var badge = badgeEl ? badgeEl.textContent.trim() : '';
      var type = offerType;
      if (badge.toLowerCase().includes('bon plan')) type = 'bon_plan';
      if (badge.toLowerCase().includes('info')) type = 'info';

      // Titre
      var titleEl = offerEl.querySelector('h2.m-offer__title');
      var title = titleEl ? titleEl.textContent.trim() : '';

      // Code (révélé dans le DOM après le clic unique)
      var code = null;
      var codeInput = offerEl.querySelector('input.a-revealedCode__inputCode');
      if (codeInput) {
        code = codeInput.getAttribute('value') || null;
      }

      // Discount badge (sidebar)
      var sidebarEl = offerEl.querySelector('.m-offer__sidebar');
      var discountBadge = null;
      if (sidebarEl) {
        var coloredEl = sidebarEl.querySelector('.m-offer__colored');
        discountBadge = coloredEl ? coloredEl.textContent.trim() : sidebarEl.textContent.trim();
      }

      // Tooltip (données décodées base64 dans data-tooltip)
      var tooltipData = null;
      var tooltipEl = offerEl.querySelector('[data-tooltip]');
      if (tooltipEl) {
        try {
          tooltipData = atob(tooltipEl.getAttribute('data-tooltip'));
        } catch(e) {}
      }

      // Description & détails
      var detailsEl = offerEl.querySelector('.m-offer__details');
      var detailsText = detailsEl ? detailsEl.textContent : '';

      // Description (premier <p> ou texte libre dans les détails)
      var descEl = detailsEl ? detailsEl.querySelector('p') : null;
      var description = descEl ? descEl.textContent.trim() : null;

      // Tout le contenu texte des détails (hors tableau et votes)
      var fullDetails = '';
      if (detailsEl) {
        // Récupérer le texte hors table et hors votes
        var clone = detailsEl.cloneNode(true);
        clone.querySelectorAll('table, .o-offerComment').forEach(function(el) { el.remove(); });
        fullDetails = clone.textContent.trim().replace(/\\s+/g, ' ');
      }

      // Tableau de conditions
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

      // Expiration
      var expiration = null;
      if (detailsText) {
        var expMatch = detailsText.match(/Expire le (\\d{2}\\/\\d{2}\\/\\d{4})/);
        if (expMatch) expiration = expMatch[1];
        else if (detailsText.includes('Validité permanente')) expiration = 'Validité permanente';
      }

      // Vérifié
      var trustEl = offerEl.querySelector('.m-offer__trustSignals');
      var isVerified = trustEl ? trustEl.textContent.includes('Vérifié') : false;

      // Votes
      var votesUpEl = offerEl.querySelector('.o-offerComment__voteButton.-yes span');
      var votesDownEl = offerEl.querySelector('.o-offerComment__voteButton.-no span');
      var votesUp = votesUpEl ? parseInt(votesUpEl.textContent.replace(/[^0-9]/g, '')) || 0 : 0;
      var votesDown = votesDownEl ? parseInt(votesDownEl.textContent.replace(/[^0-9]/g, '')) || 0 : 0;

      // Sous-titre du preamble (ex: "Plus que 5 jours")
      var preambleSubEl = offerEl.querySelector('.m-offer__preambleSubtitle');
      var preambleSub = preambleSubEl ? preambleSubEl.textContent.trim() : null;

      // Badges (nouveau, etc.)
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

  // Statistiques
  const stats = {
    totalOffers: rawOffers.length,
    codes: rawOffers.filter((o) => o.type === 'code').length,
    deals: rawOffers.filter((o) => o.type !== 'code').length,
    codesRevealed: rawOffers.filter((o) => o.type === 'code' && o.code).length,
    competitorExcluded: 0,
    expiredExcluded: 0,
  };

  // Compter les exclusions (pour le log)
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

  // Logger chaque offre
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

  // ── En-tête de page ──
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

  // ── Description marchand (sidebar) ──
  richContent.merchantDescription = await page.locator('.m-trustSignalsSidebar__about .m-shortDesc, .m-shortDesc')
    .first()
    .evaluate((el) => el.innerHTML?.trim() || null)
    .catch(() => null);

  // ── Notation ──
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

  // ── Dernière mise à jour ──
  richContent.lastUpdateDate = await page.locator('.m-trustSignalsSidebar__lastUpdateDate')
    .first()
    .textContent()
    .then((t) => {
      if (!t) return null;
      const match = t.match(/(\d{2}\/\d{2}\/\d{4})/);
      return match ? match[1] : t.trim();
    })
    .catch(() => null);

  // ── Trust signals ──
  richContent.trustSignals = await page.locator('.m-trustSignalsSidebar__engagementItem, .m-trustSignalsSidebar li')
    .allTextContents()
    .then((items) => items.map((t) => t.trim()).filter(Boolean))
    .catch(() => []);

  // ── Deal Guru / Actu ──
  richContent.dealGuruNews = await page.locator('.m-DealGuruMerchant .m-DealGuruMerchant__item, .m-DealGuruMerchant li')
    .allTextContents()
    .then((items) => items.map((t) => t.trim()).filter(Boolean))
    .catch(() => []);

  // ── Tableau récapitulatif ──
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

  // ── Contenu SEO / FAQ (sections h2 en bas de page) ──
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

  // ── Marchands similaires ──
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

  // ── Breadcrumb ──
  richContent.breadcrumb = await page.locator('.a-breadcrumb li, ul.a-breadcrumb li')
    .allTextContents()
    .then((items) => items.map((t) => t.trim()).filter(Boolean))
    .catch(() => []);

  return richContent;
}

// ══════════════════════════════════════════════════════════════════════
// Fonction principale
// ══════════════════════════════════════════════════════════════════════

async function scrapeMaReducSephora(): Promise<ScrapeResult> {
  log('🚀', `Démarrage du scraping Ma-Reduc — ${CONFIG.merchant}`);
  log('🌐', CONFIG.url);

  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const context = await browser.newContext({
      userAgent: CONFIG.userAgent,
      viewport: { width: 1440, height: 900 },
      locale: 'fr-FR',
    });

    const page = await context.newPage();
    page.setDefaultTimeout(CONFIG.timeout);
    page.setDefaultNavigationTimeout(CONFIG.navigationTimeout);

    // ── Navigation ──
    log('🌐', 'Navigation vers la page...');
    await page.goto(CONFIG.url, { waitUntil: 'networkidle' });

    // ── Cookies ──
    await acceptCookies(page);

    // ── Scroll pour charger tout le contenu ──
    await scrollFullPage(page);

    // ── Scraper les offres ──
    const { offers, stats, workPage } = await scrapeOffers(page, context);

    // ── Scraper le rich content sur la workPage (qui a les codes révélés) ──
    const richContent = await scrapeRichContent(workPage);

    // Fermer le workPage si c'est un onglet différent de l'original
    if (workPage !== page) {
      await workPage.close().catch(() => {});
      log('🔒', 'Onglet de travail fermé');
    }

    // ── Résultat ──
    const result: ScrapeResult = {
      merchant: CONFIG.merchant,
      url: CONFIG.url,
      scrapedAt: new Date().toISOString(),
      offers,
      richContent,
      stats,
    };

    log('✅', '═══════════════════════════════════════════');
    log('📊', `Résultats du scraping :`);
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
// Prompt template pour le LLM
// ══════════════════════════════════════════════════════════════════════

function generateLLMPrompt(result: ScrapeResult): string {
  return `
Tu es un expert en structuration de données e-commerce beauté.
Voici les données brutes scrapées de Ma-Reduc.com pour le marchand "${result.merchant}".

═══ OFFRES SCRAPÉES (${result.offers.length}) ═══

${result.offers
  .map(
    (o, i) => `
--- Offre ${i + 1} ---
Type: ${o.type}
Titre: ${o.title}
Code: ${o.code || 'N/A'}
Description: ${o.description || 'N/A'}
Conditions: ${o.conditions || 'N/A'}
Tableau conditions: ${o.conditionsTable ? JSON.stringify(o.conditionsTable) : 'N/A'}
Expiration: ${o.expiration || 'N/A'}
Réduction: ${o.discount || 'N/A'}
Badge: ${o.discountBadge || 'N/A'}
Vérifié: ${o.isVerified ? 'Oui' : 'Non'}
Votes: +${o.votesUp} / -${o.votesDown}
Popup titre: ${o.popupTitle || 'N/A'}
Popup expiration: ${o.popupExpiration || 'N/A'}
Popup détails: ${o.popupDetails || 'N/A'}
`
  )
  .join('')}

═══ RICH CONTENT ═══

Titre page: ${result.richContent.pageTitle}
Sous-titre: ${result.richContent.pageSubtitle}
Description marchand: ${result.richContent.merchantDescription || 'N/A'}
Note: ${result.richContent.merchantRating || 'N/A'}
Votes: ${result.richContent.merchantVotes || 'N/A'}
Dernière MAJ: ${result.richContent.lastUpdateDate || 'N/A'}
Trust signals: ${result.richContent.trustSignals.join(' | ') || 'N/A'}
Actu Deal Guru: ${result.richContent.dealGuruNews.join(' | ') || 'N/A'}
Marchands similaires: ${result.richContent.similarMerchants.map((m) => m.name).join(', ') || 'N/A'}

Tableau récap:
${result.richContent.summaryTable.map((r) => `  ${r.label} | ${r.code} | ${r.discount}`).join('\n') || 'N/A'}

Sections SEO / FAQ:
${result.richContent.seoSections.map((s) => `  ## ${s.heading}\n  ${s.content.substring(0, 200)}...`).join('\n\n') || 'N/A'}

═══ INSTRUCTIONS ═══

À partir de ces données, génère du JSON structuré avec 2 objets :

1. **promoCodes** : un tableau de PromoCode (Prisma) avec :
   - code (string) — le code promo tel quel
   - slug (string) — généré depuis le titre, format kebab-case unique
   - title (string) — titre reformulé proprement en français
   - description (string | null) — description complète
   - discountType ("PERCENTAGE" | "FIXED_AMOUNT" | "FREE_SHIPPING" | "GIFT")
   - discountValue (number | null) — ex: 20 pour -20%, 10 pour -10€
   - minimumPurchase (number | null) — montant minimum d'achat
   - maximumDiscount (number | null) — réduction max si plafonnée
   - applicableTo (string | null) — catégorie/marque concernée
   - conditions (string | null) — conditions d'utilisation
   - isNewCustomerOnly (boolean)
   - status ("ACTIVE" | "UNVERIFIED") — ACTIVE si vérifié, sinon UNVERIFIED
   - expiresAt (string ISO | null)
   - isVerified (boolean)
   - sourceUrl ("${result.url}")
   - sourceType ("ma-reduc")
   - votes (number) — votesUp - votesDown

2. **merchantPromoPage** : un objet MerchantPromoPage (Prisma) avec :
   - canonicalSlug: "${result.merchant}"
   - metaTitle (string) — optimisé SEO
   - metaDescription (string) — 155 chars max, optimisé SEO
   - heroTitle (string)
   - heroSubtitle (string)
   - introduction (string) — 2-3 paragraphes HTML
   - merchantDescription (string) — HTML
   - merchantAdvantages (JSON[]) — [{icon, title, text}]
   - howToUse (JSON[]) — [{step, title, description}]
   - tips (JSON[]) — [{title, content}]
   - bestTimeToShop (string)
   - faq (JSON[]) — [{question, answer}] basé sur le contenu SEO
   - averageDiscount (number)
   - bestCurrentDiscount (number)
   - totalActiveOffers (number)
   - conclusion (string) — HTML
   - relatedMerchants (string) — slugs séparés par virgule
   - targetKeywords (string) — mots-clés SEO séparés par virgule

Réponds UNIQUEMENT avec le JSON valide, sans markdown ni commentaire.
`;
}

// ══════════════════════════════════════════════════════════════════════
// Main — CLI
// ══════════════════════════════════════════════════════════════════════

async function main() {
  const args = process.argv.slice(2);
  const outputFlag = args.indexOf('--output');
  const outputPath = outputFlag >= 0 ? args[outputFlag + 1] : null;

  try {
    const result = await scrapeMaReducSephora();

    // Sauvegarder le JSON brut
    const rawOutputPath = outputPath || `data/mareduc-${CONFIG.merchant}-${new Date().toISOString().split('T')[0]}.json`;
    const fullPath = path.resolve(rawOutputPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, JSON.stringify(result, null, 2), 'utf-8');
    log('💾', `Résultat brut sauvegardé → ${fullPath}`);

    // Sauvegarder le prompt LLM
    const promptPath = fullPath.replace('.json', '-llm-prompt.txt');
    const prompt = generateLLMPrompt(result);
    fs.writeFileSync(promptPath, prompt, 'utf-8');
    log('🤖', `Prompt LLM sauvegardé → ${promptPath}`);

    log('🎉', 'Scraping terminé avec succès !');
    log('💡', 'Prochaine étape : envoyer le prompt LLM à GPT-4/Claude pour structuration');
  } catch (error) {
    log('❌', `Erreur fatale : ${(error as Error).message}`);
    console.error(error);
    process.exit(1);
  }
}

main();
