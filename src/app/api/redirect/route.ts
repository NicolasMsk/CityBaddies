import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/redirect?url=...
 * Redirige vers l'URL externe avec un délai pour éviter la détection bot
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  
  if (!url) {
    return NextResponse.json({ error: 'URL manquante' }, { status: 400 });
  }

  // Décoder l'URL
  const decodedUrl = decodeURIComponent(url);
  
  // Vérifier que c'est une URL valide
  try {
    new URL(decodedUrl);
  } catch {
    return NextResponse.json({ error: 'URL invalide' }, { status: 400 });
  }

  // Retourner une page HTML qui redirige avec JavaScript (contourne Cloudflare)
  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Redirection Sécurisée - City Baddies</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --background: #0a0a0a;
      --foreground: #f5f5f5;
      --wine: #9b1515;
      --wine-dark: #7b0a0a;
    }
    
    * { box-sizing: border-box; }
    
    body {
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
      background: var(--background);
      color: var(--foreground);
      overflow: hidden;
      position: relative;
    }

    /* Grain effect to match site */
    body::before {
      content: "";
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      opacity: 0.03;
      pointer-events: none;
      z-index: 10;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3%3Ffilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
    }

    .container {
      position: relative;
      z-index: 20;
      text-align: center;
      padding: 2rem;
      max-width: 400px;
      width: 90%;
    }

    .logo {
      font-size: 1.5rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      margin-bottom: 3rem;
      color: #fff;
    }

    .logo span {
      color: var(--wine);
    }

    .loader-wrapper {
      position: relative;
      height: 2px;
      width: 100%;
      background: rgba(255,255,255,0.05);
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 2rem;
    }

    .loader-bar {
      position: absolute;
      top: 0;
      left: 0;
      height: 100%;
      width: 0;
      background: linear-gradient(90deg, var(--wine-dark), var(--wine));
      box-shadow: 0 0 15px var(--wine);
      animation: progress 0.8s ease-in-out forwards;
    }

    @keyframes progress {
      0% { width: 0; }
      100% { width: 100%; }
    }

    h1 {
      font-size: 0.9rem;
      font-weight: 500;
      color: rgba(255,255,255,0.9);
      margin: 0 0 0.5rem 0;
      letter-spacing: -0.01em;
    }

    p {
      font-size: 0.8rem;
      color: rgba(255,255,255,0.4);
      margin: 0;
    }

    a {
      color: var(--wine);
      text-decoration: none;
      font-weight: 500;
      transition: opacity 0.2s;
    }

    a:hover {
      opacity: 0.8;
    }

    .footer {
      margin-top: 4rem;
      opacity: 0;
      animation: fadeIn 0.5s ease-out 1s forwards;
    }

    @keyframes fadeIn {
      to { opacity: 1; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">CITY<span>BADDIES</span></div>
    
    <div class="loader-wrapper">
      <div class="loader-bar"></div>
    </div>

    <h1>Redirection vers l'offre...</h1>
    <p>Nous vous connectons au marchand en toute sécurité.</p>

    <div class="footer">
      <p>Si la page ne s'affiche pas, <a href="${decodedUrl}">cliquez ici</a></p>
    </div>
  </div>

  <script>
    setTimeout(function() {
      window.location.replace("${decodedUrl}");
    }, 800);
  </script>
</body>
</html>
  `;

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}
