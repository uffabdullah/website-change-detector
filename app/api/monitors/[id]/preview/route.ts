import { NextResponse } from "next/server";
import { cacheIsFresh } from "@/lib/engine/change";
import { cronSecret } from "@/lib/env";
import { renderHttp } from "@/lib/render-page";
import { sanitizeForPicker } from "@/lib/sanitize";
import { createClientForUser, createWriter } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const supabase = await createClientForUser();
  const writer = createWriter();
  const secret = cronSecret();
  if (!supabase || !writer || secret.length < 24) return NextResponse.json({ message: "Not configured." }, { status: 500 });
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ message: "Sign in first." }, { status: 401 });
  const { data: monitor } = await supabase.from("wcd_monitors").select("canonical_url, url").eq("id", id).maybeSingle();
  if (!monitor) return NextResponse.json({ message: "Missing page." }, { status: 404 });
  const { data: cache } = await writer.rpc("wcd_cache_get", { p_url: monitor.canonical_url, p_secret: secret });
  const row = cache as { html?: string; fetched_at?: string } | null;
  if (row?.html && row.fetched_at && cacheIsFresh(new Date(row.fetched_at).getTime(), Date.now())) {
    return NextResponse.json({ html: sanitizeForPicker(row.html, monitor.url), url: monitor.url });
  }
  const rendered = await renderHttp(monitor.canonical_url);
  if (!rendered.html) return NextResponse.json({ message: rendered.error || "The page could not be previewed." }, { status: 422 });
  return NextResponse.json({ html: sanitizeForPicker(rendered.html, rendered.finalUrl), url: rendered.finalUrl });
}
