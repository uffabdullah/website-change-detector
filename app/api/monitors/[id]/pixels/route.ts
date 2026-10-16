import { highlightDiff } from "@/lib/engine/screenshot";
import { createClientForUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const url = new URL(request.url);
  const left = url.searchParams.get("a");
  const right = url.searchParams.get("b");
  if (!left || !right) return new Response("Choose two versions", { status: 400 });
  const supabase = await createClientForUser();
  if (!supabase) return new Response("Unconfigured", { status: 500 });
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return new Response("Sign in", { status: 401 });
  const { data: rows } = await supabase
    .from("wcd_snapshots")
    .select("id, screenshot_base64")
    .eq("monitor_id", id)
    .in("id", [left, right]);
  const a = rows?.find((row) => row.id === left)?.screenshot_base64;
  const b = rows?.find((row) => row.id === right)?.screenshot_base64;
  if (!a || !b) return new Response("Both versions need a screenshot", { status: 404 });
  const diff = highlightDiff(Buffer.from(a, "base64"), Buffer.from(b, "base64"));
  if (!diff) return new Response("Could not compare those images", { status: 422 });
  return new Response(new Uint8Array(diff), {
    headers: { "content-type": "image/png", "cache-control": "private, max-age=300" },
  });
}
