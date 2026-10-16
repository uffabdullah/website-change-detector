import { createHash } from "node:crypto";
import * as cheerio from "cheerio";

export type Region = { kind: "watch" | "ignore"; selector: string };
export type PageStatus = "ok" | "error" | "blocked";

const DROP = "script, style, noscript, svg, canvas, iframe, object, embed, template";
const ADS = [
  "ins.adsbygoogle",
  ".adsbygoogle",
  "[id*='google_ads']",
  "[class*='ad-slot']",
  "[class*='rotating-banner']",
  "[aria-label='Advertisement']",
  "[data-ad]",
  ".banner-rotate",
].join(",");

const NOISE: RegExp[] = [
  /\b\d{4}-\d{2}-\d{2}(?:[t\s]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:z|[+-]\d{2}:?\d{2})?)?\b/gi,
  /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2},?\s+\d{4}\b/gi,
  /\b\d{1,2}[:.]\d{2}(?::\d{2})?\s*(?:am|pm)\b/gi,
  /\b\d+\s*(?:sec|second|min|minute|hr|hour|day|week|month|year)s?\s+ago\b/gi,
  /\bjust now\b/gi,
  /\bupdated\s+(?:today|yesterday|moments?\s+ago)\b/gi,
  /\beyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{8,}/g,
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi,
  /\b(?:csrf|nonce|token|session)[=:]\s*[A-Za-z0-9_-]{8,}\b/gi,
  /\b[\da-f]{24,}\b/gi,
  /\b\d{1,3}(?:,\d{3})+\s*(?:views|viewers|comments|likes|shares|watching|online|visitors)?\b/gi,
  /\b(?:views|viewers|comments|likes|shares|watching|online now|visitors)\s*[:.]?\s*\d[\d,]*\b/gi,
  /\b\d[\d,]*\s*(?:views|viewers|comments|likes|shares)\b/gi,
];

const BLOCK_TEXT = [
  /verify you are human/i,
  /verify you are not a robot/i,
  /cf-browser-verification/i,
  /cf-challenge/i,
  /just a moment/i,
  /attention required/i,
  /hcaptcha/i,
  /g-recaptcha/i,
  /recaptcha/i,
  /sorry, you have been blocked/i,
  /enable javascript and cookies to continue/i,
];

function scrub(line: string): string {
  let next = line;
  for (const pattern of NOISE) next = next.replace(new RegExp(pattern.source, pattern.flags), " ");
  return next.replace(/\s+/g, " ").trim();
}

export function extractStableText(html: string, regions: Region[] = []): string {
  const $ = cheerio.load(html);
  $(DROP).remove();
  try {
    $(ADS).remove();
  } catch {
    /* selector miss is not fatal */
  }
  for (const region of regions) {
    if (region.kind !== "ignore" || !region.selector) continue;
    try {
      $(region.selector).remove();
    } catch {
      /* an invalid selector is ignored, not executed */
    }
  }
  const watch = regions.filter((region) => region.kind === "watch" && region.selector);
  const chunks: string[] = [];
  if (watch.length > 0) {
    for (const region of watch) {
      try {
        $(region.selector).each((_, el) => {
          chunks.push($(el).text());
        });
      } catch {
        /* skip invalid watch selectors */
      }
    }
  } else {
    chunks.push($.root().text());
  }
  const lines = chunks
    .join("\n")
    .replace(/\u00a0/g, " ")
    .split(/\r?\n/)
    .map((line) => scrub(line))
    .filter((line) => line.replace(/[^a-z0-9]+/gi, "").length >= 8);
  return lines.join("\n").slice(0, 200_000).trim();
}

export function stableHash(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export function classifyPage(httpStatus: number, html: string, error?: string): PageStatus {
  if (error && /timeout|aborted|econnrefused|enotfound|fetch failed|getaddrinfo|cert/i.test(error)) return "error";
  const sample = html.slice(0, 30_000);
  const challenge = BLOCK_TEXT.some((pattern) => pattern.test(sample));
  if (httpStatus === 401 || httpStatus === 403 || httpStatus === 429) return "blocked";
  if (httpStatus === 503) return challenge ? "blocked" : "error";
  if (httpStatus >= 500 || httpStatus === 0 || httpStatus === 408) return "error";
  if (httpStatus >= 400) return "error";
  if (challenge) return "blocked";
  return "ok";
}
