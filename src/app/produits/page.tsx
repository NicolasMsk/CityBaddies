import type { Metadata } from 'next';
import prisma from '@/lib/prisma';
import Link from 'next/link';
import ProduitsPageClient from './ProduitsPageClient';

// Force dynamic rendering pour avoir des données fraîches
export const dynamic = 'force-dynamic';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://citybaddies.com';
const PRODUCTS_PER_PAGE = 24;

interface PageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

// Mapping catégories pour titres SEO propres
const CATEGORY_SEO_NAMES: Record<string, string> = {
  'parfums': 'Parfums',
  'maquillage': 'Maquillage',
  'soins-visage': 'Soins Visage',
  'soins-corps': 'Soins Corps',
  'cheveux': 'Cheveux',
  'ongles': 'Ongles',
};

// Génération dynamique des métadonnées SEO
export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const params = await searchParams;
  const page = typeof params.page === 'string' ? parseInt(params.page, 10) : 1;
  const category = typeof params.category === 'string' ? params.category : undefined;
  const brand = typeof params.brand === 'string' ? params.brand : undefined;

  const hasNoiseParams = !!(
    params.subcategory || params.subsubcategory || params.merchant ||
    params.tag || params.search || params.sortBy || params.sortOrder ||
    params.hot || params.minPrice || params.maxPrice ||
    page > 1
  );

  const isIndexable = !hasNoiseParams && (!brand || !!category);

  let canonicalUrl = `${BASE_URL}/produits`;
  if (category) {
    canonicalUrl = `${BASE_URL}/produits?category=${category}`;
    if (brand && !hasNoiseParams) {
      canonicalUrl = `${BASE_URL}/produits?category=${category}&brand=${encodeURIComponent(brand)}`;
    }
  }

  let title: string;
  let description: string;

  if (category) {
    const categoryName = CATEGORY_SEO_NAMES[category] || category.charAt(0).toUpperCase() + category.slice(1).replace(/-/g, ' ');
    if (brand) {
      title = `${brand} ${categoryName} — Comparer les Prix`;
      description = `Comparez les prix ${brand} en ${categoryName.toLowerCase()} entre Sephora, Nocibé et Marionnaud. Trouvez le meilleur prix garanti.`;
    } else {
      title = `${categoryName} — Comparateur de Prix Beauté`;
      description = `Comparez les prix ${categoryName.toLowerCase()} entre Sephora, Nocibé et Marionnaud. Offres vérifiées quotidiennement.`;
    }
  } else {
    title = 'Tous les Produits Beauté | Comparateur de Prix';
    description = 'Comparez les prix beauté entre Sephora, Nocibé, Marionnaud et Notino. Maquillage, skincare, parfums : trouvez le meilleur prix.';
  }

  if (page > 1) {
    title += ` — Page ${page}`;
  }

  return {
    title,
    description,
    keywords: [
      'comparateur prix beauté',
      'bons plans maquillage',
      'promo skincare',
      'réduction parfum',
      'soldes cosmétiques',
      'offres sephora',
      'promo nocibé',
      'deals marionnaud',
      ...(category ? [`promo ${CATEGORY_SEO_NAMES[category]?.toLowerCase() || category}`] : []),
      ...(brand ? [`${brand.toLowerCase()} promo`, `${brand.toLowerCase()} pas cher`] : []),
    ],
    robots: isIndexable
      ? { index: true, follow: true }
      : { index: false, follow: true },
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: category
        ? `${CATEGORY_SEO_NAMES[category] || category}${brand ? ` ${brand}` : ''} | City Baddies`
        : 'Tous les Produits Beauté | City Baddies',
      description: description.substring(0, 200),
      url: canonicalUrl,
      type: 'website',
    },
  };
}

