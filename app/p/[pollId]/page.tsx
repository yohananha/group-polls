import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { PollTypeBadge } from "@/components/poll/PollTypeBadge";
import { PollDetailClient } from "@/components/poll/PollDetailClient";
import { AuthorControls } from "@/components/poll/AuthorControls";
import { ApproveOptionButton } from "@/components/poll/ApproveOptionButton";
import { getT } from "@/lib/i18n/server";
import type { PollSettings, PollStatus, PollType } from "@/lib/supabase/types";
import type { ResultRow } from "@/components/poll/ResultsPanel";

interface PollRow {
  id: string;
  group_id: string;
  author_id: string;
  question: string;
  description: string | null;
  type: PollType;
  settings: PollSettings;
  status: PollStatus;
  created_at: string;
  author: { display_name: string } | null;
  group: { slug: string; name: string } | null;
}

export default async function PollPage({
  params,
}: {
  params: Promise<{ pollId: string }>;
}) {
  const { pollId } = await params;
  const supabase = await createClient();
  const { locale, t } = await getT();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: pollRaw } = await supabase
    .from("polls")
    .select(
      "id, group_id, author_id, question, description, type, settings, status, created_at, author:profiles(display_name), group:groups(slug, name)"
    )
    .eq("id", pollId)
    .single();

  if (!pollRaw) notFound();
  const poll = pollRaw as unknown as PollRow;

  const { data: optionsRaw } = await supabase
    .from("poll_options")
    .select("id, label, image_url, approved, added_by, position")
    .eq("poll_id", pollId)
    .order("position", { ascending: true });
  const options = optionsRaw ?? [];

  const [{ data: resultsRaw }, { data: voterRows }] = await Promise.all([
    supabase.rpc("get_poll_results", { p_poll_id: pollId }),
    supabase.rpc("get_poll_voters", { p_poll_id: pollId }),
  ]);
  const initialResults = (resultsRaw ?? []) as ResultRow[];
  const initialVoters: Record<string, string[]> = {};
  for (const row of voterRows ?? []) {
    (initialVoters[row.option_id] ??= []).push(row.voter_name);
  }

  // My own ballot, if any — visible regardless of results_visibility (see
  // the ballot_entries RLS policy's final OR clause).
  const { data: myBallot } = await supabase
    .from("ballots")
    .select("id, ballot_entries(option_id, rank)")
    .eq("poll_id", pollId)
    .eq("voter_id", user.id)
    .maybeSingle();

  const myEntries =
    (myBallot as unknown as { ballot_entries: { option_id: string; rank: number | null }[] } | null)
      ?.ballot_entries ?? [];
  const myOptionIds = myEntries.map((e) => e.option_id);
  const myRanks = myEntries.every((e) => e.rank !== null) ? myEntries.map((e) => e.rank as number) : null;

  let initialMatchup: { option_a_id: string; option_b_id: string } | null = null;
  let hasJudgedAny = false;
  if (poll.type === "bracket") {
    const [{ data: next }, { count }] = await Promise.all([
      supabase.rpc("get_next_matchup", { p_poll_id: pollId }).maybeSingle(),
      supabase
        .from("matchups")
        .select("id", { count: "exact", head: true })
        .eq("poll_id", pollId)
        .eq("voter_id", user.id),
    ]);
    initialMatchup = next ?? null;
    hasJudgedAny = (count ?? 0) > 0;
  }

  const isAuthor = poll.author_id === user.id;
  const pendingOptions = options.filter((o) => !o.approved);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-8">
        <div>
          <Link href={poll.group ? `/g/${poll.group.slug}` : "/"} className="text-xs font-bold text-muted hover:text-ink">
            <span className="inline-block rtl:scale-x-[-1]" aria-hidden="true">
              ←
            </span>{" "}
            {poll.group?.name ?? t.common.back}
          </Link>
          <div className="mt-2.5 flex items-start justify-between gap-3">
            <PollTypeBadge type={poll.type} />
            {isAuthor && (
              <AuthorControls pollId={poll.id} groupSlug={poll.group?.slug ?? ""} status={poll.status} />
            )}
          </div>
          <h1 className="mt-2.5 font-display text-xl font-bold leading-snug text-ink">{poll.question}</h1>
          {poll.description && (
            <p className="mt-1.5 text-sm font-bold italic text-muted">{poll.description}</p>
          )}
          <p className="mt-2.5 text-xs font-bold text-muted-2">
            {poll.author?.display_name ?? t.common.someone} ·{" "}
            {new Date(poll.created_at).toLocaleDateString(locale === "he" ? "he-IL" : "en-US")}
            {poll.status === "closed" && ` · ${t.common.closed}`}
          </p>
        </div>

        {isAuthor && pendingOptions.length > 0 && (
          <div className="rounded-2xl border-2 border-border bg-type-rank-bg p-3.5">
            <p className="mb-2 font-display text-xs font-bold text-type-rank-fg">{t.pollDetail.pendingApproval}</p>
            <ul className="space-y-1.5">
              {pendingOptions.map((o) => (
                <li key={o.id} className="flex items-center justify-between text-sm font-bold text-ink">
                  <span>{o.label}</span>
                  <ApproveOptionButton optionId={o.id} pollId={poll.id} />
                </li>
              ))}
            </ul>
          </div>
        )}

        <PollDetailClient
          pollId={poll.id}
          type={poll.type}
          settings={poll.settings}
          status={poll.status}
          options={options}
          initialResults={initialResults}
          initialVoters={initialVoters}
          myOptionIds={myOptionIds}
          myRanks={myRanks}
          initialMatchup={initialMatchup}
          hasJudgedAny={hasJudgedAny}
        />
      </main>
    </div>
  );
}
