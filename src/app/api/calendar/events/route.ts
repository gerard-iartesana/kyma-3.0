import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase';

// Helper to refresh Google access token if it is expired or close to expiry
async function getValidGoogleAccessToken(supabaseClient: any, user: any, configElement: any) {
  const datos = configElement.datos || {};
  const googleCalendar = datos.googleCalendar;

  if (!googleCalendar || !googleCalendar.connected || !googleCalendar.refreshToken) {
    return null;
  }

  const expiry = new Date(googleCalendar.tokenExpiry);
  const now = new Date();

  // If token expires in less than 2 minutes, refresh it
  if (expiry.getTime() - now.getTime() < 120 * 1000) {
    console.log('Google access token expired or close to expiry. Refreshing...');
    try {
      const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        console.error('Google OAuth client credentials missing in env variables');
        return null;
      }

      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: googleCalendar.refreshToken,
          grant_type: 'refresh_token',
        }),
      });

      const refreshTokens = await response.json();

      if (refreshTokens.error) {
        console.error('Error refreshing Google token:', refreshTokens);
        return null;
      }

      // Update access token and expiry
      googleCalendar.accessToken = refreshTokens.access_token;
      googleCalendar.tokenExpiry = new Date(Date.now() + refreshTokens.expires_in * 1000).toISOString();

      if (refreshTokens.refresh_token) {
        googleCalendar.refreshToken = refreshTokens.refresh_token;
      }

      datos.googleCalendar = googleCalendar;

      // Update user config element in Supabase
      const { error: updateError } = await supabaseClient
        .from('elementos')
        .update({
          datos,
          updated_at: new Date().toISOString()
        })
        .eq('id', configElement.id);

      if (updateError) {
        console.error('Failed to save refreshed Google tokens to Supabase:', updateError);
      } else {
        console.log('Google access token refreshed and saved successfully.');
      }
    } catch (err) {
      console.error('Exception refreshing Google token:', err);
      return null;
    }
  }

  return googleCalendar.accessToken;
}

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const supabaseToken = authHeader.replace('Bearer ', '');
    const supabaseClient = createSupabaseClient(supabaseToken);

    // Get authenticating user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'No autorizado o token de Supabase inválido' }, { status: 401 });
    }

    // Get user configuration
    const { data: configData, error: configError } = await supabaseClient
      .from('elementos')
      .select('*')
      .eq('user_id', user.id)
      .eq('tipo', 'nota')
      .eq('titulo', 'kyma_system_user_configuration');

    if (configError || !configData || configData.length === 0) {
      return NextResponse.json({ connected: false, message: 'Google Calendar no conectado' });
    }

    const configElement = configData[0];
    const googleToken = await getValidGoogleAccessToken(supabaseClient, user, configElement);

    if (!googleToken) {
      return NextResponse.json({ connected: false, message: 'Google Calendar no conectado o token inválido' });
    }

    const { searchParams } = new URL(request.url);
    const paramTimeMin = searchParams.get('timeMin');
    const paramTimeMax = searchParams.get('timeMax');

    let timeMin = new Date();
    if (paramTimeMin) {
      timeMin = new Date(paramTimeMin);
    } else {
      timeMin.setHours(0, 0, 0, 0); // Start of today
    }

    let timeMax = new Date(timeMin.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days later by default
    if (paramTimeMax) {
      timeMax = new Date(paramTimeMax);
    }

    const googleCalendarUrl =
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
      `timeMin=${encodeURIComponent(timeMin.toISOString())}` +
      `&timeMax=${encodeURIComponent(timeMax.toISOString())}` +
      `&singleEvents=true` +
      `&orderBy=startTime`;

    const eventsRes = await fetch(googleCalendarUrl, {
      headers: {
        Authorization: `Bearer ${googleToken}`
      }
    });

    if (!eventsRes.ok) {
      const errBody = await eventsRes.text();
      console.error('Google Calendar API error response:', errBody);
      return NextResponse.json({ error: 'Error al consultar Google Calendar' }, { status: eventsRes.status });
    }

    const eventsData = await eventsRes.json();
    return NextResponse.json({
      connected: true,
      events: eventsData.items || []
    });
  } catch (err: any) {
    console.error('Error in GET /api/calendar/events:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const supabaseToken = authHeader.replace('Bearer ', '');
    const supabaseClient = createSupabaseClient(supabaseToken);

    // Get authenticating user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'No autorizado o token de Supabase inválido' }, { status: 401 });
    }

    const { summary, description, date, time } = await request.json();

    if (!summary || !date) {
      return NextResponse.json({ error: 'Faltan campos obligatorios: summary o date' }, { status: 400 });
    }

    // Get user configuration
    const { data: configData, error: configError } = await supabaseClient
      .from('elementos')
      .select('*')
      .eq('user_id', user.id)
      .eq('tipo', 'nota')
      .eq('titulo', 'kyma_system_user_configuration');

    if (configError || !configData || configData.length === 0) {
      return NextResponse.json(
        { error: 'Google Calendar no conectado (configuración no encontrada)' },
        { status: 400 }
      );
    }

    const configElement = configData[0];
    const googleToken = await getValidGoogleAccessToken(supabaseClient, user, configElement);

    if (!googleToken) {
      return NextResponse.json({ error: 'Google Calendar no conectado o credenciales inválidas' }, { status: 400 });
    }

    // Format times
    let start: any = {};
    let end: any = {};

    if (time) {
      const startDateTimeStr = `${date}T${time}:00`;
      const startObj = new Date(startDateTimeStr);

      if (isNaN(startObj.getTime())) {
        start = { dateTime: `${startDateTimeStr}Z` };
        end = { dateTime: `${date}T${String(parseInt(time.split(':')[0]) + 1).padStart(2, '0')}:${time.split(':')[1]}:00Z` };
      } else {
        const endObj = new Date(startObj.getTime() + 60 * 60 * 1000); // 1 hour duration
        start = { dateTime: startObj.toISOString() };
        end = { dateTime: endObj.toISOString() };
      }
    } else {
      start = { date };
      end = { date }; // All day event
    }

    const eventPayload = {
      summary,
      description: description || 'Creado desde Kyma',
      start,
      end
    };

    const createEventUrl = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
    const createRes = await fetch(createEventUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${googleToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(eventPayload)
    });

    if (!createRes.ok) {
      const errBody = await createRes.text();
      console.error('Google Calendar Event Creation error response:', errBody);
      return NextResponse.json(
        { error: 'Error al crear evento en Google Calendar' },
        { status: createRes.status }
      );
    }

    const createdEvent = await createRes.json();
    return NextResponse.json({
      success: true,
      event: createdEvent
    });
  } catch (err: any) {
    console.error('Error in POST /api/calendar/events:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
