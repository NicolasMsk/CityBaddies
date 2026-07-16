import { notFound } from 'next/navigation';
import Link from 'next/link';
import prisma from '@/lib/prisma';
import type { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';
import { generateBreadcrumbSchema, fullProductName } from '@/lib/seo-config';
import JsonLd from '@/components/seo/JsonLd';
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
        include: { variant: true },
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
  // fullProductName évite "Lancôme Lancôme La Vie Est Belle…" (le nom contient déjà la marque)
  const fullName = fullProductName(brandName, product.name);
  const bestSize = bestDeal?.variant ? ` (${bestDeal.variant.volumeValue} ${bestDeal.variant.volumeUnit})` : '';
  const priceText = bestDeal ? `à partir de ${bestDeal.dealPrice.toFixed(2)}€${bestSize}` : '';
  const discountText = bestDeal && bestDeal.discountPercent > 0 ? `(-${bestDeal.discountPercent}%)` : '';

  const title = `${fullName} ${discountText}`.trim();
  const description = `${fullName} ${priceText} ${discountText}. Comparez les prix entre Sephora, Nocibé et Marionnaud. ${categoryName} — City Baddies.`;

  return {
    title,
    description,
    robots: { index: true, follow: true },
    keywords: [
      product.name,
      brandName,
      categoryName,
      `${fullName} prix`,
      `${brandName} pas cher`,
      `comparateur prix ${categoryName.toLowerCase()}`,
    ].filter(Boolean),
    alternates: {
      canonical: `${BASE_URL}/produits/${slug}`,
    },
    openGraph: {
      title,
      description,
      url: `${BASE_URL}/produits/${slug}`,
      type: 'website',
      images: bestDeal?.imageUrl ? [{ url: bestDeal.imageUrl, width: 800, height: 600, alt: fullName }] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: priceText ? `${fullName} ${priceText}` : fullName,
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
  // fullName pour SEO/schema ; displayName pour le h1 (la marque est déjà affichée
  // dans l'eyebrow au-dessus — on ne la répète pas dans le titre visible).
  const fullName = fullProductName(brandName, product.name);
  const displayName = brandName && product.name.toLowerCase().startsWith(brandName.toLowerCase())
    ? product.name.slice(brandName.length).trim()
    : product.name;

  // Breadcrumb schema
  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Accueil', url: BASE_URL },
    { name: 'Produits', url: `${BASE_URL}/produits` },
    ...(product.category ? [{ name: product.category.name, url: `${BASE_URL}/produits?category=${product.category.slug}` }] : []),
    { name: fullName, url: `${BASE_URL}/produits/${slug}` },
  ]);

  // ── Schema.org comparateur : ProductGroup + hasVariant (par taille) + AggregateOffer + gtin13 ──
  // priceValidUntil à +30 j pour lever l'avertissement Search Console sur chaque Offer.
  const priceValidUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // gtin13 si EAN à 13 chiffres (standard), gtin générique si 8-14 chiffres (UPC/EAN8/GTIN14), sinon rien.
  const gtinFields = (ean?: string | null): Record<string, string> => {
    const d = (ean || '').replace(/\D/g, '');
    if (d.length === 13) return { gtin13: d };
    if (d.length >= 8 && d.length <= 14) return { gtin: d };
    return {};
  };

  // Une Offer par marchand ; AggregateOffer (low/high/offerCount) dès qu'il y a ≥2 offres.
  const buildOffers = (deals: typeof product.deals) => {
    const offers = deals.map(deal => ({
      '@type': 'Offer',
      url: deal.productUrl || `${BASE_URL}/produits/${slug}`,
      priceCurrency: 'EUR',
      price: deal.dealPrice,
      // validFrom = date du relevé réel (recommandé "Fiches de marchand" GSC)
      ...(deal.lastSeenAt ? { validFrom: deal.lastSeenAt.toISOString().slice(0, 10) } : {}),
      priceValidUntil,
      availability: 'https://schema.org/InStock',
      seller: { '@type': 'Organization', name: deal.merchant.name },
    }));
    if (offers.length === 1) return offers[0];
    const prices = deals.map(d => d.dealPrice);
    return {
      '@type': 'AggregateOffer',
      priceCurrency: 'EUR',
      lowPrice: Math.min(...prices),
      highPrice: Math.max(...prices),
      offerCount: offers.length,
      offers,
    };
  };

  // Regrouper les offres par variante (taille) : chaque taille = un produit réel avec son propre EAN.
  const variantOrder: string[] = [];
  const dealsByVariant = new Map<string, typeof product.deals>();
  for (const deal of product.deals) {
    const key = deal.variant?.id ?? 'sans-variante';
    if (!dealsByVariant.has(key)) {
      dealsByVariant.set(key, []);
      variantOrder.push(key);
    }
    dealsByVariant.get(key)!.push(deal);
  }

  // ── Faits GEO server-rendered : réponse directe + comparatif express ──
  // Le contenu que les moteurs IA peuvent citer doit être dans le HTML initial,
  // en phrases complètes et datées — pas seulement dans un composant client.
  const dateFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const bestSeenAt = bestDeal?.lastSeenAt ? dateFmt.format(bestDeal.lastSeenAt) : null;
  const bestSizeLabel = bestDeal?.variant ? `${bestDeal.variant.volumeValue} ${bestDeal.variant.volumeUnit}` : null;
  // Par taille : meilleur prix, enseigne, écart max entre enseignes (tailles triées par volume).
  const sizeRows = variantOrder
    .map(key => {
      const deals = dealsByVariant.get(key)!;
      const sorted = [...deals].sort((a, b) => a.dealPrice - b.dealPrice);
      const v = sorted[0].variant;
      return {
        label: v ? `${v.volumeValue} ${v.volumeUnit}` : 'Standard',
        volume: v?.volumeValue ?? 0,
        best: sorted[0],
        spread: sorted.length > 1 ? sorted[sorted.length - 1].dealPrice - sorted[0].dealPrice : 0,
        offerCount: sorted.length,
      };
    })
    .sort((a, b) => a.volume - b.volume);
  const merchantCount = new Set(product.deals.map(d => d.merchant.slug)).size;
  const maxSpreadRow = sizeRows.reduce((m, r) => (r.spread > (m?.spread ?? 0) ? r : m), null as (typeof sizeRows)[0] | null);

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
    lastSeenAt: deal.lastSeenAt ? deal.lastSeenAt.toISOString() : null,
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

  // ── Construction du schema produit (après productImages pour réutiliser les images HD validées) ──
  const schemaImages = productImages.map(i => i.url).slice(0, 5);
  const schemaImage = schemaImages.length > 0 ? schemaImages : bestDeal?.imageUrl ? [bestDeal.imageUrl] : undefined;

  const productBase = {
    name: fullName,
    description: product.seoDescription || product.description || `${fullName} — ${categoryName}`,
    image: schemaImage,
    brand: brandName ? { '@type': 'Brand', name: brandName } : undefined,
    category: categoryName,
  };

  let productSchema: Record<string, unknown>;
  if (variantOrder.length > 1) {
    // Plusieurs tailles → ProductGroup avec une variante par taille (chacune son EAN + ses offres).
    productSchema = {
      '@context': 'https://schema.org',
      '@type': 'ProductGroup',
      ...productBase,
      productGroupID: product.id,
      variesBy: 'https://schema.org/size',
      hasVariant: variantOrder.map(key => {
        const deals = dealsByVariant.get(key)!;
        const v = deals[0].variant;
        const sizeLabel = v ? `${v.volumeValue}${v.volumeUnit}` : undefined;
        return {
          '@type': 'Product',
          name: sizeLabel ? `${fullName} ${sizeLabel}` : fullName,
          // description sur CHAQUE variante (recommandé "Fiches de marchand" GSC —
          // celle du ProductGroup parent ne suffit pas à Google)
          description: productBase.description,
          ...(sizeLabel ? { size: sizeLabel } : {}),
          ...gtinFields(v?.ean),
          sku: v?.id ?? product.id,
          ...(schemaImage ? { image: schemaImage[0] } : {}),
          offers: buildOffers(deals),
        };
      }),
    };
  } else {
    // Une seule taille (ou pas de variante) → Product simple.
    const only = dealsByVariant.get(variantOrder[0]) ?? product.deals;
    const v = only[0]?.variant;
    productSchema = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      ...productBase,
      ...gtinFields(v?.ean),
      sku: v?.id ?? product.id,
      offers: buildOffers(product.deals),
    };
  }

  // Serialized price history for chart
  const serializedPriceHistory = product.priceHistory.map(ph => ({
    ...ph,
    date: ph.date.toISOString(),
  }));

  return (
    <>
      {/* JSON-LD natif : présent dans le HTML initial (crawlers sans JS) */}
      <JsonLd id="breadcrumb-schema" data={breadcrumbSchema} />
      <JsonLd id="product-schema" data={productSchema} />

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
            <span className="text-neutral-400 truncate hidden sm:inline">{fullName}</span>
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

              {/* Product name — sans répéter la marque (déjà dans l'eyebrow au-dessus) */}
              <h1 className="text-2xl sm:text-3xl md:text-5xl font-light tracking-tight text-white mb-6 sm:mb-8 md:mb-12 leading-[1.1]">
                {displayName}
              </h1>

              {/* Interactive Pricing with Volume Selector + Price History */}
              <ProductPricing
                deals={serializedDeals}
                priceHistory={serializedPriceHistory}
              />

              {/* ── Le relevé (server-rendered, citable par les moteurs IA) ──
                   Phrase réponse-directe + comparatif express par taille : c'est le
                   contenu que Google/ChatGPT/Perplexity peuvent extraire et citer,
                   présent dans le HTML initial contrairement au comparateur interactif. */}
              {bestDeal && (
                <section className="mt-6 sm:mt-8 border-t border-white/10 pt-5 sm:pt-6">
                  <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-500 mb-3 sm:mb-4">
                    Le relevé
                  </h2>
                  <p className="text-sm text-neutral-300 font-light leading-relaxed">
                    Le meilleur prix de {fullName}{bestSizeLabel ? ` en ${bestSizeLabel}` : ''} est{' '}
                    <strong className="font-medium text-white">{bestDeal.dealPrice.toFixed(2).replace('.', ',')} € chez {bestDeal.merchant.name}</strong>
                    {bestSeenAt ? `, relevé le ${bestSeenAt}` : ''}.{' '}
                    {merchantCount > 1 && maxSpreadRow && maxSpreadRow.spread > 0
                      ? `À taille égale, l'écart entre enseignes atteint ${maxSpreadRow.spread.toFixed(2).replace('.', ',')} € sur le ${maxSpreadRow.label}.`
                      : ''}
                  </p>
                  {sizeRows.length > 1 && (
                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full text-left font-mono text-[11px] sm:text-xs">
                        <thead>
                          <tr className="text-neutral-600 uppercase tracking-widest text-[9px]">
                            <th className="py-1.5 pr-4 font-medium">Taille</th>
                            <th className="py-1.5 pr-4 font-medium">Meilleur prix</th>
                            <th className="py-1.5 pr-4 font-medium">Enseigne</th>
                            <th className="py-1.5 font-medium">Écart max</th>
                          </tr>
                        </thead>
                        <tbody className="text-neutral-400">
                          {sizeRows.map(row => (
                            <tr key={row.label} className="border-t border-white/5">
                              <td className="py-1.5 pr-4">{row.label}</td>
                              <td className="py-1.5 pr-4 text-white">{row.best.dealPrice.toFixed(2).replace('.', ',')} €</td>
                              <td className="py-1.5 pr-4">{row.best.merchant.name}</td>
                              <td className="py-1.5">{row.spread > 0 ? `${row.spread.toFixed(2).replace('.', ',')} €` : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              )}

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
