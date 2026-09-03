"use client";

import { useActionState } from "react";
import { joinGroup, type ActionResult } from "@/lib/groups/actions";
import { useI18n } from "@/lib/i18n/client";

const initialState: ActionResult = {};

export function JoinConfirmButton({ code }: { code: string }) {
  const [state, formAction, pending] = useActionState(joinGroup, initialState);
  const { t } = useI18n();

  return (
    <form action={formAction} className="w-full">
      <input type="hidden" name="code" value={code} />
      {state?.error && <p className="mb-2 text-sm font-bold text-danger">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-[18px] bg-ink px-5 py-4 font-display text-sm font-bold text-card transition hover:opacity-90 disabled:opacity-50"
      >
        {pending ? t.joinGroupForm.joining : t.joinGroupForm.submit}
      </button>
    </form>
  );
}
