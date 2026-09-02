import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { CreateGroupForm } from "@/components/CreateGroupForm";
import { JoinGroupForm } from "@/components/JoinGroupForm";
import { getT } from "@/lib/i18n/server";

export default async function HomePage() {
  const supabase = await createClient();
  const { t } = await getT();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // middleware redirects signed-out visitors to /login, but guard anyway.
  if (!user) return null;

  const { data: membershipsRaw } = await supabase
    .from("group_members")
    .select("groups(id, name, slug)")
    .eq("user_id", user.id);

  const memberships = membershipsRaw as unknown as
    | { groups: { id: string; name: string; slug: string } | null }[]
    | null;

  const groups = (memberships ?? [])
    .map((m) => m.groups)
    .filter((g): g is NonNullable<typeof g> => g !== null);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-8 px-4 py-8">
        <section>
          <h1 className="text-xl font-semibold">{t.home.yourGroups}</h1>
          {groups.length === 0 ? (
            <p className="mt-2 text-sm text-neutral-500">{t.home.noGroupsYet}</p>
          ) : (
            <ul className="mt-4 divide-y divide-neutral-200 overflow-hidden rounded-xl border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
              {groups.map((g) => (
                <li key={g.id}>
                  <Link
                    href={`/g/${g.slug}`}
                    className="block px-4 py-3 text-sm font-medium hover:bg-neutral-100 dark:hover:bg-neutral-900"
                  >
                    {g.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="grid gap-6 sm:grid-cols-2">
          <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
            <h2 className="text-sm font-semibold">{t.home.startNewGroup}</h2>
            <CreateGroupForm />
          </div>
          <div className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
            <h2 className="text-sm font-semibold">{t.home.joinWithInviteCode}</h2>
            <JoinGroupForm />
          </div>
        </section>
      </main>
    </div>
  );
}
