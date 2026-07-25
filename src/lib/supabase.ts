import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase environment variables NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are missing. Supabase client initialized with placeholders.'
  );
}

// Singleton client for browser context
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder'
);

// Cache created clients to avoid instantiating thousands of clients in memory
const clientCache = new Map<string, any>();

export function createSupabaseClient(accessToken?: string) {
  // In browser context, ALWAYS return the singleton client to guarantee 100% single instance
  if (typeof window !== 'undefined') {
    return supabase;
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const cacheKey = serviceRoleKey ? `service-${serviceRoleKey}` : (accessToken ? `token-${accessToken}` : 'default');

  if (clientCache.has(cacheKey)) {
    return clientCache.get(cacheKey)!;
  }

  let client: any;

  if (serviceRoleKey && supabaseUrl) {
    client = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });
  } else if (accessToken && supabaseUrl && supabaseAnonKey) {
    client = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      },
      auth: { persistSession: false }
    });
  } else {
    client = supabase;
  }

  if (cacheKey !== 'default') {
    clientCache.set(cacheKey, client);
  }

  return client;
}
