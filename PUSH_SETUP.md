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
| Schedule (every minute) | an external pinger — step 6 below |
| Client: ask permission, subscribe, report time zone | planner `main.js` `syncPushSubscription()` |
| Client: show the pushed notification | planner `sw.js` `push` handler |

A reminder that fires in-tab and via push in the same minute carries the same
`tag`, so the second only replaces the first — no duplicate.

## Setup

Everything below stays inside the free tier. Vercel Hobby is fine; the one thing
it cannot do is run a cron more than once a day, so the schedule lives off Vercel.

### 1. Keys

A VAPID pair and a `CRON_SECRET` are already in the local `.env`. Reuse those —
regenerating the pair invalidates every subscription already stored. If you ever
do need a fresh pair:

```bash
npx web-push generate-vapid-keys
```

### 2. Put the four vars in Vercel

Vercel → the `kcain-sat` project → Settings → Environment Variables. Add each for
Production, Preview and Development, copying the values out of `SAT/.env`:

```
VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
VAPID_SUBJECT
CRON_SECRET
```

None of these is `NEXT_PUBLIC_`. The browser gets the public key at runtime from
`GET /api/planner/push`, so no rebuild is needed when it changes.

### 3. Push the schema change

```bash
npm run db:push
```

Adds `PlannerPushSubscription` and its relation on `User`. No data migration.
`.env` points at the production Supabase pooler, so this runs against prod.

### 4. Turn on RLS for the new table

`prisma db push` creates tables with row-level security **off**, which would leave
this one readable through Supabase's PostgREST anon key. Every other table here has
RLS on with no policies. Match it — Supabase → SQL Editor:

```sql
ALTER TABLE public."PlannerPushSubscription" ENABLE ROW LEVEL SECURITY;
```

Prisma connects as `postgres`, which bypasses RLS, so the app is unaffected.

### 5. Deploy

Push `main` in both repos. `web-push` is a new dependency; Vercel installs it from
the lockfile. `vercel.json` carries no `crons` entry on purpose — a `*/5` schedule
there fails the build on Hobby.

### 6. Schedule the cron route

Any free pinger works. [cron-job.org](https://cron-job.org) is the simplest:

- URL: `https://www.cainsat.org/api/cron/planner-reminders`
- Schedule: every minute
- Request method: GET
- Add a header — `Authorization: Bearer <CRON_SECRET>` (cron-job.org puts both
  the method and the headers on its ADVANCED tab, not the one you land on)

Prefer the header over `?key=`, which would put the secret in Vercel's request
logs. GitHub Actions `schedule:` also works but drifts by 10–20 minutes under load
and switches itself off after 60 days without a commit.

Reminder accuracy is the ping interval, so every minute is worth it: a minute of
lateness is invisible, five is not. Nothing in the route cares how often it runs —
`reminderFired` makes each reminder send once at any frequency, and the 48-hour
stale window is untouched by the interval. Once a minute is about 44k invocations a
month against the 1M Vercel Hobby includes.

## Verify

- Open tasks.cainsat.org, set a reminder a couple of minutes out, allow
  notifications when the bell prompts, then close the tab.
- Confirm the subscription stored: one row in `PlannerPushSubscription` carrying
  your browser's endpoint and IANA time zone.
- Hit the route by hand:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://www.cainsat.org/api/cron/planner-reminders
```

It returns `{ checked, due, sent, pruned, fired }`. The notification should arrive
with the tab shut.

## Gotchas

- **Chrome on desktop must be running** (any window, or in the background) to
  receive a push. Chrome fully quit means no notification until it reopens.
- **iOS needs Add to Home Screen first.** Safari grants push only to an installed
  web app; that is what the manifest is for.
- **A reminder fires once.** `reminderFired` is set even when every endpoint is
  dead, so a student with no working subscription does not accumulate a backlog.
- **Windows Focus Assist / Do Not Disturb** silently swallows notifications and
  looks exactly like a broken push.
