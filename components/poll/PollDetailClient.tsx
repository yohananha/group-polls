"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { canSeeResults } from "@/lib/polls/visibility";
import { DEFAULT_POLL_COLOR } from "@/lib/polls/color";
import type { PollSettings, PollStatus, PollType } from "@/lib/supabase/types";
import { VoteSingle } from "@/components/poll/VoteSingle";
import { VoteMulti } from "@/components/poll/VoteMulti";
import { VoteRank } from "@/components/poll/VoteRank";
import { VoteBracket } from "@/components/poll/VoteBracket";
import { ResultsPanel, type ResultRow } from "@/components/poll/ResultsPanel";
import { AddOptionForm } from "@/components/poll/AddOptionForm";
import { useI18n } from "@/lib/i18n/client";

interface Option {
  id: string;
  label: string;
  image_url: string | null;
  approved: boolean;
  added_by: string;
}

interface PollDetailClientProps {
  pollId: string;
  type: PollType;
  settings: PollSettings;
  status: PollStatus;
  options: Option[];
  initialResults: ResultRow[];
  initialVoters: Record<string, string[]>;
  myOptionIds: string[];
  myRanks: number[] | null;
  initialMatchup: { option_a_id: string; option_b_id: string } | null;
  hasJudgedAny: boolean;
}

export function PollDetailClient(props: PollDetailClientProps) {
  const {
    pollId,
    type,
    settings,
    status,
    initialResults,
    initialVoters,
    myOptionIds,
    myRanks,
    initialMatchup,
    hasJudgedAny,
  } = props;
  const { t } = useI18n();
  const [options, setOptions] = useState(props.options);
  const [results, setResults] = useState(initialResults);
  const [voters, setVoters] = useState(initialVoters);
  const [hasVoted, setHasVoted] = useState(
    type === "bracket" ? hasJudgedAny : myOptionIds.length > 0
  );
  const channelRef = useRef<RealtimeChannel | null>(null);
  const optionIdsRef = useRef<Set<string>>(new Set(props.options.map((o) => o.id)));
  useEffect(() => {
    optionIdsRef.current = new Set(options.map((o) => o.id));
  }, [options]);

  const refetchResults = useCallback(async () => {
    const supabase = createClient();
    const [{ data }, { data: voterRows }] = await Promise.all([
      supabase.rpc("get_poll_results", { p_poll_id: pollId }),
      supabase.rpc("get_poll_voters", { p_poll_id: pollId }),
    ]);
    if (data) setResults(data as ResultRow[]);
    if (voterRows) {
      const grouped: Record<string, string[]> = {};
      for (const row of voterRows) {
        (grouped[row.option_id] ??= []).push(row.voter_name);
      }
      setVoters(grouped);
    }
  }, [pollId]);

  const refetchOptions = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("poll_options")
      .select("id, label, image_url, approved, added_by")
      .eq("poll_id", pollId)
      .order("position", { ascending: true });
    if (data) setOptions(data as Option[]);
  }, [pollId]);

  // Live updates for everyone else watching this poll. Refetching the whole
  // aggregate on any change beats maintaining client-side counters — at
  // friend-group scale it's cheap, and it can't drift.
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session?.access_token) {
        await supabase.realtime.setAuth(session.access_token);
      }

      const channel = supabase
        .channel(`poll-${pollId}`)
        .on(
          // `ballots` rows are only readable by their own voter (RLS:
          // voter_id = auth.uid()), so Realtime never delivers other
          // people's ballot events to you — subscribing to it only ever
          // catches your own vote. `ballot_entries` is readable by any
          // group member once results_visibility allows it, which is the
          // actual signal we want. It has no poll_id column, so the filter
          // has to happen client-side against this poll's known option ids.
          "postgres_changes",
          { event: "*", schema: "public", table: "ballot_entries" },
          (payload) => {
            const changedOptionId =
              (payload.new as { option_id?: string } | null)?.option_id ??
              (payload.old as { option_id?: string } | null)?.option_id;
            if (changedOptionId && optionIdsRef.current.has(changedOptionId)) {
              refetchResults();
            }
          }
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "matchups", filter: `poll_id=eq.${pollId}` },
          refetchResults
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "poll_options", filter: `poll_id=eq.${pollId}` },
          () => {
            refetchOptions();
            refetchResults();
          }
        )
        .subscribe();

      channelRef.current = channel;
    })();

    return () => {
      cancelled = true;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [pollId, refetchResults, refetchOptions]);

  function handleVoted() {
    setHasVoted(true);
    refetchResults();
  }

  const disabled = status === "closed";
  const color = settings.color ?? DEFAULT_POLL_COLOR;
  const resultsVisible = canSeeResults(settings, hasVoted, status === "closed");
  const hiddenReason =
    settings.results_visibility === "after_vote"
      ? type === "bracket"
        ? t.pollDetail.hiddenUntilJudge
        : t.pollDetail.hiddenUntilVote
      : t.pollDetail.hiddenUntilClose;

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-2.5 font-display text-sm font-bold text-ink">{t.pollDetail.results}</h2>
        <ResultsPanel
          results={results}
          type={type}
          hidden={!resultsVisible}
          hiddenReason={hiddenReason}
          votersByOption={voters}
          color={color}
        />
      </section>

      <section>
        {type === "single" && (
          <VoteSingle
            pollId={pollId}
            options={options}
            myOptionId={myOptionIds[0] ?? null}
            allowChange={!!settings.allow_vote_change}
            disabled={disabled}
            onVoted={handleVoted}
            color={color}
          />
        )}
        {type === "multi" && (
          <VoteMulti
            pollId={pollId}
            options={options}
            myOptionIds={myOptionIds}
            minPicks={settings.min_picks ?? 1}
            maxPicks={settings.max_picks ?? options.length}
            allowChange={!!settings.allow_vote_change}
            disabled={disabled}
            onVoted={handleVoted}
            color={color}
          />
        )}
        {type === "rank" && (
          <VoteRank
            pollId={pollId}
            options={options}
            myOrder={
              myRanks && myOptionIds.length > 0
                ? myOptionIds
                    .map((id, i) => ({ id, rank: myRanks[i] }))
                    .sort((a, b) => a.rank - b.rank)
                    .map((x) => x.id)
                : null
            }
            topN={settings.top_n ?? null}
            allowChange={!!settings.allow_vote_change}
            disabled={disabled}
            onVoted={handleVoted}
          />
        )}
        {type === "bracket" && (
          <VoteBracket
            pollId={pollId}
            options={options}
            initialMatchup={initialMatchup}
            disabled={disabled}
            onJudged={handleVoted}
          />
        )}
      </section>

      {settings.allow_option_adds && !disabled && (
        <AddOptionForm pollId={pollId} needsApproval={!!settings.option_adds_need_approval} />
      )}
    </div>
  );
}
