import { createSupabaseClient } from '@/lib/supabase';

// Helper to refresh Google access token if it is expired or close to expiry
export async function getValidGoogleAccessToken(supabaseClient: any, user: any, configElement: any) {
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
