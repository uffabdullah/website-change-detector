import { Lamp, NumberChart, TextDiff } from "@/components/marks";
import { demoPlate, highlightDiff } from "@/lib/engine/screenshot";
import type { TrackedNumber } from "@/lib/engine/change";

const before = "The noon boat leaves the north pier. Adult fare: $18. The cafe serves barley soup.";
const after = "The noon boat leaves the south pier. Adult fare: $22. The cafe serves barley soup.";
const series: { at: string; numbers: TrackedNumber[] }[] = [
  { at: "1", numbers: [{ key: "adult fare", label: "Adult fare", value: 18, display: "$18" }] },
  { at: "2", numbers: [{ key: "adult fare", label: "Adult fare", value: 18, display: "$18" }] },
  { at: "3", numbers: [{ key: "adult fare", label: "Adult fare", value: 22, display: "$22" }] },
];

export default function DemoPage() {
  const pixels = highlightDiff(demoPlate(0), demoPlate(80));
  const href = pixels ? `data:image/png;base64,${pixels.toString("base64")}` : "";
  return (
    <div className="shell">
      <aside className="side">
        <a className="brand" href="/">Still</a>
        <p className="eyebrow">Sample console</p>
        <nav className="side-nav">
          <a href="/demo" aria-current="page">Monitors</a>
          <a href="/console">Your console</a>
          <a href="/extension">Extension</a>
        </nav>
      </aside>
      <main className="shell-main">
        <p className="eyebrow">Sample data</p>
        <h1 className="display display-sm">Three lamps</h1>
        <div className="cards">
          <article className="card">
            <strong><Lamp status="ok" /> North ferry</strong>
            <span>OK · every 1 hour</span>
            <span className="quiet">Checked today · Changed today</span>
            <span>Adult fare changed from $18 to $22.</span>
          </article>
          <article className="card">
            <strong><Lamp status="blocked" /> City archive</strong>
            <span>Blocked · CAPTCHA</span>
            <span className="quiet">Not stored as a change. The last real version stays.</span>
          </article>
          <article className="card">
            <strong><Lamp status="error" /> Ridge weather</strong>
            <span>Error · timed out</span>
            <span className="quiet">An outage is a lamp, not a new version. The retry waits, then backs off.</span>
          </article>
        </div>
        <h2>One-line summary</h2>
        <p>Adult fare changed from $18 to $22.</p>
        <p className="quiet">Ignored on every load: “updated 2 minutes ago” and “1,204 views”.</p>
        <h2>Text diff</h2>
        <TextDiff before={before} after={after} />
        <h2>Highlighted screenshot</h2>
        {href ? <img className="shot" alt="Sample pixel diff, phosphor where the plate moved" src={href} /> : null}
        <h2>Number tracking</h2>
        <NumberChart points={series} />
        <p className="quiet">Keyword alert for “fare” would fire. A keyword list of “weather” would stay quiet. Two hundred watchers of this URL still mean one fetch.</p>
      </main>
    </div>
  );
}
