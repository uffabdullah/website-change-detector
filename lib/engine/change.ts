import { diffWords } from "diff";
import { extractStableText, stableHash, type PageStatus, type Region } from "./page-text";

export type Sensitivity = "low" | "medium" | "high";
export type AlertMode = "all" | "keywords";

export type Segment = { type: "same" | "add" | "del"; text: string };

export type TrackedNumber = { key: string; label: string; value: number; display: string };

const THRESHOLD: Record<Sensitivity, number> = { high: 0, medium: 0.015, low: 0.08 };

export function wordDiff(before: string, after: string): Segment[] {
  return diffWords(before, after).map((part) => ({
    type: part.added ? "add" : part.removed ? "del" : "same",
    text: part.value,
  }));
}

export function changeRatio(before: string, after: string): number {
  const parts = wordDiff(before, after);
  let changed = 0;
  let total = 0;
  for (const part of parts) {
    total += part.text.length;
    if (part.type !== "same") changed += part.text.length;
  }
  if (total === 0) return 0;
  return changed / total;
}

export function changedBlob(before: string, after: string): string {
  return wordDiff(before, after)
    .filter((part) => part.type !== "same")
    .map((part) => part.text)
    .join(" ");
}

const MONEY_SOURCE = String.raw`[$€£₹]\s*(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?`;
const PERCENT_SOURCE = String.raw`(\d+(?:\.\d+)?)\s*%`;

function labelBefore(text: string, index: number): string {
  const start = text.lastIndexOf("\n", index - 1) + 1;
  const prefix = text.slice(start, index).replace(/[:|\-–]+$/g, "").trim();
  const words = prefix.split(/\s+/).filter((word) => /[a-z]/i.test(word));
  return words.slice(-3).join(" ").replace(/\s+/g, " ").trim();
}

function pushNumber(found: Map<string, TrackedNumber>, label: string, value: number, display: string) {
  const clean = label.replace(/\s+/g, " ").trim();
  if (clean.length < 2 || found.size >= 8) return;
  const key = clean.toLowerCase();
  if (!found.has(key)) found.set(key, { key, label: clean, value, display });
}

export function extractNumbers(text: string): TrackedNumber[] {
  const found = new Map<string, TrackedNumber>();
  const money = new RegExp(MONEY_SOURCE, "g");
  const percent = new RegExp(PERCENT_SOURCE, "g");
  for (const match of text.matchAll(money)) {
    const whole = match[1].replace(/,/g, "");
    const value = Number(`${whole}${match[2] ? `.${match[2]}` : ""}`);
    if (!Number.isFinite(value)) continue;
    pushNumber(found, labelBefore(text, match.index ?? 0), value, match[0].replace(/\s+/g, ""));
  }
  for (const match of text.matchAll(percent)) {
    const value = Number(match[1]);
    if (!Number.isFinite(value)) continue;
    pushNumber(found, labelBefore(text, match.index ?? 0), value, `${match[1]}%`);
  }
  return [...found.values()];
}

function clip(value: string, max = 72): string {
  const flat = value.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  return `${flat.slice(0, max - 1).trim()}…`;
}

export function oneLineSummary(before: string, after: string, beforeNumbers: TrackedNumber[], afterNumbers: TrackedNumber[]): string {
  for (const next of afterNumbers) {
    const prev = beforeNumbers.find((item) => item.key === next.key);
    if (prev && prev.value !== next.value) {
      return `${next.label} changed from ${prev.display} to ${next.display}.`.slice(0, 180);
    }
  }
  const parts = wordDiff(before, after);
  const added = parts.map((part) => (part.type === "add" ? clip(part.text) : "")).find((text) => text.length > 8);
  const removed = parts.map((part) => (part.type === "del" ? clip(part.text) : "")).find((text) => text.length > 8);
  if (added && removed) return `Changed “${removed}” to “${added}”.`.slice(0, 180);
  if (added) return `Added “${added}”.`.slice(0, 180);
  if (removed) return `Removed “${removed}”.`.slice(0, 180);
  return "The watched text changed.";
}

