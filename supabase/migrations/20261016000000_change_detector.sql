create table if not exists public.wcd_monitors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  url text not null check (char_length(url) between 8 and 2000),
  canonical_url text not null,
  interval_minutes integer not null default 60 check (interval_minutes between 15 and 1440),
  sensitivity text not null default 'medium' check (sensitivity in ('low', 'medium', 'high')),
  alert_mode text not null default 'all' check (alert_mode in ('all', 'keywords')),
  keywords text[] not null default '{}',
  track_numbers boolean not null default true,
  email text,
  discord_webhook text,
  telegram_webhook text,
  digest_enabled boolean not null default false,
  status text not null default 'ok' check (status in ('ok', 'error', 'blocked')),
  last_checked_at timestamptz,
  last_changed_at timestamptz,
  last_error text,
  last_summary text,
  stable_hash text,
  next_check_at timestamptz not null default now(),
  check_lock_until timestamptz,
  attempts integer not null default 0,
  feed_token text not null default encode(gen_random_bytes(16), 'hex'),
  created_at timestamptz not null default now()
);

create table if not exists public.wcd_regions (
  id uuid primary key default gen_random_uuid(),
  monitor_id uuid not null references public.wcd_monitors (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('watch', 'ignore')),
  selector text not null check (char_length(selector) between 1 and 300),
  label text,
  created_at timestamptz not null default now(),
  unique (monitor_id, kind, selector)
);

create table if not exists public.wcd_snapshots (
  id uuid primary key default gen_random_uuid(),
  monitor_id uuid not null references public.wcd_monitors (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  stable_hash text not null,
  text_content text not null,
  screenshot_base64 text,
  numbers jsonb not null default '[]'::jsonb,
  summary text,
  change_ratio real,
  created_at timestamptz not null default now()
);

create table if not exists public.wcd_checks (
  id uuid primary key default gen_random_uuid(),
  monitor_id uuid not null references public.wcd_monitors (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null check (status in ('ok', 'error', 'blocked')),
  changed boolean not null default false,
  stable_hash text,
  error text,
  duration_ms integer,
  attempts integer not null default 1,
  renderer text,
  from_cache boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.wcd_alerts (
  id uuid primary key default gen_random_uuid(),
  monitor_id uuid not null references public.wcd_monitors (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  snapshot_id uuid references public.wcd_snapshots (id) on delete set null,
  channel text not null check (channel in ('email', 'discord', 'telegram')),
  kind text not null check (kind in ('change', 'digest')),
  dedupe_key text not null unique,
  delivered boolean not null default false,
  summary text,
  created_at timestamptz not null default now()
);

create table if not exists public.wcd_fetch_cache (
  canonical_url text primary key,
  fetched_at timestamptz not null,
  http_status integer,
  page_status text not null,
  html text,
  title text,
  screenshot_base64 text,
  renderer text,
  error text
);

create table if not exists public.wcd_host_lease (
  host text primary key,
  locked_until timestamptz not null
);

create table if not exists public.wcd_runtime (
  key text primary key,
  value text not null
);

create index if not exists wcd_monitors_due on public.wcd_monitors (next_check_at);
create index if not exists wcd_monitors_user on public.wcd_monitors (user_id);
create index if not exists wcd_snapshots_monitor_time on public.wcd_snapshots (monitor_id, created_at desc);
create index if not exists wcd_alerts_undelivered on public.wcd_alerts (monitor_id) where delivered = false;

alter table public.wcd_monitors enable row level security;
alter table public.wcd_regions enable row level security;
alter table public.wcd_snapshots enable row level security;
alter table public.wcd_checks enable row level security;
alter table public.wcd_alerts enable row level security;
alter table public.wcd_fetch_cache enable row level security;
alter table public.wcd_host_lease enable row level security;
alter table public.wcd_runtime enable row level security;

revoke all on public.wcd_runtime from anon, authenticated;
revoke all on public.wcd_fetch_cache from anon, authenticated;
revoke all on public.wcd_host_lease from anon, authenticated;

create policy wcd_monitors_all on public.wcd_monitors
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy wcd_regions_all on public.wcd_regions
  for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.wcd_monitors m where m.id = monitor_id and m.user_id = auth.uid())
  );

create policy wcd_snapshots_all on public.wcd_snapshots
  for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.wcd_monitors m where m.id = monitor_id and m.user_id = auth.uid())
  );

