"use client";

import { useState, useTransition } from "react";
import { castBallot } from "@/lib/polls/actions";
import { useI18n } from "@/lib/i18n/client";

interface Option {
  id: string;
  label: string;
  approved: boolean;
}

export function VoteSingle({
  pollId,
  options,
  myOptionId,
  allowChange,
  disabled,
  onVoted,
}: {
  pollId: string;
  options: Option[];
  myOptionId: string | null;
  allowChange: boolean;
  disabled: boolean;
  onVoted: () => void;
}) {
  const { t } = useI18n();
  const [selected, setSelected] = useState<string | null>(myOptionId);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const locked = disabled || (myOptionId !== null && !allowChange);

  function submit(optionId: string) {
    if (locked) return;
    setSelected(optionId);
    setError(null);
    startTransition(async () => {
      const res = await castBallot({ poll_id: pollId, option_ids: [optionId] });
      if (res.error) {
        setError(res.error);
        setSelected(myOptionId);
      } else {
        onVoted();
      }
    });
  }

  return (
    <div className="space-y-2">
      {options
        .filter((o) => o.approved)
        .map((o) => (
          <button
            key={o.id}
            type="button"
            disabled={locked || pending}
            onClick={() => submit(o.id)}
            className={`flex w-full items-center justify-between rounded-lg border px-4 py-2.5 text-start text-sm transition disabled:cursor-not-allowed ${
              selected === o.id
                ? "border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900"
                : "border-neutral-300 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
            }`}
          >
            {o.label}
            {selected === o.id && <span>✓</span>}
          </button>
        ))}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {myOptionId && !allowChange && (
        <p className="text-xs text-neutral-400">{t.pollDetail.votedNoChange}</p>
      )}
    </div>
  );
}
