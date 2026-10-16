"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";
import { Scene } from "./scene";

const RiveWell = dynamic(() => import("./rive-well"), {
  ssr: false,
  loading: () => <div className="rive-well" />,
});

const answers = [
  {
    q: "Is an outage or a CAPTCHA a change?",
    a: "No. The lamp turns Error or Blocked. The last real version stays put, and nothing is filed as a new snapshot.",
  },
  {
    q: "If 200 people watch one URL, is it fetched 200 times?",
    a: "No. The page is rendered once and shared. Everyone watching that address reads the same fetch.",
  },
  {
    q: "How do endless alerts get stopped?",
    a: "Timestamps, counters, ads, banners, and random tokens are stripped before the hash. Sensitivity, plus regions you watch or ignore, does the rest. If the stable text is unchanged, there is no snapshot and no alert.",
  },
  {
    q: "How is a site kept from being hammered?",
    a: "Fifteen minutes is the shortest interval. One queue per host, a gap between requests, timeouts, retries that back off, and robots.txt.",
  },
];

const requirements = [
  ["01", "Add a page", "A name, a public URL, and an interval from 15 minutes to 24 hours. The page is rendered in a headless browser."],
  ["02", "A real queue", "Checks run on a schedule with timeouts and retries. Public pages only. Credentials are refused."],
  ["03", "Snapshots with a reason", "Each check keeps the text and a screenshot. A new version is stored only when the stable hash changes."],
  ["04", "Noise, then sensitivity", "Volatile text is removed. High, medium, or low decides how large a real change must be before it speaks."],
  ["05", "Regions", "A visual picker saves CSS selectors for what to watch and what to ignore."],
  ["06", "Three ways to look", "A text diff, a highlighted screenshot diff, and a side-by-side of any two versions."],
  ["07", "Alerts, once", "Email, Telegram, or Discord, with the summary and a link. Duplicates are dropped. A daily digest is optional."],
  ["08", "A timeline", "Every page has a version history. The console shows last checked, last changed, and OK, Error, or Blocked."],
];

const bonus = [
  ["Keywords", "Alert only when the diff contains the words you care about."],
  ["Numbers", "Prices and percents are tracked and drawn as a chart."],
  ["One line", "Each real change gets a single-sentence summary."],
  ["Extension", "Add the tab you are already on."],
  ["RSS", "Every page has its own feed of versions."],
];

const noise = ["timestamps", "counters", "ads", "rotating banners", "random tokens", "session crumbs"];

export function Home() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || !root.current) return;
    let alive = true;
    let revert: (() => void) | undefined;
    (async () => {
      const { default: gsap } = await import("gsap");
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      if (!alive || !root.current) return;
      gsap.registerPlugin(ScrollTrigger);
      const ctx = gsap.context(() => {
        gsap.utils.toArray<HTMLElement>(".req, .bonus-card").forEach((card) => {
          ScrollTrigger.create({
            trigger: card,
            start: "top 90%",
            once: true,
            onEnter: () => card.classList.add("in"),
          });
        });
      }, root);
      revert = () => ctx.revert();
    })();
    return () => {
      alive = false;
      revert?.();
    };
  }, []);

  return (
    <div ref={root}>
      <header className="nav">
        <a className="brand" href="#top">Still</a>
        <nav className="nav-links">
          <a href="#answers">Rules</a>
          <a href="#method">Method</a>
          <a href="#device">Console</a>
          <a href="#bonus">Bonus</a>
        </nav>
        <a className="btn" href="/console">Open console</a>
      </header>
      <main id="top">
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">Public web monitor</p>
            <h1 className="display">
              <span>Website</span>
              <span>Change</span>
              <span>Detector</span>
            </h1>
            <p className="deck">It watches a public page and only speaks when something real has changed.</p>
            <div className="hero-actions">
              <a className="btn btn-hot" href="/console">Open the console</a>
              <a className="btn btn-ghost" href="/demo">Inspect a sample</a>
            </div>
            <ul className="hero-meta">
              <li><LampInline /> 15 min – 24 h</li>
              <li>No stored credentials</li>
              <li>One fetch, many watchers</li>
            </ul>
          </div>
          <div className="hero-stage">
            <Scene />
          </div>
        </section>
        <div className="marquee" aria-hidden="true">
          <div className="marquee-track">
            {[0, 1].map((copy) => (
              <p key={copy}>
                {noise.map((word) => (
                  <span key={`${copy}-${word}`}>{word}</span>
                ))}
              </p>
            ))}
          </div>
        </div>
        <section className="answers" id="answers">
          <div className="answers-pin">
            {answers.map((item, index) => (
              <article className="answer" key={item.q}>
                <p className="kicker">0{index + 1}</p>
                <h2>{item.q}</h2>
                <p>{item.a}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="reqs" id="method">
          <p className="eyebrow">Eight conditions</p>
          <h2 className="display display-sm">What it actually does</h2>
          <div className="req-grid">
            {requirements.map(([no, title, copy]) => (
              <article className="req panel" key={no}>
                <span className="req-no">{no}</span>
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="device-section" id="device">
          <div>
            <p className="eyebrow">Device study</p>
            <h2 className="display display-sm">The console, in the metal</h2>
            <p className="deck">A product render built in the page: status lamps, a timeline, and a change arriving without the noise around it.</p>
          </div>
          <div className="stage-3d">
            <div className="laptop">
              <div className="screen">
                <div className="screen-top">
                  <span className="lamp lamp-ok" /> North ferry
                  <em>OK</em>
                </div>
                <p>Last checked 12:40 · Last changed 12:10</p>
                <div className="screen-row">Adult fare changed from $18 to $22.</div>
                <p className="quiet">Ignored: “updated 2 minutes ago”, “1,204 views”.</p>
              </div>
            </div>
          </div>
        </section>
        <section className="bonus" id="bonus">
          <p className="eyebrow">Also on the desk</p>
          <div className="bonus-grid">
            {bonus.map(([title, copy]) => (
              <article className="bonus-card panel" key={title}>
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
            <article className="bonus-card panel rive-card">
              <h3>Vector motion</h3>
              <p>A Rive state machine, toned to the instrument.</p>
              <RiveWell />
            </article>
          </div>
        </section>
      </main>
      </div>
  );
}

function LampInline() {
  return <i className="lamp lamp-ok" aria-hidden="true" />;
}