create policy wcd_checks_all on public.wcd_checks
  for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.wcd_monitors m where m.id = monitor_id and m.user_id = auth.uid())
  );

create policy wcd_alerts_all on public.wcd_alerts
  for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from public.wcd_monitors m where m.id = monitor_id and m.user_id = auth.uid())
  );

create or replace function public.wcd_secret_ok(p_secret text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select p_secret is not null
    and length(p_secret) >= 24
    and exists (
      select 1 from public.wcd_runtime
      where key = 'cron_secret' and value = p_secret
    );
$$;

create or replace function public.wcd_cache_get(p_url text, p_secret text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed boolean;
begin
  allowed := public.wcd_secret_ok(p_secret)
    or (
      auth.uid() is not null
      and exists (
        select 1 from public.wcd_monitors
        where user_id = auth.uid() and canonical_url = p_url
      )
    );
  if not allowed then
    return null;
  end if;
  return (
    select to_jsonb(c) from public.wcd_fetch_cache c where c.canonical_url = p_url
  );
end;
$$;

create or replace function public.wcd_cache_put(
  p_url text,
  p_row jsonb,
  p_secret text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed boolean;
begin
  allowed := public.wcd_secret_ok(p_secret)
    or (
      auth.uid() is not null
      and exists (
        select 1 from public.wcd_monitors
        where user_id = auth.uid() and canonical_url = p_url
      )
    );
  if not allowed then
    raise exception 'forbidden';
  end if;
  insert into public.wcd_fetch_cache (
    canonical_url, fetched_at, http_status, page_status, html, title, screenshot_base64, renderer, error
  ) values (
    p_url,
    coalesce((p_row->>'fetched_at')::timestamptz, now()),
    (p_row->>'http_status')::integer,
    coalesce(p_row->>'page_status', 'ok'),
    left(coalesce(p_row->>'html', ''), 1500000),
    left(coalesce(p_row->>'title', ''), 300),
    p_row->>'screenshot_base64',
    p_row->>'renderer',
    left(coalesce(p_row->>'error', ''), 500)
  )
  on conflict (canonical_url) do update set
    fetched_at = excluded.fetched_at,
    http_status = excluded.http_status,
    page_status = excluded.page_status,
    html = excluded.html,
    title = excluded.title,
    screenshot_base64 = excluded.screenshot_base64,
    renderer = excluded.renderer,
    error = excluded.error;
end;
$$;

create or replace function public.wcd_acquire_host(p_host text, p_gap_seconds integer, p_secret text default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  until_at timestamptz;
  gap integer;
begin
  if auth.uid() is null and not public.wcd_secret_ok(p_secret) then
    raise exception 'forbidden';
  end if;
  if auth.uid() is not null and not exists (
    select 1 from public.wcd_monitors m
    where m.user_id = auth.uid() and split_part(split_part(m.canonical_url, '://', 2), '/', 1) = p_host
  ) and not public.wcd_secret_ok(p_secret) then
    raise exception 'forbidden';
  end if;
  gap := least(greatest(coalesce(p_gap_seconds, 20), 20), 120);
  select locked_until into until_at from public.wcd_host_lease where host = p_host for update;
  if until_at is not null and until_at > now() then
    return ceil(extract(epoch from (until_at - now())))::integer;
  end if;
  insert into public.wcd_host_lease (host, locked_until)
  values (p_host, now() + make_interval(secs => gap))
  on conflict (host) do update set locked_until = now() + make_interval(secs => gap);
  return 0;
end;
$$;

create or replace function public.wcd_claim_checks(p_secret text, p_limit integer default 2)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
  lim integer;
begin
  if not public.wcd_secret_ok(p_secret) then
    raise exception 'forbidden';
  end if;
  lim := least(greatest(coalesce(p_limit, 2), 1), 3);
  with due as (
    select id from public.wcd_monitors
    where next_check_at <= now()
      and (check_lock_until is null or check_lock_until < now())
    order by next_check_at
    limit lim
    for update skip locked
  ),
  locked as (
    update public.wcd_monitors m
    set check_lock_until = now() + interval '90 seconds'
    from due
    where m.id = due.id
    returning m.*
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'monitor', to_jsonb(l),
    'regions', coalesce((
      select jsonb_agg(jsonb_build_object('kind', r.kind, 'selector', r.selector))
      from public.wcd_regions r where r.monitor_id = l.id
    ), '[]'::jsonb),
    'previous_text', (
      select s.text_content from public.wcd_snapshots s
      where s.monitor_id = l.id
      order by s.created_at desc
      limit 1
    )
  )), '[]'::jsonb)
  into result
  from locked l;
  return result;
end;
$$;

create or replace function public.wcd_apply_check(p_secret text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  mon public.wcd_monitors%rowtype;
  snap_id uuid;
  alert_row jsonb;
  alerts jsonb := '[]'::jsonb;
  channel text;
  kind text;
  dedupe text;
begin
  if not public.wcd_secret_ok(p_secret) then
    raise exception 'forbidden';
  end if;
  select * into mon from public.wcd_monitors where id = (p_payload->>'monitor_id')::uuid;
  if not found then
    raise exception 'missing monitor';
  end if;

  if coalesce((p_payload->>'reschedule_only')::boolean, false) then
    update public.wcd_monitors
    set next_check_at = (p_payload->>'next_check_at')::timestamptz,
        check_lock_until = null
    where id = mon.id;
    return jsonb_build_object('rescheduled', true);
  end if;

  insert into public.wcd_checks (
    monitor_id, user_id, status, changed, stable_hash, error, duration_ms, attempts, renderer, from_cache
  ) values (
    mon.id,
    mon.user_id,
    p_payload->>'status',
    coalesce((p_payload->>'store_snapshot')::boolean, false),
    p_payload->>'hash',
    left(p_payload->>'error', 500),
    (p_payload->>'duration_ms')::integer,
    coalesce((p_payload->>'attempts')::integer, 1),
    p_payload->>'renderer',
    coalesce((p_payload->>'from_cache')::boolean, false)
  );

  if coalesce((p_payload->>'store_snapshot')::boolean, false) then
    insert into public.wcd_snapshots (
      monitor_id, user_id, stable_hash, text_content, screenshot_base64, numbers, summary, change_ratio
    ) values (
      mon.id,
      mon.user_id,
      p_payload->>'hash',
      p_payload->>'text',
      p_payload->>'screenshot_base64',
      coalesce(p_payload->'numbers', '[]'::jsonb),
      left(p_payload->>'summary', 180),
      (p_payload->>'ratio')::real
    )
    returning id into snap_id;
  end if;

  update public.wcd_monitors
  set status = p_payload->>'status',
      last_checked_at = now(),
      last_changed_at = case when snap_id is not null then now() else last_changed_at end,
      last_error = left(p_payload->>'error', 500),
      last_summary = case when snap_id is not null then left(p_payload->>'summary', 180) else last_summary end,
      stable_hash = coalesce(p_payload->>'hash', stable_hash),
      next_check_at = (p_payload->>'next_check_at')::timestamptz,
      attempts = coalesce((p_payload->>'attempts')::integer, 0),
      check_lock_until = null
  where id = mon.id;

  if coalesce((p_payload->>'alert')::boolean, false) and snap_id is not null then
    kind := case when mon.digest_enabled then 'digest' else 'change' end;
    for channel in select unnest(array['email', 'discord', 'telegram']) loop
      if (channel = 'email' and mon.email is null)
        or (channel = 'discord' and mon.discord_webhook is null)
        or (channel = 'telegram' and mon.telegram_webhook is null) then
        continue;
      end if;
      dedupe := mon.id::text || ':' || (p_payload->>'hash') || ':' || channel || ':' || kind;
      insert into public.wcd_alerts (monitor_id, user_id, snapshot_id, channel, kind, dedupe_key, summary)
      values (mon.id, mon.user_id, snap_id, channel, kind, dedupe, left(p_payload->>'summary', 180))
      on conflict (dedupe_key) do nothing
      returning jsonb_build_object('id', id, 'channel', channel, 'kind', kind) into alert_row;
      if alert_row is not null then
        alerts := alerts || jsonb_build_array(alert_row);
      end if;
    end loop;
  end if;

  return jsonb_build_object('snapshot_id', snap_id, 'alerts', alerts);
end;
$$;

create or replace function public.wcd_mark_alert(p_secret text, p_id uuid, p_delivered boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.wcd_secret_ok(p_secret) then
    raise exception 'forbidden';
  end if;
  update public.wcd_alerts set delivered = p_delivered where id = p_id;
end;
$$;

create or replace function public.wcd_pending_digests(p_secret text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.wcd_secret_ok(p_secret) then
    raise exception 'forbidden';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'monitor_id', m.id,
      'name', m.name,
      'email', m.email,
      'discord_webhook', m.discord_webhook,
      'telegram_webhook', m.telegram_webhook,
      'alerts', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', a.id, 'summary', a.summary, 'channel', a.channel, 'created_at', a.created_at
        ) order by a.created_at), '[]'::jsonb)
        from public.wcd_alerts a
        where a.monitor_id = m.id and a.kind = 'digest' and a.delivered = false
      )
    ))
    from public.wcd_monitors m
    where exists (
      select 1 from public.wcd_alerts a
      where a.monitor_id = m.id and a.kind = 'digest' and a.delivered = false
    )
  ), '[]'::jsonb);
