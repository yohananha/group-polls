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

export function VoteSingle({
  pollId,
  options,
  myOptionId,
  allowChange,
  disabled,
  onVoted,
  color,
}: {
  pollId: string;
  options: Option[];
  myOptionId: string | null;
  allowChange: boolean;
  disabled: boolean;
  onVoted: () => void;
  color: string;
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
            style={selected === o.id ? { borderColor: color, backgroundColor: tintColor(color) } : undefined}
            className={`flex w-full items-center justify-between rounded-2xl border-2 px-4 py-3.5 text-start text-sm font-bold text-ink transition disabled:cursor-not-allowed ${
              selected === o.id ? "" : "border-border bg-surface"
            }`}
          >
            <span>{o.label}</span>
            {selected === o.id && <span>✓</span>}
          </button>
        ))}
      {error && <p className="text-sm font-bold text-danger">{error}</p>}
      {myOptionId && !allowChange && <p className="text-xs font-bold text-muted-2">{t.pollDetail.votedNoChange}</p>}
    </div>
  );
}
