import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'Falta el parámetro userId' }, { status: 400 });
    }

    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      return NextResponse.json(
        { error: 'NEXT_PUBLIC_GOOGLE_CLIENT_ID no configurado en el servidor.' },
        { status: 500 }
      );
    }

    const origin = new URL(request.url).origin;
    const redirectUri = `${origin}/api/calendar/callback`;

    const scopes = 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar';
    const googleAuthUrl =
      `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${clientId}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&scope=${encodeURIComponent(scopes)}` +
      `&access_type=offline` +
      `&prompt=consent` +
      `&state=${userId}`;

    return NextResponse.redirect(googleAuthUrl);
  } catch (err: any) {
    console.error('Error in /api/calendar/auth:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
