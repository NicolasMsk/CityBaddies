'use client';

export default function CopyPromoButton({ promoCode }: { promoCode: string }) {
  return (
    <button
      onClick={() => navigator.clipboard.writeText(promoCode)}
      className="ml-auto text-xs underline text-neutral-400 hover:text-white"
    >
      COPIER
    </button>
  );
}
