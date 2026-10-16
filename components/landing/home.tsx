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
    if (reduced) return;
    let revert: (() => void) | undefined;
    let destroy: (() => void) | undefined;
    let alive = true;
    (async () => {
      const [{ default: gsap }, { ScrollTrigger }, { default: Lenis }] = await Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger"),
        import("lenis"),
      ]);
      if (!alive || !root.current) return;
      gsap.registerPlugin(ScrollTrigger);
      const lenis = new Lenis({ lerp: 0.085, smoothWheel: true });
      lenis.on("scroll", ScrollTrigger.update);
      const onAnchor = (event: Event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const link = target.closest("a[href^='#']");
        if (!link) return;
        const id = link.getAttribute("href");
        const el = id ? document.querySelector(id) : null;
        if (!el) return;
        event.preventDefault();
        lenis.scrollTo(el as HTMLElement, { offset: -12 });
      };
      root.current.addEventListener("click", onAnchor);
      const onTick = (time: number) => lenis.raf(time * 1000);
      gsap.ticker.add(onTick);
      gsap.ticker.lagSmoothing(0);
      destroy = () => {
        root.current?.removeEventListener("click", onAnchor);
        gsap.ticker.remove(onTick);
        lenis.destroy();
      };
      const ctx = gsap.context(() => {
        const section = root.current?.querySelector(".answers");
        const cards = gsap.utils.toArray<HTMLElement>(".answer");
        if (section) section.classList.add("is-enhanced");
        if (section && cards.length) {
          cards[0]?.classList.add("on");
          ScrollTrigger.create({
            trigger: section,
            start: "top top",
            end: "bottom bottom",
            onUpdate: (self) => {
              const index = Math.min(cards.length - 1, Math.floor(self.progress * cards.length));
              cards.forEach((card, cardIndex) => card.classList.toggle("on", cardIndex === index));
            },
          });
        }
        gsap.from(".req", {
          y: 28,
          autoAlpha: 0,
          duration: 0.7,
          stagger: 0.06,
          ease: "power2.out",
          scrollTrigger: { trigger: ".req-grid", start: "top 75%" },
        });
        gsap.from(".bonus-card", {
          y: 20,
          autoAlpha: 0,
          duration: 0.6,
          stagger: 0.05,
          scrollTrigger: { trigger: ".bonus-grid", start: "top 80%" },
        });
        gsap.to(".laptop", {
          rotateX: 2,
          rotateY: -6,
          ease: "none",
          scrollTrigger: { trigger: ".stage-3d", start: "top 80%", end: "bottom 20%", scrub: true },
        });
      }, root);
      revert = () => ctx.revert();
    })();
    return () => {
      alive = false;
      revert?.();
      destroy?.();
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
      <footer className="colophon">
        <p>Still · Website Change Detector</p>
        <p>Three.js, GSAP, Lenis, and Rive move the page. Supabase keeps the queue. The type is Stretch Pro when you have it, and a wide grotesque until then.</p>
        <p><a href="/extension">Browser extension</a> · <a href="/demo">Sample console</a></p>
      </footer>
    </div>
  );
}

function LampInline() {
  return <i className="lamp lamp-ok" aria-hidden="true" />;
}
