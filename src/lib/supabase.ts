import { createClient } from "@supabase/supabase-js";
import { isSupabaseConfigured } from "@/lib/env";

export function getAdminDb() {
  if (!isSupabaseConfigured()) return null;
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
