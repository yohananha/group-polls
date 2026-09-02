import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/auth/actions";
import { getT } from "@/lib/i18n/server";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";

export async function SiteHeader() {
  const supabase = await createClient();
  const { locale, t } = await getT();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let displayName = user?.email ?? "";
  let avatarUrl: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("id", user.id)
      .single();
    displayName = profile?.display_name ?? displayName;
    avatarUrl = profile?.avatar_url ?? null;
  }

  return (
    <header className="border-b border-neutral-200 dark:border-neutral-800">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-sm font-semibold tracking-tight">
          {t.header.brand}
        </Link>
        <div className="flex items-center gap-3">
          <LanguageSwitcher current={locale} />
          {user && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                {avatarUrl && (
                  <Image
                    src={avatarUrl}
                    alt=""
                    width={24}
                    height={24}
                    className="rounded-full"
                    unoptimized
                  />
                )}
                <span className="text-sm text-neutral-600 dark:text-neutral-300">
                  {displayName}
                </span>
              </div>
              <form action={signOut}>
                <button
                  type="submit"
                  className="text-sm text-neutral-400 underline-offset-2 hover:text-neutral-600 hover:underline dark:hover:text-neutral-200"
                >
                  {t.header.signOut}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
