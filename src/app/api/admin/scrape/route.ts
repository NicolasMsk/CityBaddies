import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ImportEngine } from '@/lib/scraping/ImportEngine';
import { NocibeScraper } from '@/lib/scraping/nocibe';
import { SephoraScraper } from '@/lib/scraping/sephora';
import { Scraper } from '@/lib/scraping/types';

export const maxDuration = 300; // 5 minutes max pour scraping

// Registre des scrapers disponibles
const SCRAPERS: Record<string, () => Scraper> = {
  nocibe: () => new NocibeScraper({ headless: true, delayBetweenRequests: 2000 }),
  sephora: () => new SephoraScraper({ headless: true, delayBetweenRequests: 2000 }),
};

// GET - Status du scraping
export async function GET() {
  const recentProducts = await prisma.product.findMany({
    orderBy: { updatedAt: 'desc' },
    take: 10,
    include: {
      merchant: true,
      category: true,
      deals: { take: 1, orderBy: { createdAt: 'desc' } },
    },
  });

  const scrapingSources = await prisma.scrapingSource.findMany({
    where: { isActive: true },
    include: { merchant: true },
    orderBy: { lastScraped: 'desc' },
  });

  return NextResponse.json({
    status: 'ready',
    availableMerchants: Object.keys(SCRAPERS),
    recentImports: recentProducts.length,
    products: recentProducts,
    sources: scrapingSources,
  });
}

// POST - Lancer le scraping via ImportEngine
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      merchant = 'nocibe',
      clean = false,
    } = body;

    // Valider le marchand
    if (!SCRAPERS[merchant]) {
      return NextResponse.json({
        success: false,
        error: `Marchand inconnu: ${merchant}`,
        availableMerchants: Object.keys(SCRAPERS),
      }, { status: 400 });
    }

    console.log(`[API Scrape] Démarrage - ${merchant} - clean: ${clean}`);

    // Créer l'engine et le scraper
    const engine = new ImportEngine({
      batchSize: 50,
      minDiscountPercent: 5,
      verbose: true,
    });

    const scraper = SCRAPERS[merchant]();
    
    // Lancer l'import
    const stats = await engine.import(scraper, clean);

    return NextResponse.json({
      success: stats.created > 0 || stats.updated > 0,
      message: `Import ${merchant} terminé`,
      stats: {
        scraped: stats.scraped,
        withVolume: stats.withVolume,
        created: stats.created,
        updated: stats.updated,
        priceChanges: stats.priceChanges,
        errors: stats.errors.length,
        duration: stats.duration.toFixed(1) + 's',
      },
      errors: stats.errors.slice(0, 10),
    });

  } catch (error) {
    console.error('[API Scrape] Erreur:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue',
    }, { status: 500 });
  }
}
