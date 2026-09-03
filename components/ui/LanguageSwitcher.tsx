"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setLocale } from "@/lib/i18n/actions";
import { useI18n } from "@/lib/i18n/client";
import type { Locale } from "@/lib/i18n/config";

export function LanguageSwitcher({ current }: { current: Locale }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { t } = useI18n();

  function choose(locale: Locale) {
    if (locale === current || pending) return;
    startTransition(async () => {
      await setLocale(locale);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-1 rounded-full border-2 border-border bg-surface p-0.5 font-display text-xs">
      <button
        type="button"
        onClick={() => choose("en")}
        disabled={pending}
        aria-pressed={current === "en"}
        className={`rounded-full px-2 py-0.5 font-semibold transition disabled:opacity-50 ${
          current === "en" ? "bg-ink text-card" : "text-muted hover:text-ink"
        }`}
      >
        {t.languageSwitcher.en}
      </button>
      <button
        type="button"
        onClick={() => choose("he")}
        disabled={pending}
        aria-pressed={current === "he"}
        className={`rounded-full px-2 py-0.5 font-semibold transition disabled:opacity-50 ${
          current === "he" ? "bg-ink text-card" : "text-muted hover:text-ink"
        }`}
      >
        {t.languageSwitcher.he}
      </button>
    </div>
  );
}
