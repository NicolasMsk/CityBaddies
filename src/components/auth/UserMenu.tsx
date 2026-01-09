'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from './AuthProvider';
import { 
  User, 
  Heart, 
  Settings, 
  LogOut, 
  ChevronDown,
  Crown
} from 'lucide-react';

export default function UserMenu() {
  const { user, dbUser, loading, signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (loading) {
    return (
      <div className="w-10 h-10 rounded-full bg-white/10 animate-pulse" />
    );
  }

  if (!user) {
    return (
      <div className="flex items-center gap-3">
        <Link
          href="/auth/login"
          className="px-4 py-2 text-sm font-medium text-white/80 hover:text-white transition-colors"
        >
          Connexion
        </Link>
        <Link
          href="/auth/signup"
          className="px-4 py-2 text-sm font-medium bg-[#7b0a0a] hover:bg-[#9b1a1a] text-white rounded-lg transition-colors"
        >
          Inscription
        </Link>
      </div>
    );
  }

  const displayName = dbUser?.displayName || dbUser?.username || user.email?.split('@')[0];
  const avatarUrl = dbUser?.avatarUrl || user.user_metadata?.avatar_url;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-1.5 rounded-full hover:bg-white/10 transition-colors"
      >
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt={displayName || 'Avatar'}
            width={36}
            height={36}
            className="rounded-full object-cover"
          />
        ) : (
          <div className="w-9 h-9 rounded-full bg-[#7b0a0a] flex items-center justify-center">
            <User className="w-5 h-5 text-white" />
          </div>
        )}
        <ChevronDown className={`w-4 h-4 text-white/60 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-xl overflow-hidden z-50">
          {/* User Info */}
          <div className="p-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt={displayName || 'Avatar'}
                  width={44}
                  height={44}
                  className="rounded-full object-cover"
                />
              ) : (
                <div className="w-11 h-11 rounded-full bg-[#7b0a0a] flex items-center justify-center">
                  <User className="w-6 h-6 text-white" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-white truncate">{displayName}</p>
                {dbUser?.username && (
                  <p className="text-sm text-neutral-400">@{dbUser.username}</p>
                )}
              </div>
            </div>
            
            {/* Stats */}
            {dbUser?._count && (
              <div className="flex gap-4 mt-3 pt-3 border-t border-white/5">
                <div className="text-center">
                  <p className="text-white font-medium">{dbUser._count.postedDeals}</p>
                  <p className="text-xs text-neutral-500">Deals</p>
                </div>
                <div className="text-center">
                  <p className="text-white font-medium">{dbUser._count.favorites}</p>
                  <p className="text-xs text-neutral-500">Favoris</p>
                </div>
                <div className="text-center">
                  <p className="text-white font-medium">{dbUser.reputation}</p>
                  <p className="text-xs text-neutral-500">Réputation</p>
                </div>
              </div>
            )}
          </div>

          {/* Menu Items */}
          <div className="p-2">
            <Link
              href="/profile"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-3 py-2 text-neutral-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
            >
              <User className="w-5 h-5" />
              Mon profil
            </Link>
            <Link
              href="/profile/favorites"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-3 py-2 text-neutral-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
            >
              <Heart className="w-5 h-5" />
              Mes favoris
            </Link>
            <Link
              href="/profile/settings"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-3 py-2 text-neutral-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
            >
              <Settings className="w-5 h-5" />
              Paramètres
            </Link>
            
            {dbUser?.isAdmin && (
              <Link
                href="/admin"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-3 px-3 py-2 text-[#7b0a0a] hover:bg-[#7b0a0a]/10 rounded-lg transition-colors"
              >
                <Crown className="w-5 h-5" />
                Administration
              </Link>
            )}
          </div>

          {/* Logout */}
          <div className="p-2 border-t border-white/10">
            <button
              onClick={async () => {
                await signOut();
                setIsOpen(false);
                window.location.href = '/';
              }}
              className="flex items-center gap-3 w-full px-3 py-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
            >
              <LogOut className="w-5 h-5" />
              Déconnexion
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
