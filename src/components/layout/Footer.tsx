import Link from 'next/link';
import Image from 'next/image';
import { Instagram, Twitter, Mail } from 'lucide-react';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  const footerLinks = {
    'Explorer': [
      { label: 'Tous les deals', href: '/deals' },
      { label: 'Trending 🔥', href: '/deals?hotOnly=true' },
      { label: 'Par catégorie', href: '/categories' },
    ],
    'Catégories': [
      { label: 'Maquillage', href: '/categories/maquillage' },
      { label: 'Skincare', href: '/categories/soins-visage' },
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
    <footer className="bg-neutral-900 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Footer */}
        <div className="py-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12">
          {/* Brand */}
          <div className="lg:col-span-2">
            <Link href="/" className="inline-block mb-6">
              <Image
                src="/images/logo-white.png"
                alt="City Baddies"
                width={200}
                height={55}
                className="h-12 w-auto object-contain"
              />
            </Link>
            <p className="text-neutral-400 text-sm leading-relaxed max-w-sm mb-8">
              On traque les meilleures promos beauté pour que tu slayes 
              sans te ruiner. Sephora, Nocibé, on gère.
            </p>
            
            {/* Social */}
            <div className="flex items-center gap-3">
              <a 
                href="https://instagram.com" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-neutral-400 hover:bg-white/20 hover:text-white transition-all"
              >
                <Instagram className="h-4 w-4" />
              </a>
              <a 
                href="https://twitter.com" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-neutral-400 hover:bg-white/20 hover:text-white transition-all"
              >
                <Twitter className="h-4 w-4" />
              </a>
              <a 
                href="mailto:hello@citybaddies.com" 
                className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-neutral-400 hover:bg-white/20 hover:text-white transition-all"
              >
                <Mail className="h-4 w-4" />
              </a>
            </div>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h3 className="text-xs font-medium uppercase tracking-[0.15em] text-neutral-500 mb-4">
                {title}
              </h3>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link 
                      href={link.href} 
                      className="text-sm text-neutral-400 hover:text-white transition-colors"
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
        <div className="py-6 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-neutral-500">
            © {currentYear} City Baddies. Tous droits réservés.
          </p>
          <p className="text-xs text-neutral-600">
            Made for baddies who love a good deal 💅
          </p>
        </div>
      </div>
    </footer>
  );
}
