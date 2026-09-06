# Runbook

Operational procedures for PRAVDA's two operators. Read `CLAUDE.md` first for
the conventions that shape *why* these steps are safe; this document is the
concrete *how*. Every command below targets the `pravda-jo` Firebase project
unless a step says otherwise.

## 1. Rotate a secret

Three secrets exist, and they do not sign the same things. Know which one you
are rotating before you rotate it.

| Secret | Signs | Rotating it… |
|---|---|---|
| `OPERATOR_KEY` | Bearer auth on any route still gated by it; the fallback signer for `SESSION_SECRET` and `TALENT_SESSION_SECRET` when either is unset | …closes the console to every operator session immediately, **and** — if `SESSION_SECRET`/`TALENT_SESSION_SECRET` are unset — signs out every talent session too. |
| `SESSION_SECRET` | The `pravda_ops` cookie (`lib/ops/auth.ts`) | …signs out every operator session (Ali's and Khaled's). Talent sessions are untouched **if** `TALENT_SESSION_SECRET` is set. |
| `TALENT_SESSION_SECRET` | Talent HMAC sessions (`lib/talent/auth.ts`) | …signs out every talent on every device. The console warns "signs every device out" next to the reissue button for the same reason — do this outside a shoot day, or tell whoever is mid-flow first. |

To rotate any of the three:

```bash
firebase apphosting:secrets:set OPERATOR_KEY
firebase apphosting:secrets:set SESSION_SECRET
firebase apphosting:secrets:set TALENT_SESSION_SECRET
```

Generate a new value with `openssl rand -base64 32`. Redeploy for the change
to take effect (App Hosting resolves secrets at build/start, not live).

**If `SESSION_SECRET` and `TALENT_SESSION_SECRET` are both unset**, rotating
`OPERATOR_KEY` alone is effectively rotating all three at once — set both the
day you read this, so a console-key rotation is never also a talent outage.

## 2. Reissue the Meta access token

Two clocks run on the same token, and only one of them is loud:

