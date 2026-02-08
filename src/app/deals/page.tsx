import type { Metadata } from 'next';
import prisma from '@/lib/prisma';
import Link from 'next/link';
import DealCard from '@/components/deals/DealCard';
import DealsPageClient from './DealsPageClient';
import { ChevronLeft, ChevronRight, Package } from 'lucide-react';

// Force dynamic rendering pour avoir des données fraîches
export const dynamic = 'force-dynamic';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://citybaddies.com';
const DEALS_PER_PAGE = 24;

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

  // --- SEO : Déterminer l'indexabilité ---
  // Indexable : /deals, /deals?category=X, /deals?category=X&brand=Y
  // Non-indexable : tri, prix, page>1, recherche, sous-catégories, tags, hot, merchant
  const hasNoiseParams = !!(
    params.subcategory || params.subsubcategory || params.merchant ||
    params.tag || params.search || params.sortBy || params.sortOrder ||
    params.hot || params.minPrice || params.maxPrice ||
    page > 1
  );

  // Brand sans category = pas un pattern indexable valide
  const isIndexable = !hasNoiseParams && (!brand || !!category);

  // --- SEO : Canonical URL ---
  // Pointe toujours vers l'URL indexable la plus propre
  let canonicalUrl = `${BASE_URL}/deals`;
  if (category) {
    canonicalUrl = `${BASE_URL}/deals?category=${category}`;
    // On inclut brand dans le canonical seulement si l'URL est propre
    if (brand && !hasNoiseParams) {
      canonicalUrl = `${BASE_URL}/deals?category=${category}&brand=${encodeURIComponent(brand)}`;
    }
  }

  // --- SEO : Titre et description dynamiques ---
  let title: string;
  let description: string;

  if (category) {
    const categoryName = CATEGORY_SEO_NAMES[category] || category.charAt(0).toUpperCase() + category.slice(1).replace(/-/g, ' ');
    if (brand) {
      title = `${brand} ${categoryName} — Promos & Bons Plans`;
      description = `Les meilleures offres ${brand} en ${categoryName.toLowerCase()} jusqu'à -70%. Deals vérifiés quotidiennement sur Sephora, Nocibé et Marionnaud.`;
    } else {
      title = `Deals ${categoryName} — Promos & Bons Plans Beauté`;
      description = `Toutes les promotions ${categoryName.toLowerCase()} jusqu'à -70%. Sephora, Nocibé, Marionnaud : offres vérifiées quotidiennement.`;
    }
  } else {
    title = 'Tous les Deals Beauté | Promos Maquillage, Skincare & Parfums';
    description = 'Découvrez tous les bons plans beauté du moment : maquillage, soins visage, parfums et plus encore. Jusqu\'à -70% sur Sephora, Nocibé et Marionnaud.';
  }

  if (page > 1) {
    title += ` — Page ${page}`;
  }

  return {
    title,
    description,
    keywords: [
      'deals beauté',
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
        ? `Deals ${CATEGORY_SEO_NAMES[category] || category}${brand ? ` ${brand}` : ''} | City Baddies`
        : 'Tous les Deals Beauté | City Baddies',
      description: description.substring(0, 200),
      url: canonicalUrl,
      type: 'website',
    },
  };
}

