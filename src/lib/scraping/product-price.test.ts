import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, expect } from 'vitest';
import { parseMyOriginesProduct, parseNotinoProduct } from './product-price';

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

describe('parseNotinoProduct — JSON-LD réel + cas limites', () => {
  // JSON-LD capturé en live sur notino.fr (offers = ARRAY, gtin13 top-level).
  const guessLd = {
    '@type': 'Product',
    sku: 'GUSSWMW_DBOR10',
    gtin13: '85715323101',
    name: 'Guess Seductive',
    brand: { '@type': 'Brand', name: 'Guess' },
    image: ['https://cdn.notinoimg.com/order_2k/guess/85715323101_01-o/seductive___240325.jpg'],
    offers: [
      { '@type': 'Offer', name: 'Guess Seductive 125 ml', availability: 'https://schema.org/InStock', price: 5, priceCurrency: 'EUR', sku: 'GUSSWMW_DBOR10', url: '/guess/seductive-spray-corporel-parfume/p-16234475/' },
    ],
  };

  it('extrait marque, nom, image, prix et contenance', () => {
    const p = parseNotinoProduct(guessLd);
    expect(p).not.toBeNull();
    expect(p!.brand).toBe('Guess');
    expect(p!.name).toBe('Guess Seductive');
    expect(p!.currentPrice).toBe(5);
    expect(p!.volume).toBe('125ml');
    expect(p!.imageUrl).toContain('notinoimg.com');
    expect(p!.variants![0].url).toBe('https://www.notino.fr/guess/seductive-spray-corporel-parfume/p-16234475/');
    // gtin13 rattaché à la variante (contenance unique)
    expect(p!.variants![0].ean).toBe('85715323101');
  });

  it('gère plusieurs contenances (offers array) et écarte les ruptures', () => {
    const ld = {
      '@type': 'Product',
      name: 'Libre',
      brand: { name: 'Yves Saint Laurent' },
      gtin13: '3614272648418',
      offers: [
        { '@type': 'Offer', name: 'Libre Eau de Parfum 30 ml', price: 79, availability: 'https://schema.org/InStock' },
        { '@type': 'Offer', name: 'Libre Eau de Parfum 50 ml', price: 105, availability: 'https://schema.org/InStock' },
        { '@type': 'Offer', name: 'Libre Eau de Parfum 90 ml', price: 140, availability: 'https://schema.org/OutOfStock' },
      ],
    };
    const p = parseNotinoProduct(ld);
    expect(p!.variants!.map((v) => v.volume)).toEqual(['30ml', '50ml']);
    // multi-contenances → gtin top-level NON rattaché (évite mauvais mapping)
    expect(p!.variants!.every((v) => v.ean === undefined)).toBe(true);
    expect(p!.currentPrice).toBe(79);
  });

  it('retourne null si pas de Product ou pas d’offre exploitable', () => {
    expect(parseNotinoProduct(null)).toBeNull();
    expect(parseNotinoProduct({ '@type': 'BreadcrumbList' })).toBeNull();
    expect(parseNotinoProduct({ '@type': 'Product', name: 'X', offers: [] })).toBeNull();
  });
});
