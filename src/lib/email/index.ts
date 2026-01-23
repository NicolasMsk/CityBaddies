import { resend, emailConfig } from './resend';
import { getWelcomeEmailHtml, getWelcomeEmailText } from './templates/welcome';

interface SendWelcomeEmailParams {
  email: string;
  username: string;
}

export async function sendWelcomeEmail({ email, username }: SendWelcomeEmailParams) {
  try {
    const { data, error } = await resend.emails.send({
      from: emailConfig.from,
      to: email,
      subject: `Bienvenue sur ${emailConfig.appName}, ${username} ! 🎉`,
      html: getWelcomeEmailHtml({ email, username }),
      text: getWelcomeEmailText({ email, username }),
    });

    if (error) {
      console.error('[Email] Erreur envoi email de bienvenue:', error);
      return { success: false, error };
    }

    console.log('[Email] Email de bienvenue envoyé:', { id: data?.id, email });
    return { success: true, id: data?.id };
  } catch (error) {
    console.error('[Email] Exception lors de l\'envoi:', error);
    return { success: false, error };
  }
}

// Export pour utilisation dans d'autres parties de l'app
export { resend, emailConfig };
