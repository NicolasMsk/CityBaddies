interface ContactConfirmEmailProps {
  name: string;
  message: string;
}

export function getContactConfirmEmailHtml({ name, message }: ContactConfirmEmailProps): string {
  // Design System Colors
  const colors = {
    bg: '#000000',
    card: '#0a0a0a',
    border: '#1a1a1a',
    gold: '#d4a855',
    text: '#ffffff',
    textMuted: '#666666',
  };

  // Convert newlines to breaks for HTML
  const formattedMessage = message.replace(/\n/g, '<br/>');

  return `
<!DOCTYPE html>
<html lang="fr" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Message Reçu | City Baddies</title>
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
  <!-- Preheader Text -->
  <div style="display: none; max-height: 0; overflow: hidden; font-size: 1px; line-height: 1px; color: #000000;">
    ${name}, nous avons bien reçu ton message. L'équipe City Baddies te répondra sous 24-48h.
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
                Support
              </h1>
              <h2 style="margin: 0 0 30px; font-size: 32px; font-weight: 100; color: ${colors.text}; text-transform: uppercase; letter-spacing: 2px; line-height: 1.1;">
                Message Reçu
              </h2>
              
              <div style="width: 50px; height: 1px; background-color: ${colors.gold}; margin: 0 auto 30px; opacity: 0.4;"></div>

              <p style="margin: 0 0 30px; font-size: 15px; line-height: 1.9; color: #909090; font-weight: 300;">
                Bonjour ${name},<br>
                Nous avons bien reçu ton message et nous t'en remercions.<br>
                Notre équipe va te répondre sous <span style="color: white; font-weight: 400;">24h-48h</span>.
              </p>
              
              <!-- Recap Message -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #0d0d0d; border-radius: 4px; border-left: 2px solid ${colors.gold};">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0; font-size: 10px; font-weight: 700; color: ${colors.gold}; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 10px;">
                      Ta demande :
                    </p>
                    <p style="margin: 0; font-size: 14px; line-height: 1.7; color: #bbbbbb; font-style: italic;">
                      "${formattedMessage}"
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #050505; text-align: center; border-top: 1px solid ${colors.border};">
              
              <p style="margin: 0 0 15px; font-size: 12px; color: ${colors.text}; letter-spacing: 2px; text-transform: uppercase; font-weight: 600;">
                CITY BADDIES - SUPPORT
              </p>
              
              <p style="margin: 0 0 20px; font-size: 10px; color: #404040; line-height: 1.6;">
                Ceci est un message automatique, merci de ne pas y répondre directement.<br>
                En attendant, n'hésite pas à consulter nos derniers deals.
              </p>
              
              <!-- Social Links (Optional) -->
              <!--
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                <tr>
                  <td style="padding: 0 10px;">
                    <a href="#" style="color: #666666; font-size: 12px; text-decoration: none;">Instagram</a>
                  </td>
                </tr>
              </table>
              -->
              
              <div style="margin-top: 20px; font-size: 9px; color: #333333;">
                City Baddies &copy; ${new Date().getFullYear()}
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

export function getContactConfirmEmailText({ name, message }: ContactConfirmEmailProps): string {
  return `
CITY BADDIES - SUPPORT

Bonjour ${name},

Nous avons bien reçu ton message et nous t'en remercions.
Notre équipe va te répondre sous 24h-48h.

Récapitulatif de ta demande :
"${message}"

À très vite,
L'équipe City Baddies
  `;
}
