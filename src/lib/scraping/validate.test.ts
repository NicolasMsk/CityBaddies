import { describe, it, expect } from 'vitest';
import { normalizePrices, isValidDeal, productSlug } from './validate';
import type { ScrapedProduct } from './types';

const base: ScrapedProduct = {
  name: 'La Vie Est Belle Eau de Parfum',
  brand: 'Lancôme',
  productUrl: 'https://www.sephora.fr/p/la-vie-est-belle-123.html',
  currentPrice: 80,
  originalPrice: 100,
  discountPercent: 20,
  imageUrl: 'https://img.example.com/x.jpg',
  volume: '50 ml',
  category: 'parfums',
};

describe('normalizePrices', () => {
  it('recomputes originalPrice when equal to currentPrice but discount > 0', () => {
    const p = normalizePrices({ ...base, originalPrice: 80, currentPrice: 80, discountPercent: 20 });
    expect(p.originalPrice).toBeCloseTo(100, 0);
  });

  it('recomputes discountPercent when missing but prices differ', () => {
    const p = normalizePrices({ ...base, discountPercent: 0, originalPrice: 100, currentPrice: 75 });
    expect(p.discountPercent).toBe(25);
  });

  it('leaves coherent products untouched', () => {
    const p = normalizePrices({ ...base });
    expect(p.originalPrice).toBe(100);
    expect(p.discountPercent).toBe(20);
  });
});

describe('isValidDeal', () => {
  it('accepts a coherent discounted product', () => {
    expect(isValidDeal(base)).toBe(true);
  });

  it('rejects discount below 15%', () => {
    expect(isValidDeal({ ...base, discountPercent: 10 })).toBe(false);
  });

  it('rejects price <= 1€', () => {
    expect(isValidDeal({ ...base, currentPrice: 0.5 })).toBe(false);
  });

  it('rejects missing volume', () => {
    expect(isValidDeal({ ...base, volume: undefined })).toBe(false);
  });

  it('rejects unparseable volume', () => {
    expect(isValidDeal({ ...base, volume: 'lot de 3' })).toBe(false);
  });

  it('rejects originalPrice <= currentPrice', () => {
    expect(isValidDeal({ ...base, originalPrice: 80, currentPrice: 80 })).toBe(false);
  });

  it('rejects aberrant discount (>= 90%)', () => {
    expect(isValidDeal({ ...base, currentPrice: 5, originalPrice: 100, discountPercent: 95 })).toBe(false);
  });

  it('rejects missing name or url or brand', () => {
    expect(isValidDeal({ ...base, name: '' })).toBe(false);
    expect(isValidDeal({ ...base, productUrl: '' })).toBe(false);
    expect(isValidDeal({ ...base, brand: '' })).toBe(false);
  });
});

describe('productSlug', () => {
  it('builds a normalized brand-name slug', () => {
    expect(productSlug('Lancôme', 'La Vie Est Belle Eau de Parfum'))
      .toBe('lancome-la-vie-est-belle-eau-de-parfum');
  });

  it('strips duplicate brand prefix in name', () => {
    expect(productSlug('Dior', "Dior J'adore Eau de Parfum"))
      .toBe('dior-j-adore-eau-de-parfum');
  });

  it('caps length at 80 chars without trailing dash', () => {
    const slug = productSlug('X'.repeat(50), 'Y'.repeat(80));
    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slug.endsWith('-')).toBe(false);
  });
});
