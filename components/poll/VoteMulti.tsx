"use client";

import { useState, useTransition } from "react";
import { castBallot } from "@/lib/polls/actions";
import { useI18n } from "@/lib/i18n/client";

interface Option {
  id: string;
  label: string;
  approved: boolean;
}

export function VoteMulti({
  pollId,
  options,
  myOptionIds,
  minPicks,
  maxPicks,
  allowChange,
  disabled,
  onVoted,
}: {
  pollId: string;
  options: Option[];
  myOptionIds: string[];
  minPicks: number;
  maxPicks: number;
  allowChange: boolean;
  disabled: boolean;
  onVoted: () => void;
}) {
  const { t } = useI18n();
  const hasVoted = myOptionIds.length > 0;
  const [selected, setSelected] = useState<Set<string>>(new Set(myOptionIds));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const locked = disabled || (hasVoted && !allowChange);

  function toggle(id: string) {
    if (locked || pending) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= maxPicks) return prev;
        next.add(id);
      }
      return next;
    });
    setError(null);
  }

  function submit() {
    if (selected.size < minPicks) {
      setError(t.errors.pickAtLeast(minPicks));
      return;
    }
    startTransition(async () => {
      const res = await castBallot({ poll_id: pollId, option_ids: Array.from(selected) });
      if (res.error) setError(res.error);
      else onVoted();
    });
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-neutral-400">
        {t.vote.pickRange(minPicks, maxPicks)} · {t.vote.selected(selected.size)}
      </p>
      {options
        .filter((o) => o.approved)
        .map((o) => (
          <button
            key={o.id}
            type="button"
            disabled={locked}
            onClick={() => toggle(o.id)}
            className={`flex w-full items-center justify-between rounded-lg border px-4 py-2.5 text-start text-sm transition disabled:cursor-not-allowed ${
              selected.has(o.id)
                ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900"
                : "border-neutral-300 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
            }`}
          >
            {o.label}
            {selected.has(o.id) && <span>✓</span>}
          </button>
        ))}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!locked && (
        <button
          type="button"
          onClick={submit}
          disabled={pending || selected.size < minPicks}
          className="mt-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
        >
          {pending ? t.vote.saving : hasVoted ? t.vote.update : t.vote.submit}
        </button>
      )}
      {hasVoted && !allowChange && (
        <p className="text-xs text-neutral-400">{t.pollDetail.votedNoChange}</p>
      )}
    </div>
  );
}
