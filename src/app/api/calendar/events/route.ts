import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase';
import { getValidGoogleAccessToken } from '../helper';

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

    // Get dates range
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

    // Get selected calendars from user configuration (default to 'primary' if empty)
    const googleCalendar = configElement.datos?.googleCalendar || {};
    const writeCalendarId = googleCalendar.writeCalendarId;
    const selectedCalendars: string[] = googleCalendar.selectedCalendars || [];
    
    // Exclude the dedicated write calendar from query to prevent duplicates
    let calendarsToQuery = selectedCalendars.filter(id => id !== writeCalendarId);
    if (calendarsToQuery.length === 0) {
      calendarsToQuery = ['primary'];
    }

    // Fetch events from all selected calendars in parallel
    const allEventsPromises = calendarsToQuery.map(async (calendarId) => {
      try {
        const googleCalendarUrl =
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?` +
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
          console.error(`Google Calendar API error for calendar ${calendarId}:`, await eventsRes.text());
          return [];
        }

        const eventsData = await eventsRes.json();
        return (eventsData.items || []).map((item: any) => ({
          ...item,
          googleCalendarId: calendarId // Keep track of which calendar it came from
        }));
      } catch (e) {
        console.error(`Exception fetching events for calendar ${calendarId}:`, e);
        return [];
      }
    });

    const results = await Promise.all(allEventsPromises);
    
    // Flatten and deduplicate events by ID
    const flattenedEvents = results.flat();
    const uniqueEventsMap = new Map<string, any>();
    
    for (const event of flattenedEvents) {
      if (event.id) {
        uniqueEventsMap.set(event.id, event);
      }
    }
    
    const uniqueEvents = Array.from(uniqueEventsMap.values());

    // Sort combined events chronologically by start time
    uniqueEvents.sort((a, b) => {
      const startA = a.start?.dateTime || a.start?.date || '';
      const startB = b.start?.dateTime || b.start?.date || '';
      return startA.localeCompare(startB);
    });

    return NextResponse.json({
      connected: true,
      events: uniqueEvents
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

    const { summary, description, date, time, timeZone } = await request.json();

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
      const tz = timeZone || 'Europe/Madrid';
      start = {
        dateTime: `${date}T${time}:00`,
        timeZone: tz
      };

      const [hours, minutes] = time.split(':').map(Number);
      let endHours = hours + 1;
      if (endHours >= 24) {
        endHours = endHours - 24;
      }
      end = {
        dateTime: `${date}T${String(endHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`,
        timeZone: tz
      };
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

    const googleCalendar = configElement.datos?.googleCalendar || {};
    const targetCalendarId = googleCalendar.writeCalendarId || (googleCalendar.selectedCalendars?.length > 0 ? googleCalendar.selectedCalendars[0] : 'primary');

    const createEventUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(targetCalendarId)}/events`;
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

export async function DELETE(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const eventId = searchParams.get('eventId');
    let calendarId = searchParams.get('calendarId') || 'primary';

    if (!eventId) {
      return NextResponse.json({ error: 'Falta el parámetro eventId' }, { status: 400 });
    }

    const supabaseToken = authHeader.replace('Bearer ', '');
    const supabaseClient = createSupabaseClient(supabaseToken);

    // Get authenticating user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
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
    const googleCalendar = configElement.datos?.googleCalendar || {};
    if (!calendarId || calendarId === 'primary') {
      calendarId = googleCalendar.writeCalendarId || (googleCalendar.selectedCalendars?.length > 0 ? googleCalendar.selectedCalendars[0] : 'primary');
    }

    const googleToken = await getValidGoogleAccessToken(supabaseClient, user, configElement);

    if (!googleToken) {
      return NextResponse.json({ error: 'Google Calendar no conectado o credenciales inválidas' }, { status: 400 });
    }

    const deleteUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`;
    const deleteRes = await fetch(deleteUrl, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${googleToken}`
      }
    });

    if (!deleteRes.ok && deleteRes.status !== 404) {
      const errText = await deleteRes.text();
      console.error('Google Calendar Event Delete error:', errText);
      return NextResponse.json(
        { error: 'Error al borrar el evento en Google Calendar' },
        { status: deleteRes.status }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error in DELETE /api/calendar/events:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { eventId, calendarId, summary, description, date, time, timeZone } = await request.json();

    if (!eventId) {
      return NextResponse.json({ error: 'Falta el parámetro eventId' }, { status: 400 });
    }

    const supabaseToken = authHeader.replace('Bearer ', '');
    const supabaseClient = createSupabaseClient(supabaseToken);

    // Get authenticating user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
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
    const googleCalendar = configElement.datos?.googleCalendar || {};
    const targetCalendarId = calendarId || googleCalendar.writeCalendarId || 'primary';

    const googleToken = await getValidGoogleAccessToken(supabaseClient, user, configElement);

    if (!googleToken) {
      return NextResponse.json({ error: 'Google Calendar no conectado o credenciales inválidas' }, { status: 400 });
    }

    // Format times
    let start: any = {};
    let end: any = {};

    if (time) {
      const tz = timeZone || 'Europe/Madrid';
      start = {
        dateTime: `${date}T${time}:00`,
        timeZone: tz
      };

      const [hours, minutes] = time.split(':').map(Number);
      let endHours = hours + 1;
      if (endHours >= 24) {
        endHours = endHours - 24;
      }
      end = {
        dateTime: `${date}T${String(endHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`,
        timeZone: tz
      };
    } else {
      start = { date };
      end = { date };
    }

    const updateUrl = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(targetCalendarId)}/events/${encodeURIComponent(eventId)}`;
    const updateRes = await fetch(updateUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${googleToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        summary,
        description: description || 'Actualizado desde Kyma',
        start,
        end
      })
    });

    if (!updateRes.ok) {
      const errText = await updateRes.text();
      console.error('Google Calendar Event Update error:', errText);
      return NextResponse.json(
        { error: 'Error al actualizar el evento en Google Calendar' },
        { status: updateRes.status }
      );
    }

    const updatedEvent = await updateRes.json();
    return NextResponse.json({ success: true, event: updatedEvent });
  } catch (err: any) {
    console.error('Error in PUT /api/calendar/events:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
