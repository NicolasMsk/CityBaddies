import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * POST /api/admin/deals
 * Crée un nouveau deal manuellement
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const {
      productName,
      productUrl,
      imageUrl,
      brand,
      categoryId,
      merchantId,
      dealPrice,
      originalPrice,
      promoCode,
      title,
      description,
    } = body;

    // Validation
    if (!productName || !productUrl || !categoryId || !merchantId || !dealPrice || !originalPrice || !title) {
      return NextResponse.json(
        { error: 'Champs requis manquants' },
        { status: 400 }
      );
    }

    const price = parseFloat(dealPrice);
    const origPrice = parseFloat(originalPrice);
    
    if (isNaN(price) || isNaN(origPrice) || price <= 0 || origPrice <= 0) {
      return NextResponse.json(
        { error: 'Prix invalides' },
        { status: 400 }
      );
    }

    const discountPercent = Math.round((1 - price / origPrice) * 100);
    const discountAmount = origPrice - price;

    // Générer un slug unique
    const slug = generateSlug(productName) + '-' + Date.now();

    // Créer le produit (sans prix - les prix sont dans Deal)
    const product = await prisma.product.create({
      data: {
        name: productName,
        slug,
        description: description || null,
        imageUrl: imageUrl || null,
        brand: brand || null,
        productUrl,
        categoryId,
        merchantId,
      },
    });

    // Créer l'historique de prix initial
    await prisma.priceHistory.create({
      data: {
        productId: product.id,
        price,
        date: new Date(),
      },
    });

    // Créer le deal
    const deal = await prisma.deal.create({
      data: {
        title,
        description: description || null,
        dealPrice: price,
        originalPrice: origPrice,
        discountPercent,
        discountAmount,
        promoCode: promoCode || null,
        productId: product.id,
        isHot: discountPercent >= 30,
        votes: 0,
        views: 0,
      },
      include: {
        product: {
          include: {
            category: true,
            merchant: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      deal,
    });
  } catch (error) {
    console.error('Error creating deal:', error);
    return NextResponse.json(
      { error: 'Erreur serveur lors de la création' },
      { status: 500 }
    );
  }
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}
