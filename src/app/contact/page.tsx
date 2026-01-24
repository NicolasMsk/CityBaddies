'use client';

import { useState } from 'react';
import { Mail, MessageSquare, Send, CheckCircle, Loader2 } from 'lucide-react';

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setSubmitted(true);
      } else {
        alert("Une erreur est survenue lors de l'envoi du message.");
      }
    } catch {
      alert("Erreur de connexion.");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden py-12">
        {/* Background Effects */}
        <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_0%,_#1a1a1a_0%,_#0a0a0a_80%)] z-0 pointer-events-none" />
        <div className="fixed top-[-10%] left-[-10%] w-[40vw] h-[40vw] bg-[#9b1515] opacity-[0.06] blur-[100px] rounded-full pointer-events-none z-0" />
        <div className="fixed bottom-[10%] right-[-5%] w-[30vw] h-[30vw] bg-[#d4a855] opacity-[0.04] blur-[120px] rounded-full pointer-events-none z-0" />

        <div className="max-w-md w-full relative z-10">
          <div className="bg-[#0a0a0a] border border-white/5 p-12 text-center shadow-2xl">
            <CheckCircle className="w-12 h-12 text-[#d4a855] mx-auto mb-8 animate-fade-in" />
            <h1 className="text-2xl font-light uppercase tracking-widest text-white mb-4">Message envoyé !</h1>
            <p className="text-neutral-500 font-light mb-10 text-sm leading-relaxed">
              Merci de nous avoir contacté, {formData.name}.<br />
              Nous avons bien reçu ton message et nous te répondrons sous 24-48h à <span className="text-white">{formData.email}</span>.
            </p>
            <button
              onClick={() => {
                setSubmitted(false);
                setFormData({ ...formData, message: '', subject: '' });
              }}
              className="w-full py-4 bg-[#d4a855] hover:bg-white text-black font-bold rounded-lg transition-all duration-300 transform hover:scale-[1.02] text-xs tracking-[0.2em] uppercase"
            >
              Envoyer un autre message
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background Effects */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_0%,_#1a1a1a_0%,_#0a0a0a_80%)] z-0 pointer-events-none" />
      <div className="fixed top-[-10%] left-[-10%] w-[40vw] h-[40vw] bg-[#9b1515] opacity-[0.06] blur-[100px] rounded-full pointer-events-none z-0" />
      <div className="fixed bottom-[10%] right-[-5%] w-[30vw] h-[30vw] bg-[#d4a855] opacity-[0.04] blur-[120px] rounded-full pointer-events-none z-0" />

      <div className="max-w-2xl mx-auto px-4 py-16 relative z-10">
        {/* Header */}
        <div className="text-center mb-16">
          <span className="text-xs font-bold tracking-[0.3em] text-[#d4a855] uppercase border border-[#d4a855]/30 px-3 py-1 rounded-full mb-6 inline-block">
            Support
          </span>
          <h1 className="text-4xl md:text-5xl font-thin text-white mb-4 uppercase tracking-tight">
            Contactez-nous
          </h1>
          <p className="text-neutral-500 font-light max-w-lg mx-auto">
            Une question, une suggestion ou juste un mot doux ? N&apos;hésite pas à nous écrire.
          </p>
        </div>

        {/* Contact Info */}
        <div className="grid sm:grid-cols-2 gap-4 mb-12">
          {/* Email Card - Minimalist */}
          <div className="bg-[#0a0a0a] border border-white/5 p-8 flex flex-col items-center text-center group hover:border-[#d4a855]/30 transition-all duration-500 hover:bg-white/[0.02]">
            <Mail className="w-5 h-5 text-neutral-500 mb-4 group-hover:text-[#d4a855] transition-colors duration-500" />
            <p className="text-[#d4a855] text-[10px] uppercase tracking-[0.2em] font-bold mb-2">Email</p>
            <p className="text-white text-sm font-light tracking-wide select-all">contact@citybaddies.com</p>
          </div>

          {/* Response Time Card - Minimalist */}
          <div className="bg-[#0a0a0a] border border-white/5 p-8 flex flex-col items-center text-center group hover:border-[#d4a855]/30 transition-all duration-500 hover:bg-white/[0.02]">
            <MessageSquare className="w-5 h-5 text-neutral-500 mb-4 group-hover:text-[#d4a855] transition-colors duration-500" />
            <p className="text-[#d4a855] text-[10px] uppercase tracking-[0.2em] font-bold mb-2">Réponse</p>
            <p className="text-white text-sm font-light tracking-wide">Sous 24-48h</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-[#0a0a0a]/50 backdrop-blur-md border border-white/5 rounded-2xl p-8 sm:p-10 shadow-2xl">
          <div className="space-y-6">
            <div className="grid sm:grid-cols-2 gap-6">
              <div className="space-y-1">
                <label htmlFor="name" className="text-[10px] uppercase font-bold tracking-widest text-neutral-500 ml-1">
                  Nom
                </label>
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-lg py-3.5 px-4 text-sm text-white focus:outline-none focus:border-[#d4a855]/50 focus:bg-white/10 transition-all placeholder:text-neutral-600"
                  placeholder="Ton nom"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="email" className="text-[10px] uppercase font-bold tracking-widest text-neutral-500 ml-1">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-lg py-3.5 px-4 text-sm text-white focus:outline-none focus:border-[#d4a855]/50 focus:bg-white/10 transition-all placeholder:text-neutral-600"
                  placeholder="exemple@email.com"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="subject" className="text-[10px] uppercase font-bold tracking-widest text-neutral-500 ml-1">
                Sujet
              </label>
              <input
                type="text"
                id="subject"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                required
                className="w-full bg-white/5 border border-white/10 rounded-lg py-3.5 px-4 text-sm text-white focus:outline-none focus:border-[#d4a855]/50 focus:bg-white/10 transition-all placeholder:text-neutral-600"
                placeholder="Le sujet de ton message"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="message" className="text-[10px] uppercase font-bold tracking-widest text-neutral-500 ml-1">
                Message
              </label>
              <textarea
                id="message"
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                required
                rows={6}
                className="w-full bg-white/5 border border-white/10 rounded-lg py-3.5 px-4 text-sm text-white focus:outline-none focus:border-[#d4a855]/50 focus:bg-white/10 transition-all placeholder:text-neutral-600 resize-none"
                placeholder="Raconte-nous tout..."
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#d4a855] hover:bg-white text-black font-bold py-4 rounded-lg transition-all duration-300 transform hover:scale-[1.02] flex items-center justify-center gap-2 text-xs tracking-[0.2em] uppercase disabled:opacity-50 disabled:hover:scale-100 disabled:hover:bg-[#d4a855] mt-8"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Envoyer le message
                  <Send className="w-3 h-3 ml-1" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