// Récupérer les données avec pagination SSR + filtres server-side
async function getDealsData(page: number, filters: {
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
  const skip = (page - 1) * DEALS_PER_PAGE;

  // Construire le WHERE dynamique basé sur les filtres
  const where: any = {
    status: 'ACTIVE' as const,
  };

  // Filtre par catégorie (slug)
  if (filters.categories && filters.categories.length > 0) {
    where.product = { ...where.product, category: { slug: { in: filters.categories } } };
  }

  // Filtre par sous-catégorie (champ string sur Product)
  if (filters.subcategories && filters.subcategories.length > 0) {
    where.product = { ...where.product, subcategory: { in: filters.subcategories } };
  }

  // Filtre par sous-sous-catégorie (champ string sur Product)
  if (filters.subsubcategories && filters.subsubcategories.length > 0) {
    where.product = { ...where.product, subsubcategory: { in: filters.subsubcategories } };
  }

  // Filtre par marchand (slug)
  if (filters.merchants && filters.merchants.length > 0) {
    where.product = { ...where.product, merchant: { slug: { in: filters.merchants } } };
  }

  // Filtre par marque (nom exact, insensible à la casse)
  if (filters.brands && filters.brands.length > 0) {
    where.product = { ...where.product, brand: { in: filters.brands, mode: 'insensitive' } };
  }

  // Filtre par tags (contient un des tags)
  if (filters.tags && filters.tags.length > 0) {
    where.OR = filters.tags.map(tag => ({ tags: { contains: tag } }));
  }

  // Filtre par recherche textuelle
  if (filters.search) {
    const searchTerm = filters.search;
    where.AND = [
      ...(where.AND || []),
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
    where.isHot = true;
  }

  // Filtre par prix
  if (filters.minPrice !== undefined) {
    where.dealPrice = { ...where.dealPrice, gte: filters.minPrice };
  }
  if (filters.maxPrice !== undefined) {
    where.dealPrice = { ...where.dealPrice, lte: filters.maxPrice };
  }

  // Construire le ORDER BY
  let orderBy: any[] = [{ createdAt: 'desc' }];
  if (filters.sortBy) {
    switch (filters.sortBy) {
      case 'discountPercent':
        orderBy = [{ discountPercent: filters.sortOrder === 'asc' ? 'asc' : 'desc' }];
        break;
      case 'votes':
        orderBy = [{ votes: filters.sortOrder === 'asc' ? 'asc' : 'desc' }];
        break;
      case 'dealPrice':
        orderBy = [{ dealPrice: filters.sortOrder === 'asc' ? 'asc' : 'desc' }];
        break;
      default:
        orderBy = [{ createdAt: filters.sortOrder === 'asc' ? 'asc' : 'desc' }];
    }
  }
  
  // Récupérer les deals paginés + catégories + merchants + brands
  const [deals, totalDeals, categoriesRaw, merchantsRaw, brandsRaw] = await Promise.all([
    prisma.deal.findMany({
      where,
      include: {
        product: {
          include: {
            category: true,
            merchant: true,
          },
        },
      },
      orderBy,
      skip,
      take: DEALS_PER_PAGE,
    }),
    prisma.deal.count({ where }),
    // Catégories avec des deals actifs
    prisma.category.findMany({
      where: {
        products: {
          some: {
            deals: {
              some: {
                status: 'ACTIVE',
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    }),
    // Merchants avec des deals actifs
    prisma.merchant.findMany({
      where: {
        products: {
          some: {
            deals: {
              some: {
                status: 'ACTIVE',
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    }),
    // Brands uniques avec des deals actifs
    prisma.deal.findMany({
      where: {
        status: 'ACTIVE',
      },
      select: {
        product: {
          select: {
            brand: true,
          },
        },
      },
      distinct: ['productId'],
    }),
  ]);

  const totalPages = Math.ceil(totalDeals / DEALS_PER_PAGE);
  
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

  // Extraire les marques uniques et les trier
  const uniqueBrands = [...new Set(brandsRaw.map(d => d.product.brand).filter((b): b is string => Boolean(b)))].sort();
  const brands = uniqueBrands.map(b => ({
    name: b,
    slug: b.toLowerCase().replace(/\s+/g, '-'),
  }));

  return {
    deals,
    totalDeals,
    totalPages,
    currentPage: page,
    categories,
    merchants,
    brands,
  };
}

// Générer l'URL de pagination
function getPageUrl(page: number): string {
  if (page === 1) return '/deals';
  return `/deals?page=${page}`;
}

export default async function DealsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const page = typeof params.page === 'string' ? Math.max(1, parseInt(params.page, 10)) : 1;

  // Extraire les filtres des query params
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
    sortBy: typeof params.sortBy === 'string' ? params.sortBy : 'createdAt',
    sortOrder: typeof params.sortOrder === 'string' ? params.sortOrder : 'desc',
    hotOnly: params.hot === 'true',
    minPrice: typeof params.minPrice === 'string' ? parseFloat(params.minPrice) : undefined,
    maxPrice: typeof params.maxPrice === 'string' ? parseFloat(params.maxPrice) : undefined,
  };
  
  const { deals, totalDeals, totalPages, currentPage, categories, merchants, brands } = await getDealsData(page, serverFilters);

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
        {/* Header SEO avec H1 et contenu éditorial */}
        <header className="mb-20 text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold tracking-[0.3em] uppercase text-[#d4a855] mb-8 hover:bg-white/10 transition-colors cursor-default">
            <span className="w-1.5 h-1.5 rounded-full bg-[#d4a855]"></span>
            {totalDeals} Pépites Trouvées
          </div>

          <h1 className="text-5xl md:text-7xl font-thin tracking-tighter mb-8 text-white uppercase leading-[0.9]">
            Tous les <br/>
            <span className="font-normal italic text-white/40">Bons Plans</span>
          </h1>

          <div className="text-neutral-400 font-light text-lg md:text-xl leading-relaxed max-w-2xl mx-auto">
            <p className="mb-4">
              La collection complète de nos trouvailles chez <span className="text-white">Sephora, Nocibé et Marionnaud</span>.
            </p>
            <p className="text-base text-neutral-500">
              Chaque offre est vérifiée quotidiennement par notre équipe pour garantir sa validité.
              {page === 1 && ` Utilise les filtres pour affiner ta recherche.`}
            </p>
          </div>
        </header>

        {/* Composant client avec filtres interactifs */}
        <DealsPageClient
          initialDeals={serializedDeals}
          categories={categories}
          merchants={merchants}
          brands={brands}
          totalDeals={totalDeals}
          totalPages={totalPages}
          currentPage={currentPage}
          initialFilters={serverFilters}
        />

        {/* Liens SEO pour le maillage interne — pointe vers les landing pages indexables */}
        <div className="mt-16 border-t border-white/10 pt-8">
          <h2 className="text-xl font-semibold text-white mb-4">Explorer par catégorie</h2>
          <div className="flex flex-wrap gap-3">
            {categories.map((category) => (
              <Link
                key={category.id}
                href={`/deals?category=${category.slug}`}
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
