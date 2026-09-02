"use client";

import { useTransition } from "react";
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
  const router = useRouter();
  const { t } = useI18n();

  return (
    <div className="flex items-center gap-3 text-xs">
      {status === "open" && (
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(async () => { await closePoll(pollId); router.refresh(); })}
          className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
        >
          {t.pollDetail.closePoll}
        </button>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (confirm(t.pollDetail.deleteConfirm)) {
            startTransition(async () => {
              await deletePoll(pollId, groupSlug);
            });
          }
        }}
        className="text-neutral-400 hover:text-red-600"
      >
        {t.pollDetail.deletePoll}
      </button>
    </div>
  );
}
