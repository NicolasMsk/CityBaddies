import { describe, expect, it } from 'vitest';
import type { CatalogItem } from './lib';
import { selectForDay } from './concepts';

function item(slug: string, overrides: Partial<CatalogItem> = {}): CatalogItem {
  return {
    slug,
    brand: 'Dior',
    brandSlug: 'dior',
    displayName: `Sauvage ${slug}`,
    volumeLabel: '50 ml',
    meta: 'Eau de Parfum · 50 ml',
    image: `https://example.com/${slug}.jpg`,
    cheapest: 40,
    cheapestMerchant: 'Notino',
    cheapestMerchantSlug: 'notino',
    highest: 70,
    gap: 30,
    gapPct: 42,
    merchantsCount: 3,
    ...overrides,
  };
}

describe('selectForDay', () => {
  const catalog = [item('a'), item('b'), item('c'), item('d')];

  it('fait tourner les cinq concepts sur cinq jours', () => {
    const ids = Array.from({ length: 5 }, (_, dayEpoch) =>
      selectForDay(catalog, new Set(), { dayEpoch })?.conceptId,
    );

    expect(ids).toEqual([
      'deal-du-jour',
      'luxe-moins-100',
      'moins-50',
      'grosses-economies',
      'culte-au-meilleur-prix',
    ]);
  });

  it('essaie le concept suivant si celui du jour est impossible', () => {
    const nonLuxury = catalog.map((entry) => ({
      ...entry,
      brand: 'Zara',
      brandSlug: 'zara',
      displayName: `Collection ${entry.slug}`,
    }));

    expect(selectForDay(nonLuxury, new Set(), { dayEpoch: 1 })?.conceptId).toBe('moins-50');
  });

  it('garde le concept forcé lorsqu’il est réalisable', () => {
    expect(selectForDay(catalog, new Set(), {
      dayEpoch: 0,
      conceptId: 'grosses-economies',
    })?.conceptId).toBe('grosses-economies');
  });
});
