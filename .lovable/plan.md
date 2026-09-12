# Practice team on the advisors page

Security classification: **security-relevant** (touches `practice_team`, which decides
which organisations our people are auto-added to). No access rule changes.

## What changes

1. **Advisors page shows and manages practice-team membership.**
   - New server function `setPracticeMembership({ userId, onTeam })` in
     `src/lib/practice-team.functions.ts`, aal2 middleware, calling
     `admin_add_practice_member` / `admin_remove_practice_member` through
     `context.supabase` only. No service role, no direct table write.
   - The advisors page reads `listPracticeTeam` (super admin only, since the list is
     Path C metadata) and shows a "Practice team" badge plus a toggle on each row for
     super admins.
   - One plain-English line on the page explaining what the list does and that it
     grants nothing by itself.

2. **One screen, not two.** `/settings/practice-team` becomes a redirect to
   `/settings/advisors` and the sidebar link is removed. Nothing is lost: the same
   list, add and remove actions now live on the advisors page. The email-based
   `addPracticeMember` (its only service-role use, for email → user id) goes away
   with it; the register row is removed.

3. **No coupling.** `advisor` / `super_admin` never imply practice team. The toggle is
   an explicit per-person choice.

4. **Add the three current advisors** through `admin_add_practice_member` so each
   write is audited.

## Not changing

`admin_set_self_firm_membership` and the handed-over restriction, `is_practice_member_of`
(still requires an ACTIVE membership of that organisation), the super-admin requirement
on either function, every existing matrix row.

## Verification

`bun run security:check` before/after with fingerprint, typecheck, linter, a query
confirming `practice_team` holds exactly three rows and three audit rows exist.
