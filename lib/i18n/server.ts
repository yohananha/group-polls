import { cookies } from "next/headers";
import { defaultLocale, dirFor, isLocale, localeCookie, type Locale } from "./config";
import { dictionaries, type Dictionary } from "./dictionaries";

/** Reads the locale cookie set by the language switcher (see
 * lib/i18n/actions.ts). Server Components and Server Actions call this
 * directly instead of going through React Context, since Server Components
 * can't use hooks. */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(localeCookie)?.value;
  return isLocale(value) ? value : defaultLocale;
}

export async function getT(): Promise<{ locale: Locale; dir: "ltr" | "rtl"; t: Dictionary }> {
  const locale = await getLocale();
  return { locale, dir: dirFor(locale), t: dictionaries[locale] };
}
