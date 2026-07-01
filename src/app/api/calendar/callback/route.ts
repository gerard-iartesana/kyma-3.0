import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const userId = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      console.error('Google OAuth error param:', error);
      return NextResponse.redirect(new URL('/?calendar_error=auth_failed', request.url));
    }

    if (!code || !userId) {
      return NextResponse.json({ error: 'Faltan parámetros de callback' }, { status: 400 });
    }

    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.error('Google OAuth credentials not configured in env variables');
      return NextResponse.redirect(new URL('/?calendar_error=missing_credentials', request.url));
    }

    const origin = new URL(request.url).origin;
    const redirectUri = `${origin}/api/calendar/callback`;

    // Intercambiar código por tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokens = await tokenResponse.json();

    if (tokens.error) {
      console.error('Error al intercambiar el código:', tokens);
      return NextResponse.redirect(new URL('/?calendar_error=token_exchange_failed', request.url));
    }

    const accessToken = tokens.access_token;
    const refreshToken = tokens.refresh_token || '';
    const tokenExpiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Sincronizando Google Calendar...</title>
        <style>
          body {
            background-color: #08080a;
            color: #ffffff;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            text-align: center;
          }
          .spinner {
            width: 40px;
            height: 40px;
            border: 3px solid rgba(255,255,255,0.1);
            border-top-color: #a855f7;
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
            margin: 0 auto 16px auto;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        </style>
      </head>
      <body>
        <div>
          <div class="spinner"></div>
          <p>Conectando con Google Calendar...</p>
        </div>
        <script>
          try {
            const data = {
              accessToken: "${accessToken}",
              refreshToken: "${refreshToken}",
              tokenExpiry: "${tokenExpiry}",
              connected: true
            };
            localStorage.setItem('kyma_temp_google_calendar', JSON.stringify(data));
            window.location.href = "/?calendar_sync=success";
          } catch (e) {
            console.error("Error storing calendar data in localStorage:", e);
            window.location.href = "/?calendar_error=local_storage_failed";
          }
        </script>
      </body>
      </html>
    `;

    return new Response(htmlContent, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (err: any) {
    console.error('Error in /api/calendar/callback:', err);
    return NextResponse.redirect(new URL(`/?calendar_error=${encodeURIComponent(err.message)}`, request.url));
  }
}
