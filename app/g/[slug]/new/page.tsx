import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { PollComposer } from "@/components/poll/PollComposer";
import { getT } from "@/lib/i18n/server";

export default async function NewPollPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();
  const { t } = await getT();

  const { data: group } = await supabase
    .from("groups")
    .select("id, name, slug")
    .eq("slug", slug)
    .single();

  if (!group) notFound();

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <h1 className="text-xl font-semibold">{t.newPollPage.title(group.name)}</h1>
        <PollComposer groupId={group.id} />
      </main>
    </div>
  );
}
