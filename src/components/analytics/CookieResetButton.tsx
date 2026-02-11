'use client';

const CONSENT_KEY = 'cb-cookie-consent';

export default function CookieResetButton() {
  function resetConsent() {
    localStorage.removeItem(CONSENT_KEY);
    window.location.reload();
  }

  return (
    <button
      onClick={resetConsent}
      className="text-sm font-light text-neutral-400 hover:text-white hover:translate-x-1 transition-all duration-300 inline-block"
    >
      Gérer les cookies
    </button>
  );
}
