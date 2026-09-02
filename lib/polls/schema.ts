import { z } from "zod";
import type { Dictionary } from "@/lib/i18n/dictionaries";

/** Settings shared by every poll type. Stored as-is in polls.settings jsonb —
 * see supabase/migrations/0003_functions.sql for the server-side checks that
 * actually enforce these (never trust the client alone). */
const baseSettings = z.object({
  allow_option_adds: z.boolean().default(false),
  option_adds_need_approval: z.boolean().default(false),
  allow_vote_change: z.boolean().default(true),
  anonymous: z.boolean().default(false),
  results_visibility: z.enum(["always", "after_vote", "after_close"]).default("always"),
});

const singleSettings = baseSettings;

const multiSettings = baseSettings.extend({
  min_picks: z.number().int().min(1).default(1),
  max_picks: z.number().int().min(1).default(3),
});

const rankSettings = baseSettings.extend({
  top_n: z.number().int().min(1).max(50).optional(),
});

const bracketSettings = baseSettings.extend({
  // allow_vote_change has no meaning for bracket (there's no single ballot
  // to change — each matchup judgment is independent), but keeping the same
  // base shape means the settings panel doesn't need a special case for it.
});

function pollOptionInputSchema(t: Dictionary) {
  return z.object({
    label: z.string().trim().min(1, t.errors.giveOptionAName).max(200),
    image_url: z.string().url().optional().or(z.literal("")),
  });
}

/** Discriminated union on `type` — this is the extension point every poll
 * type plugs into. Adding a fifth type later means adding one more branch
 * here plus a settings shape, not touching the other four.
 *
 * Takes the request's translated dictionary so validation messages come back
 * in the user's language — see lib/polls/actions.ts, which calls this with
 * `t` from getT() before parsing. */
export function createPollSchema(t: Dictionary) {
  const pollOptionInput = pollOptionInputSchema(t);
  return z.discriminatedUnion("type", [
    z.object({
      type: z.literal("single"),
      group_id: z.string().uuid(),
      question: z.string().trim().min(1).max(300),
      description: z.string().trim().max(2000).optional().or(z.literal("")),
      options: z.array(pollOptionInput).min(2, t.errors.atLeast2Options),
      settings: singleSettings,
    }),
    z.object({
      type: z.literal("multi"),
      group_id: z.string().uuid(),
      question: z.string().trim().min(1).max(300),
      description: z.string().trim().max(2000).optional().or(z.literal("")),
      options: z.array(pollOptionInput).min(2, t.errors.atLeast2Options),
      settings: multiSettings,
    }),
    z.object({
      type: z.literal("rank"),
      group_id: z.string().uuid(),
      question: z.string().trim().min(1).max(300),
      description: z.string().trim().max(2000).optional().or(z.literal("")),
      options: z.array(pollOptionInput).min(2, t.errors.atLeast2Options),
      settings: rankSettings,
    }),
    z.object({
      type: z.literal("bracket"),
      group_id: z.string().uuid(),
      question: z.string().trim().min(1).max(300),
      description: z.string().trim().max(2000).optional().or(z.literal("")),
      options: z.array(pollOptionInput).min(4, t.errors.bracketNeeds4Options),
      settings: bracketSettings,
    }),
  ]);
}

export type CreatePollInput = z.infer<ReturnType<typeof createPollSchema>>;

export const castBallotSchema = z.object({
  poll_id: z.string().uuid(),
  option_ids: z.array(z.string().uuid()).min(1),
  ranks: z.array(z.number().int().min(1)).optional(),
});

export const recordMatchupSchema = z.object({
  poll_id: z.string().uuid(),
  option_a: z.string().uuid(),
  option_b: z.string().uuid(),
  winner: z.string().uuid(),
});

export const addOptionSchema = z.object({
  poll_id: z.string().uuid(),
  label: z.string().trim().min(1).max(200),
  image_url: z.string().url().optional().or(z.literal("")),
});

export function createGroupSchema(t: Dictionary) {
  return z.object({
    name: z.string().trim().min(1, t.errors.giveGroupAName).max(80),
  });
}

export const joinGroupSchema = z.object({
  code: z.string().trim().min(1),
});
