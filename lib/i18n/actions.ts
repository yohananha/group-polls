"use server";

import { cookies } from "next/headers";
import { localeCookie, type Locale } from "./config";

export async function setLocale(locale: Locale) {
  const store = await cookies();
  store.set(localeCookie, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}
