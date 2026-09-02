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
}: {
  results: ResultRow[];
  type: PollType;
  hidden: boolean;
  hiddenReason?: string;
  /** option_id -> display names, only populated for non-anonymous polls
   * (see get_poll_voters in supabase/migrations/0003_functions.sql). */
  votersByOption?: Record<string, string[]>;
}) {
  const { t } = useI18n();

  if (hidden) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500 dark:border-neutral-700">
        {hiddenReason ?? t.results.resultsHiddenDefault}
      </div>
    );
  }

  if (results.length === 0) {
    return <p className="text-sm text-neutral-500">{t.results.noResultsYet}</p>;
  }

  const max = Math.max(...results.map((r) => r.score), 1);
  const isBracket = type === "bracket";

  return (
    <ol className="space-y-2">
      {results.map((r, i) => (
        <li key={r.option_id}>
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-medium">
              {isBracket && <span className="me-1.5 text-neutral-400">#{i + 1}</span>}
              {r.label}
            </span>
            <span className="tabular-nums text-neutral-500">
              {isBracket ? t.results.rating(Math.round(r.score)) : t.results.votes(r.votes)}
            </span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
            <div
              className="h-full rounded-full bg-neutral-900 transition-all dark:bg-white"
              style={{ width: `${Math.max((r.score / max) * 100, r.score > 0 ? 3 : 0)}%` }}
            />
          </div>
          {votersByOption?.[r.option_id] && votersByOption[r.option_id].length > 0 && (
            <p className="mt-1 truncate text-xs text-neutral-400">
              {votersByOption[r.option_id].join(", ")}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}
