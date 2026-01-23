'use client';

import { useState } from 'react';
import { ThumbsUp, Users, Loader2, Check, X, ShieldCheck } from 'lucide-react';

interface DealFeedbackProps {
  dealId: string;
  initialViews: number;
  initialVotes: number;
}

export default function DealFeedback({ dealId, initialViews, initialVotes }: DealFeedbackProps) {
  const [votes, setVotes] = useState(initialVotes);
  const [userVote, setUserVote] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const handleVote = async (value: 1 | -1) => {
    setLoading(true);
    try {
      const res = await fetch('/api/votes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId, value }),
      });

      if (res.ok) {
        const data = await res.json();
        setVotes(data.votes);
        
        // Toggle vote si même valeur, sinon set la nouvelle
        if (userVote === value) {
          setUserVote(null);
        } else {
          setUserVote(value);
        }
      } else if (res.status === 401) {
        // Non connecté - rediriger vers login
        window.location.href = '/auth/login?redirect=' + encodeURIComponent(window.location.pathname);
      }
    } catch (error) {
      console.error('Erreur vote:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-6 mb-8 p-6 border-y border-white/10">
      <div className="flex items-center gap-8">
        <div className="flex flex-col">
          <span className="text-[10px] text-neutral-500 uppercase tracking-widest mb-1">Communauté</span>
          <span className="flex items-center gap-2 text-white">
            <Users className="h-4 w-4 text-[#d4a855]" />
            <span className="font-light tracking-wide">{initialViews} <span className="opacity-50">Vues</span></span>
          </span>
        </div>
        
        <div className="h-8 w-px bg-white/10" />

        <div className="flex flex-col">
          <span className="text-[10px] text-neutral-500 uppercase tracking-widest mb-1">Score</span>
          <span className="flex items-center gap-2">
            <ShieldCheck className={`h-4 w-4 ${votes > 0 ? 'text-emerald-500' : 'text-neutral-500'}`} />
            <span className={`font-light tracking-wide ${votes > 0 ? 'text-emerald-500' : votes < 0 ? 'text-[#9b1515]' : 'text-neutral-400'}`}>
              {votes > 0 ? `+${votes} Approuvé` : votes}
            </span>
          </span>
        </div>
      </div>
      
      {/* Feedback rapide */}
      <div className="flex items-center gap-4">
        <span className="text-[10px] text-neutral-500 uppercase tracking-widest">Vérifier ce Deal</span>
        
        {loading ? (
          <Loader2 className="h-4 w-4 text-white/40 animate-spin" />
        ) : (
          <div className="flex gap-px bg-white/10 border border-white/10">
            <button 
              onClick={() => handleVote(1)}
              className={`px-4 py-2 text-xs uppercase tracking-widest transition-all hover:bg-white/5 flex items-center gap-2 ${
                userVote === 1 
                  ? 'bg-emerald-900/20 text-emerald-500' 
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Check className="h-3 w-3" />
              Valide
            </button>
            <div className="w-px bg-white/10" />
            <button 
              onClick={() => handleVote(-1)}
              className={`px-4 py-2 text-xs uppercase tracking-widest transition-all hover:bg-white/5 flex items-center gap-2 ${
                userVote === -1 
                  ? 'bg-red-900/20 text-red-500' 
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <X className="h-3 w-3" />
              Expiré
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
