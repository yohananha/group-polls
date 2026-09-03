"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/client";

type Status = "idle" | "copied" | "failed";

export function InviteLink({ inviteCode }: { inviteCode: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const [href, setHref] = useState("");
  const { t } = useI18n();

  async function handleCopy() {
    const url = `${window.location.origin}/join/${inviteCode}`;
    let ok = false;
    try {
      await navigator.clipboard.writeText(url);
      ok = true;
    } catch {
      // The async Clipboard API can be blocked (non-secure context,
      // Permissions-Policy, an embedding iframe) without the page having any
      // control over it. Fall back to the legacy execCommand path, which
      // uses a different permission model and often still works.
      const textarea = document.createElement("textarea");
      textarea.value = url;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      try {
        ok = document.execCommand("copy");
      } catch {
        ok = false;
      }
      document.body.removeChild(textarea);
    }

    setStatus(ok ? "copied" : "failed");
    setHref(ok ? "" : url);
    setTimeout(() => {
      setStatus("idle");
      setHref("");
    }, 3000);
  }

  return (
    <div className="rounded-2xl border-2 border-border bg-surface px-4 py-3 text-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="truncate font-bold text-muted">
          {t.inviteLink.invite}{" "}
          <span className="font-display font-bold tracking-widest text-ink">{inviteCode}</span>
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="shrink-0 rounded-full bg-accent-soft px-3 py-1.5 font-display text-xs font-bold text-accent transition hover:opacity-90"
        >
          {status === "copied"
            ? t.inviteLink.copied
            : status === "failed"
              ? t.inviteLink.copyFailed
              : t.inviteLink.copyInviteLink}
        </button>
      </div>
      {status === "failed" && href && (
        <p className="mt-2 text-xs font-bold text-danger">
          {t.inviteLink.copyFailedFallback}{" "}
          <span className="select-all break-all text-ink">{href}</span>
        </p>
      )}
    </div>
  );
}
