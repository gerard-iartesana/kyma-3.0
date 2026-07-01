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

    // Fetch calendar list from Google
    const calendarListUrl = 'https://www.googleapis.com/calendar/v3/users/me/calendarList';
    const listRes = await fetch(calendarListUrl, {
      headers: {
        Authorization: `Bearer ${googleToken}`
      }
    });

    if (!listRes.ok) {
      const errBody = await listRes.text();
      console.error('Google Calendar List API error:', errBody);
      let detail = 'Error desconocido';
      try {
        const parsed = JSON.parse(errBody);
        detail = parsed.error?.message || parsed.error_description || parsed.error || errBody;
      } catch (e) {
        detail = errBody;
      }
      return NextResponse.json({ error: `Google API: ${detail}` }, { status: listRes.status });
    }

    const listData = await listRes.json();
    
    return NextResponse.json({
      connected: true,
      calendars: listData.items || []
    });
  } catch (err: any) {
    console.error('Error in GET /api/calendar/list:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
