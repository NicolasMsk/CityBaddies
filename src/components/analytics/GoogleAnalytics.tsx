'use client';

import Script from 'next/script';
import { useEffect, useState } from 'react';
import { getConsentValue } from './CookieConsent';

const GA_MEASUREMENT_ID = 'G-LWMBWRFKF2';

/**
 * Hôte de production, seul autorisé à alimenter la propriété GA4.
 * Sans ce garde-fou, `next dev` sur localhost envoie les sessions de
 * développement dans les mêmes rapports que le trafic réel — ce qui a produit
 * des sessions à 276 s et 152 pages vues indiscernables de vrais visiteurs.
 * Filtrer par IP ne suffit pas : l'IP résidentielle est dynamique.
 */
function isProductionHost(): boolean {
  if (typeof window === 'undefined') return false;
  let expected = 'citybaddies.com';
  try {
    if (process.env.NEXT_PUBLIC_SITE_URL) expected = new URL(process.env.NEXT_PUBLIC_SITE_URL).hostname;
  } catch {
    /* env mal formée : on retombe sur le domaine canonique */
  }
  const host = window.location.hostname;
  return host === expected || host === `www.${expected}`;
}

export default function GoogleAnalytics() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(getConsentValue() === 'accepted' && isProductionHost());
  }, []);

  if (!enabled) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_MEASUREMENT_ID}', { anonymize_ip: true });
        `}
      </Script>
    </>
  );
}
