interface WelcomeEmailProps {
  username: string;
  email: string;
}

export function getWelcomeEmailHtml({ username }: WelcomeEmailProps): string {
  // Design System Colors
  const colors = {
    bg: '#000000',
    card: '#0a0a0a',
    border: '#1a1a1a',
    gold: '#d4a855',
    text: '#ffffff',
    textMuted: '#666666',
  };

  return `
<!DOCTYPE html>
<html lang="fr" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Bienvenue sur City Baddies</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: ${colors.bg}; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <!-- Preheader Text (invisible mais aide à éviter les spams) -->
  <div style="display: none; max-height: 0; overflow: hidden; font-size: 1px; line-height: 1px; color: #000000;">
    ${username}, ton accès au Club Privé City Baddies est confirmé. Découvre les meilleurs deals beauté réservés aux membres.
  </div>
  
  <!-- Main Container -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: ${colors.bg}; padding: 60px 20px;">
    <tr>
      <td align="center">
        <!-- Card -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px; background-color: ${colors.card}; border: 1px solid ${colors.border};">
          
          <!-- Top Border Accent (Gold) -->
          <tr>
            <td style="height: 3px; background: linear-gradient(90deg, ${colors.gold}, #f0d48a, ${colors.gold});"></td>
          </tr>

          <!-- Header / Logo -->
          <tr>
            <td style="padding: 50px 40px 20px; text-align: center;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                <tr>
                  <td style="font-size: 11px; font-weight: 800; letter-spacing: 4px; color: ${colors.gold}; text-transform: uppercase; border: 1px solid rgba(212, 168, 85, 0.3); padding: 10px 20px; border-radius: 100px;">
                    City Baddies
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Main Message -->
          <tr>
            <td style="padding: 20px 40px 40px; text-align: center;">
              <h1 style="margin: 0 0 10px; font-size: 11px; font-weight: 600; color: ${colors.gold}; text-transform: uppercase; letter-spacing: 3px;">
                Club Priv&eacute;
              </h1>
              <h2 style="margin: 0 0 30px; font-size: 36px; font-weight: 100; color: ${colors.text}; text-transform: uppercase; letter-spacing: 2px; line-height: 1.1;">
                Bienvenue<br>${username}
              </h2>
              
              <div style="width: 50px; height: 1px; background-color: ${colors.gold}; margin: 0 auto 30px; opacity: 0.4;"></div>

              <p style="margin: 0 0 30px; font-size: 15px; line-height: 1.9; color: #909090; font-weight: 300;">
                Ton inscription est confirm&eacute;e. Tu fais d&eacute;sormais partie de notre communaut&eacute; de passionn&eacute;es qui acc&egrave;dent aux meilleures offres beaut&eacute; avant tout le monde.
              </p>
              
              <!-- CTA Button -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                <tr>
                  <td style="background-color: ${colors.gold}; padding: 18px 50px;">
                    <a href="https://beautydeals.fr/deals" style="color: #000000; text-decoration: none; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 2px; display: block;">
                      Voir les deals
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Newsletter Section -->
          <tr>
            <td style="padding: 35px 40px; background-color: #080808; border-top: 1px solid ${colors.border}; border-bottom: 1px solid ${colors.border};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="text-align: center;">
                    <p style="margin: 0 0 8px; font-size: 10px; color: ${colors.gold}; text-transform: uppercase; letter-spacing: 3px; font-weight: 600;">
                      Newsletter
                    </p>
                    <p style="margin: 0; font-size: 14px; line-height: 1.7; color: #707070; font-weight: 300;">
                      Chaque semaine, re&ccedil;ois notre s&eacute;lection des meilleurs deals directement dans ta bo&icirc;te mail. Promotions flash, restocks, ventes priv&eacute;es... Tu seras toujours la premi&egrave;re inform&eacute;e.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Perks Section -->
          <tr>
            <td style="padding: 35px 40px; background-color: #0d0d0d;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom: 20px;">
                    <span style="font-size: 10px; color: ${colors.textMuted}; text-transform: uppercase; letter-spacing: 3px;">Tes avantages</span>
                  </td>
                </tr>
                <tr>
                  <td style="text-align: center;">
                    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                      <tr>
                        <td style="padding: 8px 0; color: #888888; font-size: 13px; font-weight: 300;">
                          <span style="color: ${colors.gold}; margin-right: 10px;">&#10003;</span> Deals exclusifs membres
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #888888; font-size: 13px; font-weight: 300;">
                          <span style="color: ${colors.gold}; margin-right: 10px;">&#10003;</span> Alertes restock en temps r&eacute;el
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #888888; font-size: 13px; font-weight: 300;">
                          <span style="color: ${colors.gold}; margin-right: 10px;">&#10003;</span> Sauvegarde illimit&eacute;e de favoris
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: ${colors.bg}; text-align: center; border-top: 1px solid ${colors.border};">
              <p style="margin: 0 0 15px; font-size: 10px; color: #444444; text-transform: uppercase; letter-spacing: 2px;">
                City Baddies &copy; ${new Date().getFullYear()}
              </p>
              <p style="margin: 0; font-size: 11px; color: #333333; line-height: 1.6;">
                Cet email confirme ton inscription sur beautydeals.fr<br>
                <a href="https://beautydeals.fr" style="color: ${colors.gold}; text-decoration: none;">beautydeals.fr</a>
              </p>
            </td>
          </tr>
        </table>
        
        <!-- Legal Footer (anti-spam) -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px; margin-top: 30px;">
          <tr>
            <td style="text-align: center;">
              <p style="margin: 0; font-size: 10px; color: #333333; line-height: 1.6;">
                Tu reçois cet email car tu as créé un compte sur City Baddies.<br>
                Pour toute question : contact@citybaddies.com
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

export function getWelcomeEmailText({ username }: WelcomeEmailProps): string {
  return `
CITY BADDIES - CLUB PRIVÉ

━━━━━━━━━━━━━━━━━━━━━━━━

BIENVENUE ${username.toUpperCase()}

Ton inscription est confirmée.
Tu fais désormais partie de notre communauté de passionnées 
qui accèdent aux meilleures offres beauté avant tout le monde.

→ VOIR LES DEALS : https://beautydeals.fr/deals

━━━━━━━━━━━━━━━━━━━━━━━━

NEWSLETTER

Chaque semaine, reçois notre sélection des meilleurs deals 
directement dans ta boîte mail. Promotions flash, restocks, 
ventes privées... Tu seras toujours la première informée.

━━━━━━━━━━━━━━━━━━━━━━━━

TES AVANTAGES MEMBRE

✓ Deals exclusifs membres
✓ Alertes restock en temps réel  
✓ Sauvegarde illimitée de favoris

━━━━━━━━━━━━━━━━━━━━━━━━

City Baddies © ${new Date().getFullYear()}
https://beautydeals.fr

Cet email confirme ton inscription sur beautydeals.fr
Pour toute question : contact@beautydeals.fr
  `.trim();
}