import { notFound } from "next/navigation";
import { Picker } from "@/components/console/picker";
import { createClientForUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PickerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClientForUser();
  if (!supabase) notFound();
  const { data } = await supabase.from("wcd_monitors").select("id, name").eq("id", id).maybeSingle();
  if (!data) notFound();
  return (
    <main>
      <p className="eyebrow">Regions</p>
      <h1 className="display display-sm">{data.name}</h1>
      <p className="deck">Watch keeps only what you click. Ignore removes a region before the hash. Selectors are saved as CSS, and the page’s own scripts never run in here.</p>
      <Picker monitorId={id} />
    </main>
  );
}
