import { DueButton } from "@/components/console/controls";
import { Lamp } from "@/components/marks";
import { formatInterval, formatWhen, statusLabel } from "@/lib/format";
import { createClientForUser } from "@/lib/supabase/server";
import type { MonitorRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ConsolePage() {
  const supabase = await createClientForUser();
  const { data } = supabase ? await supabase.from("wcd_monitors").select("*").order("created_at", { ascending: false }) : { data: [] };
  const monitors = (data ?? []) as MonitorRow[];
  const counts = {
    pages: monitors.length,
    ok: monitors.filter((item) => item.status === "ok").length,
    blocked: monitors.filter((item) => item.status === "blocked").length,
    error: monitors.filter((item) => item.status === "error").length,
  };
  return (
    <main>
      <p className="eyebrow">Console</p>
      <div className="split-head">
        <h1 className="display display-sm">Watching</h1>
        <DueButton />
      </div>
      <div className="statbar">
        <div className="stat"><b>{counts.pages}</b>Pages</div>
        <div className="stat"><b>{counts.ok}</b>OK</div>
        <div className="stat"><b>{counts.blocked}</b>Blocked</div>
        <div className="stat"><b>{counts.error}</b>Error</div>
      </div>
      <p className="quiet">A URL is fetched once and shared. Outages and CAPTCHAs stay lamps, not versions. The hosted queue runs daily; Run due checks walks anything that is already late.</p>
      {monitors.length === 0 ? (
        <p>No pages yet. <a href="/console/new">Add a public URL</a> or <a href="/demo">inspect the sample</a>.</p>
      ) : (
        <div className="cards">
          {monitors.map((monitor) => (
            <a className="card" key={monitor.id} href={`/console/${monitor.id}`}>
              <strong><Lamp status={monitor.status} /> {monitor.name}</strong>
              <span className="card-url">{monitor.url}</span>
              <span>{statusLabel(monitor.status)} · every {formatInterval(monitor.interval_minutes)}</span>
              <span className="quiet">Checked {formatWhen(monitor.last_checked_at)} · Changed {formatWhen(monitor.last_changed_at)}</span>
            </a>
          ))}
        </div>
      )}
    </main>
  );
}
