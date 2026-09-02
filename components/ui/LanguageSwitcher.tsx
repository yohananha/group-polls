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
    <div className="flex items-center gap-1 rounded-full border border-neutral-300 p-0.5 text-xs dark:border-neutral-700">
      <button
        type="button"
        onClick={() => choose("en")}
        disabled={pending}
        aria-pressed={current === "en"}
        className={`rounded-full px-2 py-0.5 font-medium transition disabled:opacity-50 ${
          current === "en"
            ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
            : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
        }`}
      >
        {t.languageSwitcher.en}
      </button>
      <button
        type="button"
        onClick={() => choose("he")}
        disabled={pending}
        aria-pressed={current === "he"}
        className={`rounded-full px-2 py-0.5 font-medium transition disabled:opacity-50 ${
          current === "he"
            ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
            : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
        }`}
      >
        {t.languageSwitcher.he}
      </button>
    </div>
  );
}
