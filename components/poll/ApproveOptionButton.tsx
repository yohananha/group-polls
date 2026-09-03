"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveOption } from "@/lib/polls/actions";
import { useI18n } from "@/lib/i18n/client";

export function ApproveOptionButton({ optionId, pollId }: { optionId: string; pollId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { t } = useI18n();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await approveOption(optionId, pollId);
          router.refresh();
        })
      }
      className="rounded-full bg-type-rank-bg px-2.5 py-1 font-display text-xs font-bold text-type-rank-fg transition hover:opacity-80 disabled:opacity-50"
    >
      {pending ? t.pollDetail.approving : t.pollDetail.approve}
    </button>
  );
}
