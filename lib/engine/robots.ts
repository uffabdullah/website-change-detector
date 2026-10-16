type Rule = { allow: boolean; path: string };
type Group = { agents: string[]; rules: Rule[] };

const BOT = "stillchangedetector";

function groupsOf(body: string): Group[] {
  const groups: Group[] = [];
  let current: Group | null = null;
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    if (!line) continue;
    const index = line.indexOf(":");
    if (index < 0) continue;
    const key = line.slice(0, index).trim().toLowerCase();
    const value = line.slice(index + 1).trim();
    if (key === "user-agent") {
      if (!current || current.rules.length > 0) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
    } else if ((key === "allow" || key === "disallow") && current) {
      current.rules.push({ allow: key === "allow", path: value });
    }
  }
  return groups;
}

function chosenRules(groups: Group[]): Rule[] {
  const specific = groups.filter((group) => group.agents.some((agent) => agent !== "*" && BOT.includes(agent)));
  const fallback = groups.filter((group) => group.agents.includes("*"));
  const chosen = specific.length > 0 ? specific : fallback;
  return chosen.flatMap((group) => group.rules);
}

function matches(path: string, rulePath: string): boolean {
  if (!rulePath) return false;
  if (!rulePath.includes("*") && !rulePath.endsWith("$")) return path.startsWith(rulePath);
  const source = rulePath
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\\\*/g, ".*");
  const anchored = rulePath.endsWith("$") ? `^${source}` : `^${source}`;
  return new RegExp(anchored).test(path);
}

export function robotsAllows(body: string | null, targetPath: string): boolean {
  if (!body) return true;
  let best: { length: number; allow: boolean } | null = null;
  for (const rule of chosenRules(groupsOf(body))) {
    if (!matches(targetPath, rule.path)) continue;
    if (!best || rule.path.length > best.length) best = { length: rule.path.length, allow: rule.allow };
  }
  return best ? best.allow : true;
}

export function crawlDelaySeconds(body: string | null): number {
  if (!body) return 0;
  const match = body.match(/crawl-delay:\s*(\d+)/i);
  if (!match) return 0;
  return Math.min(120, Number(match[1]));
}
