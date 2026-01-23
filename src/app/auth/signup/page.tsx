'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Mail, Lock, User, Eye, EyeOff, Loader2, Check } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

export default function SignUpPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [subscribeNewsletter, setSubscribeNewsletter] = useState(true);
  
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/';
  
  const supabase = createClient();

  // Validation du mot de passe
  const passwordChecks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
  };
  
  const isPasswordValid = Object.values(passwordChecks).every(Boolean);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isPasswordValid) {
      setError('Le mot de passe ne respecte pas les critères');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
            display_name: username,
          },
        },
      });

      if (error) {
        if (error.message.includes('already registered')) {
          setError('Cet email est déjà utilisé');
        } else {
          setError(error.message);
        }
        return;
      }

      // Vérifier si l'email existe déjà (cas OAuth/Google)
      // Quand un user existe déjà, Supabase retourne un user avec identities vide
      if (data?.user?.identities?.length === 0) {
        setError('Cet email est déjà associé à un compte. Essaie de te connecter avec Google.');
        return;
      }

      // Envoi de l'email de bienvenue (fire and forget - ne bloque pas l'UX)
      fetch('/api/email/welcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, username }),
      }).catch((err) => {
        // Log silencieux - l'inscription est déjà réussie
        console.error('Erreur envoi email bienvenue:', err);
      });

      // Inscription à la newsletter si l'option est cochée
      if (subscribeNewsletter) {
        fetch('/api/newsletter/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, source: 'signup' }),
        }).catch((err) => {
          console.error('Erreur inscription newsletter:', err);
        });
      }

      // Si une session existe (confirmation email désactivée), rediriger directement
      if (data?.session) {
        router.push(redirect);
        return;
      }

      // Sinon, afficher l'écran de succès
      setSuccess(true);
    } catch {
      setError('Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?redirect=${redirect}`,
      },
    });
    if (error) {
      setError(error.message);
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
            <h1 className="text-2xl font-light uppercase tracking-widest text-white mb-2">Bienvenue !</h1>
            <p className="text-neutral-500 font-light mb-8 text-sm">
              Ton compte a été créé avec succès.<br />
              Un email de bienvenue t&apos;a été envoyé à <span className="text-white font-medium">{email}</span>.
            </p>
            <Link
              href="/deals"
              className="inline-block w-full py-4 bg-[#d4a855] hover:bg-white text-black font-bold rounded-lg transition-all duration-300 transform hover:scale-[1.02] text-xs tracking-[0.2em] uppercase"
            >
              Découvrir les deals
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden py-10">
      {/* Background Effects */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_0%,_#1a1a1a_0%,_#0a0a0a_80%)] z-0 pointer-events-none" />
      <div className="fixed top-[-10%] left-[-10%] w-[40vw] h-[40vw] bg-[#9b1515] opacity-[0.06] blur-[100px] rounded-full pointer-events-none z-0" />
      <div className="fixed bottom-[10%] right-[-5%] w-[30vw] h-[30vw] bg-[#d4a855] opacity-[0.04] blur-[120px] rounded-full pointer-events-none z-0" />

      <div className="w-full max-w-md relative z-10">
        {/* Header */}
        <div className="text-center mb-10">
          <Link href="/" className="inline-block mb-8">
            <span className="text-xs font-bold tracking-[0.3em] text-[#d4a855] uppercase border border-[#d4a855]/30 px-3 py-1 rounded-full">
              Nouveau Membre
            </span>
          </Link>
          <h1 className="text-4xl font-thin text-white tracking-tight uppercase mb-2">
            Créer un compte
          </h1>
          <p className="text-neutral-500 font-light">
            Rejoins la communauté City Baddies
          </p>
        </div>

        {/* Card */}
        <div className="bg-[#0a0a0a]/50 backdrop-blur-md border border-white/5 rounded-2xl p-8 sm:p-10 shadow-2xl">
          {/* Social Login */}
          <button
            onClick={handleGoogleSignUp}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3.5 bg-white text-black font-bold text-xs tracking-widest uppercase rounded-lg hover:bg-neutral-200 transition-colors disabled:opacity-50 mb-8"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continuer avec Google
          </button>

          <div className="relative mb-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/5"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase tracking-widest text-neutral-500">
              <span className="bg-[#0a0a0a] px-4">Ou avec email</span>
            </div>
          </div>

          <form onSubmit={handleSignUp} className="space-y-6">
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold tracking-widest text-neutral-500 ml-1">Pseudo</label>
              <div className="relative group">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500 group-focus-within:text-white transition-colors" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg py-3.5 pl-11 pr-4 text-sm text-white focus:outline-none focus:border-[#d4a855]/50 focus:bg-white/10 transition-all placeholder:text-neutral-600"
                  placeholder="ton_pseudo"
                  required
                  minLength={3}
                  maxLength={20}
                />
              </div>
              <p className="text-[10px] text-neutral-600 ml-1">3-20 caractères, minuscules et chiffres</p>
            </div>

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

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold tracking-widest text-neutral-500 ml-1">Mot de passe</label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500 group-focus-within:text-white transition-colors" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg py-3.5 pl-11 pr-12 text-sm text-white focus:outline-none focus:border-[#d4a855]/50 focus:bg-white/10 transition-all placeholder:text-neutral-600"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

               {/* Password Requirements */}
              <div className="grid grid-cols-2 gap-2 mt-2">
                {[
                  { check: passwordChecks.length, label: '8+ caractères' },
                  { check: passwordChecks.uppercase, label: 'Une majuscule' },
                  { check: passwordChecks.lowercase, label: 'Une minuscule' },
                  { check: passwordChecks.number, label: 'Un chiffre' },
                ].map(({ check, label }) => (
                  <div key={label} className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full flex items-center justify-center border ${check ? 'bg-[#d4a855] border-[#d4a855]' : 'border-neutral-700 bg-transparent'}`}>
                      {check && <Check className="w-2 h-2 text-black" />}
                    </div>
                    <span className={`text-[10px] ${check ? 'text-[#d4a855]' : 'text-neutral-500'}`}>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {error && (
              <div className="p-4 bg-[#9b1515]/10 border border-[#9b1515]/20 rounded-lg text-sm text-[#ff8080] text-center">
                {error}
              </div>
            )}

            <div className="flex items-start gap-3 px-1">
              <input
                type="checkbox"
                required
                id="terms"
                className="mt-0.5 w-4 h-4 rounded border-white/10 bg-white/5 text-[#d4a855] focus:ring-[#d4a855] focus:ring-offset-0 focus:ring-offset-black"
              />
              <label htmlFor="terms" className="text-xs text-neutral-500 leading-relaxed">
                J&apos;accepte les{' '}
                <Link href="/legal" className="text-white hover:text-[#d4a855] transition-colors">
                  conditions d&apos;utilisation
                </Link>{' '}
                et la{' '}
                <Link href="/legal" className="text-white hover:text-[#d4a855] transition-colors">
                  politique de confidentialité
                </Link>
              </label>
            </div>

            {/* Newsletter Checkbox */}
            <div className="flex items-start gap-3 px-1">
              <input
                type="checkbox"
                id="newsletter"
                checked={subscribeNewsletter}
                onChange={(e) => setSubscribeNewsletter(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-white/10 bg-white/5 text-[#d4a855] focus:ring-[#d4a855] focus:ring-offset-0 focus:ring-offset-black cursor-pointer"
              />
              <label htmlFor="newsletter" className="text-xs text-neutral-500 leading-relaxed cursor-pointer">
                <span className="text-[#d4a855]">✨</span> Je souhaite recevoir la newsletter avec les meilleurs deals beauté
              </label>
            </div>

            <button
              type="submit"
              disabled={loading || !isPasswordValid}
              className="w-full bg-[#d4a855] hover:bg-white text-black font-bold py-4 rounded-lg transition-all duration-300 transform hover:scale-[1.02] flex items-center justify-center gap-2 text-xs tracking-[0.2em] uppercase disabled:opacity-50 disabled:hover:scale-100 disabled:hover:bg-[#d4a855]"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Créer mon compte'
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-neutral-500">
            Déjà membre ?{' '}
            <Link href="/auth/login" className="text-white font-medium hover:text-[#d4a855] transition-colors border-b border-transparent hover:border-[#d4a855]">
              Se connecter
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
