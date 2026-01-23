'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Mail, Loader2, Check, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });

      if (error) {
        setError(error.message);
        return;
      }

      setSuccess(true);
    } catch {
      setError('Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
        {/* Background Effects */}
        <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_0%,_#1a1a1a_0%,_#0a0a0a_80%)] z-0 pointer-events-none" />
        <div className="fixed top-[-10%] left-[-10%] w-[40vw] h-[40vw] bg-[#9b1515] opacity-[0.06] blur-[100px] rounded-full pointer-events-none z-0" />
        <div className="fixed bottom-[10%] right-[-5%] w-[30vw] h-[30vw] bg-[#d4a855] opacity-[0.04] blur-[120px] rounded-full pointer-events-none z-0" />

        <div className="w-full max-w-md text-center relative z-10">
          <div className="bg-[#0a0a0a] border border-white/5 p-10 shadow-2xl">
            <Check className="w-12 h-12 text-[#d4a855] mx-auto mb-6" />
            <h1 className="text-2xl font-light uppercase tracking-widest text-white mb-2">Email envoyé !</h1>
            <p className="text-neutral-500 font-light mb-8 text-sm">
              Si un compte existe avec l&apos;adresse <span className="text-white font-medium">{email}</span>, 
              tu recevras un lien pour réinitialiser ton mot de passe.
            </p>
            <Link
              href="/auth/login"
              className="inline-block w-full py-4 bg-[#d4a855] hover:bg-white text-black font-bold rounded-lg transition-all duration-300 transform hover:scale-[1.02] text-xs tracking-[0.2em] uppercase"
            >
              Retour à la connexion
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      {/* Background Effects */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_0%,_#1a1a1a_0%,_#0a0a0a_80%)] z-0 pointer-events-none" />
      <div className="fixed top-[-10%] left-[-10%] w-[40vw] h-[40vw] bg-[#9b1515] opacity-[0.06] blur-[100px] rounded-full pointer-events-none z-0" />
      <div className="fixed bottom-[10%] right-[-5%] w-[30vw] h-[30vw] bg-[#d4a855] opacity-[0.04] blur-[120px] rounded-full pointer-events-none z-0" />

      <div className="w-full max-w-md relative z-10">
        <Link
          href="/auth/login"
          className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-neutral-500 hover:text-white transition-colors mb-8 group"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
          Retour
        </Link>
        
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-thin text-white tracking-tight uppercase mb-2">
            Mot de passe oublié
          </h1>
          <p className="text-neutral-500 font-light">
            Entre ton email pour réinitialiser ton accès
          </p>
        </div>

        {/* Card */}
        <div className="bg-[#0a0a0a]/50 backdrop-blur-md border border-white/5 rounded-2xl p-8 sm:p-10 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold tracking-widest text-neutral-500 ml-1">Email</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500 group-focus-within:text-white transition-colors" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg py-3.5 pl-11 pr-4 text-sm text-white focus:outline-none focus:border-[#d4a855]/50 focus:bg-white/10 transition-all placeholder:text-neutral-600"
                  placeholder="exemple@email.com"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="p-4 bg-[#9b1515]/10 border border-[#9b1515]/20 rounded-lg text-sm text-[#ff8080] text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#d4a855] hover:bg-white text-black font-bold py-4 rounded-lg transition-all duration-300 transform hover:scale-[1.02] flex items-center justify-center gap-2 text-xs tracking-[0.2em] uppercase"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Envoyer le lien'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
