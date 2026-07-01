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
    const expiresIn = String(tokens.expires_in || '3600');

    const params = new URLSearchParams({
      google_callback: 'success',
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: expiresIn
    });

    return NextResponse.redirect(`${origin}/?${params.toString()}`);
  } catch (err: any) {
    console.error('Error in /api/calendar/callback:', err);
    const origin = new URL(request.url).origin;
    return NextResponse.redirect(`${origin}/?calendar_error=${encodeURIComponent(err.message)}`);
  }
}
