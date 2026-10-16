import type { SupabaseClient } from "@supabase/supabase-js";
import { deliverAlert } from "./alerts";
import { cacheIsFresh, decide, nextRun } from "./engine/change";
import type { Region } from "./engine/page-text";
import { siteUrl } from "./env";
import { prepareFetch, renderPublicPage, type RenderedPage } from "./render-page";
import type { MonitorRow } from "./types";

type CacheRow = {
  fetched_at: string;
  http_status: number | null;
  page_status: "ok" | "error" | "blocked";
  html: string | null;
  title: string | null;
  screenshot_base64: string | null;
  renderer: "playwright" | "http" | null;
  error: string | null;
};

function describe(decision: ReturnType<typeof decide>, fromCache: boolean) {
  const shared = fromCache ? " The site was not fetched again — this used the shared copy." : "";
  if (decision.status !== "ok") return `${decision.error || "Check failed."}`;
  if (!decision.storeSnapshot) return `No meaningful change.${shared}`;
  if (decision.baseline) return `First version saved. Alerts start with the next real change.${shared}`;
  if (!decision.alert) return `A version was saved, and it stayed under your sensitivity, so no alert went out.${shared}`;
  return `${decision.summary || "A real change was saved."}${shared}`;
}

async function sendNewAlerts(
  writer: SupabaseClient,
  secret: string,
  monitor: MonitorRow,
  alerts: { id: string; channel: "email" | "discord" | "telegram"; kind: string }[],
  summary: string
) {
  const link = `${siteUrl()}/console/${monitor.id}`;
  const message = `STILL — ${monitor.name}\n${summary}\n${link}`;
  const destinations = {
    email: monitor.email,
    discord: monitor.discord_webhook,
    telegram: monitor.telegram_webhook,
  };
  for (const alert of alerts) {
    if (alert.kind !== "change") continue;
    const destination = destinations[alert.channel];
    if (!destination) continue;
    let delivered = false;
    try {
      delivered = await deliverAlert(alert.channel, destination, message);
    } catch {
      delivered = false;
    }
    await writer.rpc("wcd_mark_alert", { p_secret: secret, p_id: alert.id, p_delivered: delivered });
  }
}

