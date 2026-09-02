import type { PollSettings } from "@/lib/supabase/types";

/** Mirrors the RLS policy on ballot_entries/matchups (see
 * supabase/migrations/0002_polls.sql) purely for UI purposes — deciding
 * whether to render "results are hidden" copy instead of a chart that would
 * just come back all-zero. The database is what actually enforces this; this
 * function only has to agree with it, not replace it. */
export function canSeeResults(
  settings: PollSettings,
  hasVoted: boolean,
  isClosed: boolean
): boolean {
  switch (settings.results_visibility ?? "always") {
    case "after_vote":
      return hasVoted || isClosed;
    case "after_close":
      return isClosed;
    default:
      return true;
  }
}
