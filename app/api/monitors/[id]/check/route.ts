import { NextResponse } from "next/server";
import { cronSecret } from "@/lib/env";
import { inspectMonitor } from "@/lib/pipeline";
import { createClientForUser, createWriter } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const supabase = await createClientForUser();
  const writer = createWriter();
  const secret = cronSecret();
  if (!supabase || !writer || secret.length < 24) {
    return NextResponse.json({ message: "The scheduler is not configured." }, { status: 500 });
  }
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ message: "Sign in first." }, { status: 401 });
  const { data: monitor } = await supabase.from("wcd_monitors").select("*").eq("id", id).maybeSingle();
  if (!monitor) return NextResponse.json({ message: "That page is not in your console." }, { status: 404 });
  const { data: regions } = await supabase.from("wcd_regions").select("kind, selector").eq("monitor_id", id);
  const { data: previous } = await supabase
    .from("wcd_snapshots")
    .select("text_content")
    .eq("monitor_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const result = await inspectMonitor({
    monitor,
    regions: regions ?? [],
    previousText: previous?.text_content ?? null,
    writer,
    secret,
    manual: true,
  });
  return NextResponse.json(result);
}
