import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { CreateGroupForm } from "@/components/CreateGroupForm";
import { JoinGroupForm } from "@/components/JoinGroupForm";
import { getT } from "@/lib/i18n/server";

const AVATAR_COLORS = ["#FF8B6B", "#C9B8E8", "#FFD976", "#9FE0C4"];

function avatarColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export default async function HomePage() {
  const supabase = await createClient();
  const { t } = await getT();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // middleware redirects signed-out visitors to /login, but guard anyway.
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();

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

  const groupIds = groups.map((g) => g.id);
  const [membersRes, pollsRes] = groupIds.length
    ? await Promise.all([
        supabase
          .from("group_members")
          .select("group_id, user_id, profiles(display_name)")
          .in("group_id", groupIds),
        supabase.from("polls").select("group_id, status").in("group_id", groupIds),
      ])
    : [{ data: [] }, { data: [] }];

  const membersByGroup = new Map<string, { user_id: string; name: string }[]>();
  for (const row of (membersRes.data as unknown as
    | { group_id: string; user_id: string; profiles: { display_name: string } | null }[]
    | null) ?? []) {
    const list = membersByGroup.get(row.group_id) ?? [];
    list.push({ user_id: row.user_id, name: row.profiles?.display_name ?? "?" });
    membersByGroup.set(row.group_id, list);
  }

  const openPollsByGroup = new Map<string, number>();
  for (const row of (pollsRes.data as { group_id: string; status: string }[] | null) ?? []) {
    if (row.status === "open") {
      openPollsByGroup.set(row.group_id, (openPollsByGroup.get(row.group_id) ?? 0) + 1);
    }
  }

  const firstName = (profile?.display_name ?? user.email ?? "").split(" ")[0];

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-8 px-4 py-8">
        <section className="space-y-5">
          <div>
            {firstName && <p className="text-sm font-bold text-muted">{t.home.hey(firstName)}</p>}
            <h1 className="mt-0.5 font-display text-2xl font-bold text-ink">{t.home.yourGroups}</h1>
          </div>

          {groups.length === 0 ? (
            <p className="rounded-2xl border-2 border-dashed border-border p-6 text-center text-sm font-bold text-muted">
              {t.home.noGroupsYet}
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {groups.map((g) => {
                const members = membersByGroup.get(g.id) ?? [];
                const openPolls = openPollsByGroup.get(g.id) ?? 0;
                return (
                  <li key={g.id}>
                    <Link
                      href={`/g/${g.slug}`}
                      className="flex w-full items-center gap-3.5 rounded-[22px] border-2 border-border bg-surface p-3.5 text-start transition hover:border-accent"
                    >
                      <div className="flex shrink-0">
                        {members.slice(0, 3).map((m, i) => (
                          <div
                            key={m.user_id}
                            style={{ background: avatarColor(m.user_id), marginInlineStart: i === 0 ? 0 : -10 }}
                            className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-card font-display text-[11px] font-bold text-ink"
                          >
                            {m.name.charAt(0).toUpperCase()}
                          </div>
                        ))}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-display text-[15px] font-semibold text-ink">{g.name}</div>
                        <div className="mt-0.5 text-xs font-bold text-muted">
                          {t.home.groupSubtitle(members.length, openPolls)}
                        </div>
                      </div>
                      <div className="shrink-0 text-2xl text-faint rtl:scale-x-[-1]">›</div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-[22px] bg-accent-soft p-4">
            <h2 className="font-display text-sm font-bold text-ink">{t.home.startNewGroup}</h2>
            <CreateGroupForm />
          </div>
          <div className="rounded-[22px] border-2 border-border bg-surface p-4">
            <h2 className="font-display text-sm font-bold text-ink">{t.home.joinWithInviteCode}</h2>
            <JoinGroupForm />
          </div>
        </section>
      </main>
    </div>
  );
}
