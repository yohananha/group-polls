"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createGroupSchema, joinGroupSchema } from "@/lib/polls/schema";
import { randomCode, slugify } from "@/lib/slug";
import { getT } from "@/lib/i18n/server";

export type ActionResult = { error: string } | { error?: undefined };

export async function createGroup(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { t } = await getT();
  const parsed = createGroupSchema(t).safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? t.errors.invalidInput };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: t.errors.notSignedIn };

  const baseSlug = slugify(parsed.data.name);

  // Retry on the (rare) slug or invite_code collision rather than checking
  // existence first — avoids a check-then-insert race between two people
  // creating similarly-named groups at once.
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = attempt === 0 ? baseSlug : `${baseSlug}-${randomCode(4)}`;
    // Deliberately not chaining .select() here: requesting the row back
    // (RETURNING) makes Postgres also check it against the groups SELECT
    // policy (is_member(id)) — but that membership row is only created by
    // the handle_new_group AFTER INSERT trigger, and that timing races the
    // RETURNING visibility check, so it fails RLS even though the insert
    // itself is fine. We already know `slug` locally, so there's nothing to
    // read back.
    const { error } = await supabase.from("groups").insert({
      name: parsed.data.name,
      slug,
      invite_code: randomCode(8),
      created_by: user.id,
    });

    if (!error) {
      redirect(`/g/${slug}`);
    }
    if (error.code !== "23505" /* unique_violation */) {
      return { error: error.message };
    }
  }

  return { error: t.errors.couldNotCreateGroup };
}

export async function joinGroup(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { t } = await getT();
  const parsed = joinGroupSchema.safeParse({ code: formData.get("code") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? t.errors.invalidCode };
  }

  const supabase = await createClient();
  // Normalize: accept a pasted full invite link or a bare code.
  const codeMatch = parsed.data.code.match(/([a-z0-9]{6,12})\s*$/i);
  const code = (codeMatch?.[1] ?? parsed.data.code).toLowerCase();

  const { data, error } = await supabase.rpc("join_group_by_code", { p_code: code });
  if (error || !data) {
    return { error: t.errors.codeDoesNotMatch };
  }

  revalidatePath("/");
  redirect(`/g/${data.slug}`);
}
