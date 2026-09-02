"use client";

import { useActionState } from "react";
import { joinGroup, type ActionResult } from "@/lib/groups/actions";
import { useI18n } from "@/lib/i18n/client";

const initialState: ActionResult = {};

export function JoinGroupForm() {
  const [state, formAction, pending] = useActionState(joinGroup, initialState);
  const { t } = useI18n();

  return (
    <form action={formAction} className="mt-3 space-y-2">
      <input
        name="code"
        placeholder={t.joinGroupForm.placeholder}
        required
        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
      />
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium disabled:opacity-50 dark:border-neutral-700"
      >
        {pending ? t.joinGroupForm.joining : t.joinGroupForm.submit}
      </button>
    </form>
  );
}