- **`is_valid` / the token itself** expires at ~60 days. A call fails outright.
- **`data_access_expires_at`** expires at ~90 days *while `is_valid` still
  reports `true`* — every read starts silently returning `no-data`
  (`lib/data/clients.ts`'s `FAILURE_NOTE.no-data`), which looks like the
  prospect's account, not ours, unless you already know to check the token.

Steps:

1. Business Settings → System Users → the PRAVDA system user → Generate New
   Token, with `instagram_basic`, `instagram_manage_insights`,
   `pages_read_engagement`, and `ads_read` (the Page role comes through
   Business Manager — without `ads_read` every call 403s and the error never
   mentions ads).
2. Exchange it for a long-lived token:
   `GET /oauth/access_token?grant_type=fb_exchange_token&client_id=...&client_secret=...&fb_exchange_token=<short-lived>`
3. `firebase apphosting:secrets:set META_ACCESS_TOKEN`, paste the long-lived
   token, redeploy.
4. Confirm before relying on it: `curl $SITE/api/health` — read
   `meta.expiresInDays` and `meta.dataAccessExpiresInDays`. Both should be
   fresh (~60 and ~90 respectively). A `meta.warning` field means one of them
   is under 7 days; do not consider the reissue done until it is gone.

## 3. Reissue a talent's passcode

Already wired end to end — `/ops/talent`, the reissue button on a talent's
row (`components/ops/TalentManager.tsx`). Under the hood:
`POST /api/ops/talent { action: 'reissue', id }`. It signs every device that
talent is currently logged in on out (`sessionEpoch` bump), by design — a
passcode does no good if the old one still works somewhere. Tell them the new
code by hand; nothing texts it automatically.

## 4. Re-run a read

Two ways, both live in the console today:

- **`/ops` → the client → "Re-run the read"** (`components/ops/TaskAction.tsx`)
  — `POST /api/ops/client { action: 'rerun', id, vertical?, website? }`. Claims
  the read inline; if the instance dies mid-read, the lease expires and the
  sweeper below finishes it.
- **The sweeper itself**, `GET /api/cron/read`, runs unattended (see §6) and
  picks up anything in `new`, or `reading` with an expired lease, up to 3 per
  call, capped at `MAX_READ_ATTEMPTS` (3) before a client is marked `failed`.

If both are somehow unavailable, there is no other supported path — the
legacy `/api/teardown` route this runbook once pointed at no longer exists;
it was deleted with the rest of the long-form report pipeline.

## 5. Create the Cloud Scheduler job for the read sweeper

One-time, per environment:

```bash
gcloud scheduler jobs create http pravda-read-queue \
  --schedule="* * * * *" \
  --uri="$SITE/api/cron/read" \
  --http-method=GET \
  --headers="x-pravda-cron=<CRON_SECRET value>"
```

Without this job, `/api/cron/read` is never called and the sweeper is dead
code — the read guarantee (D8) depends entirely on this job existing.

## 6. Create a secret before you declare it

`apphosting.yaml` resolves every `secret:` reference **before the build
starts** and **fails the whole rollout within seconds** if one does not exist in
Secret Manager with at least one version. Secret Manager also refuses an empty
payload, so there is no such thing as a placeholder secret — and a placeholder
*value* would be worse, because a present key switches its feature on (a fake
Turnstile key locks the lead form). App Hosting also rejects a plain
`value: ""` entry as "not formatted properly". The two failed rollouts of
6 September 2026 were exactly these: first the empty values, then a secret that
existed but had never been given a version.

The rule, therefore: **create the secret, then add its stanza to
`apphosting.yaml`.** A channel that is not configured is absent from the file;
every consumer treats an unset variable as "not configured", and
`lib/config/check.ts` reports it in the console. The stanzas for every channel
not yet wired are kept, commented out, at the bottom of `apphosting.yaml` with
the command that creates each secret.

To create one — the CLI prompts for the value and grants the backend access:

```bash
firebase apphosting:secrets:set OPERATOR_PHONE
```

For a secret the system should generate itself (`SESSION_SECRET`,
`CRON_SECRET`, `TALENT_SESSION_SECRET`), pass a random value from a file so it
is never typed or echoed:

```bash
openssl rand -base64 32 | tr -d '\n' > /tmp/s && firebase apphosting:secrets:set CRON_SECRET --data-file /tmp/s && rm /tmp/s
```

If a secret was created through the console rather than the CLI, grant the
backend access once:

```bash
firebase apphosting:secrets:grantaccess SESSION_SECRET --backend my-web-app --location europe-west4
```

(Non-`secret:` variables — `TELEGRAM_CHAT_ID`, `WHATSAPP_TEMPLATE`,
`NEXT_PUBLIC_*`, `META_API_VERSION` — are plain `value:` entries and need no
Secret Manager setup; edit the file directly.)

Run `node scripts/check-env.mjs` (or `npm run check-env`) against a shell with
the intended production values sourced to sanity-check what is and is not set
before you deploy, not after.

## 7. Firestore TTL policies

Three collections carry an `expiresAt` field that only *means* something once
a TTL policy is enabled — Firestore does not delete anything on its own until
you run this, once, per collection:

```bash
gcloud firestore fields ttls update expiresAt --collection-group=ratelimit
gcloud firestore fields ttls update expiresAt --collection-group=clients
gcloud firestore fields ttls update expiresAt --collection-group=sheets
```

- `ratelimit.expiresAt` — every rate-limit window document (`lib/store/ratelimit.ts`).
- `clients.expiresAt` — set on an unconverted lead at creation
  (`lib/store/clients.ts`'s `openClient`, 180 days), cleared the day it
  becomes a client (`setClientOutcome`'s `won` branch, and `winSheet`).
- `sheets.expiresAt` — the same lifecycle, on the sheet side (H1's
  `lib/store/sheets.ts`/`convert.ts`).

Firestore's TTL sweep is best-effort and can take up to 24 hours after a
document's `expiresAt` passes — verify the policy is *enabled* via the
Firestore console's TTL policy status page rather than waiting on a real
document to prove it works.

## 8. Managed daily backups + a restore drill

Firestore → Backups (console) → enable **managed daily backups** on the
default database. No Cloud Function, no Cloud Scheduler — a native feature
with its own retention window.

Run a restore drill once, into a **scratch project or a new database
instance — never into `pravda-jo` directly** — and record here that it
worked: `<date>, <who>, <restored-into>, worked/did not work`.

```
2026-__-__  ____  scratch project “pravda-restore-test”  ⌷ worked
```

## 9. Staging backend

`FIRESTORE_COLLECTION_PREFIX=staging_` on a second App Hosting backend
sharing the same `pravda-jo` project — no second Firebase project needed,
since `firestore.rules` already denies all client-side access regardless of
prefix, and every store module already reads the prefix independently.

```bash
firebase apphosting:backends:create   # name it, e.g. pravda-staging
```

Give it its own `OPERATOR_KEY`/`SESSION_SECRET` (**must differ from prod** —
this is the console's isolation boundary; `META_ACCESS_TOKEN`/`META_IG_USER_ID`
may be shared, since staging only ever reads public Instagram data prod would
also read). Set `FIRESTORE_COLLECTION_PREFIX=staging_` on the staging backend
only. Seed it once from a developer machine with real ADC:

```bash
FIRESTORE_COLLECTION_PREFIX=staging_ GOOGLE_CLOUD_PROJECT=pravda-jo \
  node scripts/seed-content.mjs
```

`staging_` and `_itest_` are **reserved prefixes** — never let a real
business's handle collide with one (practically impossible, since handles are
Instagram usernames, but worth knowing before scripting anything that takes a
prefix as an argument).

## 10. Export a client's data (PDPL request)

```bash
node scripts/export-client.mjs <handle>
node scripts/export-client.mjs <handle> --out export.json   # write to a file instead of stdout
```

Reads `clients/{handle}`, every sheet in its `sheetTokens`, its deal (by
`dealId`, and defensively by `clientHandle` too), and every booking against
that deal. Needs real ADC against `pravda-jo`
(`gcloud auth application-default login`) and **refuses to run** if
`FIRESTORE_COLLECTION_PREFIX` is set — a real PDPL request must never be
quietly answered from staging or test fixtures.

Tested against the emulator with `FIRESTORE_COLLECTION_PREFIX=_itest_
--allow-prefix` before ever being pointed at a real handle — `--allow-prefix`
exists for exactly that, and only that.

## 11. Delete a client's data on request (PDPL request)

```bash
node scripts/delete-client.mjs <handle> --confirm
```

Deletes the same set `export-client.mjs` reads — the client document, every
sheet, deal and booking it names — as one atomic batch. Refuses without the
literal `--confirm` flag, and refuses against a prefixed environment the same
way `export-client.mjs` does. **This is permanent.** Run the export first if
there is any chance the operator will want their own copy of what was there.

Print the script's own JSON output (it names what it deleted) into the
operator's own record before replying to the requester — that output is the
only receipt this action leaves.

## Seed script flags

`scripts/seed-content.mjs`:

- `node scripts/seed-content.mjs` — idempotent, keyed by slug/id; safe to
  rerun against a populated store (preserves an operator-set day rate, phone,
  tags, and never re-issues a passcode).
- `--voiceover-rate <JOD>` — sets the (otherwise unpublished) voiceover day
  rate; without it the voiceover record seeds inactive rather than inventing
  a number nobody approved.
- `--promote <key>` — marks one seeded talent record as real rather than
  placeholder. Every seed starts `placeholder: true`; `recommend.ts` refuses
  to put a placeholder person on a client's sheet, so this flag is the only
  way a seeded person becomes bookable, and it clears the flag for one person
  at a time on purpose.
- `--force` — required to seed against `NODE_ENV=production` with no
  `FIRESTORE_COLLECTION_PREFIX` set. The script refuses by default in that
  combination, since it is the one shell where "overwrite the live
  collections" is never what was meant.
