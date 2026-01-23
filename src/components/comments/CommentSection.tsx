'use client';

import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { MessageSquare, Send, Reply, Trash2, User, LogIn, ChevronRight } from 'lucide-react';
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
    
    const displayName = comment.user.displayName || comment.user.username || 'Anonymous';
    const isAuthor = currentUserId === comment.user.id;
    
    return (
      <div className={`${isReply ? 'ml-8 pl-4 border-l border-white/10' : ''}`}>
        <div className="bg-transparent border-b border-white/5 py-4">
          {/* Header */}
          <div className="flex items-center gap-3 mb-2">
            {comment.user.avatarUrl ? (
              <img 
                src={comment.user.avatarUrl} 
                alt={displayName}
                className="w-8 h-8 object-cover border border-white/10"
              />
            ) : (
              <div className="w-8 h-8 bg-[#0a0a0a] border border-white/10 flex items-center justify-center">
                <User className="w-3 h-3 text-white/40" />
              </div>
            )}
            <div className="flex-1 flex items-baseline gap-2">
              <span className="text-xs uppercase tracking-widest font-bold text-white">{displayName}</span>
              <span className="text-[10px] text-neutral-500 uppercase tracking-wide">{timeAgo}</span>
            </div>
            {isAuthor && (
              <button
                onClick={() => handleDelete(comment.id)}
                className="text-neutral-600 hover:text-[#9b1515] transition-colors"
                title="Supprimer"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </div>
          
          {/* Content */}
          <p className="text-neutral-300 text-sm font-light leading-relaxed pl-11">{comment.content}</p>
          
          {/* Actions */}
          {!isReply && currentUserId && (
            <button
              onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
              className="flex items-center gap-1 text-neutral-500 hover:text-[#d4a855] text-[10px] uppercase tracking-widest mt-2 ml-11 transition-colors"
            >
              <Reply className="w-3 h-3" />
              Répondre
            </button>
          )}
          
          {/* Reply form */}
          {replyingTo === comment.id && (
            <form onSubmit={(e) => handleSubmit(e, comment.id)} className="mt-4 ml-11">
              <div className="flex gap-0">
                <input
                  type="text"
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  placeholder="Écrivez votre réponse..."
                  className="flex-1 bg-transparent border-b border-white/20 px-0 py-2 text-sm text-white focus:outline-none focus:border-[#d4a855] placeholder:text-neutral-600 font-light"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={!replyContent.trim() || submitting}
                  className="px-4 text-[#d4a855] disabled:text-neutral-700 hover:text-white transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}
        </div>
        
        {/* Replies */}
        {comment.replies && comment.replies.length > 0 && (
          <div className="space-y-0 mt-2">
            {comment.replies.map((reply) => (
              <CommentItem key={reply.id} comment={reply} isReply />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mt-12">
      <h2 className="text-sm font-bold uppercase tracking-[0.2em] mb-8 flex items-center gap-3 text-white">
        <MessageSquare className="w-4 h-4 text-[#d4a855]" />
        Discussion ({comments.length})
      </h2>
      
      {/* Formulaire nouveau commentaire */}
      {checkingAuth ? (
        <div className="border border-white/10 p-6 mb-8 text-center bg-[#0a0a0a]">
          <div className="animate-pulse text-neutral-500 text-xs uppercase tracking-widest">Vérification...</div>
        </div>
      ) : currentUserId ? (
        <form onSubmit={(e) => handleSubmit(e)} className="mb-12">
          <div className="relative">
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Rejoindre la discussion..."
              rows={2}
              className="w-full bg-[#0a0a0a] border border-white/10 px-4 py-4 focus:outline-none focus:border-[#d4a855] resize-none text-sm font-light tracking-wide text-white placeholder:text-neutral-600"
            />
            <div className="absolute bottom-2 right-2">
              <button
                type="submit"
                disabled={!newComment.trim() || submitting}
                className="flex items-center gap-2 px-4 py-1.5 bg-white text-black text-[10px] items-center justify-center font-bold uppercase tracking-widest hover:bg-[#d4a855] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? 'Envoi...' : 'Publier'}
              </button>
            </div>
          </div>
        </form>
      ) : (
        <div className="border border-white/10 p-8 mb-8 text-center bg-[#0a0a0a]">
          <LogIn className="w-6 h-6 text-white/20 mx-auto mb-4" />
          <p className="text-neutral-400 mb-6 text-sm font-light">Connectez-vous pour rejoindre la conversation.</p>
          <Link
            href={`/auth/login?redirect=${encodeURIComponent(`/deals/${dealId}`)}`}
            className="inline-flex items-center gap-2 px-6 py-3 border border-white text-white text-xs uppercase tracking-widest hover:bg-white hover:text-black transition-colors"
          >
            <LogIn className="w-3 h-3" />
            Se Connecter
          </Link>
        </div>
      )}
      
      {/* Liste des commentaires */}
      {loading ? (
        <div className="text-center py-12 border-t border-white/10">
          <p className="text-xs uppercase tracking-widest text-neutral-600">Chargement...</p>
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-12 border-t border-white/10">
          <p className="text-neutral-500 text-sm font-light italic">Pas encore de commentaire. Soyez le premier !</p>
        </div>
      ) : (
        <div className="space-y-0 border-t border-white/10">
          {comments.map((comment) => (
            <CommentItem key={comment.id} comment={comment} />
          ))}
        </div>
      )}
    </div>
  );
}
