"use client";

import { useActionState } from "react";
import { addOption, type ActionResult } from "@/lib/polls/actions";
import { useI18n } from "@/lib/i18n/client";

const initialState: ActionResult = {};

export function AddOptionForm({ pollId, needsApproval }: { pollId: string; needsApproval: boolean }) {
  const [state, formAction, pending] = useActionState(addOption, initialState);
  const { t } = useI18n();

  return (
    <div className="space-y-1.5">
      <form action={formAction} className="flex items-center gap-2">
        <input type="hidden" name="poll_id" value={pollId} />
        <input
          name="label"
          required
          maxLength={200}
          placeholder={t.pollDetail.addOptionPlaceholder}
          className="w-full rounded-2xl border-2 border-border bg-surface px-3.5 py-2.5 text-sm font-bold text-ink placeholder:text-muted-2"
        />
        <button
          type="submit"
          disabled={pending}
          className="shrink-0 rounded-2xl border-2 border-border bg-surface px-3.5 py-2.5 font-display text-sm font-bold text-ink transition hover:border-accent disabled:opacity-50"
        >
          {pending ? t.pollDetail.adding : t.pollDetail.add}
        </button>
      </form>
      {state?.error && <p className="text-sm font-bold text-danger">{state.error}</p>}
      {needsApproval && <p className="text-xs font-bold text-muted-2">{t.pollDetail.needsApprovalNote}</p>}
    </div>
  );
}
