import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "./env";

// Service-role client: bypasses RLS. Use only in trusted server code,
// after checking the caller's access with the user-scoped client.
export function createAdminClient() {
  return createClient(supabaseUrl, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
