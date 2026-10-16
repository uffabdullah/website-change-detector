import { assertPublicUrl } from "./engine/public-url";

export async function deliverAlert(channel: "email" | "discord" | "telegram", destination: string, message: string) {
  if (channel === "email") {
    const key = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM;
    if (!key || !from) return false;
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        from,
        to: destination,
        subject: "Website Change Detector",
        text: message,
      }),
      signal: AbortSignal.timeout(8000),
    });
    return response.ok;
  }
  const url = await assertPublicUrl(destination);
  if (url.protocol !== "https:") return false;
  const host = url.hostname;
  const body =
    host.endsWith("discord.com") || host.endsWith("discordapp.com")
      ? { content: message.slice(0, 1800) }
      : host === "api.telegram.org"
        ? { text: message.slice(0, 3500) }
        : { content: message.slice(0, 1800), text: message.slice(0, 3500) };
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  return response.ok;
}
