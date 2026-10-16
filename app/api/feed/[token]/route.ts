import { siteUrl } from "@/lib/env";
import { createWriter } from "@/lib/supabase/server";

export const runtime = "nodejs";

function escapeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const writer = createWriter();
  if (!writer) return new Response("Unconfigured", { status: 500 });
  const { data } = await writer.rpc("wcd_feed", { p_token: token });
  const feed = data as { name?: string; url?: string; items?: { id: string; summary: string | null; created_at: string }[] } | null;
  if (!feed?.name) return new Response("Not found", { status: 404 });
  const link = `${siteUrl()}/feed/${token}`;
  const items = (feed.items ?? [])
    .map((item) => {
      const title = item.summary || "Version saved";
      return `<item><title>${escapeXml(title)}</title><link>${escapeXml(link)}</link><guid isPermaLink="false">${escapeXml(item.id)}</guid><pubDate>${new Date(item.created_at).toUTCString()}</pubDate><description>${escapeXml(title)}</description></item>`;
    })
    .join("");
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${escapeXml(feed.name)} — Website Change Detector</title><link>${escapeXml(feed.url || link)}</link><description>Versions for ${escapeXml(feed.name)}</description>${items}</channel></rss>`;
  return new Response(xml, {
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      "cache-control": "private, max-age=300",
    },
  });
}
