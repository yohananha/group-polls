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
        className="w-full rounded-2xl border-2 border-border bg-card px-3.5 py-2.5 text-sm font-bold text-ink placeholder:text-muted-2"
      />
      {state?.error && <p className="text-sm font-bold text-danger">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-2xl border-2 border-border bg-card px-3 py-2.5 font-display text-sm font-bold text-ink transition hover:border-accent disabled:opacity-50"
      >
        {pending ? t.joinGroupForm.joining : t.joinGroupForm.submit}
      </button>
    </form>
  );
}
