"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/client";
import { copyToClipboard } from "@/lib/clipboard";

type Status = "idle" | "copied" | "failed";

export function InviteLink({ inviteCode }: { inviteCode: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const [href, setHref] = useState("");
  const { t } = useI18n();

  async function handleCopy() {
    const url = `${window.location.origin}/join/${inviteCode}`;
    const ok = await copyToClipboard(url);

    setStatus(ok ? "copied" : "failed");
    setHref(ok ? "" : url);
    setTimeout(() => {
      setStatus("idle");
      setHref("");
    }, 3000);
  }

  return (
    <div className="rounded-xl border border-dashed border-neutral-300 px-4 py-2.5 text-sm dark:border-neutral-700">
      <div className="flex items-center justify-between gap-3">
        <span className="truncate text-neutral-500">
          {t.inviteLink.invite} <code className="text-neutral-700 dark:text-neutral-300">{inviteCode}</code>
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="shrink-0 rounded-md border border-neutral-300 px-2.5 py-1 text-xs font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          {status === "copied"
            ? t.inviteLink.copied
            : status === "failed"
              ? t.inviteLink.copyFailed
              : t.inviteLink.copyInviteLink}
        </button>
      </div>
      {status === "failed" && href && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">
          {t.inviteLink.copyFailedFallback}{" "}
          <span className="select-all break-all text-neutral-700 dark:text-neutral-300">{href}</span>
        </p>
      )}
    </div>
  );
}
