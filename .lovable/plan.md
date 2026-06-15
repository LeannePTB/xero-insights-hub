## Problem
The `firms.owner_user_id` column is `NOT NULL`, but `adminCreateFirmAndInvite` (super-admin "Invite new business" flow) creates a firm shell before the owner exists — the owner is only created when they accept the invite. The insert fails the not-null constraint.

## Fix
Single migration to drop the `NOT NULL` constraint on `public.firms.owner_user_id`. The column stays — `acceptInvite` already sets it when the owner signs up, and existing rows keep their owners.

```sql
ALTER TABLE public.firms ALTER COLUMN owner_user_id DROP NOT NULL;
```

No code changes needed. RLS, FK (`ON DELETE RESTRICT`), and `is_firm_owner` checks all tolerate `NULL` (a null owner simply means "no owner yet", and access for that firm flows through `firm_members` / super-admin policies until the invite is accepted).

## Verification
- Super-admin → "Invite new business" with an email → firm row inserted, invite email sent, no constraint error.
- Invitee opens link, sets password + business name → `firms.owner_user_id` populated, `firm_members` row created, firm visible in dashboard.
- Existing firms unchanged.