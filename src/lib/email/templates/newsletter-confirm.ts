interface NewsletterConfirmEmailProps {
  email: string;
}

export function getNewsletterConfirmEmailHtml({ email }: NewsletterConfirmEmailProps): string {
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
  <title>Bienvenue dans la Newsletter</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${colors.bg}; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <!-- Preheader -->
  <div style="display: none; max-height: 0; overflow: hidden; font-size: 1px; line-height: 1px; color: #000000;">
    Tu es maintenant inscrit(e) à notre newsletter. Les meilleurs deals beauté arrivent directement dans ta boîte mail.
  </div>
  
  <!-- Main Container -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: ${colors.bg}; padding: 60px 20px;">
    <tr>
      <td align="center">
        <!-- Card -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 520px; background-color: ${colors.card}; border: 1px solid ${colors.border};">
          
          <!-- Top Border Accent -->
          <tr>
            <td style="height: 3px; background: linear-gradient(90deg, ${colors.gold}, #f0d48a, ${colors.gold});"></td>
          </tr>

          <!-- Header -->
          <tr>
            <td style="padding: 50px 40px 20px; text-align: center;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                <tr>
                  <td style="font-size: 11px; font-weight: 800; letter-spacing: 4px; color: ${colors.gold}; text-transform: uppercase; border: 1px solid rgba(212, 168, 85, 0.3); padding: 10px 20px; border-radius: 100px;">
                    Newsletter
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Main Message -->
          <tr>
            <td style="padding: 20px 40px 40px; text-align: center;">
              <h1 style="margin: 0 0 10px; font-size: 11px; font-weight: 600; color: ${colors.gold}; text-transform: uppercase; letter-spacing: 3px;">
                Inscription confirm&eacute;e
              </h1>
              <h2 style="margin: 0 0 30px; font-size: 32px; font-weight: 100; color: ${colors.text}; text-transform: uppercase; letter-spacing: 2px; line-height: 1.2;">
                Tu es dans<br>la liste
              </h2>
              
              <div style="width: 50px; height: 1px; background-color: ${colors.gold}; margin: 0 auto 30px; opacity: 0.4;"></div>

              <p style="margin: 0 0 30px; font-size: 15px; line-height: 1.9; color: #909090; font-weight: 300;">
                Merci de t'&ecirc;tre inscrit(e) &agrave; notre newsletter.<br>
                Tu recevras chaque semaine notre s&eacute;lection des meilleurs deals beaut&eacute;.
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

          <!-- What to expect -->
          <tr>
            <td style="padding: 35px 40px; background-color: #080808; border-top: 1px solid ${colors.border};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom: 20px;">
                    <span style="font-size: 10px; color: ${colors.textMuted}; text-transform: uppercase; letter-spacing: 3px;">&Agrave; quoi t'attendre</span>
                  </td>
                </tr>
                <tr>
                  <td style="text-align: center;">
                    <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                      <tr>
                        <td style="padding: 8px 0; color: #888888; font-size: 13px; font-weight: 300;">
                          <span style="color: ${colors.gold}; margin-right: 10px;">&#10003;</span> Les meilleurs deals de la semaine
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #888888; font-size: 13px; font-weight: 300;">
                          <span style="color: ${colors.gold}; margin-right: 10px;">&#10003;</span> Alertes promotions flash
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; color: #888888; font-size: 13px; font-weight: 300;">
                          <span style="color: ${colors.gold}; margin-right: 10px;">&#10003;</span> Ventes priv&eacute;es exclusives
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
                Tu re&ccedil;ois cet email car tu t'es inscrit(e) &agrave; notre newsletter.<br>
                <a href="https://beautydeals.fr/unsubscribe?email=${encodeURIComponent(email)}" style="color: #555555; text-decoration: underline;">Se d&eacute;sinscrire</a>
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

export function getNewsletterConfirmEmailText({ email }: NewsletterConfirmEmailProps): string {
  return `
CITY BADDIES - NEWSLETTER

━━━━━━━━━━━━━━━━━━━━━━━━

INSCRIPTION CONFIRMÉE

Tu es dans la liste !

Merci de t'être inscrit(e) à notre newsletter.
Tu recevras chaque semaine notre sélection des meilleurs deals beauté.

→ VOIR LES DEALS : https://beautydeals.fr/deals

━━━━━━━━━━━━━━━━━━━━━━━━

À QUOI T'ATTENDRE

✓ Les meilleurs deals de la semaine
✓ Alertes promotions flash
✓ Ventes privées exclusives

━━━━━━━━━━━━━━━━━━━━━━━━

City Baddies © ${new Date().getFullYear()}

Se désinscrire : https://beautydeals.fr/unsubscribe?email=${encodeURIComponent(email)}
  `.trim();
}
