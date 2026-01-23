import { Resend } from 'resend';

// Initialisation du client Resend
// Nécessite RESEND_API_KEY dans les variables d'environnement
export const resend = new Resend(process.env.RESEND_API_KEY);

// Configuration des emails
export const emailConfig = {
  // Utilise onboarding@resend.dev pour les tests (domaine vérifié par défaut)
  // Remplace par ton domaine vérifié en production (ex: noreply@citybaddies.fr)
  from: 'City Baddies <onboarding@resend.dev>',
  
  // Nom de l'application pour les emails
  appName: 'City Baddies',
};
