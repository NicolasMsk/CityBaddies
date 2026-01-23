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
      <>
        {/* Mobile: Simple User Icon */}
        <Link 
          href="/auth/login" 
          className="md:hidden p-2 text-neutral-400 hover:text-white transition-colors"
          aria-label="Se connecter"
        >
          <User className="w-5 h-5" />
        </Link>
        
        {/* Desktop: Full Buttons */}
        <div className="hidden md:flex items-center gap-4">
          <Link
            href="/auth/login"
            className="text-xs lg:text-sm font-bold text-neutral-400 hover:text-[#d4a855] transition-colors uppercase tracking-widest"
          >
            Connexion
          </Link>
          <Link
            href="/auth/signup"
            className="px-4 lg:px-6 py-2 text-xs lg:text-sm font-bold bg-[#d4a855] hover:bg-white text-black transition-colors uppercase tracking-widest"
            style={{ clipPath: 'polygon(10% 0, 100% 0, 90% 100%, 0% 100%)' }}
          >
            Inscription
          </Link>
        </div>
      </>
    );
  }

  const displayName = dbUser?.displayName || dbUser?.username || user.email?.split('@')[0];
  const avatarUrl = dbUser?.avatarUrl || user.user_metadata?.avatar_url;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 p-1 hover:bg-[#1a1a1a] transition-colors group border border-transparent hover:border-[#d4a855]/30"
      >
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt={displayName || 'Avatar'}
            width={36}
            height={36}
            className="object-cover border border-[#d4a855]/30 group-hover:border-[#d4a855]"
          />
        ) : (
          <div className="w-9 h-9 bg-black border border-[#d4a855]/50 flex items-center justify-center group-hover:border-[#d4a855]">
            <User className="w-5 h-5 text-[#d4a855]" />
          </div>
        )}
        <ChevronDown className={`w-4 h-4 text-neutral-500 group-hover:text-[#d4a855] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-[#0a0a0a] border border-[#d4a855]/30 shadow-2xl z-50">
          {/* User Info */}
          <div className="p-6 border-b border-[#333] bg-gradient-to-b from-[#111] to-[#0a0a0a]">
            <div className="flex items-center gap-4">
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt={displayName || 'Avatar'}
                  width={56}
                  height={56}
                  className="object-cover border border-[#d4a855]"
                />
              ) : (
                <div className="w-14 h-14 bg-black border border-[#d4a855] flex items-center justify-center">
                  <User className="w-6 h-6 text-[#d4a855]" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-black text-white truncate uppercase tracking-tight text-lg italic">{displayName}</p>
                {dbUser?.username && (
                  <p className="text-xs text-[#d4a855] font-mono mt-1">@{dbUser.username}</p>
                )}
              </div>
            </div>
            
            {/* Stats */}
            {dbUser?._count && (
              <div className="flex gap-1 mt-6">
                <div className="flex-1 text-center p-2 bg-black border border-[#333]">
                  <p className="text-white font-bold text-lg">{dbUser._count.postedDeals}</p>
                  <p className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold">Deals</p>
                </div>
                <div className="flex-1 text-center p-2 bg-black border-y border-r border-[#333]">
                  <p className="text-white font-bold text-lg">{dbUser._count.favorites}</p>
                  <p className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold">Favoris</p>
                </div>
                <div className="flex-1 text-center p-2 bg-black border-y border-r border-[#333]">
                  <p className="text-white font-bold text-lg">{dbUser.reputation}</p>
                  <p className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold">Rep</p>
                </div>
              </div>
            )}
          </div>

          {/* Menu Items */}
          <div className="p-2 space-y-1 bg-[#0a0a0a]">
            <Link
              href="/profile"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-4 px-4 py-3 text-neutral-400 hover:text-white hover:bg-[#1a1a1a] transition-colors group border border-transparent hover:border-[#333]"
            >
              <User className="w-4 h-4 text-neutral-600 group-hover:text-[#d4a855]" />
              <span className="uppercase tracking-widest text-xs font-bold">Mon profil</span>
            </Link>
            <Link
              href="/profile/favorites"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-4 px-4 py-3 text-neutral-400 hover:text-white hover:bg-[#1a1a1a] transition-colors group border border-transparent hover:border-[#333]"
            >
              <Heart className="w-4 h-4 text-neutral-600 group-hover:text-[#d4a855]" />
              <span className="uppercase tracking-widest text-xs font-bold">Mes favoris</span>
            </Link>
            <Link
              href="/profile/settings"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-4 px-4 py-3 text-neutral-400 hover:text-white hover:bg-[#1a1a1a] transition-colors group border border-transparent hover:border-[#333]"
            >
              <Settings className="w-4 h-4 text-neutral-600 group-hover:text-[#d4a855]" />
              <span className="uppercase tracking-widest text-xs font-bold">Paramètres</span>
            </Link>
            
            {dbUser?.isAdmin && (
              <Link
                href="/admin"
                onClick={() => setIsOpen(false)}
                className="flex items-center gap-4 px-4 py-3 text-white bg-[#d4a855]/10 hover:bg-[#d4a855] hover:text-black transition-colors group border border-[#d4a855]/20 hover:border-[#d4a855]"
              >
                <Crown className="w-4 h-4 text-[#d4a855] group-hover:text-black" />
                <span className="uppercase tracking-widest text-xs font-black">Administration</span>
              </Link>
            )}
          </div>

          {/* Logout */}
          <div className="p-2 border-t border-[#333] bg-[#050505]">
            <button
              onClick={async () => {
                await signOut();
                setIsOpen(false);
                window.location.href = '/';
              }}
              className="flex items-center gap-4 w-full px-4 py-3 text-[#9b1515] hover:bg-[#9b1515] hover:text-white transition-colors group border border-transparent hover:border-[#9b1515]"
            >
              <LogOut className="w-4 h-4" />
              <span className="uppercase tracking-widest text-xs font-bold">Déconnexion</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
