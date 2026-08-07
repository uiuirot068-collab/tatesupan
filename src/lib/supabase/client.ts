import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const rawKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const supabaseUrl =
    rawUrl && rawUrl.startsWith('http') ? rawUrl : 'https://placeholder.supabase.co';
  const supabaseAnonKey = rawKey || 'placeholder-key';

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
