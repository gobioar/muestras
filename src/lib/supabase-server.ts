import "server-only";

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServerKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_SERVICE_ROLE) {
  console.warn(
    "[supabase-server] Missing SUPABASE_SERVICE_ROLE_KEY. Falling back to anon key; server reads may fail under RLS."
  );
}

export const supabaseServer = createClient(supabaseUrl, supabaseServerKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
