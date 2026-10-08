# Calm the Xero usage warning — reserve red Action for genuine failure risk

## Problem

The Security page check "Xero API usage against the limits" shows a red **Action** badge. Today that happens for three different conditions mixed together:

1. A file's busiest hour exceeded 40 calls (the burst from the now-fixed Tax obligations card bug).
2. Xero paused a few calls (concurrent limit — Xero retries them itself, no data lost).
3. "Lowest remaining on any limit: 0.0%" — but that 0% is a single busy **minute** (0/60), while the day allowance is healthy at 94%.

None of these mean something is seriously wrong, yet all of them turn the badge red. Red should mean "reads will start failing", not "usage was lumpy".

## What you'll see

- **Bursts and pauses → amber "Warn"** instead of red. The detail text keeps naming the file, hour and count, and says what to do: check for a refresh loop. Nothing is hidden — only the colour and the alarming badge change.
- **Red "Action" stays reserved** for one condition: a file's **day** allowance under 5% remaining — i.e. reads for that file are about to fail.
- The near-quota judgement now uses the **day** remaining only. Minute-by-minute dips (0/60 during a burst) stay in the evidence line for transparency but no longer drive the badge red. A busy minute recovers by itself within 60 seconds; the day allowance is what actually matters.
- Every other posture check keeps its current behaviour, and the sidebar Security pill follows the same counts as before.

## Technical details

- All logic lives in one database function: `public.xero_rate_limit_posture()` (SECURITY DEFINER, aal2 + super-admin asserted — unchanged).
  - `st := action` branches for `bursts > 0` and `rejects > 0` become `warn`.
  - `worst_pct` is computed from `day_remaining_low / day_cap` only; the minute and app-wide-minute figures remain in the evidence string.
  - The "nearly out of quota" `< 5%` branch keeps `action`; the `< 20%` branch stays `warn`.
  - Detail wording for the warn cases adjusted: same facts, "worth checking" tone rather than incident tone.
- No signature change, no privilege change, no policy change; `definer-purposes.ts` / definer register entries unchanged. Additive migration amending the function body only.
- Security classification: security-relevant (modifies a guarded definer function), but read-only presentation of monitoring severity — no row can be read or written by anyone who could not before.

## Verification

- After the migration, render the check's JSON by invoking the function's logic through a read-only fixture (the real function requires an AAL2 super-admin session, so verify the branch logic directly against the same inputs): bursts present + healthy day quota must return `warn`; day remaining < 5% must return `action`; quiet day must return `ok`.
- Run `bun run security:check` — zero unexpected failures, known-failure list unchanged (129 tests + 18 live, linter 118, `security_posture()` read unverifiable from tooling).
- Confirm the definer guard scan still passes and no new linter findings appear.
- Update `docs/security-backlog.md` with the change and its verification evidence.
- Visual check of /admin/security needs the owner's own session (test sign-in cannot pass MFA).
