# Hide the "Demo" label from everyone except System Admin

## What changes for you

- People who belong to a demo organisation (like Demo Practice) will see it in their normal
  organisation list, in alphabetical order, with **no** "Demo" label and no separate group.
  It behaves exactly like any other organisation for them.
- You, as a System Administrator, keep the separate **Demo** group at the bottom of your list.
- The switch itself is untouched: it still lives only at System Admin → Organisations →
  [organisation] → Overview, still needs System Administrator + MFA, and still writes to the
  audit log.

## Why it needs a change at all

Right now the database sends the demo marking to *every* member's browser, and the sidebar
merely decides whether to show the group. So a member's own app already knows their
organisation is marked as a demo one. To make the label genuinely System-Admin-only, the
marking must stop leaving the database for anyone who isn't a System Administrator.

## How it will be built

1. **New database rule (migration `0061_demo_flag_reader.sql`).** A caller-scoped reader
   function that returns each organisation's demo marking *only* when the caller is a System
   Administrator, and "not a demo" for everybody else. It reads through the caller's own
   session and existing row-level security, is not callable by signed-out users, and changes
   no table, no column, and no existing function or permission.
2. **Member-facing reads stop carrying the flag.** The sidebar's organisation list gets the
   demo marking from that new function instead of reading the column directly, so a member
   only ever receives "not a demo". The organisation detail read used by members drops the
   column from its query entirely (nothing on that screen shows it).
3. **The sidebar list itself needs no rework.** It still puts demo organisations in their own
   group at the bottom when it is given a true marking — which, after step 1, only ever
   happens for a System Administrator.
4. **Lock the rule in with checks.** New access-matrix rows and a probe for the new function
   (System Administrator sees it; organisation owner, staff, another organisation's member,
   business owner and viewer do not), plus a static guard so a member-facing read can never
   quietly start selecting the demo column directly again.
5. **Paperwork and gates.** Regenerate the access matrix, update the security backlog, then
   run the security check, the test suite, the posture read and the database linter.
6. **Verify signed in.** As a member of Demo Practice: one flat list, no label. As System
   Admin: the Demo group still at the bottom.

## Security classification

Security-relevant, and it only ever narrows what a person can see — no new access is granted
and nothing is loosened. The existing System-Administrator-only write path, its MFA check and
its audit entry are not modified.

## Technical details

- New: `public.my_firm_demo_flags()` — `returns table(firm_id uuid, is_demo boolean)`,
  `security invoker`, `stable`, `set search_path = public`, body resolves the value with
  `case when public.me_is_super_admin() then f.is_demo else false end` over the rows the
  caller may already read under existing RLS. `revoke execute from public, anon;`
  `grant execute to authenticated;` — no `supabaseAdmin`, no definer, no new grants on tables.
- `src/lib/firms.functions.ts`: `listMyFirms` selects `id, name` from `firms` and maps
  `isDemo` from `my_firm_demo_flags()`; `getMyFirm` selects `id, name, is_always_free` only
  and sets `isDemo: false`. `FirmOverviewCard` keeps its `isDemo` field; the System Admin grid
  is unchanged.
- `src/components/shell/WorkspaceSwitcher.tsx`: no change (grouping logic already keys off the
  flag it is handed).
- `src/routes/_authenticated/system.organisations.$firmId.tsx` and
  `src/lib/admin.functions.ts` (`getFirmDetailAdmin`, `adminSetFirmDemo`) are untouched, so the
  switch, its System-Administrator + MFA requirement and its audit write all stay as they are.
- Proofs: `docs/security/access-matrix.ts` rows for resource `demo: my_firm_demo_flags`
  (allow for `super_admin_no_membership`, deny for `org_owner`, `org_staff`,
  `other_org_member`, `business_owner`, `client_viewer`); the `demo:` branch in
  `tests/access-matrix.test.ts` extended to run the new function as the probe role; a guard in
  `tests/static-guards.test.ts` failing any member-facing query in
  `src/lib/firms.functions.ts` that selects `is_demo` straight from `firms`.
- Checks: `bun run security:check`, `bunx vitest run`, `public.security_posture()`, Supabase
  linter, and a signed-in pass in both roles.
