import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth/require-admin';

// Force dynamic - pas de pré-rendu au build
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max pour scraping

// GET - Status du scraping (exposait produits récents + sources → admin only)
export async function GET() {
  const guard = await requireAdmin();
  if ('error' in guard) return guard.error;

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
  const guard = await requireAdmin();
  if ('error' in guard) return guard.error;
  // V2: Scrapers are being rebuilt — not available yet
  return NextResponse.json({
    success: false,
    error: 'Scraping non disponible en V2 — en cours de reconstruction',
  }, { status: 503 });
}
