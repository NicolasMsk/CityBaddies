'use client';

import { useState } from 'react';
import { Diamond, Loader2, CheckCircle } from 'lucide-react';

export default function NewsletterSection() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !email.includes('@')) {
      setError('Entre une adresse email valide');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'homepage' }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
        setEmail('');
      } else {
        setError(data.error || 'Une erreur est survenue');
      }
    } catch {
      setError('Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="relative z-10 py-32 border-t border-white/5 overflow-hidden">
      {/* Background Gradients */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-[#9b1515] opacity-[0.03] blur-[120px] rounded-full pointer-events-none" />
      
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold tracking-[0.2em] uppercase text-[#d4a855] mb-8">
            <Diamond className="w-3 h-3" />
            Club Privé
          </span>
          
          <h2 className="text-5xl md:text-7xl font-thin text-white tracking-tighter mb-8 leading-none">
            NE MANQUEZ <br/>
            <span className="italic font-normal text-white/40">JAMAIS</span> UN DEAL
          </h2>
          
          <p className="text-neutral-400 font-light text-lg mb-12 max-w-xl mx-auto leading-relaxed">
             Les meilleures offres partent en quelques minutes. Les membres de la liste sont prévenus en avant-première.
          </p>

          {success ? (
            <div className="max-w-lg mx-auto bg-[#0a0a0a] border border-[#d4a855]/30 p-8 text-center animate-fade-in">
              <CheckCircle className="w-12 h-12 text-[#d4a855] mx-auto mb-4" />
              <h3 className="text-xl font-light text-white uppercase tracking-widest mb-2">
                Bienvenue dans le club !
              </h3>
              <p className="text-neutral-500 text-sm">
                Tu recevras nos meilleurs deals en avant-première. Check tes mails !
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="relative max-w-lg mx-auto group">
              <div className="absolute inset-0 bg-gradient-to-r from-[#d4a855]/20 to-[#9b1515]/20 rounded-xl blur opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
              <div className="relative flex flex-col sm:flex-row gap-0 bg-[#0a0a0a] border border-white/10 rounded-xl p-2 transition-colors focus-within:border-white/20">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="votre-email@exemple.com"
                  className="w-full bg-transparent px-6 py-4 text-white placeholder-neutral-600 focus:outline-none tracking-wide text-sm"
                  disabled={loading}
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="mt-2 sm:mt-0 px-8 py-4 bg-white text-black text-xs font-bold tracking-[0.2em] uppercase rounded-lg hover:bg-[#d4a855] transition-colors whitespace-nowrap disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "S'inscrire"
                  )}
                </button>
              </div>
              
              {error && (
                <p className="text-red-400 text-sm mt-4">{error}</p>
              )}
            </form>
          )}
          
          <p className="text-[10px] text-neutral-600 mt-6 tracking-wide uppercase">
            Pas de spam. Désabonnement en un clic.
          </p>
        </div>
      </div>
    </section>
  );
}
