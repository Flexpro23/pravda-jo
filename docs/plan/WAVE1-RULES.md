# Wave 1 — rules every agent follows

Repo: /Users/aliodat/Pravda. Read docs/plan/MASTER-PLAN.md sections 1–3 first, then the source
plan items named in your brief. README.md explains the stack and the .next/.next-prod split.

Eight agents are editing this working tree at the same time. Each has an exclusive file list.
- Touch ONLY the files in your brief's SCOPE. If you need a change in a file you do not own,
  write the exact change you need into your final report instead of making it.
- No git commands that mutate state: no stash, checkout, reset, commit, add, restore.
  git status / diff / log are fine.
- Do not run `npm install`, do not edit package.json or package-lock.json. If you need a
  dependency, say so in the report. Do not start `next dev` or `next build`.
- New unit tests go in tests/unit/<yourarea>.test.mts using node:test + node:assert/strict.
  Fixtures go under tests/fixtures/<yourarea>/ only. Run yours with:
    NODE_OPTIONS='--experimental-strip-types --import ./tests/register.mjs' node --test tests/unit/<file>
  No network in unit tests — inject fetch/lookup seams. Itests use the emulator:
    JAVA_HOME=$(/usr/libexec/java_home -v 21) npx firebase-tools emulators:exec --only firestore "node --experimental-strip-types --import ./tests/register.mjs tests/<file>.itest.mts"
- Finish with `npx tsc --noEmit`. If the only errors are in files owned by a sibling agent
  (mid-edit), report them and stop; do not fix a sibling's file.
- Conventions: TypeScript strict; comments explain why in the repo's existing voice; bilingual
  strings are {ar, en}; Arabic surfaces use Arabic-Indic digits via lib/format/num.ts; dates via
  lib/format/date.ts; never add a client price to a Booking; never invent a number a client reads.
- Wave 0 already landed: lib/format/{num,date}.ts, lib/store/ratelimit.ts (hit/ipKey/clientIp),
  FIRESTORE_EMULATOR_HOST branch in firebase.ts, .eslintrc, tests/unit harness, openClient
  contact-merge fix, sameSite lax, legacy routes fenced to 410, /api/ops/run deleted.
- Return a report of at most 20 lines: files changed/created, decisions you made that the plan
  left open, exact edits you need in files you do not own, test results, anything undone.
