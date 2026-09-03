"use client";

import { useState, useTransition } from "react";
import { castBallot } from "@/lib/polls/actions";
import { useI18n } from "@/lib/i18n/client";
import { tintColor } from "@/lib/polls/color";

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
  color,
}: {
  pollId: string;
  options: Option[];
  myOptionIds: string[];
  minPicks: number;
  maxPicks: number;
  allowChange: boolean;
  disabled: boolean;
  onVoted: () => void;
  color: string;
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
      <p className="text-xs font-bold text-muted">
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
            style={selected.has(o.id) ? { borderColor: color, backgroundColor: tintColor(color) } : undefined}
            className={`flex w-full items-center justify-between rounded-2xl border-2 px-4 py-3.5 text-start text-sm font-bold text-ink transition disabled:cursor-not-allowed ${
              selected.has(o.id) ? "" : "border-border bg-surface"
            }`}
          >
            <span>{o.label}</span>
            {selected.has(o.id) && <span>✓</span>}
          </button>
        ))}
      {error && <p className="text-sm font-bold text-danger">{error}</p>}
      {!locked && (
        <button
          type="button"
          onClick={submit}
          disabled={pending || selected.size < minPicks}
          className="mt-2 w-full rounded-2xl bg-ink px-4 py-3.5 font-display text-sm font-bold text-card transition hover:opacity-90 disabled:opacity-50"
        >
          {pending ? t.vote.saving : hasVoted ? t.vote.update : t.vote.submit}
        </button>
      )}
      {hasVoted && !allowChange && <p className="text-xs font-bold text-muted-2">{t.pollDetail.votedNoChange}</p>}
    </div>
  );
}
