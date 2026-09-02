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
      className="rounded-md border border-amber-300 px-2 py-0.5 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-900"
    >
      {pending ? t.pollDetail.approving : t.pollDetail.approve}
    </button>
  );
}
