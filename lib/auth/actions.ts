"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n/server";

export async function signInWithGoogle(formData: FormData) {
  const { t } = await getT();
  const next = formData.get("next");
  const supabase = await createClient();
  const headerList = await headers();
  // x-forwarded-* is set by Vercel's proxy; falls back to host for local dev.
  const proto = headerList.get("x-forwarded-proto") ?? "http";
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  const origin = `${proto}://${host}`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback${
        typeof next === "string" && next ? `?next=${encodeURIComponent(next)}` : ""
      }`,
    },
  });
  if (error || !data.url) {
    throw new Error(error?.message ?? t.errors.couldNotStartSignIn);
  }
  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
