import { notFound } from 'next/navigation';
import Link from 'next/link';
import prisma from '@/lib/prisma';
import type { Metadata } from 'next';
import Script from 'next/script';
import { ArrowLeft } from 'lucide-react';
import { generateBreadcrumbSchema } from '@/lib/seo-config';
import ProductPricing from '@/components/deals/ProductPricing';
import ProductImageCarousel from '@/components/deals/ProductImageCarousel';
import { getHighQualityImageUrl, isValidImageUrl } from '@/lib/utils/image';

// Force dynamic
export const dynamic = 'force-dynamic';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://citybaddies.com';

// ──────────────────────────────────────────────────────────────────
// SEO Metadata
// ──────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;

  const product = await prisma.product.findUnique({
    where: { slug },
    include: {
      category: true,
      deals: {
        where: { status: 'ACTIVE' },
        orderBy: { dealPrice: 'asc' },
        take: 1,
      },
    },
  });

  // Aucun produit OU aucun deal actif (offre expirée) → noindex : on ne veut pas
  // indexer une fiche sans prix en cours.
  if (!product || product.deals.length === 0) {
    return {
      title: 'Produit non trouvé',
      description: "Ce produit n'existe pas.",
      robots: { index: false, follow: false },
    };
  }

  const bestDeal = product.deals[0];
  const brandName = product.brand || '';
  const categoryName = product.category?.name || 'Beauté';
  const productName = product.name;
  const priceText = bestDeal ? `à partir de ${bestDeal.dealPrice.toFixed(2)}€` : '';
  const discountText = bestDeal && bestDeal.discountPercent > 0 ? `(-${bestDeal.discountPercent}%)` : '';

  const title = `${brandName} ${productName} ${discountText}`.trim();
  const description = `${brandName} ${productName} ${priceText} ${discountText}. Comparez les prix entre Sephora, Nocibé et Marionnaud. ${categoryName} — City Baddies.`;

  return {
    title,
    description,
    robots: { index: true, follow: true },
    keywords: [
      productName,
      brandName,
      categoryName,
      `${brandName} ${productName} prix`,
      `${brandName} pas cher`,
      `comparateur prix ${categoryName.toLowerCase()}`,
    ].filter(Boolean),
    alternates: {
      canonical: `${BASE_URL}/produits/${slug}`,
    },
    openGraph: {
      title: `${brandName} ${productName} ${discountText}`.trim(),
      description,
      url: `${BASE_URL}/produits/${slug}`,
      type: 'website',
      images: bestDeal?.imageUrl ? [{ url: bestDeal.imageUrl, width: 800, height: 600, alt: `${brandName} ${productName}` }] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${brandName} ${productName} ${discountText}`.trim(),
      description: priceText ? `${productName} ${priceText}` : productName,
      images: bestDeal?.imageUrl ? [bestDeal.imageUrl] : [],
    },
  };
}

// ──────────────────────────────────────────────────────────────────
// Data fetching
// ──────────────────────────────────────────────────────────────────

async function getProductData(slug: string) {
  const product = await prisma.product.findUnique({
    where: { slug },
    include: {
      category: true,
      brandRef: true,
      images: {
        orderBy: { position: 'asc' },
      },
      variants: {
        orderBy: { volumeValue: 'asc' },
      },
      deals: {
        where: { status: 'ACTIVE' },
        orderBy: { dealPrice: 'asc' },
        include: {
          merchant: true,
          variant: true,
        },
      },
      priceHistory: {
        orderBy: { date: 'asc' },
      },
    },
  });

  if (!product) return null;
  if (product.deals.length === 0) return null; // Pas de deal actif

  return product;
}

// ──────────────────────────────────────────────────────────────────
// Page Component
// ──────────────────────────────────────────────────────────────────

export default async function ProduitPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductData(slug);

  if (!product) notFound();

  const bestDeal = product.deals[0]; // Lowest price (ordered by dealPrice asc)
  const bestScore = Math.max(...product.deals.map(d => d.score || 0));
  const categoryName = product.category?.name || 'Beauté';
  const brandName = product.brand || '';

  // Breadcrumb schema
  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Accueil', url: BASE_URL },
    { name: 'Produits', url: `${BASE_URL}/produits` },
    ...(product.category ? [{ name: product.category.name, url: `${BASE_URL}/produits?category=${product.category.slug}` }] : []),
    { name: `${brandName} ${product.name}`, url: `${BASE_URL}/produits/${slug}` },
  ]);

  // Product schema
  const productSchema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: `${brandName} ${product.name}`,
    description: product.seoDescription || product.description || `${brandName} ${product.name} — ${categoryName}`,
    image: bestDeal?.imageUrl,
    brand: brandName ? { '@type': 'Brand', name: brandName } : undefined,
    category: categoryName,
    sku: product.id,
    offers: product.deals.map(deal => ({
      '@type': 'Offer',
      url: `${BASE_URL}/produits/${slug}`,
      priceCurrency: 'EUR',
      price: deal.dealPrice,
      availability: 'https://schema.org/InStock',
      seller: {
        '@type': 'Organization',
        name: deal.merchant.name,
      },
    })),
  };

  // Serialize deals for the client component
  const serializedDeals = product.deals.map(deal => ({
    id: deal.id,
    dealPrice: deal.dealPrice,
    originalPrice: deal.originalPrice,
    discountPercent: deal.discountPercent,
    volume: deal.volume,
    sourceUrl: deal.sourceUrl,
    productUrl: deal.productUrl,
    promoCode: deal.promoCode,
    priceConditions: deal.priceConditions,
    merchant: { name: deal.merchant.name, slug: deal.merchant.slug },
    variant: deal.variant ? {
      volumeValue: deal.variant.volumeValue,
      volumeUnit: deal.variant.volumeUnit,
    } : null,
  }));

  // Priorité des marchands pour les images : Sephora → Marionnaud → Nocibé
  const MERCHANT_IMAGE_PRIORITY: Record<string, number> = {
    'cmluymd990000trhkr60e37nd': 0, // Sephora
    'cmluya9ag0000trz04a2fx00m': 1, // Marionnaud
    'cmluyeypq0000trwstrwoiqaz': 2, // Nocibé
  };

  // Serialize product images for the carousel (HD quality + original pour fallback)
  // Tri : d'abord par priorité marchand, puis par position au sein du même marchand
  const productImages: { url: string; originalUrl: string; alt: string | null; type: string }[] = [...product.images]
    .sort((a, b) => {
      const prioA = a.merchantId ? (MERCHANT_IMAGE_PRIORITY[a.merchantId] ?? 99) : 99;
      const prioB = b.merchantId ? (MERCHANT_IMAGE_PRIORITY[b.merchantId] ?? 99) : 99;
      if (prioA !== prioB) return prioA - prioB;
      return a.position - b.position;
    })
    .map(img => ({
      url: getHighQualityImageUrl(img.url) || img.url,
      originalUrl: img.url,
      alt: img.alt,
      type: img.type,
    }))
    .filter(img => isValidImageUrl(img.url) || isValidImageUrl(img.originalUrl));

  // Fallback: ajouter l'image du deal si pas d'images produit
  if (productImages.length === 0) {
    const dealImg = getHighQualityImageUrl(bestDeal?.imageUrl);
    const originalDealImg = bestDeal?.imageUrl || '';
    if (isValidImageUrl(dealImg) || isValidImageUrl(originalDealImg)) {
      productImages.push({
        url: dealImg || originalDealImg,
        originalUrl: originalDealImg,
        alt: `${brandName} ${product.name}`,
        type: 'packshot',
      });
    }
  }

  // Serialized price history for chart
  const serializedPriceHistory = product.priceHistory.map(ph => ({
    ...ph,
    date: ph.date.toISOString(),
  }));

  return (
    <>
      <Script
        id="breadcrumb-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <Script
        id="product-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
      />

      <div className="min-h-screen bg-[#0a0a0a] py-6 sm:py-10 md:py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-12">

          {/* ── Breadcrumb ── */}
          <nav className="flex items-center gap-2 sm:gap-3 text-[9px] uppercase tracking-[0.2em] sm:tracking-[0.3em] text-neutral-500 mb-6 sm:mb-8 md:mb-12 overflow-x-auto whitespace-nowrap scrollbar-hide">
            <Link href="/" className="hover:text-white transition-colors flex-shrink-0">Accueil</Link>
            <span className="text-neutral-700 flex-shrink-0">/</span>
            <Link href="/produits" className="hover:text-white transition-colors flex-shrink-0">Produits</Link>
            {product.category && (
              <>
                <span className="text-neutral-700 flex-shrink-0">/</span>
                <Link href={`/produits?category=${product.category.slug}`} className="hover:text-white transition-colors flex-shrink-0">
                  {product.category.name}
                </Link>
              </>
            )}
            <span className="text-neutral-700 flex-shrink-0 hidden sm:inline">/</span>
            <span className="text-neutral-400 truncate hidden sm:inline">{brandName} {product.name}</span>
          </nav>

          {/* ── Hero Section ── */}
          <div className="grid md:grid-cols-2 gap-6 sm:gap-8 md:gap-20 mb-12 sm:mb-16 md:mb-24">
            {/* Image Carousel */}
            <ProductImageCarousel
              images={productImages}
              productName={product.name}
              brandName={brandName}
              categorySlug={product.category?.slug}
            />

            {/* Info + Pricing */}
            <div className="flex flex-col justify-center">
              {/* Brand */}
              <span className="text-[10px] font-bold uppercase tracking-[0.3em] sm:tracking-[0.4em] text-neutral-400 mb-2 sm:mb-4">
                {brandName}
              </span>

              {/* Product name */}
              <h1 className="text-2xl sm:text-3xl md:text-5xl font-light tracking-tight text-white mb-6 sm:mb-8 md:mb-12 leading-[1.1]">
                {product.name}
              </h1>

              {/* Interactive Pricing with Volume Selector + Price History */}
              <ProductPricing
                deals={serializedDeals}
                priceHistory={serializedPriceHistory}
              />

              {/* Category tag */}
              <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.2em] text-neutral-500 mt-6 sm:mt-8 md:mt-12 pt-4 sm:pt-6 md:pt-8 border-t border-white/10">
                <Link href={`/produits?category=${product.category?.slug}`} className="hover:text-white transition-colors">
                  {categoryName}
                </Link>
                {product.subcategory && (
                  <>
                    <span className="text-neutral-700">/</span>
                    <span>{product.subcategory}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* ── Details Grid ── */}
          <div className="grid md:grid-cols-2 gap-8 sm:gap-12 md:gap-24 mb-12 sm:mb-16 md:mb-24">
            {/* Left Column: Analysis & Description */}
            <div className="space-y-8 sm:space-y-12 md:space-y-16">
              {/* ── Why Good Deal (AI analysis) ── */}
              {bestDeal.whyGoodDeal && (
                <section>
                  <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-neutral-500 mb-4 sm:mb-6">
                    Notre analyse
                  </h2>
                  <div
                    className="text-neutral-300 font-light text-sm leading-loose prose prose-invert prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: bestDeal.whyGoodDeal }}
                  />
                </section>
              )}

              {/* ── Product Description ── */}
              {(product.seoDescription || product.description) && (
                <section>
                  <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-neutral-500 mb-4 sm:mb-6">
                    Description
                  </h2>
                  <div className="text-neutral-400 font-light text-sm leading-loose">
                    {product.seoDescription || product.description}
                  </div>
                </section>
              )}
            </div>

            {/* Right Column: Ingredients */}
            <div className="space-y-8 sm:space-y-12 md:space-y-16">
              {/* ── Ingredients ── */}
              {product.ingredients && (
                <section>
                  <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-neutral-500 mb-4 sm:mb-6">
                    Ingrédients (INCI)
                  </h2>
                  <div className="text-neutral-500 font-light text-xs leading-loose">
                    {product.ingredients}
                  </div>
                </section>
              )}
            </div>
          </div>

          {/* ── Back link ── */}
          <div className="pt-8 sm:pt-12 border-t border-white/10 flex justify-center">
            <Link
              href="/produits"
              className="inline-flex items-center gap-3 text-[10px] font-bold uppercase tracking-[0.3em] text-neutral-500 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-3 w-3" />
              Retour aux produits
            </Link>
          </div>

        </div>
      </div>
    </>
  );
}
