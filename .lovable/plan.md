# Cut over to tractionadvisory.com.au

Goal: make `tractionadvisory.com.au` the canonical domain everywhere in code, email, and Xero, then publish.

## 1. Code changes (find/replace `tractionadvisory.app` → `tractionadvisory.com.au`)

Update every hardcoded reference:

- `src/lib/xero/connections.functions.ts`
  - `CANONICAL_XERO_APP_ORIGIN` → `https://tractionadvisory.com.au`
  - Allowed-origin list → `tractionadvisory.com.au`, `www.tractionadvisory.com.au`
- `src/routes/api/public/xero/callback.ts`
  - `XERO_CALLBACK_URL` → `https://tractionadvisory.com.au/api/public/xero/callback`
  - Allowed-origin list updated to `.com.au`
- `src/lib/invites.functions.ts` — both `inviteUrl` builders → `https://tractionadvisory.com.au/signup/${token}`
- `src/lib/advisors.functions.ts` — `redirectTo` and fallback → `https://tractionadvisory.com.au/set-password`
- `src/lib/admin.functions.ts` — `redirectTo` → `https://tractionadvisory.com.au/set-password`
- `src/routes/auth.tsx` — production set-password URL → `https://tractionadvisory.com.au/set-password`
- `src/routes/_authenticated/settings.advisors.tsx` — copy-credentials snippet → `https://tractionadvisory.com.au/auth`
- `src/routes/_authenticated/clients.$clientId.settings.tsx` — viewer-credentials snippet → `https://tractionadvisory.com.au/auth`
- `src/lib/email-templates/firm-invite.tsx` — default `inviteUrl` and preview example → `tractionadvisory.com.au`

Email sender domain (must match the DNS NS delegation we already sent the host):

- `src/lib/email/send.server.ts`, `src/routes/lovable/email/transactional/send.ts`, `src/routes/lovable/email/auth/webhook.ts`, `src/routes/lovable/email/auth/preview.ts`
  - `SENDER_DOMAIN` → `notify.tractionadvisory.com.au`
  - `FROM_DOMAIN` / `ROOT_DOMAIN` → `tractionadvisory.com.au`

## 2. Lovable Domains (manual, in Project Settings → Domains)

1. Confirm `tractionadvisory.com.au` and `www.tractionadvisory.com.au` are connected and **Active** (host has the A/TXT records from the Word doc).
2. Set `tractionadvisory.com.au` as **Primary**.
3. Either remove `tractionadvisory.app` / `www.tractionadvisory.app` or leave them as redirects to the new primary — your call.

## 3. Xero developer portal (manual)

In the Xero app config, add the new redirect URI **before** publishing:

- `https://tractionadvisory.com.au/api/public/xero/callback`

Keep the old `.app` URI temporarily so in-flight connections don't break, then remove it once the cutover is verified.

## 4. Publish

Run `preview_ui--publish` after the code changes land and Domains shows Active.

## 5. Post-deploy smoke test

- `https://tractionadvisory.com.au/auth` loads, MFA works.
- Invite/reset-password email links point at `.com.au`.
- Xero "Connect" redirects to `.com.au/api/public/xero/callback` and links the tenant.
- Auth + transactional emails send from `notify.tractionadvisory.com.au` with no DKIM/SPF warnings.

## Open question

The DNS doc I generated delegates `notify.tractionadvisory.com.au` for email. Confirm that's the sender subdomain you want (this plan assumes yes). If you'd prefer `mail.` or root-domain sending, tell me and I'll adjust the constants and the DNS doc.
