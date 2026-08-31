'use client';

import { useState, useEffect } from 'react';

const CONSENT_KEY = 'cb-cookie-consent';
export const CONSENT_EVENT = 'cb:consent-changed';

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
    window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: 'accepted' }));
  }

  function refuse() {
    localStorage.setItem(CONSENT_KEY, 'refused');
    setVisible(false);
    window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: 'refused' }));
  }

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-0 inset-x-0 z-[9999] p-2 sm:p-3 animate-in slide-in-from-bottom-2 duration-300"
      role="dialog"
      aria-label="Choix des cookies"
      aria-live="polite"
    >
      <div className="max-w-4xl mx-auto bg-[#111]/98 border border-white/15 shadow-2xl shadow-black/50 px-3 py-2.5 sm:px-4 sm:py-3">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:gap-5">
          <p className="min-w-0 text-[11px] sm:text-xs text-neutral-300 leading-[1.35] sm:leading-relaxed">
            <strong className="text-white">Mesure d&apos;audience.</strong>{' '}
            Google Analytics est activé uniquement avec ton accord.{' '}
            <a href="/legal#confidentialite" className="text-[#d4a855] whitespace-nowrap hover:underline">
              En savoir plus
            </a>
          </p>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={refuse}
              className="min-h-8 px-3 py-1.5 text-[10px] font-bold tracking-wider uppercase text-neutral-300 hover:text-white border border-white/15 hover:border-white/30 transition-colors"
            >
              Refuser
            </button>
            <button
              onClick={accept}
              className="min-h-8 px-3 py-1.5 text-[10px] font-bold tracking-wider uppercase text-black bg-[#d4a855] hover:bg-[#e0b96a] transition-colors"
            >
              Accepter
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
