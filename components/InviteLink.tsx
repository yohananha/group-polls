"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/client";

export function InviteLink({ inviteCode }: { inviteCode: string }) {
  const [copied, setCopied] = useState(false);
  const { t } = useI18n();
  const href = typeof window !== "undefined" ? `${window.location.origin}/join/${inviteCode}` : "";

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-neutral-300 px-4 py-2.5 text-sm dark:border-neutral-700">
      <span className="truncate text-neutral-500">
        {t.inviteLink.invite} <code className="text-neutral-700 dark:text-neutral-300">{inviteCode}</code>
      </span>
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(href || `/join/${inviteCode}`);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="shrink-0 rounded-md border border-neutral-300 px-2.5 py-1 text-xs font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
      >
        {copied ? t.inviteLink.copied : t.inviteLink.copyInviteLink}
      </button>
    </div>
  );
}
