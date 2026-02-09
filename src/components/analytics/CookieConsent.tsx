'use client';

import { useState, useEffect } from 'react';

const CONSENT_KEY = 'cb-cookie-consent';

type ConsentValue = 'accepted' | 'refused' | null;

export function getConsentValue(): ConsentValue {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(CONSENT_KEY) as ConsentValue;
}

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = getConsentValue();
    if (!consent) {
      // Small delay so it doesn't flash on page load
      const timer = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  function accept() {
    localStorage.setItem(CONSENT_KEY, 'accepted');
    setVisible(false);
    // Reload to let GA4 load
    window.location.reload();
  }

  function refuse() {
    localStorage.setItem(CONSENT_KEY, 'refused');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-[9999] p-4 animate-in slide-in-from-bottom-4 duration-500">
      <div className="max-w-4xl mx-auto bg-[#111] border border-white/10 rounded-2xl shadow-2xl shadow-black/50 p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          {/* Text */}
          <div className="flex-1 min-w-0">
            <p className="text-sm text-neutral-300 leading-relaxed">
              🍪 Nous utilisons des <strong className="text-white">cookies essentiels</strong> pour le fonctionnement du site 
              et <strong className="text-white">Google Analytics</strong> pour comprendre comment tu utilises City Baddies 
              (pages vues, navigation). Aucune donnée n&apos;est vendue à des tiers.{' '}
              <a
                href="/legal#confidentialite"
                className="text-[#d4a855] hover:underline"
              >
                En savoir plus
              </a>
            </p>
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={refuse}
              className="px-4 py-2 text-xs font-bold tracking-wider uppercase text-neutral-400 hover:text-white border border-white/10 hover:border-white/20 rounded-lg transition-colors"
            >
              Refuser
            </button>
            <button
              onClick={accept}
              className="px-5 py-2 text-xs font-bold tracking-wider uppercase text-black bg-[#d4a855] hover:bg-[#e0b96a] rounded-lg transition-colors"
            >
              Accepter
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
