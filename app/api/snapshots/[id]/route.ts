import { createClientForUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const supabase = await createClientForUser();
  if (!supabase) return new Response("Unconfigured", { status: 500 });
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return new Response("Sign in", { status: 401 });
  const { data } = await supabase.from("wcd_snapshots").select("screenshot_base64").eq("id", id).maybeSingle();
  if (!data?.screenshot_base64) return new Response("No screenshot", { status: 404 });
  const bytes = Buffer.from(data.screenshot_base64, "base64");
  return new Response(new Uint8Array(bytes), {
    headers: { "content-type": "image/png", "cache-control": "private, max-age=3600" },
  });
}
