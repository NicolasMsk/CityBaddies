const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://citybaddies.com';

export interface ComparisonOfferSchemaInput {
  price: number;
  url: string;
  sellerName: string;
  sellerUrl?: string | null;
  score?: number | null;
  lastSeenAt?: Date | null;
}

export interface ComparisonProductSchemaInput {
  position: number;
  slug: string;
  name: string;
  brand?: string | null;
  image?: string | null;
  size: string;
  offers: ComparisonOfferSchemaInput[];
  editorialReview?: {
    ratingValue: number;
    bestRating: number;
    body: string;
    url: string;
    datePublished?: Date | null;
  } | null;
}

/** Accepte les notes 1–10 actuelles et les anciennes valeurs 0–100. */
export function normalizeCityBaddiesRating(score: number | null | undefined): number | null {
  if (!score || !Number.isFinite(score)) return null;
  const normalized = score > 10 ? score / 10 : score;
  if (normalized < 1) return null;
  return Math.round(Math.min(normalized, 10) * 10) / 10;
}

export function averageCityBaddiesRating(offers: ComparisonOfferSchemaInput[]): { value: number; count: number } | null {
  const scores = offers
    .map(offer => normalizeCityBaddiesRating(offer.score))
    .filter((score): score is number => score !== null);
  if (!scores.length) return null;
  return {
    value: Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 10) / 10,
    count: scores.length,
  };
}

export function buildComparisonProductListSchema(products: ComparisonProductSchemaInput[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Produits et offres comparés',
    numberOfItems: products.length,
    itemListElement: products.map(product => {
      const prices = product.offers.map(offer => offer.price);
      const offerRating = averageCityBaddiesRating(product.offers);
      const rating = product.editorialReview
        ? { value: product.editorialReview.ratingValue, count: 1, bestRating: product.editorialReview.bestRating }
        : offerRating
          ? { ...offerRating, bestRating: 10 }
          : null;
      const latestRatingDate = product.offers
        .map(offer => offer.lastSeenAt)
        .filter((date): date is Date => Boolean(date))
        .sort((a, b) => b.getTime() - a.getTime())[0];
      const priceValidUntil = new Date((latestRatingDate ?? new Date()).getTime() + 30 * 86_400_000)
        .toISOString()
        .slice(0, 10);
      const productUrl = `${BASE_URL}/produits/${product.slug}`;
      const reviewBody = product.editorialReview?.body || (rating
        ? `Note prix City Baddies : ${rating.value}/10, calculée à partir de ${rating.count} offre${rating.count > 1 ? 's' : ''} active${rating.count > 1 ? 's' : ''} comparée${rating.count > 1 ? 's' : ''}.`
        : null);

      return {
        '@type': 'ListItem',
        position: product.position,
        url: productUrl,
        item: {
          '@type': 'Product',
          '@id': `${productUrl}#${product.size.replace(/\s+/g, '-').toLowerCase()}`,
          name: `${product.name} ${product.size}`,
          url: productUrl,
          ...(product.image ? { image: product.image } : {}),
          ...(product.brand ? { brand: { '@type': 'Brand', name: product.brand } } : {}),
          category: 'Parfum',
          sku: `${product.slug}-${product.size.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()}`,
          offers: {
            '@type': 'AggregateOffer',
            priceCurrency: 'EUR',
            lowPrice: Math.min(...prices),
            highPrice: Math.max(...prices),
            offerCount: product.offers.length,
            offers: product.offers.map(offer => ({
              '@type': 'Offer',
              price: offer.price,
              priceCurrency: 'EUR',
              availability: 'https://schema.org/InStock',
              itemCondition: 'https://schema.org/NewCondition',
              priceValidUntil,
              url: offer.url,
              seller: {
                '@type': 'Organization',
                name: offer.sellerName,
                ...(offer.sellerUrl ? { url: offer.sellerUrl } : {}),
              },
            })),
          },
          ...(rating ? {
            aggregateRating: {
              '@type': 'AggregateRating',
              ratingValue: rating.value,
              bestRating: rating.bestRating,
              worstRating: 1,
              ratingCount: rating.count,
            },
            review: {
              '@type': 'Review',
              name: `Analyse prix City Baddies de ${product.name}`,
              author: { '@type': 'Organization', name: 'City Baddies', url: BASE_URL },
              ...((product.editorialReview?.datePublished || latestRatingDate) ? {
                datePublished: (product.editorialReview?.datePublished || latestRatingDate)!.toISOString(),
              } : {}),
              ...(product.editorialReview ? { url: product.editorialReview.url } : {}),
              reviewRating: {
                '@type': 'Rating',
                ratingValue: rating.value,
                bestRating: rating.bestRating,
                worstRating: 1,
              },
              reviewBody,
            },
          } : {}),
        },
      };
    }),
  };
}
