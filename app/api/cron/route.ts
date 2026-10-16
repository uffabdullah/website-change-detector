import { NextResponse } from "next/server";
import { cronSecret } from "@/lib/env";
import { inspectMonitor, sendDigests } from "@/lib/pipeline";
import { createWriter } from "@/lib/supabase/server";
import type { Region } from "@/lib/engine/page-text";
import type { MonitorRow } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = cronSecret();
  if (secret.length < 24 || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const writer = createWriter();
  if (!writer) return new NextResponse("Unconfigured", { status: 500 });
  const { data, error } = await writer.rpc("wcd_claim_checks", { p_secret: secret, p_limit: 2 });
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  const claimed = (data ?? []) as { monitor: MonitorRow; regions: Region[]; previous_text: string | null }[];
  const results = [];
  for (const job of claimed) {
    const result = await inspectMonitor({
      monitor: job.monitor,
      regions: job.regions ?? [],
      previousText: job.previous_text,
      writer,
      secret,
    });
    results.push({ id: job.monitor.id, message: result.message });
  }
  await sendDigests(writer, secret);
  return NextResponse.json({ checked: results.length, results });
}
