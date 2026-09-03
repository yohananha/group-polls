"use client";

import { useI18n } from "@/lib/i18n/client";
import type { PollType } from "@/lib/supabase/types";

export interface ResultRow {
  option_id: string;
  label: string;
  image_url: string | null;
  score: number;
  votes: number;
}

export function ResultsPanel({
  results,
  type,
  hidden,
  hiddenReason,
  votersByOption,
  color,
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

  const max = Math.max(...results.map((r) => r.score), 1);
  const isBracket = type === "bracket";

  return (
    <ol className="space-y-3.5">
      {results.map((r, i) => (
        <li key={r.option_id}>
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-bold text-ink">
              {isBracket && <span className="me-1.5 text-faint">#{i + 1}</span>}
              {r.label}
            </span>
            <span className="font-bold tabular-nums text-muted">
              {isBracket ? t.results.rating(Math.round(r.score)) : t.results.votes(r.votes)}
            </span>
          </div>
          <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${Math.max((r.score / max) * 100, r.score > 0 ? 3 : 0)}%`, backgroundColor: color }}
            />
          </div>
          {votersByOption?.[r.option_id] && votersByOption[r.option_id].length > 0 && (
            <p className="mt-1 truncate text-xs font-semibold text-muted-2">
              {votersByOption[r.option_id].join(", ")}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}
