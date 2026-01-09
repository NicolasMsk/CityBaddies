'use client';

import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { MessageCircle, Send, Reply, Trash2, User, LogIn } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

interface CommentUser {
  id: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  user: CommentUser;
  replies: Comment[];
}

interface CommentSectionProps {
  dealId: string;
}

export default function CommentSection({ dealId }: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Vérifier l'authentification côté client
  useEffect(() => {
    async function checkAuth() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        setCurrentUserId(user?.id || null);
      } catch (error) {
        console.error('Erreur vérification auth:', error);
        setCurrentUserId(null);
      } finally {
        setCheckingAuth(false);
      }
    }
    checkAuth();
  }, []);

  // Charger les commentaires
  useEffect(() => {
    fetchComments();
  }, [dealId]);

  async function fetchComments() {
    try {
      const res = await fetch(`/api/comments?dealId=${dealId}`);
      if (res.ok) {
        const data = await res.json();
        setComments(data);
      }
    } catch (error) {
      console.error('Erreur chargement commentaires:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent, parentId?: string) {
    e.preventDefault();
    
    const content = parentId ? replyContent : newComment;
    if (!content.trim() || submitting) return;
    
    setSubmitting(true);
    
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealId,
          content: content.trim(),
          parentId: parentId || null,
        }),
      });
      
      if (res.ok) {
        // Recharger les commentaires
        await fetchComments();
        setNewComment('');
        setReplyContent('');
        setReplyingTo(null);
      } else if (res.status === 401) {
        // Rediriger vers login
        window.location.href = '/auth/login?redirect=' + encodeURIComponent(window.location.pathname);
      }
    } catch (error) {
      console.error('Erreur envoi commentaire:', error);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(commentId: string) {
    if (!confirm('Supprimer ce commentaire ?')) return;
    
    try {
      const res = await fetch(`/api/comments?id=${commentId}`, {
        method: 'DELETE',
      });
      
      if (res.ok) {
        await fetchComments();
      }
    } catch (error) {
      console.error('Erreur suppression:', error);
    }
  }

  function CommentItem({ comment, isReply = false }: { comment: Comment; isReply?: boolean }) {
    const timeAgo = formatDistanceToNow(new Date(comment.createdAt), {
      addSuffix: true,
      locale: fr,
    });
    
    const displayName = comment.user.displayName || comment.user.username || 'Utilisateur';
    const isAuthor = currentUserId === comment.user.id;
    
    return (
      <div className={`${isReply ? 'ml-8 border-l-2 border-[#333] pl-4' : ''}`}>
        <div className="bg-[#1a1a1a] rounded-lg p-4 mb-3">
          {/* Header */}
          <div className="flex items-center gap-3 mb-2">
            {comment.user.avatarUrl ? (
              <img 
                src={comment.user.avatarUrl} 
                alt={displayName}
                className="w-8 h-8 rounded-full"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-[#7b0a0a] flex items-center justify-center">
                <User className="w-4 h-4" />
              </div>
            )}
            <div className="flex-1">
              <span className="font-medium text-white">{displayName}</span>
              <span className="text-gray-500 text-sm ml-2">• {timeAgo}</span>
            </div>
            {isAuthor && (
              <button
                onClick={() => handleDelete(comment.id)}
                className="text-gray-500 hover:text-red-500 transition-colors"
                title="Supprimer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
          
          {/* Content */}
          <p className="text-gray-300 whitespace-pre-wrap">{comment.content}</p>
          
          {/* Actions */}
          {!isReply && currentUserId && (
            <button
              onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
              className="flex items-center gap-1 text-gray-500 hover:text-[#7b0a0a] text-sm mt-3 transition-colors"
            >
              <Reply className="w-4 h-4" />
              Répondre
            </button>
          )}
          
          {/* Reply form */}
          {replyingTo === comment.id && (
            <form onSubmit={(e) => handleSubmit(e, comment.id)} className="mt-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder="Écrire une réponse..."
                  className="flex-1 bg-[#252525] border border-[#333] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#7b0a0a]"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={!replyContent.trim() || submitting}
                  className="px-3 py-2 bg-[#7b0a0a] text-white rounded-lg hover:bg-[#9b1a1a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}
        </div>
        
        {/* Replies */}
        {comment.replies && comment.replies.length > 0 && (
          <div className="space-y-2">
            {comment.replies.map((reply) => (
              <CommentItem key={reply.id} comment={reply} isReply />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mt-8">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <MessageCircle className="w-5 h-5 text-[#7b0a0a]" />
        Commentaires ({comments.length})
      </h2>
      
      {/* Formulaire nouveau commentaire */}
      {checkingAuth ? (
        <div className="bg-[#1a1a1a] border border-[#333] rounded-lg p-6 mb-6 text-center">
          <div className="animate-pulse text-gray-500">Vérification...</div>
        </div>
      ) : currentUserId ? (
        <form onSubmit={(e) => handleSubmit(e)} className="mb-6">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Partagez votre avis sur ce deal..."
            rows={3}
            className="w-full bg-[#1a1a1a] border border-[#333] rounded-lg px-4 py-3 focus:outline-none focus:border-[#7b0a0a] resize-none"
          />
          <div className="flex justify-end mt-2">
            <button
              type="submit"
              disabled={!newComment.trim() || submitting}
              className="flex items-center gap-2 px-4 py-2 bg-[#7b0a0a] text-white rounded-lg hover:bg-[#9b1a1a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-4 h-4" />
              {submitting ? 'Envoi...' : 'Publier'}
            </button>
          </div>
        </form>
      ) : (
        <div className="bg-[#1a1a1a] border border-[#333] rounded-lg p-6 mb-6 text-center">
          <LogIn className="w-8 h-8 text-gray-500 mx-auto mb-2" />
          <p className="text-gray-400 mb-3">Connectez-vous pour laisser un commentaire</p>
          <Link
            href={`/auth/login?redirect=${encodeURIComponent(`/deals/${dealId}`)}`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#7b0a0a] text-white rounded-lg hover:bg-[#9b1a1a] transition-colors"
          >
            <LogIn className="w-4 h-4" />
            Se connecter
          </Link>
        </div>
      )}
      
      {/* Liste des commentaires */}
      {loading ? (
        <div className="text-center py-8 text-gray-500">
          Chargement des commentaires...
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>Aucun commentaire pour le moment</p>
          <p className="text-sm">Soyez le premier à donner votre avis !</p>
        </div>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <CommentItem key={comment.id} comment={comment} />
          ))}
        </div>
      )}
    </div>
  );
}
