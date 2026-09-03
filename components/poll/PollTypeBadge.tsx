import { getT } from "@/lib/i18n/server";
import type { PollType } from "@/lib/supabase/types";

const STYLES: Record<PollType, string> = {
  single: "bg-type-single-bg text-type-single-fg",
  multi: "bg-type-multi-bg text-type-multi-fg",
  rank: "bg-type-rank-bg text-type-rank-fg",
  bracket: "bg-type-bracket-bg text-type-bracket-fg",
};

export async function PollTypeBadge({ type }: { type: PollType }) {
  const { t } = await getT();

  return (
    <span
      className={`shrink-0 rounded-[10px] px-2.5 py-1 font-display text-[11px] font-bold ${STYLES[type]}`}
    >
      {t.pollType[type]}
    </span>
  );
}
