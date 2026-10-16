import { NextResponse } from "next/server";
import { cronSecret } from "@/lib/env";
import { inspectMonitor } from "@/lib/pipeline";
import { createClientForUser, createWriter } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST() {
  const supabase = await createClientForUser();
  const writer = createWriter();
  const secret = cronSecret();
  if (!supabase || !writer || secret.length < 24) {
    return NextResponse.json({ message: "The scheduler is not configured." }, { status: 500 });
  }
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ message: "Sign in first." }, { status: 401 });
  const { data: monitors } = await supabase
    .from("wcd_monitors")
    .select("*")
    .lte("next_check_at", new Date().toISOString())
    .order("next_check_at", { ascending: true })
    .limit(2);
  const messages: string[] = [];
  for (const monitor of monitors ?? []) {
    const { data: regions } = await supabase.from("wcd_regions").select("kind, selector").eq("monitor_id", monitor.id);
    const { data: previous } = await supabase
      .from("wcd_snapshots")
      .select("text_content")
      .eq("monitor_id", monitor.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const result = await inspectMonitor({
      monitor,
      regions: regions ?? [],
      previousText: previous?.text_content ?? null,
      writer,
      secret,
    });
    messages.push(`${monitor.name}: ${result.message}`);
  }
  return NextResponse.json({
    message: messages.length ? messages.join(" ") : "Nothing is due. The queue is quiet.",
  });
}
