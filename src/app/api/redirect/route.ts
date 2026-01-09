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
<html>
<head>
  <meta charset="utf-8">
  <title>Redirection...</title>
  <style>
    body {
      font-family: system-ui, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }
    .container {
      text-align: center;
    }
    .spinner {
      width: 40px;
      height: 40px;
      border: 4px solid rgba(255,255,255,0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 20px;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    a {
      color: white;
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="spinner"></div>
    <p>Redirection vers le deal...</p>
    <p><small>Si rien ne se passe, <a href="${decodedUrl}">cliquez ici</a></small></p>
  </div>
  <script>
    // Redirection après un court délai
    setTimeout(function() {
      window.location.replace("${decodedUrl}");
    }, 500);
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
