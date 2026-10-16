import * as cheerio from "cheerio";

function absolute(base: string, value: string) {
  try {
    return new URL(value, base).toString();
  } catch {
    return value;
  }
}

export function sanitizeForPicker(html: string, pageUrl: string): string {
  const $ = cheerio.load(html);
  $("script, iframe, object, embed, base, meta, noscript, template").remove();
  $("link").each((_, el) => {
    const rel = ($(el).attr("rel") || "").toLowerCase();
    if (!rel.includes("stylesheet")) {
      $(el).remove();
      return;
    }
    const href = $(el).attr("href");
    if (href) $(el).attr("href", absolute(pageUrl, href));
  });
  $("*").each((_, el) => {
    const attribs = ("attribs" in el ? el.attribs : {}) || {};
    for (const name of Object.keys(attribs)) {
      const lower = name.toLowerCase();
      const value = attribs[name] || "";
      if (lower.startsWith("on") || lower === "srcdoc") {
        $(el).removeAttr(name);
        continue;
      }
      if (/^\s*javascript:/i.test(value) || /expression\s*\(/i.test(value)) $(el).removeAttr(name);
      if ((lower === "href" || lower === "src" || lower === "poster") && value) {
        $(el).attr(name, absolute(pageUrl, value));
      }
    }
  });
  return $.html();
}

export function cleanSelector(selector: string) {
  const value = selector.trim();
  if (value.length < 1 || value.length > 300) throw new Error("That selector does not look usable.");
  if (/[{}<>]/.test(value)) throw new Error("That selector is not allowed.");
  return value;
}
