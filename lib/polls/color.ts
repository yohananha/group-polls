/** Falls back to the app's default accent for polls created before the
 * per-poll color picker existed (lib/supabase/types.ts PollSettings.color). */
export const DEFAULT_POLL_COLOR = "#E8623D";

/** Mirrors the accentTint formula in the original Group Polls design: a
 * light wash of the poll's color over the surface color, used behind a
 * selected option. */
export function tintColor(hex: string): string {
  return `color-mix(in oklab, ${hex} 35%, #FFFDF9)`;
}
