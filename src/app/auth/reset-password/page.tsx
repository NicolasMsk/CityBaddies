'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Lock, Eye, EyeOff, Loader2, Check } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  const router = useRouter();
  const supabase = createClient();

  // Validation du mot de passe
  const passwordChecks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    match: password === confirmPassword && password.length > 0,
  };
  
  const isPasswordValid = Object.values(passwordChecks).every(Boolean);

  useEffect(() => {
    // Vérifier qu'on a bien un token de récupération
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    if (!hashParams.get('access_token')) {
      router.push('/auth/forgot-password');
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isPasswordValid) {
      setError('Le mot de passe ne respecte pas les critères');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        setError(error.message);
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/');
      }, 2000);
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
            <h1 className="text-2xl font-light uppercase tracking-widest text-white mb-2">Mot de passe mis à jour !</h1>
            <p className="text-neutral-500 font-light">
              Redirection en cours...
            </p>
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
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-thin text-white tracking-tight uppercase mb-2">
            Nouveau mot de passe
          </h1>
          <p className="text-neutral-500 font-light">
            Choisis un nouveau mot de passe sécurisé
          </p>
        </div>

        {/* Card */}
        <div className="bg-[#0a0a0a]/50 backdrop-blur-md border border-white/5 rounded-2xl p-8 sm:p-10 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold tracking-widest text-neutral-500 ml-1">Nouveau mot de passe</label>
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

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold tracking-widest text-neutral-500 ml-1">Confirmer</label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500 group-focus-within:text-white transition-colors" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg py-3.5 pl-11 pr-4 text-sm text-white focus:outline-none focus:border-[#d4a855]/50 focus:bg-white/10 transition-all placeholder:text-neutral-600"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>

               {/* Password Requirements */}
              <div className="grid grid-cols-2 gap-2 mt-2">
                {[
                    { check: passwordChecks.length, label: '8+ caractères' },
                    { check: passwordChecks.uppercase, label: 'Une majuscule' },
                    { check: passwordChecks.lowercase, label: 'Une minuscule' },
                    { check: passwordChecks.number, label: 'Un chiffre' },
                    { check: passwordChecks.match, label: 'Identiques' },
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

            <button
              type="submit"
              disabled={loading || !isPasswordValid}
              className="w-full bg-[#d4a855] hover:bg-white text-black font-bold py-4 rounded-lg transition-all duration-300 transform hover:scale-[1.02] flex items-center justify-center gap-2 text-xs tracking-[0.2em] uppercase disabled:opacity-50 disabled:hover:scale-100 disabled:hover:bg-[#d4a855]"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Réinitialiser'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
