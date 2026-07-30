import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { parseMyOriginesProduct } from './product-price';

const libreHtml = readFileSync(
  fileURLToPath(new URL('./__fixtures__/my-origines-libre.html', import.meta.url)),
  'utf8',
);

describe('parseMyOriginesProduct — fixture réelle (YSL Libre)', () => {
  it('extrait marque, nom et image depuis le ld+json Product', () => {
    const p = parseMyOriginesProduct(libreHtml, 'https://www.my-origines.com/fr/libre-81413585.html');
    expect(p).not.toBeNull();
    expect(p!.brand).toBe('Yves St Laurent');
    expect(p!.name).toBe('Libre');
    expect(p!.imageUrl).toContain('81413585_P.jpg');
  });

  it('prend comme prix affiché la variante dont le sku est dans l’URL', () => {
    // /fr/libre-81413585.html → "Libre 50" à 84,40 €
    const p = parseMyOriginesProduct(libreHtml, 'https://www.my-origines.com/fr/libre-81413585.html');
    expect(p!.currentPrice).toBe(84.4);
    expect(p!.volume).toBe('50ml');
    // Pas de faux prix barré fabriqué.
    expect(p!.originalPrice).toBe(84.4);
  });

  it('liste TOUTES les contenances avec volume (depuis offer.name) et prix', () => {
    const p = parseMyOriginesProduct(libreHtml, 'https://www.my-origines.com/fr/libre-81413585.html');
    const byVol = Object.fromEntries((p!.variants ?? []).map((v) => [v.volume, v.currentPrice]));
    expect(byVol).toEqual({
      '30ml': 59.1,
      '50ml': 84.4,
      '90ml': 114.85,
      '10ml': 25.45,
      '150ml': 155.45,
      '100ml': 100.75,
    });
    // url profonde par variante conservée
    expect(p!.variants!.find((v) => v.volume === '30ml')!.url).toBe(
      'https://www.my-origines.com/fr/libre-81413580.html',
    );
  });

  it('repli sur la 1re variante valide si le sku de l’URL est absent', () => {
    const p = parseMyOriginesProduct(libreHtml, 'https://www.my-origines.com/fr/libre-999999.html');
    expect(p).not.toBeNull();
    expect(p!.currentPrice).toBe(59.1); // "Libre 30", 1re offre
  });
});

describe('parseMyOriginesProduct — cas limites', () => {
  const wrap = (product: object) =>
    `<html><head><script type="application/ld+json">${JSON.stringify(product)}</script></head><body></body></html>`;

  it('retourne null si aucun ld+json Product', () => {
    expect(parseMyOriginesProduct('<html><body>rien</body></html>')).toBeNull();
    const other = wrap({ '@type': 'BreadcrumbList', itemListElement: [] });
    expect(parseMyOriginesProduct(other)).toBeNull();
  });

  it('écarte les offres en rupture de stock', () => {
    const html = wrap({
      '@type': 'Product',
      name: 'Test',
      brand: { '@type': 'Brand', name: 'ACME' },
      offers: {
        '@type': 'AggregateOffer',
        offers: [
          { '@type': 'Offer', name: 'Test 50', price: 40, availability: 'https://schema.org/OutOfStock' },
          { '@type': 'Offer', name: 'Test 100', price: 70, availability: 'https://schema.org/InStock' },
        ],
      },
    });
    const p = parseMyOriginesProduct(html, 'https://www.my-origines.com/fr/test-1.html');
    expect(p!.variants!.map((v) => v.volume)).toEqual(['100ml']);
    expect(p!.currentPrice).toBe(70); // repli sur la seule variante en stock
  });

  it('parse le volume même sans unité (dernier nombre du name = ml)', () => {
    const html = wrap({
      '@type': 'Product',
      name: 'N°5',
      offers: { '@type': 'AggregateOffer', offers: [{ '@type': 'Offer', name: 'N°5 100', price: 130 }] },
    });
    const p = parseMyOriginesProduct(html);
    expect(p!.variants).toEqual([{ volume: '100ml', currentPrice: 130, originalPrice: undefined, ean: undefined, url: undefined }]);
  });

  it('accepte un name avec unité explicite (30 ml)', () => {
    const html = wrap({
      '@type': 'Product',
      name: 'Test',
      offers: { '@type': 'AggregateOffer', offers: [{ '@type': 'Offer', name: 'Eau de Parfum 30 ml', price: 42 }] },
    });
    const p = parseMyOriginesProduct(html);
    expect(p!.variants![0].volume).toBe('30ml');
  });
});
