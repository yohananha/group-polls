import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { JoinConfirmButton } from "@/components/JoinConfirmButton";
import { getT } from "@/lib/i18n/server";

export default async function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const supabase = await createClient();
  const { t } = await getT();

  const { data } = await supabase.rpc("preview_group_by_code", { p_code: code }).single();
  if (!data) notFound();

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-sm text-neutral-500">{t.joinPage.invitedTo}</p>
        <h1 className="text-2xl font-semibold">{data.name}</h1>
        <p className="text-sm text-neutral-500">{t.joinPage.members(data.member_count)}</p>
        <JoinConfirmButton code={code} />
      </main>
    </div>
  );
}
