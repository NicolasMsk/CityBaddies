'use client';

import { useState } from 'react';
import { ThumbsUp, Users, Loader2 } from 'lucide-react';

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
    <div className="flex flex-wrap items-center justify-between gap-4 mb-6 p-4 bg-white/5 rounded-xl">
      <div className="flex items-center gap-4 text-white/60">
        <span className="flex items-center gap-2">
          <Users className="h-4 w-4 text-[#d4a855]" />
          <span className="text-white font-medium">{initialViews}</span> {initialViews > 1 ? 'baddies ont checké' : 'baddie a checké'}
        </span>
        <span className="text-white/20">•</span>
        <span className="flex items-center gap-1">
          <ThumbsUp className="h-4 w-4" />
          <span className={votes > 0 ? 'text-emerald-400' : votes < 0 ? 'text-red-400' : ''}>
            {votes > 0 ? `+${votes}` : votes}
          </span>
        </span>
      </div>
      
      {/* Feedback rapide */}
      <div className="flex items-center gap-2">
        <span className="text-white/40 text-sm">Deal valide ?</span>
        
        {loading ? (
          <Loader2 className="h-4 w-4 text-white/40 animate-spin" />
        ) : (
          <>
            <button 
              onClick={() => handleVote(1)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                userVote === 1 
                  ? 'bg-emerald-500 text-white scale-105' 
                  : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400'
              }`}
            >
              ✅ Oui
            </button>
            <button 
              onClick={() => handleVote(-1)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                userVote === -1 
                  ? 'bg-red-500 text-white scale-105' 
                  : 'bg-red-500/20 hover:bg-red-500/30 text-red-400'
              }`}
            >
              ❌ Non
            </button>
          </>
        )}
      </div>
    </div>
  );
}
