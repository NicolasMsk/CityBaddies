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
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#7b0a0a]" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <User className="w-16 h-16 text-neutral-600 mx-auto mb-4" />
          <p className="text-neutral-400 mb-4">Connecte-toi pour accéder aux paramètres</p>
          <Link
            href="/auth/login?redirect=/profile/settings"
            className="px-6 py-3 bg-[#7b0a0a] hover:bg-[#9b1a1a] text-white font-medium rounded-xl transition-colors"
          >
            Se connecter
          </Link>
        </div>
      </div>
    );
  }

  const avatarUrl = dbUser?.avatarUrl || user.user_metadata?.avatar_url;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/profile"
          className="inline-flex items-center gap-2 text-neutral-400 hover:text-white transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour au profil
        </Link>
        <h1 className="text-2xl font-bold text-white">Paramètres</h1>
        <p className="text-neutral-400">Gère ton compte et tes préférences</p>
      </div>

      {/* Profile Section */}
      <section className="mb-8 p-6 bg-[#1a1a1a] border border-white/10 rounded-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-[#7b0a0a]/20 rounded-lg">
            <User className="w-5 h-5 text-[#7b0a0a]" />
          </div>
          <h2 className="text-lg font-semibold text-white">Profil</h2>
        </div>

        {/* Avatar */}
        <div className="flex items-center gap-4 mb-6 pb-6 border-b border-white/10">
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt="Avatar"
              width={80}
              height={80}
              className="rounded-full object-cover"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-[#7b0a0a] flex items-center justify-center">
              <User className="w-10 h-10 text-white" />
            </div>
          )}
          <div>
            <p className="text-sm text-neutral-400 mb-2">
              Photo de profil (via Google/Provider OAuth)
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">
              Nom d&apos;affichage
            </label>
            <input
              type="text"
              value={profileData.displayName}
              onChange={(e) => setProfileData({ ...profileData, displayName: e.target.value })}
              placeholder="Ton nom"
              className="w-full px-4 py-3 bg-[#0d0d0d] border border-white/10 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-[#7b0a0a] focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">
              Nom d&apos;utilisateur
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500">@</span>
              <input
                type="text"
                value={profileData.username}
                onChange={(e) => setProfileData({ ...profileData, username: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
                placeholder="username"
                className="w-full pl-8 pr-4 py-3 bg-[#0d0d0d] border border-white/10 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-[#7b0a0a] focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">
              Bio
            </label>
            <textarea
              value={profileData.bio}
              onChange={(e) => setProfileData({ ...profileData, bio: e.target.value })}
              placeholder="Parle-nous de toi..."
              rows={3}
              className="w-full px-4 py-3 bg-[#0d0d0d] border border-white/10 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-[#7b0a0a] focus:border-transparent resize-none"
            />
          </div>

          {profileError && (
            <p className="text-red-400 text-sm">{profileError}</p>
          )}

          <button
            onClick={handleSaveProfile}
            disabled={savingProfile}
            className="flex items-center gap-2 px-6 py-3 bg-[#7b0a0a] hover:bg-[#9b1a1a] disabled:opacity-50 text-white font-medium rounded-xl transition-colors"
          >
            {savingProfile ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : profileSaved ? (
              <Check className="w-4 h-4" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {profileSaved ? 'Sauvegardé !' : 'Sauvegarder'}
          </button>
        </div>
      </section>

      {/* Email Section */}
      <section className="mb-8 p-6 bg-[#1a1a1a] border border-white/10 rounded-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-blue-500/20 rounded-lg">
            <Mail className="w-5 h-5 text-blue-400" />
          </div>
          <h2 className="text-lg font-semibold text-white">Email</h2>
        </div>

        <div className="flex items-center justify-between p-4 bg-[#0d0d0d] rounded-xl">
          <div>
            <p className="text-white font-medium">{user.email}</p>
            <p className="text-sm text-neutral-500">Email principal</p>
          </div>
          <span className="px-3 py-1 bg-green-500/20 text-green-400 text-sm rounded-full">
            Vérifié
          </span>
        </div>
      </section>

      {/* Password Section (only for email users) */}
      {user.app_metadata?.provider === 'email' && (
        <section className="mb-8 p-6 bg-[#1a1a1a] border border-white/10 rounded-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-yellow-500/20 rounded-lg">
              <Lock className="w-5 h-5 text-yellow-400" />
            </div>
            <h2 className="text-lg font-semibold text-white">Mot de passe</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                Mot de passe actuel
              </label>
              <input
                type="password"
                value={passwordData.currentPassword}
                onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                className="w-full px-4 py-3 bg-[#0d0d0d] border border-white/10 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-[#7b0a0a] focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                Nouveau mot de passe
              </label>
              <input
                type="password"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                className="w-full px-4 py-3 bg-[#0d0d0d] border border-white/10 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-[#7b0a0a] focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-300 mb-2">
                Confirmer le mot de passe
              </label>
              <input
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                className="w-full px-4 py-3 bg-[#0d0d0d] border border-white/10 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-[#7b0a0a] focus:border-transparent"
              />
            </div>

            {passwordError && (
              <p className="text-red-400 text-sm">{passwordError}</p>
            )}

            <button
              onClick={handleChangePassword}
              disabled={savingPassword || !passwordData.currentPassword || !passwordData.newPassword}
              className="flex items-center gap-2 px-6 py-3 bg-[#7b0a0a] hover:bg-[#9b1a1a] disabled:opacity-50 text-white font-medium rounded-xl transition-colors"
            >
              {savingPassword ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : passwordSaved ? (
                <Check className="w-4 h-4" />
              ) : (
                <Lock className="w-4 h-4" />
              )}
              {passwordSaved ? 'Mot de passe changé !' : 'Changer le mot de passe'}
            </button>
          </div>
        </section>
      )}

      {/* Notifications Section */}
      <section className="mb-8 p-6 bg-[#1a1a1a] border border-white/10 rounded-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-purple-500/20 rounded-lg">
            <Bell className="w-5 h-5 text-purple-400" />
          </div>
          <h2 className="text-lg font-semibold text-white">Notifications</h2>
        </div>

        <div className="space-y-4">
          <label className="flex items-center justify-between p-4 bg-[#0d0d0d] rounded-xl cursor-pointer">
            <div>
              <p className="text-white font-medium">Nouveaux deals</p>
              <p className="text-sm text-neutral-500">Reçois des emails pour les meilleurs deals</p>
            </div>
            <input
              type="checkbox"
              checked={notifications.emailDeals}
              onChange={(e) => setNotifications({ ...notifications, emailDeals: e.target.checked })}
              className="w-5 h-5 accent-[#7b0a0a]"
            />
          </label>

          <label className="flex items-center justify-between p-4 bg-[#0d0d0d] rounded-xl cursor-pointer">
            <div>
              <p className="text-white font-medium">Commentaires</p>
              <p className="text-sm text-neutral-500">Notifié quand quelqu&apos;un répond à ton commentaire</p>
            </div>
            <input
              type="checkbox"
              checked={notifications.emailComments}
              onChange={(e) => setNotifications({ ...notifications, emailComments: e.target.checked })}
              className="w-5 h-5 accent-[#7b0a0a]"
            />
          </label>

          <label className="flex items-center justify-between p-4 bg-[#0d0d0d] rounded-xl cursor-pointer">
            <div>
              <p className="text-white font-medium">Newsletter</p>
              <p className="text-sm text-neutral-500">Récapitulatif hebdomadaire des tendances</p>
            </div>
            <input
              type="checkbox"
              checked={notifications.emailNewsletter}
              onChange={(e) => setNotifications({ ...notifications, emailNewsletter: e.target.checked })}
              className="w-5 h-5 accent-[#7b0a0a]"
            />
          </label>
        </div>
      </section>

      {/* Danger Zone */}
      <section className="p-6 bg-red-950/20 border border-red-500/20 rounded-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-red-500/20 rounded-lg">
            <Trash2 className="w-5 h-5 text-red-400" />
          </div>
          <h2 className="text-lg font-semibold text-red-400">Zone dangereuse</h2>
        </div>

        <p className="text-neutral-400 mb-4">
          La suppression de ton compte est définitive. Toutes tes données seront perdues.
        </p>

        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="px-6 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 font-medium rounded-xl transition-colors"
          >
            Supprimer mon compte
          </button>
        ) : (
          <div className="p-4 bg-[#0d0d0d] rounded-xl space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-neutral-300">
                Pour confirmer, tape <span className="font-bold text-red-400">SUPPRIMER</span> ci-dessous :
              </p>
            </div>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="SUPPRIMER"
              className="w-full px-4 py-3 bg-[#1a1a1a] border border-red-500/30 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmText('');
                }}
                className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-medium rounded-xl transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirmText !== 'SUPPRIMER' || deleting}
                className="flex items-center gap-2 px-6 py-3 bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-colors"
              >
                {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                Supprimer définitivement
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
