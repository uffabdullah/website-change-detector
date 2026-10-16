# Website Change Detector

Still watches public pages and reports a change only when the stable text actually moved.

## What it refuses to treat as a change

- An outage, a timeout, or a 5xx stays **Error**.
- A CAPTCHA, a 401/403/429, or a robots.txt refusal stays **Blocked**.
- Timestamps, counters, ads, rotating banners, and random tokens are removed before the hash.
- The same URL is fetched once per 15 minutes and shared by every watcher.
- Intervals cannot be shorter than 15 minutes. Hosts have a gap, a timeout, and retries that back off.

## Run

```bash
npm install
cp .env.example .env.local
npm test
npm run dev
```

Apply `supabase/migrations/20261016000000_change_detector.sql`, then store the same `CRON_SECRET` in `.env.local` and in the `wcd_runtime` table.

Stretch Pro is the display face. It is a commercial font, so the site uses it when it is installed and otherwise uses Anybody at its widest axis. Drop licensed `woff2` files into `public/fonts` and extend the `@font-face` in `app/globals.css` if you have a license.

The browser extension lives in `extension/`. Load it unpacked.
