import type { AlertMode, Sensitivity } from "./engine/change";
import type { PageStatus, Region } from "./engine/page-text";

export type MonitorRow = {
  id: string;
  user_id: string;
  name: string;
  url: string;
  canonical_url: string;
  interval_minutes: number;
  sensitivity: Sensitivity;
  alert_mode: AlertMode;
  keywords: string[] | null;
  track_numbers: boolean;
  email: string | null;
  discord_webhook: string | null;
  telegram_webhook: string | null;
  digest_enabled: boolean;
  status: PageStatus;
  last_checked_at: string | null;
  last_changed_at: string | null;
  last_error: string | null;
  last_summary: string | null;
  stable_hash: string | null;
  next_check_at: string;
  attempts: number;
  feed_token: string;
  created_at: string;
};

export type RegionRow = Region & { id: string; label: string | null; monitor_id: string };

export type SnapshotRow = {
  id: string;
  monitor_id: string;
  stable_hash: string;
  text_content?: string;
  screenshot_base64?: string | null;
  numbers: { key: string; label: string; value: number; display: string }[];
  summary: string | null;
  change_ratio: number | null;
  created_at: string;
};

export type { Region };
