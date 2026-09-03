"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { closePoll, deletePoll } from "@/lib/polls/actions";
import { useI18n } from "@/lib/i18n/client";

export function AuthorControls({
  pollId,
  groupSlug,
  status,
}: {
  pollId: string;
  groupSlug: string;
  status: "open" | "closed";
}) {
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { t } = useI18n();

  function handleClose() {
    setError(null);
    startTransition(async () => {
      const res = await closePoll(pollId);
      if (res?.error) setError(res.error);
      else router.refresh();
    });
  }

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      // On success this never returns — deletePoll() redirects server-side.
      const res = await deletePoll(pollId, groupSlug);
      if (res?.error) {
        setError(res.error);
        setConfirmOpen(false);
      }
    });
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-3.5 text-xs font-bold">
        {status === "open" && (
          <button type="button" disabled={pending} onClick={handleClose} className="text-muted hover:text-ink disabled:opacity-50">
            {t.pollDetail.closePoll}
          </button>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setError(null);
            setConfirmOpen(true);
          }}
          className="text-danger hover:opacity-70 disabled:opacity-50"
        >
          {t.pollDetail.deletePoll}
        </button>
      </div>

      {error && <p className="mt-1.5 text-end text-xs font-bold text-danger">{error}</p>}

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" onClick={() => !pending && setConfirmOpen(false)}>
          <div
            role="alertdialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xs rounded-[22px] border-2 border-border bg-card p-5 text-center shadow-[0_30px_60px_-20px_rgba(43,33,24,0.28)]"
          >
            <p className="text-sm font-bold text-ink">{t.pollDetail.deleteConfirm}</p>
            <div className="mt-4 flex gap-2.5">
              <button
                type="button"
                disabled={pending}
                onClick={() => setConfirmOpen(false)}
                className="flex-1 rounded-2xl border-2 border-border bg-surface px-3 py-2.5 font-display text-sm font-bold text-ink disabled:opacity-50"
              >
                {t.common.cancel}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={handleDelete}
                className="flex-1 rounded-2xl bg-danger px-3 py-2.5 font-display text-sm font-bold text-card disabled:opacity-50"
              >
                {pending ? t.pollDetail.deleting : t.pollDetail.deletePoll}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
