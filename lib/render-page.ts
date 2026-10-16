import { classifyPage } from "./engine/page-text";
import { crawlDelaySeconds, robotsAllows } from "./engine/robots";
import { assertPublicUrl, fetchPublic, isBlockedAddress } from "./engine/public-url";

export const BOT_UA = "StillChangeDetector/1.0 (public page monitor; +https://website-change-detector.vercel.app; respects robots.txt)";

export type RenderedPage = {
  finalUrl: string;
  httpStatus: number;
  html: string;
  title: string;
  screenshot?: Buffer;
  renderer: "playwright" | "http";
  pageStatus: "ok" | "error" | "blocked";
  error?: string;
  crawlDelay: number;
};

export function pageTitle(html: string) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) return "";
  return match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 180);
}

async function readLimited(response: Response) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > 1_500_000) {
      await reader.cancel();
      throw new Error("Page is too large to store.");
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function prepareFetch(raw: string) {
  const url = await assertPublicUrl(raw);
  let robotsBody: string | null = null;
  try {
    const robotsUrl = new URL("/robots.txt", `${url.protocol}//${url.host}`).toString();
    const { response } = await fetchPublic(robotsUrl, {
      headers: { "user-agent": BOT_UA, accept: "text/plain" },
      signal: AbortSignal.timeout(8000),
    });
    if (response.ok) robotsBody = (await response.text()).slice(0, 200_000);
  } catch {
    robotsBody = null;
  }
  return {
    url,
    blocked: !robotsAllows(robotsBody, `${url.pathname || "/"}${url.search}`),
    crawlDelay: crawlDelaySeconds(robotsBody),
  };
}

export async function renderHttp(raw: string): Promise<RenderedPage> {
  const started = await assertPublicUrl(raw);
  try {
    const { response, url } = await fetchPublic(raw, {
      headers: {
        "user-agent": BOT_UA,
        accept: "text/html,application/xhtml+xml",
        "accept-language": "en",
      },
      signal: AbortSignal.timeout(20_000),
    });
    const type = response.headers.get("content-type") || "";
    if (type && !/html|xml|text\/plain/i.test(type)) {
      return {
        finalUrl: url.toString(),
        httpStatus: response.status,
        html: "",
        title: "",
        renderer: "http",
        pageStatus: "error",
        error: "The address did not return an HTML page.",
        crawlDelay: 0,
      };
    }
    const html = await readLimited(response);
    const pageStatus = classifyPage(response.status, html);
    return {
      finalUrl: url.toString(),
      httpStatus: response.status,
      html,
      title: pageTitle(html),
      renderer: "http",
      pageStatus,
      error: pageStatus === "ok" ? undefined : pageStatus === "blocked" ? "Blocked or CAPTCHA. Not stored as a change." : `The site responded with ${response.status}. Not stored as a change.`,
      crawlDelay: 0,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "The page could not be fetched.";
    return {
      finalUrl: started.toString(),
      httpStatus: 0,
      html: "",
      title: "",
      renderer: "http",
      pageStatus: /public websites|Credentials|redirects/i.test(message) ? "blocked" : "error",
      error: message,
      crawlDelay: 0,
    };
  }
}

async function renderPlaywright(raw: string): Promise<RenderedPage> {
  const { chromium } = await import("playwright-core");
  const browser = process.env.VERCEL
    ? await (async () => {
        const mod = await import("@sparticuz/chromium");
        const binary = mod.default;
        return chromium.launch({
          args: binary.args,
          executablePath: await binary.executablePath(),
          headless: true,
        });
      })()
    : await chromium.launch({ channel: process.env.BROWSER_CHANNEL || "msedge", headless: true }).catch(() =>
        chromium.launch({ channel: "chrome", headless: true })
      );
  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent: BOT_UA,
      javaScriptEnabled: true,
      ignoreHTTPSErrors: false,
    });
    const page = await context.newPage();
    await page.route("**/*", async (route) => {
      try {
        const target = new URL(route.request().url());
        if (target.protocol === "http:" || target.protocol === "https:") {
          if (route.request().isNavigationRequest()) await assertPublicUrl(target.toString());
          else if (isBlockedAddress(target.hostname) || target.hostname === "localhost" || target.hostname.endsWith(".local")) {
            await route.abort();
            return;
          }
        }
      } catch {
        await route.abort();
        return;
      }
      await route.continue();
    });
    const response = await page.goto(raw, { waitUntil: "domcontentloaded", timeout: 20_000 });
    await page.waitForTimeout(700);
    const html = await page.content();
    const status = response?.status() ?? 0;
    const shot = await page.screenshot({ type: "png" });
    const pageStatus = classifyPage(status, html);
    return {
      finalUrl: page.url(),
      httpStatus: status,
      html,
      title: pageTitle(html),
      screenshot: shot.length < 500_000 ? shot : undefined,
      renderer: "playwright",
      pageStatus,
      error: pageStatus === "ok" ? undefined : pageStatus === "blocked" ? "Blocked or CAPTCHA. Not stored as a change." : `The site responded with ${status}. Not stored as a change.`,
      crawlDelay: 0,
    };
  } finally {
    await browser.close();
  }
}

export async function renderPublicPage(raw: string): Promise<RenderedPage> {
  try {
    return await renderPlaywright(raw);
  } catch {
    return renderHttp(raw);
  }
}
