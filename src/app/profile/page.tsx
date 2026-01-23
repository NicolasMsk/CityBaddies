'use client';

import { useAuth } from '@/components/auth';
import { useState, useEffect } from 'react';
import { 
  User, 
  Heart, 
  Calendar, 
  Edit2, 
  Save, 
  X,
  Loader2,
  Award,
  MessageSquare,
  ThumbsUp,
  ThumbsDown
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import DealCard from '@/components/deals/DealCard';
import { Deal } from '@/types';

interface VoteActivity {
  id: string;
  value: number;
  createdAt: string;
  deal: {
    id: string;
    title: string;
    product: {
      name: string;
      imageUrl: string | null;
    };
    merchant: {
      name: string;
    };
  };
}

interface CommentActivity {
  id: string;
  content: string;
  createdAt: string;
  deal: {
    id: string;
    title: string;
    product: {
      name: string;
      imageUrl: string | null;
    };
  };
}

export default function ProfilePage() {
  const { user, dbUser, loading, refreshUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'favorites' | 'votes'>('favorites');
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    displayName: '',
    username: '',
    bio: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [favorites, setFavorites] = useState<Deal[]>([]);
  const [votes, setVotes] = useState<VoteActivity[]>([]);
  const [comments, setComments] = useState<CommentActivity[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (dbUser) {
      setEditData({
        displayName: dbUser.displayName || '',
        username: dbUser.username || '',
        bio: dbUser.bio || '',
      });
    }
  }, [dbUser]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      
      setLoadingData(true);
      try {
        // Fetch favorites
        const favRes = await fetch('/api/favorites');
        if (favRes.ok) {
          const favData = await favRes.json();
          setFavorites(favData);
        }
        
        // Fetch activity (votes and comments)
        const activityRes = await fetch('/api/user/activity');
        if (activityRes.ok) {
          const activityData = await activityRes.json();
          setVotes(activityData.votes || []);
          setComments(activityData.comments || []);
        }
      } catch (error) {
        console.error('Error fetching profile data:', error);
      }
      setLoadingData(false);
    };

    fetchData();
  }, [user]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/user', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Erreur lors de la sauvegarde');
        return;
      }

      await refreshUser();
      setIsEditing(false);
    } catch {
      setError('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-[#0a0a0a]">
        <Loader2 className="w-8 h-8 animate-spin text-[#d4a855]" />
      </div>
    );
  }

  if (!user || !dbUser) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-[#0a0a0a]">
        <div className="text-center">
          <p className="text-neutral-400 mb-6 font-mono uppercase tracking-widest text-xs">Tu dois être connecté pour voir ton profil</p>
          <Link
            href="/auth/login"
            className="inline-block px-8 py-3 bg-[#d4a855] hover:bg-white text-black font-bold uppercase tracking-widest transition-colors"
            style={{ clipPath: 'polygon(10% 0, 100% 0, 90% 100%, 0% 100%)' }}
          >
            Se connecter
          </Link>
        </div>
      </div>
    );
  }

  const displayName = dbUser.displayName || dbUser.username || user.email?.split('@')[0];
  const avatarUrl = dbUser.avatarUrl || user.user_metadata?.avatar_url;
  const joinDate = new Date(dbUser.createdAt).toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Profile Header */}
      <div className="bg-[#1a1a1a] border border-[#d4a855]/20 p-8 mb-8 relative overflow-hidden">
        {/* Decorative background element */}
        <div className="absolute top-0 right-0 p-8 opacity-5">
          <User className="w-64 h-64 text-[#d4a855]" />
        </div>

        <div className="flex flex-col md:flex-row gap-8 relative z-10">
          {/* Avatar */}
          <div className="flex-shrink-0">
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt={displayName || 'Avatar'}
                width={120}
                height={120}
                className="object-cover border-2 border-[#d4a855]"
              />
            ) : (
              <div className="w-[120px] h-[120px] bg-[#0a0a0a] border-2 border-[#d4a855] flex items-center justify-center">
                <User className="w-12 h-12 text-[#d4a855]" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1">
            {isEditing ? (
              <div className="space-y-6 max-w-xl">
                {error && (
                  <div className="p-4 bg-[#9b1515]/10 border border-[#9b1515] text-[#9b1515] text-sm font-bold uppercase tracking-wider">
                    {error}
                  </div>
                )}
                <div>
                  <label className="block text-xs font-bold text-[#d4a855] uppercase tracking-widest mb-2">Nom affiché</label>
                  <input
                    type="text"
                    value={editData.displayName}
                    onChange={(e) => setEditData({ ...editData, displayName: e.target.value })}
                    className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#333] focus:border-[#d4a855] text-white focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#d4a855] uppercase tracking-widest mb-2">Pseudo</label>
                  <input
                    type="text"
                    value={editData.username}
                    onChange={(e) => setEditData({ ...editData, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                    className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#333] focus:border-[#d4a855] text-white focus:outline-none transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#d4a855] uppercase tracking-widest mb-2">Bio</label>
                  <textarea
                    value={editData.bio}
                    onChange={(e) => setEditData({ ...editData, bio: e.target.value })}
                    rows={3}
                    maxLength={200}
                    className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#333] focus:border-[#d4a855] text-white focus:outline-none transition-colors resize-none"
                  />
                </div>
                <div className="flex gap-4 pt-2">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-6 py-2 bg-[#d4a855] hover:bg-white text-black font-bold uppercase tracking-widest transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Sauvegarder
                  </button>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-6 py-2 border border-white/20 hover:border-white text-white font-bold uppercase tracking-widest transition-colors flex items-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between">
                  <div>
                    <h1 className="text-4xl font-black text-white uppercase tracking-tighter italic">{displayName}</h1>
                    {dbUser.username && (
                      <p className="text-[#d4a855] font-mono mt-1">@{dbUser.username}</p>
                    )}
                  </div>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="p-2 text-neutral-400 hover:text-[#d4a855] transition-colors"
                  >
                    <Edit2 className="w-5 h-5" />
                  </button>
                </div>
                
                {dbUser.bio && (
                  <p className="text-neutral-300 mt-4 font-light max-w-2xl">{dbUser.bio}</p>
                )}

                <div className="flex flex-wrap gap-6 mt-6 text-xs text-neutral-500 font-bold uppercase tracking-widest">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Membre depuis {joinDate}
                  </div>
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-[#d4a855]" />
                    <span className="text-[#d4a855]">{dbUser.reputation} points de réputation</span>
                  </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-8">
                  <div className="bg-[#0a0a0a] border border-[#333] p-4 text-center group hover:border-[#d4a855]/50 transition-colors">
                    <p className="text-3xl font-black text-white">{dbUser._count?.favorites || 0}</p>
                    <p className="text-xs font-bold text-[#d4a855] uppercase tracking-widest mt-1">Favoris</p>
                  </div>
                  <div className="bg-[#0a0a0a] border border-[#333] p-4 text-center group hover:border-[#d4a855]/50 transition-colors">
                    <p className="text-3xl font-black text-white">{dbUser._count?.votes || 0}</p>
                    <p className="text-xs font-bold text-[#d4a855] uppercase tracking-widest mt-1">Votes</p>
                  </div>
                  <div className="bg-[#0a0a0a] border border-[#333] p-4 text-center group hover:border-[#d4a855]/50 transition-colors">
                    <p className="text-3xl font-black text-white">{dbUser._count?.comments || 0}</p>
                    <p className="text-xs font-bold text-[#d4a855] uppercase tracking-widest mt-1">Commentaires</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-8 mb-8 border-b border-white/10 px-4">
        <button
          onClick={() => setActiveTab('favorites')}
          className={`pb-4 text-sm font-bold uppercase tracking-widest transition-colors relative ${
            activeTab === 'favorites' ? 'text-[#d4a855]' : 'text-neutral-500 hover:text-white'
          }`}
        >
          <span className="flex items-center gap-2">
            <Heart className="w-4 h-4" />
            Favoris ({favorites.length})
          </span>
          {activeTab === 'favorites' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#d4a855]" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('votes')}
          className={`pb-4 text-sm font-bold uppercase tracking-widest transition-colors relative ${
            activeTab === 'votes' ? 'text-[#d4a855]' : 'text-neutral-500 hover:text-white'
          }`}
        >
          <span className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Activité
          </span>
          {activeTab === 'votes' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#d4a855]" />
          )}
        </button>
      </div>

      {/* Tab Content */}
      {loadingData ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-[#d4a855]" />
        </div>
      ) : (
        <>
          {activeTab === 'favorites' && (
            <div>
              {favorites.length === 0 ? (
                <div className="text-center py-20 bg-[#1a1a1a] border border-dashed border-[#333]">
                  <Heart className="w-16 h-16 text-[#333] mx-auto mb-6" />
                  <p className="text-neutral-500 mb-6 font-mono text-sm uppercase tracking-wider">Tu n&apos;as pas encore de favoris</p>
                  <Link
                    href="/deals"
                    className="inline-block px-8 py-3 bg-[#d4a855] hover:bg-white text-black font-bold uppercase tracking-widest transition-colors"
                  >
                    Découvrir les deals
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {favorites.map((deal) => (
                    <DealCard key={deal.id} deal={deal} />
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'votes' && (
            <div>
              {votes.length === 0 && comments.length === 0 ? (
                <div className="text-center py-20 bg-[#1a1a1a] border border-dashed border-[#333]">
                  <MessageSquare className="w-16 h-16 text-[#333] mx-auto mb-6" />
                  <p className="text-neutral-500 mb-6 font-mono text-sm uppercase tracking-wider">Pas encore d&apos;activité</p>
                  <Link
                    href="/deals"
                    className="inline-block px-8 py-3 bg-[#d4a855] hover:bg-white text-black font-bold uppercase tracking-widest transition-colors"
                  >
                    Découvrir les deals
                  </Link>
                </div>
              ) : (
                <div className="space-y-8">
                  {/* Votes Section */}
                  {votes.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-black text-white italic uppercase tracking-wider flex items-center gap-3">
                        <ThumbsUp className="w-5 h-5 text-[#d4a855]" />
                        Mes votes ({votes.length})
                      </h3>
                      <div className="grid gap-2">
                        {votes.map((vote) => (
                          <Link
                            key={vote.id}
                            href={`/deals/${vote.deal.id}`}
                            className="flex items-center gap-4 p-4 bg-[#0a0a0a] border border-[#333] hover:border-[#d4a855] transition-colors group"
                          >
                            {vote.deal.product.imageUrl && (
                              <Image
                                src={vote.deal.product.imageUrl}
                                alt={vote.deal.product.name}
                                width={48}
                                height={48}
                                className="w-12 h-12 object-cover border border-[#333]"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-white truncate group-hover:text-[#d4a855] transition-colors">{vote.deal.product.name}</p>
                              <p className="text-xs text-neutral-500 uppercase tracking-wider">{vote.deal.merchant.name}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              {vote.value > 0 ? (
                                <span className="flex items-center gap-1 text-[#d4a855] font-bold text-sm">
                                  <ThumbsUp className="w-4 h-4" />
                                  +1
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-[#9b1515] font-bold text-sm">
                                  <ThumbsDown className="w-4 h-4" />
                                  -1
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-neutral-600 font-mono">
                              {new Date(vote.createdAt).toLocaleDateString('fr-FR')}
                            </span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Comments Section */}
                  {comments.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-black text-white italic uppercase tracking-wider flex items-center gap-3">
                        <MessageSquare className="w-5 h-5 text-[#d4a855]" />
                        Mes commentaires ({comments.length})
                      </h3>
                      <div className="grid gap-2">
                        {comments.map((comment) => (
                          <Link
                            key={comment.id}
                            href={`/deals/${comment.deal.id}`}
                            className="block p-4 bg-[#0a0a0a] border border-[#333] hover:border-[#d4a855] transition-colors group"
                          >
                            <div className="flex items-center gap-4 mb-3">
                              {comment.deal.product.imageUrl && (
                                <Image
                                  src={comment.deal.product.imageUrl}
                                  alt={comment.deal.product.name}
                                  width={40}
                                  height={40}
                                  className="w-10 h-10 object-cover border border-[#333]"
                                />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="font-bold text-white truncate group-hover:text-[#d4a855] transition-colors">{comment.deal.product.name}</p>
                              </div>
                              <span className="text-xs text-neutral-600 font-mono">
                                {new Date(comment.createdAt).toLocaleDateString('fr-FR')}
                              </span>
                            </div>
                            <p className="text-neutral-400 text-sm pl-14 line-clamp-2 italic border-l-2 border-[#333] py-1 pl-4 mb-1">{comment.content}</p>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
