import { NextRequest, NextResponse } from 'next/server';
import { resend, emailConfig } from '@/lib/email/resend';
import { getContactConfirmEmailHtml, getContactConfirmEmailText } from '@/lib/email/templates/contact-confirm';
import { rateLimit, clientIp, tooMany } from '@/lib/rate-limit';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Échappe le HTML des champs interpolés dans l'email admin (anti-injection HTML/phishing).
const esc = (s: string) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export async function POST(request: NextRequest) {
  try {
    if (!rateLimit(`contact:${clientIp(request)}`, 3, 60_000)) return tooMany();

    const { name, email, subject, message } = await request.json();

    if (!name || !email || !message || typeof email !== 'string' || !EMAIL_RE.test(email)) {
      return NextResponse.json(
        { error: 'Champs manquants ou email invalide' },
        { status: 400 }
      );
    }
    if (String(message).length > 5000 || String(name).length > 200) {
      return NextResponse.json({ error: 'Message trop long' }, { status: 400 });
    }

    // 1. Envoi à l'admin (toi) — champs échappés avant interpolation HTML
    const adminEmail = await resend.emails.send({
      from: emailConfig.from,
      to: 'citybaddies068@gmail.com', // Boîte mail du site
      replyTo: email, // Pour pouvoir répondre directement à l'utilisateur
      subject: `[Contact] ${esc(subject || 'Nouveau message').slice(0, 120)}`,
      html: `
        <h2>Nouveau message de contact</h2>
        <p><strong>De:</strong> ${esc(name)} (${esc(email)})</p>
        <p><strong>Sujet:</strong> ${esc(subject || '')}</p>
        <hr />
        <p>${esc(message).replace(/\n/g, '<br/>')}</p>
      `,
    });

    if (adminEmail.error) {
      console.error('Erreur envoi admin:', adminEmail.error);
    }

    // 2. Accusé de réception à l'utilisateur
    const userEmail = await resend.emails.send({
      from: emailConfig.from,
      to: email,
      subject: 'Message Reçu | City Baddies',
      html: getContactConfirmEmailHtml({ name, message }),
      text: getContactConfirmEmailText({ name, message }),
    });

    if (userEmail.error) {
      console.error('Erreur envoi utilisateur:', userEmail.error);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erreur envoi contact:', error);
    return NextResponse.json(
      { error: 'Erreur lors de l\'envoi du message' },
      { status: 500 }
    );
  }
}
