"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  createPollSchema,
  castBallotSchema,
  recordMatchupSchema,
  addOptionSchema,
} from "@/lib/polls/schema";
import { getT } from "@/lib/i18n/server";
import type { PollSettings, PollType } from "@/lib/supabase/types";

export type ActionResult = { error: string } | { error?: undefined; ok?: true };

/** Server Action bound to a specific group + poll type by the composer form
 * (see components/poll/PollComposer.tsx), so the form only ever submits one
 * branch of the discriminated union. */
export async function createPoll(
  groupId: string,
  type: PollType,
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const { t } = await getT();
  const rawOptions = formData.getAll("option").map((v) => String(v));
  const rawColor = formData.get("color");
  const settings: PollSettings = {
    allow_option_adds: formData.get("allow_option_adds") === "on",
    option_adds_need_approval: formData.get("option_adds_need_approval") === "on",
    allow_vote_change: formData.get("allow_vote_change") === "on",
    anonymous: formData.get("anonymous") === "on",
    results_visibility: (formData.get("results_visibility") as PollSettings["results_visibility"]) ?? "always",
    ...(typeof rawColor === "string" && rawColor ? { color: rawColor } : {}),
    ...(type === "multi"
      ? {
          min_picks: Number(formData.get("min_picks") ?? 1),
          max_picks: Number(formData.get("max_picks") ?? 3),
        }
      : {}),
    ...(type === "rank" && formData.get("top_n")
      ? { top_n: Number(formData.get("top_n")) }
      : {}),
  };

  const parsed = createPollSchema(t).safeParse({
    type,
    group_id: groupId,
    question: formData.get("question"),
    description: formData.get("description") ?? "",
    options: rawOptions.filter((o) => o.trim().length > 0).map((label) => ({ label })),
    settings,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? t.errors.invalidPoll };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: t.errors.notSignedIn };

  const { data: poll, error: pollError } = await supabase
    .from("polls")
    .insert({
      group_id: parsed.data.group_id,
      author_id: user.id,
      question: parsed.data.question,
      description: parsed.data.description || null,
      type: parsed.data.type,
      settings: parsed.data.settings,
    })
    .select("id")
    .single();

  if (pollError || !poll) {
    return { error: pollError?.message ?? t.errors.couldNotCreatePoll };
  }

  const { error: optionsError } = await supabase.from("poll_options").insert(
    parsed.data.options.map((opt, i) => ({
      poll_id: poll.id,
      label: opt.label,
      image_url: opt.image_url || null,
      added_by: user.id,
      position: i,
      approved: true,
    }))
  );

  if (optionsError) {
    // Options failed after the poll row landed — remove the orphaned poll
    // rather than leaving an empty, unvotable poll in the feed.
    await supabase.from("polls").delete().eq("id", poll.id);
    return { error: optionsError.message };
  }

  revalidatePath(`/g`);
  redirect(`/p/${poll.id}`);
}

export async function addOption(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { t } = await getT();
  const parsed = addOptionSchema.safeParse({
    poll_id: formData.get("poll_id"),
    label: formData.get("label"),
    image_url: formData.get("image_url") ?? "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? t.errors.invalidOption };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("add_poll_option", {
    p_poll_id: parsed.data.poll_id,
    p_label: parsed.data.label,
    p_image_url: parsed.data.image_url || null,
  });
  if (error) return { error: error.message };

  revalidatePath(`/p/${parsed.data.poll_id}`);
  return { ok: true };
}

export async function approveOption(optionId: string, pollId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_poll_option", { p_option_id: optionId });
  if (error) return { error: error.message };

  revalidatePath(`/p/${pollId}`);
  return { ok: true };
}

export async function castBallot(input: {
  poll_id: string;
  option_ids: string[];
  ranks?: number[];
}): Promise<ActionResult> {
  const { t } = await getT();
  const parsed = castBallotSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? t.errors.invalidVote };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("cast_ballot", {
    p_poll_id: parsed.data.poll_id,
    p_option_ids: parsed.data.option_ids,
    p_ranks: parsed.data.ranks ?? null,
  });
  if (error) return { error: error.message };

  revalidatePath(`/p/${parsed.data.poll_id}`);
  return { ok: true };
}

export async function recordMatchup(input: {
  poll_id: string;
  option_a: string;
  option_b: string;
  winner: string;
}): Promise<ActionResult> {
  const { t } = await getT();
  const parsed = recordMatchupSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? t.errors.invalidMatchup };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("record_matchup", {
    p_poll_id: parsed.data.poll_id,
    p_option_a: parsed.data.option_a,
    p_option_b: parsed.data.option_b,
    p_winner: parsed.data.winner,
  });
  if (error) return { error: error.message };

  return { ok: true };
}

export async function closePoll(pollId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("polls").update({ status: "closed" }).eq("id", pollId);
  if (error) return { error: error.message };

  revalidatePath(`/p/${pollId}`);
  return { ok: true };
}

export async function deletePoll(pollId: string, groupSlug: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("polls").delete().eq("id", pollId);
  if (error) return { error: error.message };

  redirect(`/g/${groupSlug}`);
}