// Récupérer les données avec pagination SSR + filtres server-side
async function getProduitsData(page: number, filters: {
  categories?: string[];
  subcategories?: string[];
  subsubcategories?: string[];
  merchants?: string[];
  brands?: string[];
  tags?: string[];
  search?: string;
  sortBy?: string;
  sortOrder?: string;
  hotOnly?: boolean;
  minPrice?: number;
  maxPrice?: number;
}) {
  const skip = (page - 1) * PRODUCTS_PER_PAGE;

  // Construire le WHERE sur Deal (pour filtrer puis distinct par product)
  const dealWhere: any = {
    status: 'ACTIVE' as const,
  };

  // Filtre par catégorie (slug)
  if (filters.categories && filters.categories.length > 0) {
    dealWhere.product = { ...dealWhere.product, category: { slug: { in: filters.categories } } };
  }

  // Filtre par sous-catégorie
  if (filters.subcategories && filters.subcategories.length > 0) {
    dealWhere.product = { ...dealWhere.product, subcategory: { in: filters.subcategories } };
  }

  // Filtre par sous-sous-catégorie
  if (filters.subsubcategories && filters.subsubcategories.length > 0) {
    dealWhere.product = { ...dealWhere.product, subsubcategory: { in: filters.subsubcategories } };
  }

  // Filtre par marchand (slug)
  if (filters.merchants && filters.merchants.length > 0) {
    dealWhere.merchant = { slug: { in: filters.merchants } };
  }

  // Filtre par marque
  if (filters.brands && filters.brands.length > 0) {
    dealWhere.product = { ...dealWhere.product, brand: { in: filters.brands, mode: 'insensitive' } };
  }

  // Filtre par tags
  if (filters.tags && filters.tags.length > 0) {
    dealWhere.OR = filters.tags.map((tag: string) => ({ tags: { contains: tag } }));
  }

  // Filtre par recherche textuelle
  if (filters.search) {
    const searchTerm = filters.search;
    dealWhere.AND = [
      ...(dealWhere.AND || []),
      {
        OR: [
          { title: { contains: searchTerm, mode: 'insensitive' } },
          { refinedTitle: { contains: searchTerm, mode: 'insensitive' } },
          { product: { name: { contains: searchTerm, mode: 'insensitive' } } },
          { product: { brand: { contains: searchTerm, mode: 'insensitive' } } },
        ],
      },
    ];
  }

  // Filtre hot only
  if (filters.hotOnly) {
    dealWhere.isHot = true;
  }

  // Filtre par prix
  if (filters.minPrice !== undefined) {
    dealWhere.dealPrice = { ...dealWhere.dealPrice, gte: filters.minPrice };
  }
  if (filters.maxPrice !== undefined) {
    dealWhere.dealPrice = { ...dealWhere.dealPrice, lte: filters.maxPrice };
  }

  // Déterminer le tri — par défaut : score desc
  let orderBy: any[] = [{ score: 'desc' }];
  if (filters.sortBy) {
    switch (filters.sortBy) {
      case 'score':
        orderBy = [{ score: filters.sortOrder === 'asc' ? 'asc' : 'desc' }];
        break;
      case 'discountPercent':
        orderBy = [{ discountPercent: filters.sortOrder === 'asc' ? 'asc' : 'desc' }];
        break;
      case 'votes':
        orderBy = [{ votes: filters.sortOrder === 'asc' ? 'asc' : 'desc' }];
        break;
      case 'dealPrice':
        orderBy = [{ dealPrice: filters.sortOrder === 'asc' ? 'asc' : 'desc' }];
        break;
      case 'createdAt':
        orderBy = [{ createdAt: filters.sortOrder === 'asc' ? 'asc' : 'desc' }];
        break;
      default:
        orderBy = [{ score: 'desc' }];
    }
  }

  // Requête principale : 1 deal (le meilleur) par produit, trié par score
  const [deals, totalProducts, categoriesRaw, merchantsRaw, brandsRaw] = await Promise.all([
    prisma.deal.findMany({
      where: dealWhere,
      include: {
        merchant: true,
        product: {
          include: {
            category: true,
            images: { orderBy: { position: 'asc' }, take: 5 },
          },
        },
      },
      orderBy,
      distinct: ['productId'], // Un seul deal par produit (le meilleur selon le tri)
      skip,
      take: PRODUCTS_PER_PAGE,
    }),
    // Compter le nombre de produits distincts avec des deals actifs
    prisma.product.count({
      where: {
        deals: { some: { status: 'ACTIVE' } },
        ...(filters.categories?.length ? { category: { slug: { in: filters.categories } } } : {}),
        ...(filters.brands?.length ? { brand: { in: filters.brands, mode: 'insensitive' as const } } : {}),
      },
    }),
    // Catégories avec des deals actifs
    prisma.category.findMany({
      where: {
        products: {
          some: {
            deals: { some: { status: 'ACTIVE' } },
          },
        },
      },
      orderBy: { name: 'asc' },
    }),
    // Merchants avec des deals actifs
    prisma.merchant.findMany({
      where: {
        deals: {
          some: {
            status: 'ACTIVE',
          },
        },
      },
      orderBy: { name: 'asc' },
    }),
    // Brands uniques avec des deals actifs
    prisma.deal.findMany({
      where: { status: 'ACTIVE' },
      select: {
        product: {
          select: { brand: true },
        },
      },
      distinct: ['productId'],
    }),
  ]);

  const totalPages = Math.ceil(totalProducts / PRODUCTS_PER_PAGE);

  const categories = categoriesRaw.map(c => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    icon: c.icon ?? undefined,
    description: c.description ?? undefined,
  }));

  const merchants = merchantsRaw.map(m => ({
    id: String(m.id),
    name: m.name,
    slug: m.slug,
  }));

  const uniqueBrands = [...new Set(brandsRaw.map(d => d.product.brand).filter((b): b is string => Boolean(b)))].sort();
  const brands = uniqueBrands.map(b => ({
    name: b,
    slug: b.toLowerCase().replace(/\s+/g, '-'),
  }));

  return {
    deals,
    totalProducts,
    totalPages,
    currentPage: page,
    categories,
    merchants,
    brands,
  };
}

