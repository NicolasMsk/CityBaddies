import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resend, emailConfig } from '@/lib/email/resend';
import { getNewsletterConfirmEmailHtml, getNewsletterConfirmEmailText } from '@/lib/email/templates/newsletter-confirm';
import { rateLimit, clientIp, tooMany } from '@/lib/rate-limit';
import { clientIdFromGaCookie, sessionIdFromGaCookie, sendGa4Events } from '@/lib/analytics/ga4-server';

// Validation email raisonnable (l'ancien `includes('@')` laissait passer n'importe quoi).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(request: NextRequest) {
  try {
    // Anti-abus : chaque appel déclenche 2 envois Resend (victime + admin) et
    // écrit en base. Sans limite → mail-bombing de tiers + explosion du quota.
    if (!rateLimit(`newsletter:${clientIp(request)}`, 3, 60_000)) return tooMany();

    const { email, source = 'website' } = await request.json();

    if (!email || typeof email !== 'string' || !EMAIL_RE.test(email) || email.length > 254) {
      return NextResponse.json(
        { error: 'Email invalide' },
        { status: 400 }
      );
    }
    // `source` est fourni par le client → borné et neutralisé (interpolé dans l'email admin).
    const safeSource = String(source).replace(/[<>]/g, '').slice(0, 60);

    // Vérifier si déjà inscrit
    const existing = await prisma.newsletterSubscription.findUnique({
      where: { email: email.toLowerCase() },
    });
    let shouldTrackSignup = false;

    if (existing) {
      // Si déjà confirmé
      if (existing.isConfirmed && !existing.unsubscribedAt) {
        return NextResponse.json(
          { message: 'Tu es déjà inscrit(e) à la newsletter !' },
          { status: 200 }
        );
      }
      
      // Si désinscrit, réactiver
      if (existing.unsubscribedAt) {
        await prisma.newsletterSubscription.update({
          where: { email: email.toLowerCase() },
          data: {
            unsubscribedAt: null,
            isConfirmed: true,
            confirmedAt: new Date(),
          },
        });
        shouldTrackSignup = true;
      }
    } else {
      // Nouvelle inscription - on confirme directement (pas de double opt-in pour simplifier)
      await prisma.newsletterSubscription.create({
        data: {
          email: email.toLowerCase(),
          source: safeSource,
          isConfirmed: true,
          confirmedAt: new Date(),
        },
      });
      shouldTrackSignup = true;
    }

    // Conversion douce GA4 : aucun email ni identifiant métier n'est envoyé.
    // Comme pour les clics marchands, l'événement ne part que si `_ga` prouve
    // que la personne a accepté la mesure. Une réinscription est comptée, pas
    // un formulaire soumis par quelqu'un déjà abonné.
    if (shouldTrackSignup) {
      const clientId = clientIdFromGaCookie(request.cookies.get('_ga')?.value);
      if (clientId) {
        const suffix = (process.env.GA4_MEASUREMENT_ID ?? '').replace(/^G-/, '');
        const sessionId = sessionIdFromGaCookie(request.cookies.get(`_ga_${suffix}`)?.value);
        const sourcePath = safeSource.startsWith('/') ? safeSource : '/';
        await sendGa4Events(
          [{
            name: 'sign_up',
            params: {
              method: 'newsletter',
              page_location: `${request.nextUrl.origin}${sourcePath}`,
            },
          }],
          { clientId, sessionId }
        );
      }
    }

    // 1. Envoyer l'email de confirmation à l'utilisateur
    const { error: emailError } = await resend.emails.send({
      from: emailConfig.from,
      to: email,
      subject: 'Bienvenue dans la Newsletter City Baddies ✨',
      html: getNewsletterConfirmEmailHtml({ email }),
      text: getNewsletterConfirmEmailText({ email }),
    });

    if (emailError) {
      console.error('Erreur envoi email newsletter:', emailError);
      // On ne bloque pas l'inscription si l'email échoue
    }

    // 2. Notification admin - Nouvelle inscription
    await resend.emails.send({
      from: emailConfig.from,
      to: 'citybaddies068@gmail.com',
      subject: '🎉 Nouvelle inscription à la newsletter',
      html: `
        <h2>Nouvelle inscription à la newsletter</h2>
        <p><strong>Email :</strong> ${email}</p>
        <p><strong>Source :</strong> ${safeSource}</p>
        <p><strong>Date :</strong> ${new Date().toLocaleString('fr-FR')}</p>
      `,
    });

    return NextResponse.json({
      success: true,
      message: 'Inscription confirmée ! Tu vas recevoir un email de confirmation.',
    });
  } catch (error) {
    console.error('Erreur inscription newsletter:', error);
    return NextResponse.json(
      { error: 'Erreur lors de l\'inscription' },
      { status: 500 }
    );
  }
}
