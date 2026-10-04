import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';

// SPN-UNIFY-001: one plain supabase-js client per page. Its login is kept in
// localStorage under the project's default key, the same place the SpunTales
// portal pages (caroad assets/js/auth.js) keep theirs, so one login on
// spuntales.net is shared by the portal and every tool. PKCE stays on for
// password-recovery links (?code=), as with the previous @supabase/ssr client.
let browserClient: SupabaseClient | null = null;

export function createClient(): SupabaseClient {
  if (browserClient) return browserClient;

  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const rawKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const supabaseUrl =
    rawUrl && rawUrl.startsWith('http') ? rawUrl : 'https://placeholder.supabase.co';
  const supabaseAnonKey = rawKey || 'placeholder-key';

  browserClient = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    auth: { flowType: 'pkce' },
  });
  return browserClient;
}
