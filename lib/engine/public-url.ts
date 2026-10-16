import { lookup } from "node:dns/promises";
import net from "node:net";

const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "fbclid",
  "gclid",
  "mc_cid",
  "mc_eid",
  "igshid",
  "ref",
]);

export function isBlockedAddress(ip: string): boolean {
  const normalized = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (normalized.startsWith("::ffff:")) return isBlockedAddress(normalized.slice(7));
  const kind = net.isIP(normalized);
  if (kind === 4) {
    const [a, b] = normalized.split(".").map(Number);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a === 255 || a >= 224) return true;
    return false;
  }
  if (kind === 6) {
    if (normalized === "::1" || normalized === "::") return true;
    if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
    if (normalized.startsWith("fe80") || normalized.startsWith("ff")) return true;
    return false;
  }
  return false;
}

function blockedHost(host: string): boolean {
  const name = host.toLowerCase().replace(/\.$/, "");
  if (!name || name === "localhost" || name.endsWith(".localhost")) return true;
  if (name.endsWith(".local") || name.endsWith(".internal") || name.endsWith(".localdomain")) return true;
  if (name === "metadata.google.internal" || name === "metadata.google") return true;
  return false;
}

export function canonicalUrl(raw: string): string {
  const url = new URL(raw.trim());
  url.hash = "";
  url.hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if ((url.protocol === "https:" && url.port === "443") || (url.protocol === "http:" && url.port === "80")) {
    url.port = "";
  }
  const kept = [...url.searchParams.entries()].filter(([key]) => !TRACKING_PARAMS.has(key.toLowerCase()));
  kept.sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));
  url.search = "";
  for (const [key, value] of kept) url.searchParams.append(key, value);
  if (url.pathname.length > 1 && url.pathname.endsWith("/")) url.pathname = url.pathname.slice(0, -1);
  return url.toString();
}

export async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error("Enter a full URL, including https://.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only public http and https pages can be watched.");
  }
  if (url.username || url.password) {
    throw new Error("Credentials are not stored or sent. Watch a public page.");
  }
  const host = url.hostname.toLowerCase();
  if (blockedHost(host)) throw new Error("Only public websites can be watched.");
  if (net.isIP(host)) {
    if (isBlockedAddress(host)) throw new Error("Only public websites can be watched.");
    return url;
  }
  let records: { address: string }[] = [];
  try {
    records = await lookup(host, { all: true, verbatim: true });
  } catch {
    throw new Error("That host did not resolve.");
  }
  if (records.length === 0) throw new Error("That host did not resolve.");
  for (const record of records) {
    if (isBlockedAddress(record.address)) throw new Error("Only public websites can be watched.");
  }
  return url;
}

export async function fetchPublic(raw: string, init: RequestInit = {}, hops = 5): Promise<{ response: Response; url: URL }> {
  let current = await assertPublicUrl(raw);
  for (let hop = 0; hop < hops; hop += 1) {
    const response = await fetch(current, {
      ...init,
      redirect: "manual",
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) return { response, url: current };
      current = await assertPublicUrl(new URL(location, current).toString());
      continue;
    }
    return { response, url: current };
  }
  throw new Error("Too many redirects.");
}
