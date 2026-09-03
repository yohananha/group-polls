import { signInWithGoogle } from "@/lib/auth/actions";
import { getT } from "@/lib/i18n/server";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const { locale, t } = await getT();

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm space-y-8 rounded-[26px] border-2 border-border bg-card p-8 shadow-[0_30px_60px_-20px_rgba(43,33,24,0.28)]">
        <div className="flex justify-center">
          <LanguageSwitcher current={locale} />
        </div>

        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-[84px] w-[84px] items-center justify-center rounded-[26px] bg-accent font-display text-3xl font-bold text-ink">
            GP
          </div>
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-ink">{t.login.title}</h1>
            <p className="mt-2.5 max-w-[250px] text-sm font-bold leading-snug text-muted">
              {t.login.subtitle}
            </p>
          </div>
        </div>

        {error && (
          <p className="rounded-2xl bg-accent-soft px-3 py-2 text-center text-sm font-bold text-accent">
            {t.login.error}
          </p>
        )}

        <form action={signInWithGoogle} className="space-y-2.5">
          <input type="hidden" name="next" value={next ?? "/"} />
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-[18px] bg-ink px-4 py-4 font-display text-sm font-bold text-card transition hover:opacity-90"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62z"
              />
              <path
                fill="#34A853"
                d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 0 0 9 18z"
              />
              <path
                fill="#FBBC05"
                d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.16.28-1.7V4.97H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.03l2.99-2.33z"
              />
              <path
                fill="#EA4335"
                d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.97l2.99 2.33C4.66 5.17 6.65 3.58 9 3.58z"
              />
            </svg>
            {t.login.signInWithGoogle}
          </button>
        </form>
      </div>
    </div>
  );
}
