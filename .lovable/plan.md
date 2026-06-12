## Goal

Get the previously-failed advisor invites delivered through your verified `notify.tractionadvisory.app` sender, with branding, retries, and logging.

## Steps

1. **Scaffold branded auth email templates**
   Creates the 6 auth templates (signup, magic link, recovery, **invite**, email-change, reauthentication) and wires the auth webhook to the email queue using `notify.tractionadvisory.app`. Apply your brand styling (logo, colors from `src/index.css`) to each template. Body background stays white per the email guide.

2. **Add a "Resend invite" server function** (`resendAdvisorInvite` in `src/lib/advisors.functions.ts`)
   - Advisor-only.
   - For a given advisor user_id, look up the auth user and confirm they have never confirmed/signed in (`email_confirmed_at` / `last_sign_in_at` both null) — so we never re-invite an active advisor.
   - Call `supabaseAdmin.auth.admin.generateLink({ type: 'invite', email, options: { redirectTo } })`. This triggers the auth webhook → enqueues a branded invite email to the `auth_emails` queue → sent through Lovable Emails.
   - Return `{ ok: true }`.

3. **Add a "Resend all pending invites" server function** (`resendAllPendingAdvisorInvites`)
   - Advisor-only.
   - Lists every advisor row whose auth user has no confirmation/last sign-in, iterates and calls the per-user resend logic. Returns `{ resent: string[], skipped: string[] }`.

4. **UI on `/settings/advisors`**
   - For each advisor row that is "pending" (never signed in), show a `Resend invite` button next to their email.
   - Add a top-level `Resend all pending invites` button. Toast results.

5. **Trigger the resend now**
   Once the route is live, click `Resend all pending invites` (or I can invoke the server fn directly once it's deployed). Each invite enqueues, the cron worker sends it within ~5s, and rows land in `email_send_log` with `template_name = 'invite'`.

## Verification

- `email_send_log` shows one `pending` → `sent` row per advisor with `template_name = 'invite'`.
- Recipients receive an email From `…@notify.tractionadvisory.app`.
- Inviting/clicking the link lands them on `/auth` and they can set a password.

## Notes

- No DB migration needed; auth users already exist from the first (silent) invite. We use `generateLink` rather than `inviteUserByEmail` to avoid "user already registered" errors and to re-trigger the webhook.
- The cron worker / queue infra is already in place from the previous email setup turn.
- I won't touch the existing `inviteAdvisor` happy-path — only add the resend functions and UI.
