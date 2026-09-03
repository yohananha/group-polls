"use client";

import { useActionState } from "react";
import { joinGroupForPoll, type ActionResult } from "@/lib/polls/actions";
import { useI18n } from "@/lib/i18n/client";

const initialState: ActionResult = {};

export function PollJoinPrompt({ pollId, code }: { pollId: string; code: string }) {
  const [state, formAction, pending] = useActionState(joinGroupForPoll, initialState);
  const { t } = useI18n();

  return (
    <form action={formAction}>
      <input type="hidden" name="poll_id" value={pollId} />
      <input type="hidden" name="code" value={code} />
      {state?.error && <p className="mb-2 text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
      >
        {pending ? t.sharePoll.joining : t.sharePoll.joinToView}
      </button>
    </form>
  );
}
