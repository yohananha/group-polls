"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { recordMatchup } from "@/lib/polls/actions";
import { useI18n } from "@/lib/i18n/client";

interface Option {
  id: string;
  label: string;
  image_url: string | null;
  approved: boolean;
}

export function VoteBracket({
  pollId,
  options,
  initialMatchup,
  disabled,
  onJudged,
}: {
  pollId: string;
  options: Option[];
  initialMatchup: { option_a_id: string; option_b_id: string } | null;
  disabled: boolean;
  onJudged: () => void;
}) {
  const { t } = useI18n();
  const [matchup, setMatchup] = useState(initialMatchup);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const byId = new Map(options.filter((o) => o.approved).map((o) => [o.id, o]));

  async function loadNext() {
    const supabase = createClient();
    const { data, error: rpcError } = await supabase
      .rpc("get_next_matchup", { p_poll_id: pollId })
      .maybeSingle();
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setMatchup(data ?? null);
  }

  function choose(winnerId: string) {
    if (disabled || !matchup) return;
    setError(null);
    startTransition(async () => {
      const res = await recordMatchup({
        poll_id: pollId,
        option_a: matchup.option_a_id,
        option_b: matchup.option_b_id,
        winner: winnerId,
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      onJudged();
      await loadNext();
    });
  }

  if (disabled) {
    return <p className="text-sm text-neutral-500">{t.vote.thisPollClosed}</p>;
  }

  if (!matchup) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-500 dark:border-neutral-700">
        {t.vote.judgedAllPairs}
      </div>
    );
  }

  const a = byId.get(matchup.option_a_id);
  const b = byId.get(matchup.option_b_id);
  if (!a || !b) return null;

  return (
    <div className="space-y-3">
      <p className="text-center text-xs text-neutral-400">{t.vote.whichWins}</p>
      <div className="grid grid-cols-2 gap-3">
        {[a, b].map((opt) => (
          <button
            key={opt.id}
            type="button"
            disabled={pending}
            onClick={() => choose(opt.id)}
            className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-xl border border-neutral-300 p-4 text-center text-sm font-medium transition hover:border-neutral-900 hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:hover:border-white dark:hover:bg-neutral-900"
          >
            {opt.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={opt.image_url} alt="" className="h-16 w-16 rounded-lg object-cover" />
            )}
            {opt.label}
          </button>
        ))}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