end;
$$;

create or replace function public.wcd_feed(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  mon public.wcd_monitors%rowtype;
begin
  if p_token is null or length(p_token) < 16 then
    return null;
  end if;
  select * into mon from public.wcd_monitors where feed_token = p_token;
  if not found then
    return null;
  end if;
  return jsonb_build_object(
    'name', mon.name,
    'url', mon.url,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id,
        'summary', s.summary,
        'created_at', s.created_at
      ) order by s.created_at desc)
      from (
        select id, summary, created_at
        from public.wcd_snapshots
        where monitor_id = mon.id
        order by created_at desc
        limit 20
      ) s
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.wcd_secret_ok(text) from public, anon, authenticated;
revoke all on function public.wcd_cache_get(text, text) from public;
revoke all on function public.wcd_cache_put(text, jsonb, text) from public;
revoke all on function public.wcd_acquire_host(text, integer, text) from public;
revoke all on function public.wcd_claim_checks(text, integer) from public;
revoke all on function public.wcd_apply_check(text, jsonb) from public;
revoke all on function public.wcd_mark_alert(text, uuid, boolean) from public;
revoke all on function public.wcd_pending_digests(text) from public;
revoke all on function public.wcd_feed(text) from public;

grant execute on function public.wcd_cache_get(text, text) to anon, authenticated;
grant execute on function public.wcd_cache_put(text, jsonb, text) to anon, authenticated;
grant execute on function public.wcd_acquire_host(text, integer, text) to anon, authenticated;
grant execute on function public.wcd_claim_checks(text, integer) to anon, authenticated;
grant execute on function public.wcd_apply_check(text, jsonb) to anon, authenticated;
grant execute on function public.wcd_mark_alert(text, uuid, boolean) to anon, authenticated;
grant execute on function public.wcd_pending_digests(text) to anon, authenticated;
grant execute on function public.wcd_feed(text) to anon, authenticated;

notify pgrst, 'reload schema';
