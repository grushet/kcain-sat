# Planner push reminders

The planner (tasks.cainsat.org) can only remind a student while its tab is open:
`checkReminders()` runs on a `setInterval` in that page and nowhere else. This
adds server-sent Web Push so a reminder also fires with the tab closed, on
desktop and on Android. iOS needs the site added to the Home Screen first
(a manifest ships for that).

With the env vars below unset the feature is simply **off** and the planner falls
back to in-tab reminders only — nothing breaks.

## How it works

| Piece | Where |
|---|---|
| Subscription table `PlannerPushSubscription` (one row per browser, carries the device's IANA time zone) | `prisma/schema.prisma` |
| Subscribe / unsubscribe / read public config | `POST` / `DELETE` / `GET /api/planner/push` |
| "Is this reminder due in the student's zone" — pure, unit-tested | `src/lib/planner-reminders.ts` |
| VAPID setup + one send helper (`web-push`) | `src/lib/planner-push.ts` |
| Scan + fire, runs on a schedule | `GET /api/cron/planner-reminders` |
| Schedule (every 5 min) | `vercel.json` `crons` |
| Client: ask permission, subscribe, report time zone | planner `main.js` `syncPushSubscription()` |
| Client: show the pushed notification | planner `sw.js` `push` handler |

A reminder that fires in-tab and via push in the same minute carries the same
`tag`, so the second only replaces the first — no duplicate.

## Setup

### 1. Generate a VAPID key pair

```bash
npx web-push generate-vapid-keys
```

### 2. Set env vars (local `.env` and Vercel → Settings → Environment Variables)

```env
VAPID_PUBLIC_KEY="B..."        # from step 1
VAPID_PRIVATE_KEY="..."        # from step 1
VAPID_SUBJECT="mailto:admin@cainsat.org"
CRON_SECRET="openssl rand -base64 32"
```

Vercel Cron automatically sends `Authorization: Bearer $CRON_SECRET` to the cron
route once `CRON_SECRET` is set. The route refuses to run if the secret is
missing.

### 3. Push the schema change

```bash
npm run db:push
```

Adds `PlannerPushSubscription` and its relation on `User`. No data migration.

### 4. Deploy

`web-push` is a new dependency — make sure `npm install` has run. `vercel.json`
now carries a `crons` entry; Vercel picks it up on deploy.

### 5. Verify

- Open tasks.cainsat.org, set a reminder a couple of minutes out, allow
  notifications when the bell prompts, then close the tab.
- Hit the cron route by hand:
  `curl "https://www.cainsat.org/api/cron/planner-reminders?key=$CRON_SECRET"`
  — it returns `{ checked, due, sent, pruned, fired }`.
- The notification should arrive with the tab shut.

## Plan note

`vercel.json` uses `*/5 * * * *`. **Vercel Hobby only runs crons once per day**
and may reject a sub-daily schedule. On Hobby either change it to `0 * * * *`
(hourly, reminders land up to an hour late) or keep a daily Vercel cron and drive
the real cadence from an external pinger (cron-job.org, GitHub Actions, an uptime
monitor) calling the route every few minutes with `?key=$CRON_SECRET`.