export default async function ProduitsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = typeof params.page === 'string' ? Math.max(1, parseInt(params.page, 10)) : 1;

  const parseArray = (val: string | string[] | undefined): string[] => {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    return val.split(',').filter(Boolean);
  };

  const serverFilters = {
    categories: parseArray(params.category),
    subcategories: parseArray(params.subcategory),
    subsubcategories: parseArray(params.subsubcategory),
    merchants: parseArray(params.merchant),
    brands: parseArray(params.brand),
    tags: parseArray(params.tag),
    search: typeof params.search === 'string' ? params.search : undefined,
    sortBy: typeof params.sortBy === 'string' ? params.sortBy : 'score',
    sortOrder: typeof params.sortOrder === 'string' ? params.sortOrder : 'desc',
    hotOnly: params.hot === 'true',
    minPrice: typeof params.minPrice === 'string' ? parseFloat(params.minPrice) : undefined,
    maxPrice: typeof params.maxPrice === 'string' ? parseFloat(params.maxPrice) : undefined,
  };

  const { deals, totalProducts, totalPages, currentPage, categories, merchants, brands } = await getProduitsData(page, serverFilters);

  // Sérialiser les deals pour le client (dates -> strings)
  const serializedDeals = deals.map(deal => ({
    ...deal,
    createdAt: deal.createdAt.toISOString(),
    updatedAt: deal.updatedAt.toISOString(),
    lastSeenAt: deal.lastSeenAt?.toISOString() || null,
    product: {
      ...deal.product,
      createdAt: deal.product.createdAt.toISOString(),
      updatedAt: deal.product.updatedAt.toISOString(),
    },
  }));

  return (
    <div className="min-h-screen py-8 bg-[#0a0a0a]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header SEO */}
        <header className="mb-20 text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold tracking-[0.3em] uppercase text-[#d4a855] mb-8 hover:bg-white/10 transition-colors cursor-default">
            <span className="w-1.5 h-1.5 rounded-full bg-[#d4a855]"></span>
            {totalProducts} Produits Analysés
          </div>

          <h1 className="text-5xl md:text-7xl font-thin tracking-tighter mb-8 text-white uppercase leading-[0.9]">
            Tous les <br/>
            <span className="font-normal italic text-white/40">Produits</span>
          </h1>

          <div className="text-neutral-400 font-light text-lg md:text-xl leading-relaxed max-w-2xl mx-auto">
            <p className="mb-4">
              Comparez les prix beauté entre <span className="text-white">Sephora, Nocibé, Marionnaud et Notino</span>.
            </p>
            <p className="text-base text-neutral-500">
              Chaque produit est analysé et noté. On vous dit si c&apos;est vraiment une bonne affaire.
              {page === 1 && ` Triés par score par défaut.`}
            </p>
          </div>
        </header>

        {/* Composant client avec filtres interactifs */}
        <ProduitsPageClient
          initialDeals={serializedDeals}
          categories={categories}
          merchants={merchants}
          brands={brands}
          totalProducts={totalProducts}
          totalPages={totalPages}
          currentPage={currentPage}
          initialFilters={serverFilters}
        />

        {/* Liens SEO pour le maillage interne */}
        <div className="mt-16 border-t border-white/10 pt-8">
          <h2 className="text-xl font-semibold text-white mb-4">Explorer par catégorie</h2>
          <div className="flex flex-wrap gap-3">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/produits?category=${category.slug}`}
                className="px-4 py-2 rounded-full bg-[#1a1a1a] text-white/70 hover:bg-[#7b0a0a]/20 hover:text-white border border-white/10 transition-all"
              >
                {category.name}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
