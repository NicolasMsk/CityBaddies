'use client';

import { useAuth } from '@/components/auth';
import { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  User, 
  Mail, 
  Lock, 
  Bell, 
  Trash2,
  Save,
  Loader2,
  Check,
  AlertTriangle
} from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

export default function SettingsPage() {
  const { user, dbUser, loading: authLoading, refreshUser, signOut } = useAuth();
  
  // Profile settings
  const [profileData, setProfileData] = useState({
    displayName: '',
    username: '',
    bio: '',
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Password settings
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Notifications settings
  const [notifications, setNotifications] = useState({
    emailDeals: true,
    emailComments: true,
    emailNewsletter: false,
  });

  // Delete account
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (dbUser) {
      setProfileData({
        displayName: dbUser.displayName || '',
        username: dbUser.username || '',
        bio: dbUser.bio || '',
      });
    }
  }, [dbUser]);

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    setProfileError(null);
    setProfileSaved(false);

    try {
      const res = await fetch('/api/user', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileData),
      });

      if (!res.ok) {
        const data = await res.json();
        setProfileError(data.error || 'Erreur lors de la sauvegarde');
        return;
      }

      await refreshUser();
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } catch {
      setProfileError('Erreur lors de la sauvegarde');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('Les mots de passe ne correspondent pas');
      return;
    }

    if (passwordData.newPassword.length < 8) {
      setPasswordError('Le mot de passe doit contenir au moins 8 caractères');
      return;
    }

    setSavingPassword(true);
    setPasswordError(null);
    setPasswordSaved(false);

    try {
      const res = await fetch('/api/user/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setPasswordError(data.error || 'Erreur lors du changement de mot de passe');
        return;
      }

      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPasswordSaved(true);
      setTimeout(() => setPasswordSaved(false), 3000);
    } catch {
      setPasswordError('Erreur lors du changement de mot de passe');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'SUPPRIMER') return;

    setDeleting(true);
    try {
      const res = await fetch('/api/user', {
        method: 'DELETE',
      });

      if (res.ok) {
        await signOut();
        window.location.href = '/';
      }
    } catch (error) {
      console.error('Error deleting account:', error);
    } finally {
      setDeleting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-[#0a0a0a]">
        <Loader2 className="w-8 h-8 animate-spin text-[#d4a855]" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-[#0a0a0a]">
        <div className="text-center">
          <User className="w-16 h-16 text-[#333] mx-auto mb-6" />
          <p className="text-neutral-400 mb-6 font-mono text-sm uppercase tracking-widest">Connecte-toi pour accéder aux paramètres</p>
          <Link
            href="/auth/login?redirect=/profile/settings"
            className="inline-block px-8 py-3 bg-[#d4a855] hover:bg-white text-black font-bold uppercase tracking-widest transition-colors"
            style={{ clipPath: 'polygon(10% 0, 100% 0, 90% 100%, 0% 100%)' }}
          >
            Se connecter
          </Link>
        </div>
      </div>
    );
  }

  const avatarUrl = dbUser?.avatarUrl || user.user_metadata?.avatar_url;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-12">
        <Link
          href="/profile"
          className="inline-flex items-center gap-2 text-neutral-400 hover:text-[#d4a855] transition-colors mb-6 uppercase tracking-widest text-xs font-bold"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour au profil
        </Link>
        <div className="flex items-center gap-6">
          <div className="p-4 bg-[#0a0a0a] border border-[#d4a855] flex items-center justify-center">
            <User className="w-8 h-8 text-[#d4a855]" />
          </div>
          <div>
            <h1 className="text-4xl font-black text-white italic uppercase tracking-tighter">Paramètres</h1>
            <p className="text-[#d4a855] font-mono text-sm mt-1">Gère ton compte et tes préférences</p>
          </div>
        </div>
      </div>

      {/* Profile Section */}
      <section className="mb-12">
        <div className="flex items-center gap-4 mb-8 border-b border-[#333] pb-4">
          <h2 className="text-2xl font-black text-white uppercase tracking-tight italic">Profil</h2>
          <div className="h-px flex-1 bg-gradient-to-r from-[#333] to-transparent"></div>
        </div>

        {/* Avatar */}
        <div className="flex items-center gap-6 mb-8 bg-[#0a0a0a] border border-[#333] p-6 relative group">
          <div className="absolute top-0 right-0 w-4 h-4 border-t border-r border-[#d4a855] opacity-50 group-hover:opacity-100 transition-opacity" />
          <div className="absolute bottom-0 left-0 w-4 h-4 border-b border-l border-[#d4a855] opacity-50 group-hover:opacity-100 transition-opacity" />
          
          {avatarUrl ? (
            <div className="relative">
              <Image
                src={avatarUrl}
                alt="Avatar"
                width={80}
                height={80}
                className="object-cover border border-[#333]"
              />
              <div className="absolute inset-0 border border-[#d4a855]/30"></div>
            </div>
          ) : (
            <div className="w-20 h-20 bg-[#111] flex items-center justify-center border border-[#333]">
              <User className="w-10 h-10 text-[#d4a855]" />
            </div>
          )}
          <div>
            <p className="text-[#d4a855] font-bold uppercase tracking-wider text-sm mb-1">Photo de profil</p>
            <p className="text-xs text-neutral-500 font-mono">
              Gérée via ton provider de connexion (Google/Email)
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="group">
            <label className="block text-xs font-bold text-[#d4a855] uppercase tracking-widest mb-2 group-focus-within:text-white transition-colors">
              Nom d&apos;affichage
            </label>
            <input
              type="text"
              value={profileData.displayName}
              onChange={(e) => setProfileData({ ...profileData, displayName: e.target.value })}
              placeholder="TON NOM"
              className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#333] text-white placeholder-neutral-700 focus:outline-none focus:border-[#d4a855] transition-colors font-mono"
            />
          </div>

          <div className="group">
            <label className="block text-xs font-bold text-[#d4a855] uppercase tracking-widest mb-2 group-focus-within:text-white transition-colors">
              Nom d&apos;utilisateur
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#d4a855] font-bold">@</span>
              <input
                type="text"
                value={profileData.username}
                onChange={(e) => setProfileData({ ...profileData, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                placeholder="username"
                className="w-full pl-8 pr-4 py-3 bg-[#0a0a0a] border border-[#333] text-white placeholder-neutral-700 focus:outline-none focus:border-[#d4a855] transition-colors font-mono"
              />
            </div>
          </div>

          <div className="group">
            <label className="block text-xs font-bold text-[#d4a855] uppercase tracking-widest mb-2 group-focus-within:text-white transition-colors">
              Bio
            </label>
            <textarea
              value={profileData.bio}
              onChange={(e) => setProfileData({ ...profileData, bio: e.target.value })}
              placeholder="PARLE-NOUS DE TOI..."
              rows={3}
              className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#333] text-white placeholder-neutral-700 focus:outline-none focus:border-[#d4a855] transition-colors font-mono resize-none"
            />
          </div>

          {profileError && (
            <div className="p-3 bg-red-950/30 border border-red-900 text-red-500 text-sm font-mono">
              ! {profileError}
            </div>
          )}

          <button
            onClick={handleSaveProfile}
            disabled={savingProfile}
            className="group relative inline-flex items-center justify-center gap-3 px-8 py-3 bg-[#d4a855] hover:bg-white text-black font-black uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ clipPath: 'polygon(10% 0, 100% 0, 90% 100%, 0% 100%)' }}
          >
            {savingProfile ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : profileSaved ? (
              <Check className="w-4 h-4" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {profileSaved ? 'SAUVEGARDÉ !' : 'SAUVEGARDER'}
          </button>
        </div>
      </section>

      {/* Email Section */}
      <section className="mb-12">
        <div className="flex items-center gap-4 mb-8 border-b border-[#333] pb-4">
          <h2 className="text-2xl font-black text-white uppercase tracking-tight italic">Email</h2>
          <div className="h-px flex-1 bg-gradient-to-r from-[#333] to-transparent"></div>
        </div>

        <div className="flex items-center justify-between p-6 bg-[#0a0a0a] border border-[#333]">
          <div>
            <p className="text-white font-mono text-lg">{user.email}</p>
            <p className="text-xs text-[#d4a855] uppercase tracking-widest mt-1">Email principal</p>
          </div>
          <span className="px-3 py-1 bg-[#1a1a1a] border border-[#d4a855] text-[#d4a855] text-xs font-bold uppercase tracking-wider">
            Vérifié
          </span>
        </div>
      </section>

      {/* Password Section (only for email users) */}
      {user.app_metadata?.provider === 'email' && (
        <section className="mb-12">
          <div className="flex items-center gap-4 mb-8 border-b border-[#333] pb-4">
            <h2 className="text-2xl font-black text-white uppercase tracking-tight italic">Sécurité</h2>
            <div className="h-px flex-1 bg-gradient-to-r from-[#333] to-transparent"></div>
          </div>

          <div className="space-y-6">
            <div className="group">
              <label className="block text-xs font-bold text-[#d4a855] uppercase tracking-widest mb-2 group-focus-within:text-white transition-colors">
                Mot de passe actuel
              </label>
              <input
                type="password"
                value={passwordData.currentPassword}
                onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#333] text-white placeholder-neutral-700 focus:outline-none focus:border-[#d4a855] transition-colors font-mono"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="group">
                <label className="block text-xs font-bold text-[#d4a855] uppercase tracking-widest mb-2 group-focus-within:text-white transition-colors">
                  Nouveau mot de passe
                </label>
                <input
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#333] text-white placeholder-neutral-700 focus:outline-none focus:border-[#d4a855] transition-colors font-mono"
                />
              </div>

              <div className="group">
                <label className="block text-xs font-bold text-[#d4a855] uppercase tracking-widest mb-2 group-focus-within:text-white transition-colors">
                  Confirmer le mot de passe
                </label>
                <input
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  className="w-full px-4 py-3 bg-[#0a0a0a] border border-[#333] text-white placeholder-neutral-700 focus:outline-none focus:border-[#d4a855] transition-colors font-mono"
                />
              </div>
            </div>

            {passwordError && (
              <div className="p-3 bg-red-950/30 border border-red-900 text-red-500 text-sm font-mono">
                ! {passwordError}
              </div>
            )}

            <button
              onClick={handleChangePassword}
              disabled={savingPassword || !passwordData.currentPassword || !passwordData.newPassword}
              className="group relative inline-flex items-center justify-center gap-3 px-8 py-3 bg-transparent border border-[#d4a855] hover:bg-[#d4a855] text-[#d4a855] hover:text-black font-black uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {savingPassword ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : passwordSaved ? (
                <Check className="w-4 h-4" />
              ) : (
                <Lock className="w-4 h-4" />
              )}
              {passwordSaved ? 'MOT DE PASSE CHANGÉ' : 'CHANGER LE MOT DE PASSE'}
            </button>
          </div>
        </section>
      )}

      {/* Notifications Section */}
      <section className="mb-12">
        <div className="flex items-center gap-4 mb-8 border-b border-[#333] pb-4">
          <h2 className="text-2xl font-black text-white uppercase tracking-tight italic">Notifications</h2>
          <div className="h-px flex-1 bg-gradient-to-r from-[#333] to-transparent"></div>
        </div>

        <div className="space-y-4">
          <label className="flex items-center justify-between p-6 bg-[#0a0a0a] border border-[#333] cursor-pointer hover:border-[#d4a855] transition-colors group">
            <div>
              <p className="text-white font-bold uppercase tracking-wide group-hover:text-[#d4a855] transition-colors">Nouveaux deals</p>
              <p className="text-sm text-neutral-500 mt-1 font-mono">Reçois des emails pour les meilleurs deals</p>
            </div>
            <div className={`w-6 h-6 border ${notifications.emailDeals ? 'bg-[#d4a855] border-[#d4a855]' : 'border-[#333]'} flex items-center justify-center transition-colors`}>
               {notifications.emailDeals && <Check className="w-4 h-4 text-black" />}
            </div>
            <input
              type="checkbox"
              checked={notifications.emailDeals}
              onChange={(e) => setNotifications({ ...notifications, emailDeals: e.target.checked })}
              className="hidden"
            />
          </label>

          <label className="flex items-center justify-between p-6 bg-[#0a0a0a] border border-[#333] cursor-pointer hover:border-[#d4a855] transition-colors group">
            <div>
              <p className="text-white font-bold uppercase tracking-wide group-hover:text-[#d4a855] transition-colors">Commentaires</p>
              <p className="text-sm text-neutral-500 mt-1 font-mono">Notifié quand quelqu&apos;un répond à ton commentaire</p>
            </div>
            <div className={`w-6 h-6 border ${notifications.emailComments ? 'bg-[#d4a855] border-[#d4a855]' : 'border-[#333]'} flex items-center justify-center transition-colors`}>
               {notifications.emailComments && <Check className="w-4 h-4 text-black" />}
            </div>
            <input
              type="checkbox"
              checked={notifications.emailComments}
              onChange={(e) => setNotifications({ ...notifications, emailComments: e.target.checked })}
              className="hidden"
            />
          </label>

          <label className="flex items-center justify-between p-6 bg-[#0a0a0a] border border-[#333] cursor-pointer hover:border-[#d4a855] transition-colors group">
            <div>
              <p className="text-white font-bold uppercase tracking-wide group-hover:text-[#d4a855] transition-colors">Newsletter</p>
              <p className="text-sm text-neutral-500 mt-1 font-mono">Récapitulatif hebdomadaire des tendances</p>
            </div>
            <div className={`w-6 h-6 border ${notifications.emailNewsletter ? 'bg-[#d4a855] border-[#d4a855]' : 'border-[#333]'} flex items-center justify-center transition-colors`}>
               {notifications.emailNewsletter && <Check className="w-4 h-4 text-black" />}
            </div>
            <input
              type="checkbox"
              checked={notifications.emailNewsletter}
              onChange={(e) => setNotifications({ ...notifications, emailNewsletter: e.target.checked })}
              className="hidden"
            />
          </label>
        </div>
      </section>

      {/* Danger Zone */}
      <section className="p-8 bg-[#1a0505] border border-red-900 border-dashed">
        <div className="flex items-center gap-3 mb-6">
          <AlertTriangle className="w-6 h-6 text-red-500" />
          <h2 className="text-xl font-black text-red-500 uppercase tracking-tighter italic">Danger Zone</h2>
        </div>

        <p className="text-red-400/70 mb-8 font-mono text-sm">
          La suppression de ton compte est définitive. Toutes tes données seront perdues et ne pourront pas être récupérées.
        </p>

        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="px-8 py-3 border border-red-900 text-red-500 font-bold uppercase tracking-widest hover:bg-red-950 transition-colors"
          >
            Supprimer mon compte
          </button>
        ) : (
          <div className="p-6 bg-black border border-red-900 space-y-6">
            <div className="flex items-start gap-3">
              <p className="text-sm text-red-400 font-mono">
                Pour confirmer, tape <span className="font-bold text-red-500">SUPPRIMER</span> ci-dessous :
              </p>
            </div>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="SUPPRIMER"
              className="w-full px-4 py-3 bg-[#1a0505] border border-red-900 text-white placeholder-red-900 focus:outline-none focus:border-red-500 transition-colors font-mono uppercase"
            />
            <div className="flex gap-4">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmText('');
                }}
                className="px-6 py-3 border border-[#333] text-neutral-400 hover:text-white font-bold uppercase tracking-widest text-sm transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirmText !== 'SUPPRIMER' || deleting}
                className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold uppercase tracking-widest text-sm transition-colors"
              >
                {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                ADIEU, CITY BADDIES
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
