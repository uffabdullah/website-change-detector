"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { intervalAllowed, type AlertMode, type Sensitivity } from "@/lib/engine/change";
import { assertPublicUrl, canonicalUrl } from "@/lib/engine/public-url";
import { cleanSelector } from "@/lib/sanitize";
import { createClientForUser } from "@/lib/supabase/server";

function safeNext(value: string) {
  if (!value.startsWith("/console") || value.startsWith("//")) return "/console";
  return value;
}

export async function signIn(_prev: { message: string } | null, formData: FormData) {
  const supabase = await createClientForUser();
  if (!supabase) return { message: "Supabase is not configured yet." };
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email") || ""),
    password: String(formData.get("password") || ""),
  });
  if (error) return { message: error.message };
  redirect(safeNext(String(formData.get("next") || "/console")));
}

export async function signUp(_prev: { message: string } | null, formData: FormData) {
  const supabase = await createClientForUser();
  if (!supabase) return { message: "Supabase is not configured yet." };
  const password = String(formData.get("password") || "");
  if (password.length < 8) return { message: "Use at least 8 characters." };
  const { data, error } = await supabase.auth.signUp({
    email: String(formData.get("email") || ""),
    password,
  });
  if (error) return { message: error.message };
  if (!data.session) return { message: "Check your email to confirm the account, then sign in." };
  redirect("/console");
}

export async function signOut() {
  const supabase = await createClientForUser();
  if (supabase) await supabase.auth.signOut();
  redirect("/");
}

async function optionalHttps(value: string, label: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const url = await assertPublicUrl(trimmed);
  if (url.protocol !== "https:") throw new Error(`${label} must be an https address.`);
  return url.toString();
}

export async function createMonitor(_prev: { message: string } | null, formData: FormData) {
  const supabase = await createClientForUser();
  if (!supabase) return { message: "Supabase is not configured yet." };
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { message: "Sign in first." };
  const name = String(formData.get("name") || "").trim();
  if (name.length < 1 || name.length > 80) return { message: "Give the page a name." };
  const interval = Number(formData.get("interval_minutes"));
  if (!intervalAllowed(interval)) return { message: "The interval has to sit between 15 minutes and 24 hours." };
  let canonical = "";
  let rawUrl = "";
  try {
    const url = await assertPublicUrl(String(formData.get("url") || ""));
    rawUrl = url.toString();
    canonical = canonicalUrl(rawUrl);
  } catch (error) {
    return { message: error instanceof Error ? error.message : "That URL is not public." };
  }
  let discord: string | null = null;
  let telegram: string | null = null;
  try {
    discord = await optionalHttps(String(formData.get("discord_webhook") || ""), "Discord");
    telegram = await optionalHttps(String(formData.get("telegram_webhook") || ""), "Telegram");
  } catch (error) {
    return { message: error instanceof Error ? error.message : "That webhook is not public." };
  }
  const email = String(formData.get("email") || "").trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { message: "That email does not look right." };
  const sensitivity = String(formData.get("sensitivity") || "medium") as Sensitivity;
  const alertMode = String(formData.get("alert_mode") || "all") as AlertMode;
  const keywords = String(formData.get("keywords") || "")
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 20);
  const { data, error } = await supabase
    .from("wcd_monitors")
    .insert({
      user_id: userData.user.id,
      name,
      url: rawUrl,
      canonical_url: canonical,
      interval_minutes: interval,
      sensitivity,
      alert_mode: alertMode,
      keywords,
      track_numbers: formData.get("track_numbers") === "on",
      email: email || null,
      discord_webhook: discord,
      telegram_webhook: telegram,
      digest_enabled: formData.get("digest_enabled") === "on",
      next_check_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !data) return { message: error?.message || "Could not save the page." };
  redirect(`/console/${data.id}`);
}

export async function deleteMonitor(formData: FormData) {
  const supabase = await createClientForUser();
  if (!supabase) redirect("/login");
  await supabase.from("wcd_monitors").delete().eq("id", String(formData.get("id") || ""));
  redirect("/console");
}

export async function addRegion(monitorId: string, kind: "watch" | "ignore", selector: string) {
  const supabase = await createClientForUser();
  if (!supabase) return { message: "Supabase is not configured yet." };
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { message: "Sign in first." };
  let clean = "";
  try {
    clean = cleanSelector(selector);
  } catch (error) {
    return { message: error instanceof Error ? error.message : "Bad selector." };
  }
  const { error } = await supabase.from("wcd_regions").insert({
    monitor_id: monitorId,
    user_id: userData.user.id,
    kind,
    selector: clean,
  });
  if (error) return { message: error.message };
  revalidatePath(`/console/${monitorId}`);
  revalidatePath(`/console/${monitorId}/picker`);
  return { message: "" };
}

export async function deleteRegion(formData: FormData) {
  const supabase = await createClientForUser();
  if (!supabase) return;
  const monitorId = String(formData.get("monitor_id") || "");
  await supabase.from("wcd_regions").delete().eq("id", String(formData.get("id") || ""));
  revalidatePath(`/console/${monitorId}`);
}
