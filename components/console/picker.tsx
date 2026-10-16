"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { addRegion } from "@/app/console/actions";

function selectorFor(element: Element) {
  if (element.id && /^[A-Za-z][\w-]*$/.test(element.id)) return `#${CSS.escape(element.id)}`;
  const parts: string[] = [];
  let node: Element | null = element;
  while (node && node.tagName.toLowerCase() !== "body" && parts.length < 6) {
    const current: Element = node;
    const tag = current.tagName.toLowerCase();
    const parent: Element | null = current.parentElement;
    if (!parent) break;
    const same = [...parent.children].filter((child) => child.tagName === current.tagName);
    const index = same.indexOf(current) + 1;
    parts.unshift(`${tag}:nth-of-type(${index})`);
    node = parent;
  }
  return parts.join(" > ");
}

export function Picker({ monitorId }: { monitorId: string }) {
  const router = useRouter();
  const frame = useRef<HTMLIFrameElement>(null);
  const [mode, setMode] = useState<"watch" | "ignore">("watch");
  const [html, setHtml] = useState("");
  const [pageUrl, setPageUrl] = useState("");
  const [message, setMessage] = useState("Loading the public page…");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const response = await fetch(`/api/monitors/${monitorId}/preview`);
      const body = (await response.json()) as { html?: string; url?: string; message?: string };
      if (cancel) return;
      if (!response.ok || !body.html) {
        setMessage(body.message || "The preview could not be loaded.");
        return;
      }
      setHtml(body.html);
      setPageUrl(body.url || "");
      setMessage("Click a region. Scripts on the page are not run.");
    })();
    return () => {
      cancel = true;
    };
  }, [monitorId]);

  useEffect(() => {
    const iframe = frame.current;
    if (!iframe || !html) return;
    const onLoad = () => {
      const doc = iframe.contentDocument;
      if (!doc) return;
      if (pageUrl && !doc.querySelector("base")) {
        const base = doc.createElement("base");
        base.href = pageUrl;
        doc.head.prepend(base);
      }
      const style = doc.createElement("style");
      style.textContent = "*{cursor:crosshair!important}.wcd-hot{outline:2px solid #e2ff4d!important;outline-offset:2px}";
      doc.head.append(style);
      let hot: Element | null = null;
      const move = (event: Event) => {
        const target = event.target;
        if (!(target instanceof Element) || target === doc.body || target === doc.documentElement) return;
        if (hot && hot !== target) hot.classList.remove("wcd-hot");
        hot = target;
        hot.classList.add("wcd-hot");
      };
      const click = async (event: Event) => {
        event.preventDefault();
        event.stopPropagation();
        const target = event.target;
        if (!(target instanceof Element)) return;
        setPending(true);
        const result = await addRegion(monitorId, mode, selectorFor(target));
        setMessage(result.message || `Saved as a region to ${mode}.`);
        setPending(false);
        router.refresh();
      };
      doc.addEventListener("mousemove", move, true);
      doc.addEventListener("click", click, true);
    };
    iframe.addEventListener("load", onLoad);
    return () => iframe.removeEventListener("load", onLoad);
  }, [html, mode, monitorId, pageUrl, router]);

  return (
    <div className="picker">
      <div className="choice">
        <label><input type="radio" name="mode" checked={mode === "watch"} onChange={() => setMode("watch")} /> Watch</label>
        <label><input type="radio" name="mode" checked={mode === "ignore"} onChange={() => setMode("ignore")} /> Ignore</label>
      </div>
      <p className="quiet">{pending ? "Saving selector…" : message}</p>
      {html ? <iframe ref={frame} className="picker-frame" sandbox="allow-same-origin" srcDoc={html} title="Page region picker" /> : null}
    </div>
  );
}