export async function inspectMonitor(input: {
  monitor: MonitorRow;
  regions: Region[];
  previousText: string | null;
  writer: SupabaseClient;
  secret: string;
  manual?: boolean;
}) {
  const { monitor, writer, secret } = input;
  if (input.manual && monitor.last_checked_at && Date.now() - new Date(monitor.last_checked_at).getTime() < 60_000) {
    return { message: "This page was checked less than a minute ago.", status: monitor.status, changed: false };
  }

  const started = Date.now();
  let rendered: RenderedPage;
  let fromCache = false;

  try {
    const prep = await prepareFetch(monitor.canonical_url);
    if (prep.blocked) {
      rendered = {
        finalUrl: prep.url.toString(),
        httpStatus: 0,
        html: "",
        title: "",
        renderer: "http",
        pageStatus: "blocked",
        error: "robots.txt disallows automated checks. Not stored as a change.",
        crawlDelay: prep.crawlDelay,
      };
    } else {
      const { data: cache } = await writer.rpc("wcd_cache_get", { p_url: monitor.canonical_url, p_secret: secret });
      const row = cache as CacheRow | null;
      if (row?.html && row.fetched_at && cacheIsFresh(new Date(row.fetched_at).getTime(), Date.now())) {
        fromCache = true;
        rendered = {
          finalUrl: monitor.canonical_url,
          httpStatus: row.http_status ?? 200,
          html: row.html,
          title: row.title || "",
          screenshot: row.screenshot_base64 ? Buffer.from(row.screenshot_base64, "base64") : undefined,
          renderer: row.renderer || "http",
          pageStatus: row.page_status,
          error: row.error || undefined,
          crawlDelay: prep.crawlDelay,
        };
      } else {
        const gap = Math.max(20, prep.crawlDelay);
        const { data: wait, error: leaseError } = await writer.rpc("wcd_acquire_host", {
          p_host: prep.url.hostname,
          p_gap_seconds: gap,
          p_secret: secret,
        });
        if (leaseError) throw new Error(leaseError.message);
        if (typeof wait === "number" && wait > 0) {
          const next = new Date(Date.now() + 30_000).toISOString();
          await writer.rpc("wcd_apply_check", {
            p_secret: secret,
            p_payload: { monitor_id: monitor.id, reschedule_only: true, next_check_at: next },
          });
          return {
            message: input.manual
              ? `This host was fetched moments ago. Try again in ${wait} seconds so the site is not hammered.`
              : "Rescheduled. Another check is already talking to that host.",
            status: monitor.status,
            changed: false,
          };
        }
        rendered = await renderPublicPage(monitor.canonical_url);
        rendered.crawlDelay = prep.crawlDelay;
        const shot = rendered.screenshot && rendered.screenshot.length < 500_000 ? rendered.screenshot.toString("base64") : null;
        await writer.rpc("wcd_cache_put", {
          p_url: monitor.canonical_url,
          p_secret: secret,
          p_row: {
            fetched_at: new Date().toISOString(),
            http_status: rendered.httpStatus,
            page_status: rendered.pageStatus,
            html: rendered.html.slice(0, 1_500_000),
            title: rendered.title,
            screenshot_base64: shot,
            renderer: rendered.renderer,
            error: rendered.error || null,
          },
        });
      }
    }
  } catch (error) {
    rendered = {
      finalUrl: monitor.canonical_url,
      httpStatus: 0,
      html: "",
      title: "",
      renderer: "http",
      pageStatus: "error",
      error: error instanceof Error ? error.message : "Check failed.",
      crawlDelay: 0,
    };
  }

  const decision = decide({
    previousText: input.previousText,
    html: rendered.html,
    pageStatus: rendered.pageStatus,
    httpError: rendered.error,
    sensitivity: monitor.sensitivity,
    alertMode: monitor.alert_mode,
    keywords: monitor.keywords ?? [],
    regions: input.regions,
    trackNumbers: monitor.track_numbers,
  });
  const schedule = nextRun({
    status: decision.status,
    intervalMinutes: monitor.interval_minutes,
    attempts: monitor.attempts ?? 0,
    now: Date.now(),
  });
  const screenshot = rendered.screenshot && rendered.screenshot.length < 500_000 ? rendered.screenshot.toString("base64") : null;
  const { data, error } = await writer.rpc("wcd_apply_check", {
    p_secret: secret,
    p_payload: {
      monitor_id: monitor.id,
      status: decision.status,
      error: decision.error,
      duration_ms: Date.now() - started,
      attempts: schedule.attempts,
      renderer: rendered.renderer,
      from_cache: fromCache,
      store_snapshot: decision.storeSnapshot,
      alert: decision.alert,
      hash: decision.hash,
      text: decision.text,
      screenshot_base64: decision.storeSnapshot ? screenshot : null,
      numbers: decision.numbers,
      summary: decision.summary,
      ratio: decision.ratio,
      next_check_at: new Date(schedule.nextCheckAt).toISOString(),
    },
  });
  if (error) return { message: error.message, status: "error" as const, changed: false };
  const applied = (data ?? {}) as { alerts?: { id: string; channel: "email" | "discord" | "telegram"; kind: string }[] };
  if (decision.alert && decision.summary && !monitor.digest_enabled) {
    await sendNewAlerts(writer, secret, monitor, applied.alerts ?? [], decision.summary);
  }
  return { message: describe(decision, fromCache), status: decision.status, changed: decision.storeSnapshot && decision.alert };
}

export async function sendDigests(writer: SupabaseClient, secret: string) {
  const { data, error } = await writer.rpc("wcd_pending_digests", { p_secret: secret });
  if (error || !Array.isArray(data)) return;
  for (const group of data as {
    monitor_id: string;
    name: string;
    email: string | null;
    discord_webhook: string | null;
    telegram_webhook: string | null;
    alerts: { id: string; summary: string | null; channel: "email" | "discord" | "telegram" }[];
  }[]) {
    const lines = [...new Set(group.alerts.map((alert) => alert.summary).filter(Boolean))];
    const message = `STILL daily digest — ${group.name}\n${lines.join("\n")}\n${siteUrl()}/console/${group.monitor_id}`;
    const byChannel = new Map<string, { id: string; channel: "email" | "discord" | "telegram" }[]>();
    for (const alert of group.alerts) {
      const list = byChannel.get(alert.channel) ?? [];
      list.push(alert);
      byChannel.set(alert.channel, list);
    }
    const destinations = {
      email: group.email,
      discord: group.discord_webhook,
      telegram: group.telegram_webhook,
    };
    for (const [channel, alerts] of byChannel) {
      const destination = destinations[channel as "email"];
      let delivered = false;
      if (destination) {
        try {
          delivered = await deliverAlert(channel as "email", destination, message);
        } catch {
          delivered = false;
        }
      }
      for (const alert of alerts) {
        await writer.rpc("wcd_mark_alert", { p_secret: secret, p_id: alert.id, p_delivered: delivered });
      }
    }
  }
}
