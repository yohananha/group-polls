import { getT } from "@/lib/i18n/server";
import type { PollType } from "@/lib/supabase/types";

const STYLES: Record<PollType, string> = {
  single: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  multi: "bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  rank: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  bracket: "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
};

export async function PollTypeBadge({ type }: { type: PollType }) {
  const { t } = await getT();

  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STYLES[type]}`}
    >
      {t.pollType[type]}
    </span>
  );
}
