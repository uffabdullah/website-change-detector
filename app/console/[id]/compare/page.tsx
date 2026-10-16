import { notFound } from "next/navigation";
import { TextDiff } from "@/components/marks";
import { formatWhen } from "@/lib/format";
import { createClientForUser } from "@/lib/supabase/server";
import type { SnapshotRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ComparePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ a?: string; b?: string; view?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const supabase = await createClientForUser();
  if (!supabase) notFound();
  const { data: versions } = await supabase
    .from("wcd_snapshots")
    .select("id, created_at, summary, text_content, screenshot_base64")
    .eq("monitor_id", id)
    .order("created_at", { ascending: false });
  const rows = (versions ?? []) as SnapshotRow[];
  if (rows.length < 2) {
    return (
      <main>
        <h1 className="display display-sm">Compare</h1>
        <p>Two saved versions are needed. Noise-only checks never become a version.</p>
      </main>
    );
  }
  const right = rows.find((row) => row.id === query.b) ?? rows[0];
  const left = rows.find((row) => row.id === query.a && row.id !== right.id) ?? rows.find((row) => row.id !== right.id) ?? rows[1];
  const view = query.view === "pixels" || query.view === "side" ? query.view : "text";
  const href = (next: string) => `/console/${id}/compare?a=${left.id}&b=${right.id}&view=${next}`;
  return (
    <main>
      <p className="eyebrow">Any two versions</p>
      <h1 className="display display-sm">Compare</h1>
      <form className="split-head" action={`/console/${id}/compare`}>
        <label className="field">Earlier
          <select name="a" defaultValue={left.id}>
            {rows.map((row) => <option key={row.id} value={row.id}>{formatWhen(row.created_at)} — {row.summary || "Version"}</option>)}
          </select>
        </label>
        <label className="field">Later
          <select name="b" defaultValue={right.id}>
            {rows.map((row) => <option key={row.id} value={row.id}>{formatWhen(row.created_at)} — {row.summary || "Version"}</option>)}
          </select>
        </label>
        <input type="hidden" name="view" value={view} />
        <button className="btn" type="submit">Show</button>
      </form>
      <div className="tabs">
        <a className="btn" aria-current={view === "text" ? "page" : undefined} href={href("text")}>Text diff</a>
        <a className="btn" aria-current={view === "pixels" ? "page" : undefined} href={href("pixels")}>Highlighted pixels</a>
        <a className="btn" aria-current={view === "side" ? "page" : undefined} href={href("side")}>Side by side</a>
      </div>
      {view === "text" ? <TextDiff before={left.text_content || ""} after={right.text_content || ""} /> : null}
      {view === "pixels" ? (
        left.screenshot_base64 && right.screenshot_base64 ? (
          <img className="shot" alt="Highlighted screenshot difference" src={`/api/monitors/${id}/pixels?a=${left.id}&b=${right.id}`} />
        ) : (
          <p className="quiet">These versions do not both have a browser screenshot yet. The text diff is still there.</p>
        )
      ) : null}
      {view === "side" ? (
        <div className="columns">
          <article>
            <h2>{formatWhen(left.created_at)}</h2>
            {left.screenshot_base64 ? <img className="shot" alt="" src={`/api/snapshots/${left.id}`} /> : null}
            <pre className="diff">{left.text_content}</pre>
          </article>
          <article>
            <h2>{formatWhen(right.created_at)}</h2>
            {right.screenshot_base64 ? <img className="shot" alt="" src={`/api/snapshots/${right.id}`} /> : null}
            <pre className="diff">{right.text_content}</pre>
          </article>
        </div>
      ) : null}
    </main>
  );
}
