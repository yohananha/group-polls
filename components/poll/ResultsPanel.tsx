"use client";

import { useI18n } from "@/lib/i18n/client";
import type { PollType } from "@/lib/supabase/types";

export interface ResultRow {
  option_id: string;
  label: string;
  image_url: string | null;
  /** Confidence-adjusted score — the sort key, and what the bar length shows,
   * so the bars can never disagree with the ordering. Roughly 0..1 but can go
   * slightly negative when an option has almost no support, so it is never
   * displayed as a number; `raw` is what the percentage comes from. See
   * supabase/migrations/0008_fair_scoring.sql. */
  score: number;
  /** Same number as `support`, under its original name. */
  votes: number;
  /** Ballots that could have contained this option — i.e. cast or revised
   * after it became votable. Smaller than the turnout for options added
   * mid-poll, which is the whole point. */
  reach: number;
  support: number;
  /** support/reach before shrinkage; null when nothing has reached it yet. */
  raw: number | null;
  /** Mean finishing position — rank polls only. */
  avg_rank: number | null;
}

export interface Turnout {
  ballots_cast: number;
  group_size: number;
}

export function ResultsPanel({
  results,
  type,
  hidden,
  hiddenReason,
  votersByOption,
  color,
  turnout,
}: {
  results: ResultRow[];
  type: PollType;
  hidden: boolean;
  hiddenReason?: string;
  /** option_id -> display names, only populated for non-anonymous polls
   * (see get_poll_voters in supabase/migrations/0003_functions.sql). */
  votersByOption?: Record<string, string[]>;
  /** The poll author's chosen color (lib/polls/color.ts) — fills the bars. */
  color: string;
  /** Poll-level denominator (get_poll_turnout). Null while it's unavailable. */
  turnout?: Turnout | null;
}) {
  const { t } = useI18n();

  if (hidden) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-border bg-surface p-6 text-center text-sm font-bold text-muted">
        {hiddenReason ?? t.results.resultsHiddenDefault}
      </div>
    );
  }

  if (results.length === 0) {
    return <p className="text-sm font-bold text-muted">{t.results.noResultsYet}</p>;
  }

  const isBracket = type === "bracket";
  const isRank = type === "rank";
  const isSingle = type === "single";

  // Single-choice is mutually exclusive, so shares of the vote sum to a
  // whole — a donut reads that relationship at a glance in a way a list of
  // bars doesn't. Slices are a sequential ramp of the poll's own color
  // (strongest for the leader, fading by rank) rather than an unrelated
  // categorical palette, so the chart still reads as "this poll's color."
  const totalSupport = results.reduce((sum, r) => sum + r.support, 0);
  function sliceColor(i: number, n: number): string {
    if (n <= 1) return color;
    const step = 60 / (n - 1);
    return `color-mix(in oklab, ${color} ${Math.round(100 - i * step)}%, white)`;
  }

  // Bar length always tracks `score`, so a bar can never disagree with the
  // ordering above it — but the two families of score need different scales.
  // single/multi/rank scores sit just above zero, so a share of the leader
  // reads correctly. Bracket scores are expected win rates centred on 0.5, so
  // the same treatment gives an option that lost every matchup a bar most of
  // the way across; those get spread across the observed range instead.
  const scores = results.map((r) => r.score);
  const hi = Math.max(...scores);
  const lo = Math.min(...scores);
  const span = hi - lo;
  function barPct(score: number): number {
    const frac = isBracket
      ? span > 0
        ? (score - lo) / span
        : 1
      : Math.max(score, 0) / Math.max(hi, 0.0001);
    return Math.max(frac * 100, score > lo ? 3 : 0);
  }

  function stat(r: ResultRow): string {
    if (r.reach === 0) return t.results.notSeenYet;
    // Bracket reach counts matchups played, not voters, so it reads as a
    // win record rather than a share of the electorate.
    if (isBracket) return t.results.wonOf(r.support, r.reach);
    const ratio = t.results.supportOf(r.support, r.reach);
    if (isRank) {
      return r.avg_rank != null ? `${ratio} · ${t.results.avgRank(r.avg_rank)}` : ratio;
    }
    return `${ratio} · ${t.results.percent(Math.round((r.raw ?? 0) * 100))}`;
  }

  return (
    <div>
      {turnout && (
        <p className="mb-2.5 text-xs font-bold text-muted-2">
          {t.results.turnout(turnout.ballots_cast, turnout.group_size)}
        </p>
      )}
      {isSingle && totalSupport > 0 && (
        <div className="relative mx-auto mb-4 h-40 w-40">
          <svg
            viewBox="0 0 42 42"
            className="h-full w-full"
            role="img"
            aria-label={results
              .map((r) => `${r.label}: ${t.results.percent(Math.round((r.support / totalSupport) * 100))}`)
              .join(", ")}
          >
            <circle cx="21" cy="21" r="15.9155" fill="none" stroke="var(--color-border)" strokeWidth="6" />
            {(() => {
              let cumulative = 0;
              const gap = results.length > 1 ? 0.6 : 0;
              return results.map((r, i) => {
                const pct = (r.support / totalSupport) * 100;
                const dash = Math.max(pct - gap, 0);
                const dashoffset = 25 - cumulative - gap / 2;
                cumulative += pct;
                if (dash <= 0) return null;
                return (
                  <circle
                    key={r.option_id}
                    cx="21"
                    cy="21"
                    r="15.9155"
                    fill="none"
                    stroke={sliceColor(i, results.length)}
                    strokeWidth="6"
                    strokeDasharray={`${dash} ${100 - dash}`}
                    strokeDashoffset={dashoffset}
                  />
                );
              });
            })()}
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-4 text-center">
            <span className="font-display text-xl font-bold text-ink">
              {t.results.percent(Math.round((results[0].support / totalSupport) * 100))}
            </span>
            <span className="truncate text-[11px] font-bold text-muted-2">{results[0].label}</span>
          </div>
        </div>
      )}
      <ol className="space-y-3.5">
        {results.map((r, i) => {
          // Fewer ballots could have contained this than have been cast, so it
          // was added mid-poll. Without saying so, "2 of 3" next to "8 of 12"
          // reads as a stronger result than it is.
          const late = !isBracket && turnout != null && r.reach > 0 && r.reach < turnout.ballots_cast;
          return (
            <li key={r.option_id}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 font-bold text-ink">
                  {/* dir="ltr" keeps "#1" from rendering as "1#" in RTL, but it
                      also flips the element's own inline-end, so the spacing
                      has to live on an outer span that still inherits the
                      document direction. */}
                  <span className="me-1.5 text-faint">
                    <span dir="ltr">#{i + 1}</span>
                  </span>
                  {r.label}
                </span>
                <span className="shrink-0 font-bold tabular-nums text-muted">{stat(r)}</span>
              </div>
              <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-border">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${barPct(r.score)}%`,
                    backgroundColor: isSingle ? sliceColor(i, results.length) : color,
                  }}
                />
              </div>
              {late && turnout && (
                <p className="mt-1.5">
                  <span className="rounded-full border-2 border-border px-2 py-0.5 text-xs font-bold text-muted-2">
                    {t.results.seenBy(r.reach, turnout.ballots_cast)}
                  </span>
                </p>
              )}
              {votersByOption?.[r.option_id] && votersByOption[r.option_id].length > 0 && (
                <p className="mt-1 truncate text-xs font-semibold text-muted-2">
                  {votersByOption[r.option_id].join(", ")}
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
