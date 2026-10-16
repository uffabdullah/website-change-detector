import { notFound } from "next/navigation";
import { CheckButton } from "@/components/console/controls";
import { deleteMonitor, deleteRegion } from "@/app/console/actions";
import { Lamp, NumberChart } from "@/components/marks";
import { formatInterval, formatWhen, statusLabel } from "@/lib/format";
import { createClientForUser } from "@/lib/supabase/server";
import type { MonitorRow, RegionRow, SnapshotRow } from "@/lib/types";
import type { TrackedNumber } from "@/lib/engine/change";

export const dynamic = "force-dynamic";

export default async function MonitorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClientForUser();
  if (!supabase) notFound();
  const { data: monitor } = await supabase.from("wcd_monitors").select("*").eq("id", id).maybeSingle();
  if (!monitor) notFound();
  const page = monitor as MonitorRow;
  const { data: regionRows } = await supabase.from("wcd_regions").select("*").eq("monitor_id", id).order("created_at");
  const { data: snaps } = await supabase
    .from("wcd_snapshots")
    .select("id, created_at, summary, numbers, change_ratio")
    .eq("monitor_id", id)
    .order("created_at", { ascending: false })
    .limit(20);
  const regions = (regionRows ?? []) as RegionRow[];
  const versions = (snaps ?? []) as SnapshotRow[];
  const chart = [...versions].reverse().map((version) => ({
    at: version.created_at,
    numbers: (version.numbers ?? []) as TrackedNumber[],
  }));
  const [latest, previous] = versions;
  return (
    <main>
      <p className="eyebrow">{statusLabel(page.status)}</p>
      <div className="split-head">
        <h1 className="display display-sm"><Lamp status={page.status} /> {page.name}</h1>
        <CheckButton id={page.id} />
      </div>
      <p className="card-url">{page.url}</p>
      <div className="statbar">
        <div className="stat"><b>{formatInterval(page.interval_minutes)}</b>Interval</div>
        <div className="stat"><b>{formatWhen(page.last_checked_at)}</b>Last checked</div>
        <div className="stat"><b>{formatWhen(page.last_changed_at)}</b>Last changed</div>
        <div className="stat"><b>{page.sensitivity}</b>Sensitivity</div>
      </div>
      {page.last_error ? <p className="notice">{page.last_error}</p> : null}
      {page.last_summary ? <p>{page.last_summary}</p> : <p className="quiet">No version yet. The first check becomes the baseline and does not alert.</p>}
      <div className="tabs">
        <a className="btn" href={`/console/${page.id}/picker`}>Pick regions</a>
        {latest && previous ? <a className="btn" href={`/console/${page.id}/compare?a=${previous.id}&b=${latest.id}`}>Compare</a> : null}
        <a className="btn btn-ghost" href={`/api/feed/${page.feed_token}`}>RSS</a>
      </div>
      <h2>Numbers</h2>
      <NumberChart points={chart} />
      <h2>Regions</h2>
      {regions.length === 0 ? <p className="quiet">The whole page is watched, after noise filtering. Add a selector when you want less.</p> : null}
      <div className="region-list">
        {regions.map((region) => (
          <form key={region.id} className="version" action={deleteRegion}>
            <input type="hidden" name="id" value={region.id} />
            <input type="hidden" name="monitor_id" value={page.id} />
            <b>{region.kind}</b>
            <code>{region.selector}</code>
            <button className="btn btn-ghost" type="submit">Remove</button>
          </form>
        ))}
      </div>
      <h2>Timeline</h2>
      <div className="timeline">
        {versions.length === 0 ? <p className="quiet">Versions show up only when the stable text changes.</p> : null}
        {versions.map((version, index) => {
          const other = versions[index + 1];
          return (
            <a className="version" key={version.id} href={other ? `/console/${page.id}/compare?a=${other.id}&b=${version.id}` : `/console/${page.id}`}>
              <Lamp status="ok" />
              <span>{version.summary || "Version saved"}</span>
              <time>{formatWhen(version.created_at)}</time>
            </a>
          );
        })}
      </div>
      <p className="quiet">Alerts: {page.alert_mode === "keywords" ? `keywords only (${(page.keywords ?? []).join(", ") || "none yet"})` : "any real change"}{page.digest_enabled ? " · daily digest" : ""}. {page.email || "No email"} · {page.discord_webhook ? "Discord on" : "Discord off"} · {page.telegram_webhook ? "Telegram on" : "Telegram off"}.</p>
      <form action={deleteMonitor}>
        <input type="hidden" name="id" value={page.id} />
        <button className="btn btn-ghost" type="submit">Stop watching</button>
      </form>
    </main>
  );
}
