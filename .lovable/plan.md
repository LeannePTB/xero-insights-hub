# Diagnosis — "Starter (5 clients)" vs "Clients allowed: 1"

Read-only investigation. Nothing changed.

## 1. Where each number comes from

**The badge — hardcoded string in application code.**
`src/lib/firmPlans.ts:17` — `TIER_LABEL.starter = "Starter (5 clients)"`.
`firmPlanView()` (same file, `planLabel`) picks it purely from `subscriptions.tier`; it never sees any limit column.
Rendered at `src/routes/_authenticated/firms.$firmId.settings.tsx:174` — `<Badge variant="secondary">{planV.planLabel}</Badge>`.

**"0 of 1 clients used" and "Clients allowed: 1" — a database column.**
`src/routes/_authenticated/firms.$firmId.settings.tsx:179` and `:219` both read `view.clientLimit`, which comes from `getFirmSubscription` in `src/lib/firm-subscription.functions.ts:133`: `clientLimitFor(s.tier, isAlwaysFree, { override, catalogue })`, where `catalogue` is built from `plan_levels` rows (`scope = 'firm'`, `key`, `client_limit`). So the number is `plan_levels.client_limit` for `starter`, which is **1**.

**Xero files allowed: 1** — `plan_levels.xero_org_limit` for `starter` (also 1), via `summary.xeroFileLimit`.

So: one value is a string a human typed into `firmPlans.ts`, the other is a live column. The `plan_levels.starter` row was edited from 5 down to 1 at some point; the string never moved.

## 2. Which one is enforced

The column — twice, and the badge never.

Database (authoritative), trigger `trg_enforce_client_limit` on `public.clients`, function `app_private.enforce_client_limit()`:

```
select client_limit into _lim from app_private.firm_limits(NEW.firm_id);
if _lim is null then return NEW; end if;
select count(*) into _cnt from public.clients where firm_id = NEW.firm_id;
if _cnt >= _lim then
  raise exception 'PLAN_LIMIT_CLIENTS: this organisation''s plan allows % client(s). Upgrade to add more.', _lim
```

Application pre-check, `src/lib/clients.functions.ts:342-359`, using the same `plan_levels` catalogue:

```
const limit = clientLimitFor((subRow as any)?.tier, (firmRow as any)?.is_always_free, {
  override: (subRow as any)?.client_limit_override ?? null,
  catalogue: firmLimitCatalogue(planRows as any),
});
...
if ((usedCount ?? 0) >= limit) {
  throw new Error(`Client limit reached (${usedCount}/${limit}). Upgrade the subscription to add more clients.`);
}
```

A second client is blocked at 1. The badge is decorative and, for this organisation, wrong by a factor of five.

## 3. The actual rows

`firms` + `subscriptions` for Bangkok On Darby (`499e7cb4-7938-463a-8b02-89114e2cddce`):

| field | value |
| --- | --- |
| is_always_free | false |
| tier | starter |
| status | trialing |
| trial_ends_at | 2026-09-30 00:00:00+00 |
| current_period_end | null |
| client_limit_override | null |
| cancel_at_period_end | false |
| consolidation_enabled | false |

`plan_levels` where `scope = 'firm'`:

| key | label | description | client_limit | xero_org_limit | allows_multi_org | is_free | enabled | allowed_tiers |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ptb | PTB | Complimentary plan for Positive Traction bookkeeping clients… | 1 | 1 | false | true | true | {basic, advisory, multi_company} |
| starter | Starter | Up to 5 client subscriptions. | 1 | 1 | false | false | true | {basic, advisory} |
| growth | Growth | Up to 10 client subscriptions. | 10 | 10 | false | false | true | {basic, advisory} |
| scale | Multi Company Consolidation | Up to 20 client subscriptions. | 20 | 20 | false | false | true | {multi_company} |

Note: the stored `plan_levels.label` for starter is just **"Starter"** — no number. The "(5 clients)" is only in `firmPlans.ts`.

Client count: the organisation had 0 clients when you looked; a client ("Bangkok on King") was created at 2026-08-26 07:41:50 UTC, so it now reads **1 of 1** and is at its limit.

## 4. Derived or stored?

Stored, in three separate places, none of which is the limit column:

