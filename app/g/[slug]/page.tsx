import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { InviteLink } from "@/components/InviteLink";
import { PollTypeBadge } from "@/components/poll/PollTypeBadge";
import { getT } from "@/lib/i18n/server";
import type { PollStatus, PollType } from "@/lib/supabase/types";

interface PollListItem {
  id: string;
  question: string;
  type: PollType;
  status: PollStatus;
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
      .select("id, question, type, status, created_at, author:profiles(display_name)")
      .eq("group_id", group.id)
      .order("created_at", { ascending: false }),
    supabase.from("group_members").select("user_id").eq("group_id", group.id),
  ]);

  const polls = pollsRes.data as unknown as PollListItem[] | null;
  const members = membersRes.data;

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">{group.name}</h1>
            <p className="text-sm text-neutral-500">{t.group.members(members?.length ?? 0)}</p>
          </div>
          <Link
            href={`/g/${group.slug}/new`}
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
          >
            {t.group.newPoll}
          </Link>
        </div>

        <InviteLink inviteCode={group.invite_code} />

        <section className="space-y-3">
          {!polls || polls.length === 0 ? (
            <p className="rounded-xl border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500 dark:border-neutral-700">
              {t.group.noPollsYet}
            </p>
          ) : (
            polls.map((poll) => (
              <Link
                key={poll.id}
                href={`/p/${poll.id}`}
                className="block rounded-xl border border-neutral-200 p-4 transition hover:border-neutral-300 dark:border-neutral-800 dark:hover:border-neutral-700"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium">{poll.question}</p>
                  <PollTypeBadge type={poll.type} />
                </div>
                <p className="mt-1 text-xs text-neutral-500">
                  {poll.author?.display_name ?? t.common.someone} ·{" "}
                  {new Date(poll.created_at).toLocaleDateString(locale === "he" ? "he-IL" : "en-US")}
                  {poll.status === "closed" && ` · ${t.common.closed}`}
                </p>
              </Link>
            ))
          )}
        </section>
      </main>
    </div>
  );
}
