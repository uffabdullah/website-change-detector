"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { createMonitor, signIn, signUp } from "@/app/console/actions";
import { formatInterval } from "@/lib/format";

export function AuthForm({ mode, next }: { mode: "in" | "up"; next?: string }) {
  const action = mode === "in" ? signIn : signUp;
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form className="panel form-grid" action={formAction}>
      <input type="hidden" name="next" value={next || "/console"} />
      <label className="field">
        <span>Email</span>
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <label className="field">
        <span>Password</span>
        <input name="password" type="password" autoComplete={mode === "in" ? "current-password" : "new-password"} minLength={8} required />
      </label>
      <button className="btn btn-hot" type="submit" disabled={pending}>
        {pending ? "Working" : mode === "in" ? "Enter" : "Create account"}
      </button>
      {state?.message ? <p className="notice">{state.message}</p> : null}
    </form>
  );
}

export function MonitorForm({ initialUrl = "" }: { initialUrl?: string }) {
  const [state, formAction, pending] = useActionState(createMonitor, null);
  const [interval, setInterval] = useState(60);
  return (
    <form className="panel form-grid" action={formAction}>
      <label className="field">
        <span>Name</span>
        <input name="name" required maxLength={80} placeholder="North ferry" />
      </label>
      <label className="field">
        <span>Public URL</span>
        <input name="url" type="url" required defaultValue={initialUrl} placeholder="https://" />
      </label>
      <label className="field">
        <span>Check every {formatInterval(interval)}</span>
        <input type="range" name="interval_minutes" min={15} max={1440} step={15} value={interval} onChange={(event) => setInterval(Number(event.target.value))} />
      </label>
      <fieldset className="choice">
        <legend>Sensitivity</legend>
        <label><input type="radio" name="sensitivity" value="high" /> High</label>
        <label><input type="radio" name="sensitivity" value="medium" defaultChecked /> Medium</label>
        <label><input type="radio" name="sensitivity" value="low" /> Low</label>
      </fieldset>
      <fieldset className="choice">
        <legend>Alerts</legend>
        <label><input type="radio" name="alert_mode" value="all" defaultChecked /> Any real change</label>
        <label><input type="radio" name="alert_mode" value="keywords" /> Keywords only</label>
      </fieldset>
      <label className="field">
        <span>Keywords</span>
        <textarea name="keywords" rows={3} placeholder="fare, sold out, 404" />
      </label>
      <label className="switch-row">
        <input type="checkbox" name="track_numbers" defaultChecked />
        <span>Track numbers and chart them</span>
      </label>
      <label className="switch-row">
        <input type="checkbox" name="digest_enabled" />
        <span>Daily digest instead of instant alerts</span>
      </label>
      <label className="field">
        <span>Email</span>
        <input name="email" type="email" placeholder="you@domain.com" />
      </label>
      <label className="field">
        <span>Discord webhook</span>
        <input name="discord_webhook" type="url" placeholder="https://discord.com/api/webhooks/..." />
      </label>
      <label className="field">
        <span>Telegram webhook</span>
        <input name="telegram_webhook" type="url" placeholder="https://api.telegram.org/bot…/sendMessage?chat_id=…" />
      </label>
      <button className="btn btn-hot" disabled={pending} type="submit">{pending ? "Saving" : "Watch this page"}</button>
      {state?.message ? <p className="notice">{state.message}</p> : null}
    </form>
  );
}

export function CheckButton({ id, label = "Check now" }: { id: string; label?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  async function run() {
    setPending(true);
    setMessage(null);
    const response = await fetch(`/api/monitors/${id}/check`, { method: "POST" });
    const body = (await response.json()) as { message?: string };
    setMessage(body.message || "Check finished.");
    setPending(false);
    router.refresh();
  }
  return (
    <div className="action-stack">
      <button className="btn btn-hot" type="button" onClick={run} disabled={pending}>{pending ? "Checking" : label}</button>
      {message ? <p className="notice">{message}</p> : null}
    </div>
  );
}

export function DueButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  async function run() {
    setPending(true);
    const response = await fetch("/api/checks/due", { method: "POST" });
    const body = (await response.json()) as { message?: string };
    setMessage(body.message || "Done.");
    setPending(false);
    router.refresh();
  }
  return (
    <div className="action-stack">
      <button className="btn" type="button" onClick={run} disabled={pending}>{pending ? "Running queue" : "Run due checks"}</button>
      {message ? <p className="notice">{message}</p> : null}
    </div>
  );
}
