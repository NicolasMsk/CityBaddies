'use client';

import { useState } from 'react';
import { Mail, MessageSquare, Send, CheckCircle } from 'lucide-react';

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Implémenter l'envoi du formulaire
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="bg-[#1a1a1a] rounded-2xl border border-white/10 p-12 text-center">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-4">Message envoyé !</h1>
          <p className="text-white/60 mb-8">
            Merci de nous avoir contacté. Nous vous répondrons dans les plus brefs délais.
          </p>
          <button
            onClick={() => setSubmitted(false)}
            className="px-6 py-3 bg-[#7b0a0a] hover:bg-[#9b1a1a] text-white font-medium rounded-xl transition-colors"
          >
            Envoyer un autre message
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-white mb-4">Contactez-nous</h1>
        <p className="text-white/60">
          Une question, une suggestion ? N&apos;hésitez pas à nous écrire.
        </p>
      </div>

      {/* Contact Info */}
      <div className="grid sm:grid-cols-2 gap-4 mb-8">
        <div className="bg-[#1a1a1a] rounded-xl border border-white/10 p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-[#7b0a0a]/20 rounded-full flex items-center justify-center">
            <Mail className="w-5 h-5 text-[#ff6b6b]" />
          </div>
          <div>
            <p className="text-white/40 text-xs">Email</p>
            <p className="text-white text-sm">contact@citybaddies.com</p>
          </div>
        </div>
        <div className="bg-[#1a1a1a] rounded-xl border border-white/10 p-4 flex items-center gap-4">
          <div className="w-10 h-10 bg-[#7b0a0a]/20 rounded-full flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-[#ff6b6b]" />
          </div>
          <div>
            <p className="text-white/40 text-xs">Réponse</p>
            <p className="text-white text-sm">Sous 24-48h</p>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-[#1a1a1a] rounded-2xl border border-white/10 p-8">
        <div className="space-y-6">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-white/60 mb-2">
                Nom
              </label>
              <input
                type="text"
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full px-4 py-3 bg-[#0f0f0f] border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-[#7b0a0a]"
                placeholder="Votre nom"
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-white/60 mb-2">
                Email
              </label>
              <input
                type="email"
                id="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                className="w-full px-4 py-3 bg-[#0f0f0f] border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-[#7b0a0a]"
                placeholder="votre@email.com"
              />
            </div>
          </div>

          <div>
            <label htmlFor="subject" className="block text-sm font-medium text-white/60 mb-2">
              Sujet
            </label>
            <input
              type="text"
              id="subject"
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              required
              className="w-full px-4 py-3 bg-[#0f0f0f] border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-[#7b0a0a]"
              placeholder="Objet de votre message"
            />
          </div>

          <div>
            <label htmlFor="message" className="block text-sm font-medium text-white/60 mb-2">
              Message
            </label>
            <textarea
              id="message"
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              required
              rows={5}
              className="w-full px-4 py-3 bg-[#0f0f0f] border border-white/10 rounded-xl text-white placeholder-white/30 focus:outline-none focus:border-[#7b0a0a] resize-none"
              placeholder="Votre message..."
            />
          </div>

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-[#7b0a0a] hover:bg-[#9b1a1a] text-white font-semibold rounded-xl transition-colors"
          >
            <Send className="w-5 h-5" />
            Envoyer le message
          </button>
        </div>
      </form>
    </div>
  );
}
