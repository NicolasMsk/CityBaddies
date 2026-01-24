import { NextRequest, NextResponse } from 'next/server';
import { resend, emailConfig } from '@/lib/email/resend';
import { getContactConfirmEmailHtml, getContactConfirmEmailText } from '@/lib/email/templates/contact-confirm';

export async function POST(request: NextRequest) {
  try {
    const { name, email, subject, message } = await request.json();

    if (!name || !email || !message) {
      return NextResponse.json(
        { error: 'Champs manquants' },
        { status: 400 }
      );
    }

    // 1. Envoi à l'admin (toi)
    const adminEmail = await resend.emails.send({
      from: emailConfig.from,
      to: 'citybaddies068@gmail.com', // Boîte mail du site
      replyTo: email, // Pour pouvoir répondre directement à l'utilisateur
      subject: `[Contact] ${subject || 'Nouveau message'}`,
      html: `
        <h2>Nouveau message de contact</h2>
        <p><strong>De:</strong> ${name} (${email})</p>
        <p><strong>Sujet:</strong> ${subject}</p>
        <hr />
        <p>${message.replace(/\n/g, '<br/>')}</p>
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
