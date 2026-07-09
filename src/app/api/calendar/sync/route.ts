import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/lib/supabase';
import { getValidGoogleAccessToken } from '../helper';

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

    const googleCalendar = configElement.datos?.googleCalendar || {};
    const targetCalendarId = googleCalendar.writeCalendarId || 'primary';

    // Fetch all local agenda items for the user (type 'evento' in Supabase elements table)
    const { data: agendaItems, error: agendaError } = await supabaseClient
      .from('elementos')
      .select('*')
      .eq('user_id', user.id)
      .eq('tipo', 'evento');

    if (agendaError) {
      console.error('Error fetching local agenda items:', agendaError);
      return NextResponse.json({ error: `Error al consultar la agenda local: ${agendaError.message}` }, { status: 500 });
    }

    // Filter items that don't have googleEventId, have eventDate, and do NOT belong to 'estela' door
    const itemsToSync = (agendaItems || []).filter((item: any) => {
      const datos = item.datos || {};
      const isEstela = datos.year !== undefined || datos.dateStr !== undefined || datos.lugar !== undefined;
      return !isEstela && !datos.googleEventId && datos.eventDate;
    });

    let syncedCount = 0;
    const failures = [];

    for (const item of itemsToSync) {
      try {
        const itemDatos = item.datos || {};
        const date = itemDatos.eventDate;
        const time = itemDatos.eventTime;
        const summary = item.titulo;
        const description = item.contenido || 'Sincronizado desde Kyma';

        let start: any = {};
        let end: any = {};

        if (time) {
          const tz = 'Europe/Madrid';
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

        const recurrencia = itemDatos.recurrencia;
        let recurrence: string[] | undefined = undefined;

        if (recurrencia && recurrencia !== 'none') {
          if (recurrencia === 'semanal') {
            recurrence = ['RRULE:FREQ=WEEKLY'];
          } else if (recurrencia === 'mensual') {
            recurrence = ['RRULE:FREQ=MONTHLY'];
          } else if (recurrencia === 'anual') {
            recurrence = ['RRULE:FREQ=YEARLY'];
          }
        }

        const eventPayload = {
          summary,
          description,
          start,
          end,
          ...(recurrence ? { recurrence } : {})
        };

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
          console.error(`Failed to sync event "${summary}" to Google Calendar:`, errBody);
          failures.push({ title: summary, error: errBody });
          continue;
        }

        const createdEvent = await createRes.json();
        
        // Save googleEventId back to Supabase
        const updatedDatos = {
          ...itemDatos,
          googleEventId: createdEvent.id
        };

        const { error: updateError } = await supabaseClient
          .from('elementos')
          .update({ datos: updatedDatos, updated_at: new Date().toISOString() })
          .eq('id', item.id);

        if (updateError) {
          console.error(`Failed to update item "${summary}" with googleEventId in Supabase:`, updateError);
        } else {
          syncedCount++;
        }
      } catch (err: any) {
        console.error(`Exception syncing item "${item.titulo}":`, err);
        failures.push({ title: item.titulo, error: err.message });
      }
    }

    return NextResponse.json({
      success: true,
      syncedCount,
      totalToSync: itemsToSync.length,
      failures
    });
  } catch (err: any) {
    console.error('Error in POST /api/calendar/sync:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