export function shouldAlert(input: {
  baseline: boolean;
  ratio: number;
  sensitivity: Sensitivity;
  alertMode: AlertMode;
  keywords: string[];
  diffText: string;
}): boolean {
  if (input.baseline) return false;
  if (input.alertMode === "keywords") {
    const haystack = input.diffText.toLowerCase();
    return input.keywords.some((keyword) => keyword.trim() && haystack.includes(keyword.trim().toLowerCase()));
  }
  return input.ratio > THRESHOLD[input.sensitivity];
}

export type Decision = {
  status: PageStatus;
  error: string | null;
  text: string | null;
  hash: string | null;
  storeSnapshot: boolean;
  alert: boolean;
  ratio: number;
  summary: string | null;
  numbers: TrackedNumber[];
  baseline: boolean;
};

export function decide(input: {
  previousText: string | null;
  html: string;
  pageStatus: PageStatus;
  httpError?: string | null;
  sensitivity: Sensitivity;
  alertMode: AlertMode;
  keywords: string[];
  regions: Region[];
  trackNumbers: boolean;
}): Decision {
  if (input.pageStatus !== "ok") {
    return {
      status: input.pageStatus,
      error: input.httpError || (input.pageStatus === "blocked" ? "Blocked or CAPTCHA. Not stored as a change." : "The page could not be read. Not stored as a change."),
      text: null,
      hash: null,
      storeSnapshot: false,
      alert: false,
      ratio: 0,
      summary: null,
      numbers: [],
      baseline: false,
    };
  }
  const text = extractStableText(input.html, input.regions);
  if (text.length < 20) {
    return {
      status: "error",
      error: "No stable text was left after noise filtering.",
      text: null,
      hash: null,
      storeSnapshot: false,
      alert: false,
      ratio: 0,
      summary: null,
      numbers: [],
      baseline: false,
    };
  }
  const hash = stableHash(text);
  const previous = input.previousText;
  const baseline = !previous;
  if (previous && stableHash(previous) === hash) {
    return {
      status: "ok",
      error: null,
      text,
      hash,
      storeSnapshot: false,
      alert: false,
      ratio: 0,
      summary: null,
      numbers: input.trackNumbers ? extractNumbers(text) : [],
      baseline: false,
    };
  }
  const ratio = previous ? changeRatio(previous, text) : 1;
  const numbers = input.trackNumbers ? extractNumbers(text) : [];
  const previousNumbers = previous && input.trackNumbers ? extractNumbers(previous) : [];
  const summary = previous ? oneLineSummary(previous, text, previousNumbers, numbers) : "First version saved.";
  const diffText = previous ? changedBlob(previous, text) : text;
  return {
    status: "ok",
    error: null,
    text,
    hash,
    storeSnapshot: true,
    alert: shouldAlert({
      baseline,
      ratio,
      sensitivity: input.sensitivity,
      alertMode: input.alertMode,
      keywords: input.keywords,
      diffText,
    }),
    ratio,
    summary,
    numbers,
    baseline,
  };
}

export function cacheIsFresh(fetchedAtMs: number, nowMs: number, windowMs = 15 * 60 * 1000): boolean {
  return nowMs - fetchedAtMs < windowMs;
}

export function nextRun(input: { status: PageStatus | "busy"; intervalMinutes: number; attempts: number; now: number }): { nextCheckAt: number; attempts: number } {
  const intervalMs = input.intervalMinutes * 60 * 1000;
  if (input.status === "busy") {
    return { nextCheckAt: input.now + 30_000, attempts: input.attempts };
  }
  if (input.status === "ok" || input.status === "blocked") {
    return { nextCheckAt: input.now + intervalMs, attempts: 0 };
  }
  const attempts = input.attempts + 1;
  if (attempts < 3) {
    const backoff = Math.min(intervalMs, 2 ** attempts * 60 * 1000);
    return { nextCheckAt: input.now + backoff, attempts };
  }
  return { nextCheckAt: input.now + intervalMs, attempts: 0 };
}

export function intervalAllowed(minutes: number): boolean {
  return Number.isInteger(minutes) && minutes >= 15 && minutes <= 24 * 60;
}
