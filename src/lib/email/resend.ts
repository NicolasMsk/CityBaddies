import { Resend } from 'resend';

// Initialisation du client Resend (lazy pour éviter erreur au build)
// Nécessite RESEND_API_KEY dans les variables d'environnement
const getResendClient = () => {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not defined');
  }
  return new Resend(apiKey);
};

// Export lazy - le client est créé uniquement quand utilisé
export const resend = {
  emails: {
    send: async (...args: Parameters<Resend['emails']['send']>) => {
      const client = getResendClient();
      return client.emails.send(...args);
    },
  },
};

// Configuration des emails
export const emailConfig = {
  // Email pour les notifications automatiques (inscription, newsletter, etc.)
  from: 'City Baddies <noreply@citybaddies.com>',
  
  // Nom de l'application pour les emails
  appName: 'City Baddies',
};
