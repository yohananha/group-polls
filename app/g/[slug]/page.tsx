import Link from "next/link";
import type { CSSProperties } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { InviteLink } from "@/components/InviteLink";
import { PollTypeBadge } from "@/components/poll/PollTypeBadge";
import { getT } from "@/lib/i18n/server";
import { DEFAULT_POLL_COLOR } from "@/lib/polls/color";
import type { PollSettings, PollStatus, PollType } from "@/lib/supabase/types";

interface PollListItem {
  id: string;
  question: string;
  type: PollType;
  status: PollStatus;
  settings: PollSettings;
  created_at: string;
  author: { display_name: string } | null;
}

export default async function GroupPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const { locale, t } = await getT();

  const { data: group } = await supabase
    .from("groups")
    .select("id, name, slug, invite_code")
    .eq("slug", slug)
    .single();

  // RLS returns nothing for a group you're not a member of — that's
  // indistinguishable from "doesn't exist", which is the point.
  if (!group) notFound();

  const [pollsRes, membersRes] = await Promise.all([
    supabase
      .from("polls")
      .select("id, question, type, status, settings, created_at, author:profiles(display_name)")
      .eq("group_id", group.id)
      .order("created_at", { ascending: false }),
    supabase.from("group_members").select("user_id").eq("group_id", group.id),
  ]);

  const polls = pollsRes.data as unknown as PollListItem[] | null;
  const members = membersRes.data;

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-5 px-4 py-8">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate font-display text-2xl font-bold text-ink">{group.name}</h1>
            <p className="text-sm font-bold text-muted">{t.group.members(members?.length ?? 0)}</p>
          </div>
          <Link
            href={`/g/${group.slug}/new`}
            className="shrink-0 rounded-full bg-accent-soft px-3.5 py-2 font-display text-xs font-bold text-accent transition hover:opacity-90"
          >
            {t.group.newPoll}
          </Link>
        </div>

        <InviteLink inviteCode={group.invite_code} />

        <section className="space-y-3.5">
          {!polls || polls.length === 0 ? (
            <p className="rounded-2xl border-2 border-dashed border-border p-6 text-center text-sm font-bold text-muted">
              {t.group.noPollsYet}
            </p>
          ) : (
            polls.map((poll) => {
              const color = poll.settings?.color ?? DEFAULT_POLL_COLOR;
              return (
              <Link
                key={poll.id}
                href={`/p/${poll.id}`}
                style={{ "--poll-color": color } as CSSProperties}
                className="block rounded-[20px] border-2 border-border bg-surface p-4 transition hover:border-[var(--poll-color)]"
              >
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} aria-hidden="true" />
                  <PollTypeBadge type={poll.type} />
                  <span
                    className={`ms-auto text-[11px] font-bold ${poll.status === "open" ? "text-success" : "text-muted-2"}`}
                  >
                    {poll.status === "open" ? t.common.open : t.common.closed}
                  </span>
                </div>
                <p className="mt-2 font-display text-[15px] font-semibold leading-snug text-ink">
                  {poll.question}
                </p>
                <p className="mt-1.5 text-xs font-bold text-muted">
                  {poll.author?.display_name ?? t.common.someone} ·{" "}
                  {new Date(poll.created_at).toLocaleDateString(locale === "he" ? "he-IL" : "en-US")}
                </p>
              </Link>
              );
            })
          )}
        </section>
      </main>
    </div>
  );
}
