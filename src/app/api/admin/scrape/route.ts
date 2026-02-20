import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Force dynamic - pas de pré-rendu au build
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max pour scraping

// GET - Status du scraping
export async function GET() {
  const recentProducts = await prisma.product.findMany({
    orderBy: { updatedAt: 'desc' },
    take: 10,
    include: {
      category: true,
      deals: {
        take: 1,
        orderBy: { createdAt: 'desc' },
        include: { merchant: true },
      },
    },
  });

  const scrapingSources = await prisma.scrapingSource.findMany({
    where: { isActive: true },
    include: { merchant: true },
    orderBy: { lastScraped: 'desc' },
  });

  return NextResponse.json({
    status: 'ready',
    availableMerchants: ['nocibe', 'sephora'],
    recentImports: recentProducts.length,
    products: recentProducts,
    sources: scrapingSources,
  });
}

// POST - Lancer le scraping via ImportEngine
export async function POST() {
  // V2: Scrapers are being rebuilt — not available yet
  return NextResponse.json({
    success: false,
    error: 'Scraping non disponible en V2 — en cours de reconstruction',
  }, { status: 503 });
}
