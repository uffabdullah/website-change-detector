"use client";

import { useEffect, useRef, useState } from "react";

function tone(kind: "hover" | "click") {
  const audio = getAudio();
  if (!audio || audio.state === "closed") return;
  const now = audio.currentTime;
  const osc = audio.createOscillator();
  const amp = audio.createGain();
  osc.type = kind === "click" ? "sine" : "triangle";
  osc.frequency.setValueAtTime(kind === "click" ? 196 : 740, now);
  if (kind === "click") osc.frequency.exponentialRampToValueAtTime(120, now + 0.08);
  amp.gain.setValueAtTime(kind === "click" ? 0.045 : 0.02, now);
  amp.gain.exponentialRampToValueAtTime(0.0001, now + (kind === "click" ? 0.12 : 0.05));
  osc.connect(amp);
  amp.connect(audio.destination);
  osc.start(now);
  osc.stop(now + 0.14);
}

let context: AudioContext | null = null;
let soundOn = true;

function getAudio() {
  if (!soundOn) return null;
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!context) context = new Ctx();
  if (context.state === "suspended") void context.resume();
  return context;
}

export function CursorFx() {
  const dot = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(true);
  const [fine, setFine] = useState(false);

  useEffect(() => {
    const pointer = window.matchMedia("(pointer: fine)").matches && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setFine(pointer);
    if (pointer) document.body.classList.add("has-cursor");
    soundOn = on;

    const pos = { x: -100, y: -100 };
    const lag = { x: -100, y: -100 };
    let frame = 0;
    let hot = false;

    const paint = () => {
      frame = requestAnimationFrame(paint);
      lag.x += (pos.x - lag.x) * 0.22;
      lag.y += (pos.y - lag.y) * 0.22;
      if (dot.current) dot.current.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0) translate(-50%, -50%)`;
      if (ring.current) ring.current.style.transform = `translate3d(${lag.x}px, ${lag.y}px, 0) translate(-50%, -50%)`;
    };
    if (pointer) frame = requestAnimationFrame(paint);

    const move = (event: PointerEvent) => {
      pos.x = event.clientX;
      pos.y = event.clientY;
      const next = Boolean((event.target as Element | null)?.closest?.("a, button, input, textarea, select, label"));
      if (next !== hot) {
        hot = next;
        document.body.classList.toggle("cursor-hot", hot);
        if (hot) tone("hover");
      }
    };
    const down = () => tone("click");
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerdown", down);

    return () => {
      cancelAnimationFrame(frame);
      document.body.classList.remove("has-cursor", "cursor-hot");
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerdown", down);
    };
  }, [on]);

  return (
    <>
      {fine ? (
        <>
          <div ref={ring} className="cursor-ring" />
          <div ref={dot} className="cursor-dot" />
        </>
      ) : null}
      <button
        className={`sound-toggle ${on ? "is-on" : ""}`}
        type="button"
        aria-pressed={on}
        onClick={() => {
          soundOn = !on;
          setOn((value) => !value);
        }}
      >
        <i className={`lamp ${on ? "lamp-ok" : "lamp-blocked"}`} />
        {on ? "Sound on" : "Sound off"}
      </button>
    </>
  );
}
