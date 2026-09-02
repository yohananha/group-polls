import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/supabase/types";

/** Server-side Supabase client for use in Server Components and Server
 * Actions. Reads/writes the auth cookie so the session round-trips with the
 * browser, and — critically — still carries the user's own JWT, never the
 * service-role key. Every mutation in this app runs as the user, so RLS is
 * the only thing standing between one group's data and another's. */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll called from a Server Component (not an Action/Route
            // Handler) — cookies() is read-only there. Safe to ignore as
            // long as middleware.ts is refreshing the session on every
            // request, which it is (see middleware.ts).
          }
        },
      },
    }
  );
}
