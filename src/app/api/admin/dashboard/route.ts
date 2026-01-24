import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // Dates pour les calculs
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);
    const lastMonth = new Date(today);
    lastMonth.setMonth(lastMonth.getMonth() - 1);

    // Stats générales
    const [
      totalDeals,
      activeDeals,
      expiredDeals,
      hotDeals,
      totalUsers,
      totalVotes,
      totalComments,
      totalFavorites,
      totalNewsletterSubscribers,
      confirmedNewsletterSubscribers,
      totalProducts,
      totalBrands,
      totalCategories,
    ] = await Promise.all([
      prisma.deal.count(),
      prisma.deal.count({ where: { isExpired: false } }),
      prisma.deal.count({ where: { isExpired: true } }),
      prisma.deal.count({ where: { isHot: true, isExpired: false } }),
      prisma.user.count(),
      prisma.vote.count(),
      prisma.comment.count(),
      prisma.favorite.count(),
      prisma.newsletterSubscription.count(),
      prisma.newsletterSubscription.count({ where: { isConfirmed: true, unsubscribedAt: null } }),
      prisma.product.count(),
      prisma.brand.count(),
      prisma.category.count(),
    ]);

    // Stats temporelles
    const [
      dealsToday,
      dealsThisWeek,
      dealsThisMonth,
      usersToday,
      usersThisWeek,
      usersThisMonth,
      newsletterToday,
      newsletterThisWeek,
      newsletterThisMonth,
    ] = await Promise.all([
      prisma.deal.count({ where: { createdAt: { gte: today } } }),
      prisma.deal.count({ where: { createdAt: { gte: lastWeek } } }),
      prisma.deal.count({ where: { createdAt: { gte: lastMonth } } }),
      prisma.user.count({ where: { createdAt: { gte: today } } }),
      prisma.user.count({ where: { createdAt: { gte: lastWeek } } }),
      prisma.user.count({ where: { createdAt: { gte: lastMonth } } }),
      prisma.newsletterSubscription.count({ where: { subscribedAt: { gte: today } } }),
      prisma.newsletterSubscription.count({ where: { subscribedAt: { gte: lastWeek } } }),
      prisma.newsletterSubscription.count({ where: { subscribedAt: { gte: lastMonth } } }),
    ]);

    // Top 10 deals les plus populaires (par votes)
    const topDeals = await prisma.deal.findMany({
      take: 10,
      orderBy: { votes: 'desc' },
      where: { isExpired: false },
      select: {
        id: true,
        title: true,
        dealPrice: true,
        originalPrice: true,
        votes: true,
        isHot: true,
        createdAt: true,
        product: {
          select: {
            name: true,
            imageUrl: true,
            merchant: { select: { name: true } },
            category: { select: { name: true } },
          },
        },
      },
    });

    // Top 10 deals les plus likés (favoris)
    const topFavorites = await prisma.deal.findMany({
      take: 10,
      where: { isExpired: false },
      select: {
        id: true,
        title: true,
        dealPrice: true,
        originalPrice: true,
        votes: true,
        _count: { select: { favorites: true } },
        product: {
          select: {
            name: true,
            imageUrl: true,
            merchant: { select: { name: true } },
          },
        },
      },
      orderBy: {
        favorites: { _count: 'desc' },
      },
    });

    // Stats par catégorie
    const categoryStats = await prisma.category.findMany({
      select: {
        name: true,
        slug: true,
        _count: {
          select: { products: true },
        },
      },
      orderBy: {
        products: { _count: 'desc' },
      },
    });

    // Stats par marchand
    const merchantStats = await prisma.merchant.findMany({
      select: {
        name: true,
        slug: true,
        _count: {
          select: { products: true },
        },
      },
      orderBy: {
        products: { _count: 'desc' },
      },
    });

    // Dernières inscriptions newsletter
    const recentNewsletterSignups = await prisma.newsletterSubscription.findMany({
      take: 10,
      orderBy: { subscribedAt: 'desc' },
      select: {
        email: true,
        source: true,
        subscribedAt: true,
        isConfirmed: true,
      },
    });

    // Derniers utilisateurs inscrits
    const recentUsers = await prisma.user.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        displayName: true,
        username: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    // Calcul des économies totales générées
    const dealsWithPrices = await prisma.deal.findMany({
      where: { isExpired: false },
      select: {
        dealPrice: true,
        originalPrice: true,
      },
    });
    
    const totalSavings = dealsWithPrices.reduce((acc, deal) => {
      return acc + (deal.originalPrice - deal.dealPrice);
    }, 0);

    const averageDiscount = dealsWithPrices.length > 0
      ? dealsWithPrices.reduce((acc, deal) => {
          const discount = ((deal.originalPrice - deal.dealPrice) / deal.originalPrice) * 100;
          return acc + discount;
        }, 0) / dealsWithPrices.length
      : 0;

    return NextResponse.json({
      overview: {
        totalDeals,
        activeDeals,
        expiredDeals,
        hotDeals,
        totalUsers,
        totalVotes,
        totalComments,
        totalFavorites,
        totalNewsletterSubscribers,
        confirmedNewsletterSubscribers,
        totalProducts,
        totalBrands,
        totalCategories,
        totalSavings: Math.round(totalSavings * 100) / 100,
        averageDiscount: Math.round(averageDiscount * 10) / 10,
      },
      growth: {
        deals: { today: dealsToday, week: dealsThisWeek, month: dealsThisMonth },
        users: { today: usersToday, week: usersThisWeek, month: usersThisMonth },
        newsletter: { today: newsletterToday, week: newsletterThisWeek, month: newsletterThisMonth },
      },
      topDeals,
      topFavorites: topFavorites.map(d => ({
        ...d,
        favoritesCount: d._count.favorites,
      })),
      categoryStats: categoryStats.map(c => ({
        name: c.name,
        slug: c.slug,
        productsCount: c._count.products,
      })),
      merchantStats: merchantStats.map(m => ({
        name: m.name,
        slug: m.slug,
        productsCount: m._count.products,
      })),
      recentNewsletterSignups,
      recentUsers,
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des statistiques' },
      { status: 500 }
    );
  }
}
