"use client";

import { useActionState } from "react";
import { addOption, type ActionResult } from "@/lib/polls/actions";
import { useI18n } from "@/lib/i18n/client";

const initialState: ActionResult = {};

export function AddOptionForm({ pollId, needsApproval }: { pollId: string; needsApproval: boolean }) {
  const [state, formAction, pending] = useActionState(addOption, initialState);
  const { t } = useI18n();

  return (
    <div className="space-y-1">
      <form action={formAction} className="flex items-center gap-2">
        <input type="hidden" name="poll_id" value={pollId} />
        <input
          name="label"
          required
          maxLength={200}
          placeholder={t.pollDetail.addOptionPlaceholder}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />
        <button
          type="submit"
          disabled={pending}
          className="shrink-0 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium disabled:opacity-50 dark:border-neutral-700"
        >
          {pending ? t.pollDetail.adding : t.pollDetail.add}
        </button>
      </form>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {needsApproval && (
        <p className="text-xs text-neutral-400">{t.pollDetail.needsApprovalNote}</p>
      )}
    </div>
  );
}
