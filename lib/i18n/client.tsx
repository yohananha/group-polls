"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Locale } from "./config";
import { dictionaries, type Dictionary } from "./dictionaries";

interface I18nContextValue {
  locale: Locale;
  t: Dictionary;
}

const I18nContext = createContext<I18nContextValue | null>(null);

// `locale` is the only thing that needs to cross the server -> client
// boundary as a prop (it's a plain string). The dictionary itself contains
// functions (for parameterized strings like "3 members"), and functions
// can't be passed as props from a Server Component into a Client Component —
// so this looks the dictionary up locally, on the client, instead of
// receiving it from the server.
export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <I18nContext.Provider value={{ locale, t: dictionaries[locale] }}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
