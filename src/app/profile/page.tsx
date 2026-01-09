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
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#7b0a0a]" />
      </div>
    );
  }

  if (!user || !dbUser) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <p className="text-neutral-400 mb-4">Tu dois être connecté pour voir ton profil</p>
          <Link
            href="/auth/login"
            className="px-6 py-3 bg-[#7b0a0a] hover:bg-[#9b1a1a] text-white font-medium rounded-xl transition-colors"
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
      <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-6 mb-8">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Avatar */}
          <div className="flex-shrink-0">
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt={displayName || 'Avatar'}
                width={120}
                height={120}
                className="rounded-2xl object-cover"
              />
            ) : (
              <div className="w-[120px] h-[120px] rounded-2xl bg-[#7b0a0a] flex items-center justify-center">
                <User className="w-12 h-12 text-white" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1">
            {isEditing ? (
              <div className="space-y-4">
                {error && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                    {error}
                  </div>
                )}
                <div>
                  <label className="block text-sm text-neutral-400 mb-1">Nom affiché</label>
                  <input
                    type="text"
                    value={editData.displayName}
                    onChange={(e) => setEditData({ ...editData, displayName: e.target.value })}
                    className="w-full px-4 py-2 bg-[#0f0f0f] border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#7b0a0a]"
                  />
                </div>
                <div>
                  <label className="block text-sm text-neutral-400 mb-1">Pseudo</label>
                  <input
                    type="text"
                    value={editData.username}
                    onChange={(e) => setEditData({ ...editData, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                    className="w-full px-4 py-2 bg-[#0f0f0f] border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#7b0a0a]"
                  />
                </div>
                <div>
                  <label className="block text-sm text-neutral-400 mb-1">Bio</label>
                  <textarea
                    value={editData.bio}
                    onChange={(e) => setEditData({ ...editData, bio: e.target.value })}
                    rows={3}
                    maxLength={200}
                    className="w-full px-4 py-2 bg-[#0f0f0f] border border-white/10 rounded-lg text-white focus:outline-none focus:border-[#7b0a0a] resize-none"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 bg-[#7b0a0a] hover:bg-[#9b1a1a] text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Sauvegarder
                  </button>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors flex items-center gap-2"
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
                    <h1 className="text-2xl font-bold text-white">{displayName}</h1>
                    {dbUser.username && (
                      <p className="text-neutral-400">@{dbUser.username}</p>
                    )}
                  </div>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="p-2 text-neutral-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <Edit2 className="w-5 h-5" />
                  </button>
                </div>
                
                {dbUser.bio && (
                  <p className="text-neutral-300 mt-3">{dbUser.bio}</p>
                )}

                <div className="flex flex-wrap gap-4 mt-4 text-sm text-neutral-400">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    Membre depuis {joinDate}
                  </div>
                  <div className="flex items-center gap-1">
                    <Award className="w-4 h-4" />
                    {dbUser.reputation} points de réputation
                  </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
                  <div className="bg-[#0f0f0f] rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-white">{dbUser._count?.postedDeals || 0}</p>
                    <p className="text-sm text-neutral-500">Deals postés</p>
                  </div>
                  <div className="bg-[#0f0f0f] rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-white">{dbUser._count?.favorites || 0}</p>
                    <p className="text-sm text-neutral-500">Favoris</p>
                  </div>
                  <div className="bg-[#0f0f0f] rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-white">{dbUser._count?.votes || 0}</p>
                    <p className="text-sm text-neutral-500">Votes</p>
                  </div>
                  <div className="bg-[#0f0f0f] rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-white">{dbUser._count?.comments || 0}</p>
                    <p className="text-sm text-neutral-500">Commentaires</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-white/10">
        <button
          onClick={() => setActiveTab('favorites')}
          className={`px-4 py-3 text-sm font-medium transition-colors relative ${
            activeTab === 'favorites' ? 'text-white' : 'text-neutral-400 hover:text-white'
          }`}
        >
          <Heart className="w-4 h-4 inline mr-2" />
          Favoris ({favorites.length})
          {activeTab === 'favorites' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#7b0a0a]" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('votes')}
          className={`px-4 py-3 text-sm font-medium transition-colors relative ${
            activeTab === 'votes' ? 'text-white' : 'text-neutral-400 hover:text-white'
          }`}
        >
          <MessageSquare className="w-4 h-4 inline mr-2" />
          Activité
          {activeTab === 'votes' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#7b0a0a]" />
          )}
        </button>
      </div>

      {/* Tab Content */}
      {loadingData ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-[#7b0a0a]" />
        </div>
      ) : (
        <>
          {activeTab === 'favorites' && (
            <div>
              {favorites.length === 0 ? (
                <div className="text-center py-12 bg-[#1a1a1a] border border-white/10 rounded-2xl">
                  <Heart className="w-12 h-12 text-neutral-600 mx-auto mb-4" />
                  <p className="text-neutral-400 mb-4">Tu n&apos;as pas encore de favoris</p>
                  <Link
                    href="/deals"
                    className="inline-block px-6 py-3 bg-[#7b0a0a] hover:bg-[#9b1a1a] text-white font-medium rounded-xl transition-colors"
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
                <div className="text-center py-12 bg-[#1a1a1a] border border-white/10 rounded-2xl">
                  <MessageSquare className="w-12 h-12 text-neutral-600 mx-auto mb-4" />
                  <p className="text-neutral-400 mb-4">Pas encore d&apos;activité</p>
                  <Link
                    href="/deals"
                    className="inline-block px-6 py-3 bg-[#7b0a0a] hover:bg-[#9b1a1a] text-white font-medium rounded-xl transition-colors"
                  >
                    Découvrir les deals
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Votes Section */}
                  {votes.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        <ThumbsUp className="w-5 h-5 text-[#7b0a0a]" />
                        Mes votes ({votes.length})
                      </h3>
                      <div className="space-y-2">
                        {votes.map((vote) => (
                          <Link
                            key={vote.id}
                            href={`/deals/${vote.deal.id}`}
                            className="flex items-center gap-4 p-4 bg-[#1a1a1a] border border-white/10 rounded-xl hover:border-[#7b0a0a]/50 transition-colors"
                          >
                            {vote.deal.product.imageUrl && (
                              <Image
                                src={vote.deal.product.imageUrl}
                                alt={vote.deal.product.name}
                                width={48}
                                height={48}
                                className="w-12 h-12 rounded-lg object-cover"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-white truncate">{vote.deal.product.name}</p>
                              <p className="text-sm text-neutral-400">{vote.deal.merchant.name}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              {vote.value > 0 ? (
                                <span className="flex items-center gap-1 text-green-500">
                                  <ThumbsUp className="w-4 h-4" />
                                  +1
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-red-500">
                                  <ThumbsDown className="w-4 h-4" />
                                  -1
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-neutral-500">
                              {new Date(vote.createdAt).toLocaleDateString('fr-FR')}
                            </span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Comments Section */}
                  {comments.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-[#7b0a0a]" />
                        Mes commentaires ({comments.length})
                      </h3>
                      <div className="space-y-2">
                        {comments.map((comment) => (
                          <Link
                            key={comment.id}
                            href={`/deals/${comment.deal.id}`}
                            className="block p-4 bg-[#1a1a1a] border border-white/10 rounded-xl hover:border-[#7b0a0a]/50 transition-colors"
                          >
                            <div className="flex items-center gap-4 mb-2">
                              {comment.deal.product.imageUrl && (
                                <Image
                                  src={comment.deal.product.imageUrl}
                                  alt={comment.deal.product.name}
                                  width={40}
                                  height={40}
                                  className="w-10 h-10 rounded-lg object-cover"
                                />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-white truncate">{comment.deal.product.name}</p>
                              </div>
                              <span className="text-xs text-neutral-500">
                                {new Date(comment.createdAt).toLocaleDateString('fr-FR')}
                              </span>
                            </div>
                            <p className="text-neutral-300 text-sm pl-14 line-clamp-2">{comment.content}</p>
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
