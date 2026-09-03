"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/client";
import { copyToClipboard } from "@/lib/clipboard";

type Status = "idle" | "copied" | "failed";

/** The share link carries the group's invite code so a non-member opening it
 * lands on a join prompt instead of a 404 — see the ?code handling in
 * app/p/[pollId]/page.tsx. */
export function SharePollButton({ pollId, inviteCode }: { pollId: string; inviteCode: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const [href, setHref] = useState("");
  const { t } = useI18n();

  async function handleShare() {
    const url = `${window.location.origin}/p/${pollId}?code=${inviteCode}`;
    const ok = await copyToClipboard(url);

    setStatus(ok ? "copied" : "failed");
    setHref(ok ? "" : url);
    setTimeout(() => {
      setStatus("idle");
      setHref("");
    }, 3000);
  }

  return (
    <div>
      <button type="button" onClick={handleShare} className="text-xs font-bold text-muted hover:text-ink">
        {status === "copied"
          ? t.sharePoll.copied
          : status === "failed"
            ? t.sharePoll.copyFailed
            : t.sharePoll.share}
      </button>
      {status === "failed" && href && (
        <p className="mt-2 text-xs font-bold text-danger">
          {t.sharePoll.copyFailedFallback} <span className="select-all break-all text-ink">{href}</span>
        </p>
      )}
    </div>
  );
}