1. **`src/lib/firmPlans.ts` `TIER_LABEL`** — hand-edited TypeScript. Every entry with a number is a hostage to fortune:
   - `starter: "Starter (5 clients)"` — **disagrees**: `plan_levels.starter.client_limit = 1`.
   - `growth: "Growth (10 clients)"` — agrees (10).
   - `scale: "Scale (20 clients)"` — count agrees (20) but the **name** disagrees: the stored label is "Multi Company Consolidation".
   - `firm: "Organisation (50 clients)"` — **no `plan_levels` row exists** for `firm`, so `clientLimitFor` falls through to the hardcoded `CLIENT_LIMITS.firm = 50`. Nothing to disagree with, and nothing an admin can change from the tier screen either.
   - `ptb: "PTB (1 client, free)"` — agrees (1).
   - `free` / `legacy` — no numbers, no rows; both resolve to the hardcoded 9999.
2. **`plan_levels.description`** — also stored prose with a number: starter says *"Up to 5 client subscriptions."* against `client_limit = 1`. This one is user-visible in the "Change plan" cards (`firms.$firmId.settings.tsx:358`), directly above the card's own "Clients: 1" line.
3. **`CLIENT_LIMITS` in `firmPlans.ts`** — a second hardcoded copy of the limits themselves, used whenever a tier has no `plan_levels` row (`firm`, `free`, `legacy`). That is a numeric fallback, not a label, but it is the same class of problem.

So there are currently **two** wrong texts for starter (label and description) and **one** wrong name for scale.

## 5. Everywhere the pair is displayed

Every screen calling `firmPlanView()` shows the hardcoded label:

- `src/routes/_authenticated/firms.$firmId.settings.tsx:174` — organisation settings badge (the reported screen), sitting next to `view.clientLimit` at `:179`, `:219`, `:269`, `:275-281`.
- `src/routes/_authenticated/firms.$firmId.index.tsx:186` — organisation overview, `planLabel` passed into the header/clients section.
- `src/routes/_authenticated/dashboard.tsx:249` — the organisation card badge on the all-organisations list.

Screens showing the *stored* label and description instead (correct name, but the description prose can still lie):

- "Change plan" cards, `firms.$firmId.settings.tsx:335-375` — `p.label`, `p.description`, `p.clientLimit`, `p.xeroOrgLimit`, from `getFirmSubscription`'s `plans` array.
- The change-plan confirmation, `firms.$firmId.settings.tsx:427` — `{target?.clientLimit} clients` (derived, correct).
- Plan level admin editor, `src/lib/plan-levels.functions.ts` / the tier settings screen — edits the columns.

Limit-related error copy is already derived and safe: `src/lib/plan-errors.ts`, `src/lib/xero/connections.functions.ts` and the database exception all interpolate the live number. No emails or public pricing screen bake a count into a plan name.

`src/lib/tiers.ts` `TIER_LABEL` is a different thing — dashboard tiers (Standard/Advisory), no client counts. Not affected.

## 6. Recommendation

Your preference is the right one, with one refinement.

**Do:**
- Delete the counts from `TIER_LABEL` in `firmPlans.ts` so it holds plain names only ("Starter", "Growth", …) — the same content as `TIER_SHORT`, which suggests collapsing the two.
- Make `firmPlanView()` take the resolved limit (it already computes `clientLimit`) and have the badge render name and number as two adjacent pieces — `Starter · 1 client` — or simply drop the count from the badge entirely, since "0 of 1 clients used" is already sitting 20 pixels to its right. Rendering the same fact twice on one line is what created the bug; deriving both from one source removes the contradiction, but showing it once is better still.
- Prefer the **stored** `plan_levels.label` over the hardcoded map wherever a plan name is shown, so the scale plan reads "Multi Company Consolidation" everywhere. `firmPlanView` currently has no access to the catalogue; passing it in is the same change as passing the limit.
- Treat `plan_levels.description` as the remaining hazard: either stop writing counts into it (leave the numbers to the "Clients: N" line beneath) or, at minimum, fix the starter row's prose. This is a data edit, not code, and would be a separate approval.

**Reasons not to, considered:**
- *Marketing copy.* These labels are not public pricing copy — every render is inside the authenticated advisor UI, next to the enforced number. There is no case for the name disagreeing with the limit here. If a public pricing page appears later it can have its own copy table, deliberately separate.
- *Overrides.* `subscriptions.client_limit_override` means the effective limit is per-organisation, so a plan-name-with-a-count is wrong for any organisation with an override, whatever the plan row says. That is an additional argument for deriving, not against.
- *Tiers with no row.* `firm`, `free` and `legacy` have no `plan_levels` row and fall back to `CLIENT_LIMITS`. Deriving the label from the resolved limit works for them too, but it is worth deciding whether those three should exist at all, since they cannot be administered.

No files, rows, policies or database objects were changed.
