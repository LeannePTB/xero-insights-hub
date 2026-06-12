## Problem

The advisor invite email reads "You've been invited to join xero-shine-dashboards" and the From line shows `xero-shine-dashboards <noreply@notify.tractionadvisory.app>`. That's the project's internal slug, not the brand.

## Cause

`SITE_NAME` is hard-coded to `"xero-shine-dashboards"` in two files:
- `src/routes/lovable/email/auth/webhook.ts` (used for live sends + From header)
- `src/routes/lovable/email/auth/preview.ts` (used for dashboard previews)

It flows into every auth template (`invite`, `signup`, `magic-link`, `recovery`, `email-change`, `reauthentication`) as the `siteName` prop, and into the `From` line of the outgoing email.

## Change

1. In `webhook.ts` and `preview.ts`, set:
   ```ts
   const SITE_NAME = "Traction Advisory"
   ```
2. No template edits needed — they already render `{siteName}` (e.g. invite says "You've been invited to join **Traction Advisory**").
3. Result: invite reads "join Traction Advisory", and emails arrive from `Traction Advisory <noreply@notify.tractionadvisory.app>`. Applies to all auth emails, not just invites.

No migration, no infra changes. After approval I'll make the edits and you can hit "Resend" on a pending advisor to verify.
