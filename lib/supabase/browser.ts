import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "../env";

export function createBrowser() {
  const env = publicEnv();
  if (!env) return null;
  return createBrowserClient(env.url, env.key);
}
