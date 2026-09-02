import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/types";

/** Browser-side Supabase client. Carries the signed-in user's session/JWT,
 * so every query it makes is subject to that user's RLS policies. */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
