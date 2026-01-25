import Link from 'next/link';
import Image from 'next/image';
import { Mail } from 'lucide-react';

// TikTok SVG icon
const TikTokIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
  </svg>
);

export default function Footer() {
  const currentYear = new Date().getFullYear();

  const footerLinks = {
    'Explorer': [
      { label: 'Tous les deals', href: '/deals' },
      { label: 'Tendances 🔥', href: '/deals?hotOnly=true' },
      { label: 'Par catégorie', href: '/categories' },
    ],
    'Catégories': [
      { label: 'Maquillage', href: '/categories/maquillage' },
      { label: 'Soin Visage', href: '/categories/soins-visage' },
      { label: 'Parfums', href: '/categories/parfums' },
      { label: 'Cheveux', href: '/categories/cheveux' },
    ],
    'City Baddies': [
      { label: 'Qui sommes-nous', href: '/about' },
      { label: 'Contact', href: '/contact' },
      { label: 'Mentions légales', href: '/legal' },
    ],
  };

  return (
    <footer className="relative z-10 bg-[#0a0a0a] text-white border-t border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Footer */}
        <div className="py-20 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12">
          {/* Brand */}
          <div className="lg:col-span-2 space-y-8">
            <Link href="/" className="inline-block">
              <Image
                src="/images/logo-white.png"
                alt="City Baddies"
                width={200}
                height={55}
                className="h-12 w-auto object-contain brightness-200 contrast-200"
              />
            </Link>
            <p className="text-neutral-400 font-light text-sm leading-relaxed max-w-sm">
              LE VRAI PRIX, PAS LE FAKE. <br/>
              <span className="text-neutral-600 block mt-2">
                Nous traquons l&apos;historique des prix pour vous garantir la meilleure affaire. Transparence totale.
              </span>
            </p>
            
            {/* Social */}
            <div className="flex items-center gap-4">
              <a 
                href="https://www.tiktok.com/@city_baddies" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="w-10 h-10 border border-white/10 flex items-center justify-center text-neutral-400 hover:bg-white hover:text-black hover:border-white transition-all duration-300"
              >
                <TikTokIcon />
              </a>
              <a 
                href="mailto:contact@citybaddies.com" 
                className="w-10 h-10 border border-white/10 flex items-center justify-center text-neutral-400 hover:bg-white hover:text-black hover:border-white transition-all duration-300"
              >
                <Mail className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#d4a855] mb-6">
                {title}
              </h3>
              <ul className="space-y-4">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link 
                      href={link.href} 
                      className="text-sm font-light text-neutral-400 hover:text-white hover:translate-x-1 transition-all duration-300 inline-block"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom Bar */}
        <div className="py-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
          <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-neutral-600">
            © {currentYear} City Baddies. Tous droits réservés.
          </p>
          <p className="text-xs text-neutral-500 font-light italic">
            Made for baddies who love a good deal 💅
          </p>
        </div>
      </div>
    </footer>
  );
}
