import assert from "node:assert/strict";
import test from "node:test";
import { cacheIsFresh, decide, intervalAllowed, nextRun, oneLineSummary, extractNumbers } from "./change";
import { classifyPage, extractStableText, stableHash } from "./page-text";
import { assertPublicUrl, canonicalUrl, isBlockedAddress } from "./public-url";
import { robotsAllows } from "./robots";
import { demoPlate, highlightDiff } from "./screenshot";

const noisy = (stamp: string, views: string, body: string) => `<html><body>
  <div class="adsbygoogle">Buy now rotating banner</div>
  <p>Updated ${stamp}</p>
  <p>${views} views</p>
  <article>${body}</article>
</body></html>`;

test("timestamps, counters, and ads do not change the hash", () => {
  const first = extractStableText(noisy("2 minutes ago", "1,204", "The noon boat leaves the north pier."));
  const second = extractStableText(noisy("5 minutes ago", "1,488", "The noon boat leaves the north pier."));
  assert.equal(first, second);
  assert.equal(stableHash(first), stableHash(second));
  assert.match(first, /noon boat/);
  assert.doesNotMatch(first, /views|minutes ago|Buy now/);
});

test("a real sentence stores a snapshot and summarizes it", () => {
  const previous = "The noon boat leaves at 12:10. Adult fare: $18.";
  const html = noisy("1 minute ago", "9 views", "The noon boat leaves at 12:40. Adult fare: $22.");
  const decision = decide({
    previousText: previous,
    html,
    pageStatus: "ok",
    sensitivity: "medium",
    alertMode: "all",
    keywords: [],
    regions: [],
    trackNumbers: true,
  });
  assert.equal(decision.storeSnapshot, true);
  assert.equal(decision.alert, true);
  assert.match(decision.summary || "", /\$18/);
  assert.match(decision.summary || "", /\$22/);
});

test("keyword-only mode stays quiet unless the diff contains the word", () => {
  const html = noisy("just now", "10 views", "The cafe added barley soup to the evening menu.");
  const quiet = decide({
    previousText: "The cafe serves barley soup.",
    html,
    pageStatus: "ok",
    sensitivity: "high",
    alertMode: "keywords",
    keywords: ["fare"],
    regions: [],
    trackNumbers: false,
  });
  assert.equal(quiet.storeSnapshot, true);
  assert.equal(quiet.alert, false);
});

test("an outage or a CAPTCHA is not a content change", () => {
  const captcha = decide({
    previousText: "The noon boat leaves the north pier today.",
    html: "<html><title>Just a moment...</title><div class='g-recaptcha'></div></html>",
    pageStatus: classifyPage(403, "<html><title>Just a moment...</title><div class='g-recaptcha'></div></html>"),
    sensitivity: "high",
    alertMode: "all",
    keywords: [],
    regions: [],
    trackNumbers: false,
  });
  assert.equal(captcha.status, "blocked");
  assert.equal(captcha.storeSnapshot, false);
  assert.equal(captcha.alert, false);

  const outage = decide({
    previousText: "The noon boat leaves the north pier today.",
    html: "",
    pageStatus: classifyPage(502, ""),
    sensitivity: "high",
    alertMode: "all",
    keywords: [],
    regions: [],
    trackNumbers: false,
  });
  assert.equal(outage.status, "error");
  assert.equal(outage.storeSnapshot, false);
});

test("watch and ignore regions keep only the requested text", () => {
  const html = `<main><p id="price">Adult fare: $18</p><p id="ticker">Updated just now</p><aside class="rotating-banner">Sale sale sale today only</aside></main>`;
  const text = extractStableText(html, [
    { kind: "watch", selector: "#price" },
    { kind: "ignore", selector: "#ticker" },
  ]);
  assert.match(text, /Adult fare/);
  assert.doesNotMatch(text, /Sale sale/);
});

test("shared fetch window and schedule protect the origin", () => {
  assert.equal(cacheIsFresh(0, 14 * 60 * 1000), true);
  assert.equal(cacheIsFresh(0, 16 * 60 * 1000), false);
  assert.equal(intervalAllowed(14), false);
  assert.equal(intervalAllowed(15), true);
  assert.equal(intervalAllowed(1440), true);
  const busy = nextRun({ status: "busy", intervalMinutes: 15, attempts: 1, now: 0 });
  assert.equal(busy.attempts, 1);
  assert.equal(busy.nextCheckAt, 30_000);
  const retry = nextRun({ status: "error", intervalMinutes: 60, attempts: 0, now: 0 });
  assert.equal(retry.attempts, 1);
  assert.equal(retry.nextCheckAt, 2 * 60 * 1000);
  const blocked = nextRun({ status: "blocked", intervalMinutes: 60, attempts: 2, now: 0 });
  assert.equal(blocked.attempts, 0);
  assert.equal(blocked.nextCheckAt, 60 * 60 * 1000);
});

test("public url rules reject credentials, private hosts, and tracking crumbs", async () => {
  assert.equal(isBlockedAddress("127.0.0.1"), true);
  assert.equal(isBlockedAddress("10.1.2.3"), true);
  assert.equal(isBlockedAddress("192.168.0.8"), true);
  assert.equal(isBlockedAddress("169.254.169.254"), true);
  assert.equal(isBlockedAddress("8.8.8.8"), false);
  assert.equal(
    canonicalUrl("https://Example.com/path/?utm_source=ad&b=2&a=1#top"),
    "https://example.com/path?a=1&b=2"
  );
  await assert.rejects(() => assertPublicUrl("https://user:secret@example.com"), /Credentials/);
  await assert.rejects(() => assertPublicUrl("http://127.0.0.1/admin"), /public websites/);
  await assert.rejects(() => assertPublicUrl("http://169.254.169.254/"), /public websites/);
});

test("robots.txt can refuse a path", () => {
  const body = "User-agent: *\nDisallow: /private\nAllow: /private/open\n";
  assert.equal(robotsAllows(body, "/news"), true);
  assert.equal(robotsAllows(body, "/private/open"), true);
  assert.equal(robotsAllows(body, "/private/logs"), false);
  assert.equal(robotsAllows(null, "/anything"), true);
});

test("number tracking and highlighted plates", () => {
  const numbers = extractNumbers("Adult fare: $18\nOccupancy: 40%");
  assert.equal(numbers[0]?.display, "$18");
  const summary = oneLineSummary("Adult fare: $18", "Adult fare: $22", extractNumbers("Adult fare: $18"), extractNumbers("Adult fare: $22"));
  assert.match(summary, /18/);
  assert.match(summary, /22/);
  const diff = highlightDiff(demoPlate(0), demoPlate(80));
  assert.ok(diff && diff.length > 100);
});
