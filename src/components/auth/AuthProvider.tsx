'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { SupabaseClient, User as SupabaseUser } from '@supabase/supabase-js';

interface DbUser {
  id: string;
  email: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  isAdmin: boolean;
  reputation: number;
  createdAt: string;
  _count?: {
    favorites: number;
    postedDeals: number;
    votes: number;
    comments: number;
  };
}

interface AuthContextType {
  user: SupabaseUser | null;
  dbUser: DbUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  dbUser: null,
  loading: true,
  signOut: async () => {},
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [dbUser, setDbUser] = useState<DbUser | null>(null);
  const [loading, setLoading] = useState(true);
  const supabaseRef = useRef<SupabaseClient | null>(null);

  const fetchDbUser = async () => {
    try {
      const res = await fetch('/api/user');
      if (res.ok) {
        const data = await res.json();
        setDbUser(data.user);
      }
    } catch (error) {
      console.error('Error fetching db user:', error);
    }
  };

  const refreshUser = async () => {
    const supabase = supabaseRef.current;
    if (!supabase) return;
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    setUser(currentUser);
    if (currentUser) {
      await fetchDbUser();
    } else {
      setDbUser(null);
    }
  };

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    let idleId: number | undefined;
    let timerId: ReturnType<typeof setTimeout> | undefined;

    // L'authentification n'est pas nécessaire au premier rendu. Le SDK
    // Supabase reste ainsi hors du chunk critique partagé par les pages publiques.
    const initializeAuth = async () => {
      const { createClient } = await import('@/lib/supabase/client');
      if (!active) return;

      const supabase = createClient();
      supabaseRef.current = supabase;
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!active) return;

      setUser(currentUser);
      if (currentUser) await fetchDbUser();
      if (active) setLoading(false);

      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (_event, session) => {
          if (!active) return;
          setUser(session?.user ?? null);
          if (session?.user) await fetchDbUser();
          else setDbUser(null);
          if (active) setLoading(false);
        }
      );
      unsubscribe = () => subscription.unsubscribe();
    };

    const schedule = () => {
      if ('requestIdleCallback' in window) {
        idleId = window.requestIdleCallback(() => void initializeAuth(), { timeout: 2500 });
      } else {
        timerId = setTimeout(() => void initializeAuth(), 1);
      }
    };

    if (document.readyState === 'complete') schedule();
    else window.addEventListener('load', schedule, { once: true });

    return () => {
      active = false;
      window.removeEventListener('load', schedule);
      if (idleId !== undefined && 'cancelIdleCallback' in window) window.cancelIdleCallback(idleId);
      if (timerId !== undefined) clearTimeout(timerId);
      unsubscribe?.();
    };
  }, []);

  const signOut = async () => {
    const supabase = supabaseRef.current;
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    setDbUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, dbUser, loading, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
