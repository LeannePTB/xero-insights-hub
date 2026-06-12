# Add advisor with password + let them change it later

Right now the only way to add an advisor is to send them an email invite and have them click a link to set a password. This adds a second path: you type their email and a starter password, they're active immediately, and after they log in they can change the password themselves.

## What changes

### 1. Advisors settings page — new "Create with password" mode

The existing invite card gets a small toggle:

```text
[ Send email invite  |  Create with password ]
```

- **Send email invite** — current behaviour, unchanged.
- **Create with password** — shows an email field, a password field (with show/hide toggle), and a "Copy credentials" button after creation that copies `email + password` to the clipboard so you can hand them over via Slack/SMS/etc.

The new advisor is created already-confirmed (no email click required), gets the advisor role, and appears in "Current advisors" with no "Pending invite" badge — they can sign in immediately at the normal `/auth` page.

### 2. New "Change password" section in Account settings

A new card on `/settings` (or a dedicated `/settings/account` page if you prefer — let me know) with:

- Current password
- New password (with strength hint)
- Confirm new password
- "Update password" button

After update: success toast, fields clear. Any signed-in user (advisor or viewer) can use it.

### 3. Sensible password rules

Minimum 8 characters, at least one letter and one number. Same rule on both the create-advisor form and the change-password form so behaviour is consistent.

## Technical notes

- New server fn `createAdvisorWithPassword({ email, password })` — advisor-gated, uses `supabaseAdmin.auth.admin.createUser` with `email_confirm: true` and the supplied password, then grants the advisor role. Rejects if the email already exists.
- New server fn `changeMyPassword({ currentPassword, newPassword })` — re-authenticates with the current password (defence against an unlocked laptop), then calls `supabase.auth.updateUser({ password })`.
- Primary advisor (`admin@positivetraction.com.au`) protections from the previous change are untouched.
- No DB migration needed.

## Out of scope

- Forgot-password / reset-by-email flow (separate request if you want it).
- Password strength meter UI beyond the basic rule check.
