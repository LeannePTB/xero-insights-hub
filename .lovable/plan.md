# Domain migration audit — `tractionadvisory.com.au` to `tractionadvisory.app`

Findings only. Nothing was changed: no files edited, no database objects created or altered.

## 1. Literal occurrences of the old domain

| File | Line | What it is | Verdict |
|---|---|---|---|
| `src/routes/api/public/xero/callback.ts` | 5 | `XERO_CALLBACK_URL` constant used when exchanging the auth code | **Change** — must match the registered redirect exactly |
| `src/routes/api/public/xero/callback.ts` | 656–658 | `ALLOWED_RETURN_HOSTS` = `.com.au`, `www.com.au`, `xero-shine-dashboards.lovable.app` | **Change** (add `.app`; decide whether to keep `.com.au`) |
| `src/lib/xero/connections.functions.ts` | 11 | `CANONICAL_XERO_APP_ORIGIN` — builds the redirect sent to Xero | **Change** |
| `src/lib/xero/connections.functions.ts` | 500 | `ALLOWED_CUSTOM_HOSTS` allow-list for the calling origin | **Change** |
| `src/lib/xero/reconnect-all.server.ts` | 11 | Same canonical origin constant, duplicated | **Change** |
| `src/lib/invites.functions.ts` | 205, 277, 328 | Invite links `https://…/signup/{token}` hardcoded | **Change** |
| `src/lib/advisors.functions.ts` | 234, 299 | Password-set redirect hardcoded (`getInviteRedirect`) | **Change** |
| `src/lib/admin.functions.ts` | 164 | Password-set redirect hardcoded | **Change** |
| `src/routes/auth.tsx` | 97–101 | Reset-password redirect: `window.location.origin` in preview, else hardcoded `.com.au` | **Change** the fallback |
| `src/lib/reports/report-delivery.server.ts` | 202–205 | `siteOrigin()` — `SITE_URL` / `VITE_SITE_URL` else hardcoded `.com.au`; used for report links (line 270) | **Change** fallback (or set `SITE_URL`) |
| `src/lib/email-templates/report-ready.tsx` | 16, 55 | Default/preview URL only (real URL is passed in) | Cosmetic — change |
| `src/lib/email-templates/firm-invite.tsx` | 15, 59 | Default/preview URL only | Cosmetic — change |
| `src/routes/lovable/email/auth/webhook.ts` | 35–37, 137 | `SENDER_DOMAIN`, `ROOT_DOMAIN`, `FROM_DOMAIN`; `siteUrl` in auth emails | **Ambiguous** — see §4 |
| `src/routes/lovable/email/auth/preview.ts` | 22 | `ROOT_DOMAIN` for template preview | Ambiguous (follow §4) |
| `src/lib/email/send.server.ts` | 13–14 | `SENDER_DOMAIN`, `FROM_DOMAIN` (From address) | **Ambiguous** — sending domain, not app domain |
| `src/routes/lovable/email/transactional/send.ts` | 11, 14 | Same pair | Ambiguous |
| `src/routes/_authenticated/settings.advisors.tsx` | 282 | "Sign in:" text copied to clipboard for a new advisor | **Change** |
| `src/routes/_authenticated/clients.$clientId.settings.tsx` | 882 | Same clipboard text for a client viewer | **Change** |
| `supabase/migrations/20260826015658_*.sql` | 20 | Cron job posts to `https://www.tractionadvisory.com.au/api/public/xero/snapshot-refresh` | **Change** — see §9 |
| `.lovable/plan/*.md` (3 files) | — | Historical plan notes | Leave |

Live database rows (not code): `security_contact_details` and `xero_assessment_contact` both hold `website = https://www.tractionadvisory.com.au/` and `primary_contact_email/contact_email = admin@tractionadvisory.com.au`. These feed the Xero security assessment pack. **Your decision** — data edit, not a code change.

Old brand leftovers: `supabase/migrations/20260627060009_*.sql` lines 49, 71 default `website` to `https://www.positivetraction.com.au/`.

## 2. The Xero `redirect_uri` actually sent

Constructed as a **hardcoded module constant**, not an env var and not `window.location.origin`:

- `src/lib/xero/connections.functions.ts:11–12` — `CANONICAL_XERO_APP_ORIGIN + "/api/public/xero/callback"`, set on the authorise URL at line 49 and in the other connect/reconnect flows in the same file.
- `src/lib/xero/reconnect-all.server.ts:11` — a second copy of the same constant.
- `src/routes/api/public/xero/callback.ts:5` — a third copy, sent again on the token exchange (Xero requires it to match).

Currently all three produce `https://tractionadvisory.com.au/api/public/xero/callback`, which will **fail** against the registered `https://tractionadvisory.app/api/public/xero/callback`. The browser's origin is used separately: `normalizeOrigin()` (connections line 502) validates the caller's origin against an allow-list and then **discards it**, always returning the canonical constant — so the redirect never varies by host, but a user on `tractionadvisory.app` will currently be **rejected** by that allow-list before the flow even starts.

The three copies must move in lockstep. A single shared constant would be safer, but that is a change, not a finding.

## 3. Environment variables holding a base or site URL

Only one pair exists: `SITE_URL` and `VITE_SITE_URL`, read at `src/lib/reports/report-delivery.server.ts:203`. Neither is present in `.env` and neither appears in the project secrets list (secrets are: `LOVABLE_API_KEY`, `PAYMENTS_SANDBOX_WEBHOOK_SECRET`, `STRIPE_SANDBOX_API_KEY`, `TOKEN_ENC_KEY`, `XERO_CLIENT_ID`, `XERO_CLIENT_SECRET`) — so the hardcoded `.com.au` fallback is what runs today. No `APP_URL`, `PUBLIC_URL`, `BASE_URL` or `NEXT_PUBLIC_*` anywhere. The other URL variables are Supabase endpoints (`SUPABASE_URL`, `VITE_SUPABASE_URL`), unaffected. No values printed.

Also `src/lib/clients.functions.ts:686` builds a sign-in redirect from `project--{LOVABLE_PROJECT_ID}.lovable.app` rather than the custom domain — **your decision** whether that should now be the live domain.

## 4. Emails and link building

- Invites: `src/lib/invites.functions.ts` (hardcoded, §1).
- Password reset / set-password: `advisors.functions.ts`, `admin.functions.ts`, `auth.tsx`.
- Report-ready: link built in `report-delivery.server.ts:270` from `siteOrigin()`.
- Supabase auth emails: `src/routes/lovable/email/auth/webhook.ts:137` sets `siteUrl` from `ROOT_DOMAIN`. The confirmation links themselves come from Supabase's own Site URL / redirect allow-list setting, which is **outside the repo** — it must be updated in the backend auth settings or reset and invite links will keep landing on the old domain.
- Sending identity (`notify.tractionadvisory.com.au`, `noreply@tractionadvisory.com.au`) is a **separate decision**: moving it needs new DNS/DKIM for `tractionadvisory.app`. Keeping `.com.au` as the sending domain while links point at `.app` is legitimate.

## 5. Monthly report PDF

`src/lib/reports/report-pdf.server.ts` — header band (lines 124–158) and footer (160–174) contain **no URL**: logo image, client name, month, generated date, version, page numbers. No domain is printed or embedded in the PDF. The only URL in the report path is the emailed link (§4). Nothing to change here.

## 6. CORS allow-lists

**None found.** No `Access-Control-Allow-Origin` header is set anywhere in the app, and there are no Supabase edge functions in this project (all server work is TanStack server functions and `/api/public/*` routes). Nothing to change.

## 7. Cookies and auth storage

**No cookie is set with a `Domain=` attribute anywhere in the repo.** Supabase auth uses browser storage, not cookies: `src/integrations/supabase/client.ts:24` uses `brokeredPreviewStorage()`, and `previewAuthStorage.ts:8` only special-cases Lovable preview zones (`lovable.app`, `lovableproject.com`, etc.). Storage is therefore origin-scoped: sessions will not carry across from `.com.au` to `.app` — expected, and confirms no parent-domain scoping. No change needed.

## 8. Content-Security-Policy

Present in `src/start.ts:35–50`, **report-only** (`content-security-policy-report-only`), with `frame-ancestors 'none'` — no domain allow-list, so it is domain-agnostic and needs no change. `x-frame-options: DENY` and HSTS with `includeSubDomains; preload` are also set — note that the HSTS preload directive will apply to `tractionadvisory.app` subdomains too once served there.

## 9. Not a domain issue — flagged, not fixed

1. **Cron job authorises with the wrong secret name.** The live `xero-snapshot-refresh-daily` job sends `Bearer` from vault secret `email_queue_service_role_key`, while `snapshot-refresh.ts:22` compares against `SUPABASE_SERVICE_ROLE_KEY`. It also runs **hourly** (`5 * * * *`) despite being named "daily" and previously described as a 3am run. And it posts to `www.` — after the move it will 404 or redirect and silently stop refreshing.
2. **Three duplicate copies** of the Xero callback URL constant — exactly the drift risk this migration exposes.
3. `normalizeOrigin` in `connections.functions.ts:519` accepts **any** `*.lovable.app` host; `getSafeReturnOrigin` in `callback.ts:671` does the same for return redirects. Broad for an OAuth return allow-list.
4. Plain-text credentials copied to the clipboard in `settings.advisors.tsx:282` and `clients.$clientId.settings.tsx:882`.
5. Stale contact rows in `security_contact_details` / `xero_assessment_contact` still describe the old website — these are the details Xero sees.

## Decisions I need from you

1. Does `tractionadvisory.com.au` stay live as a redirect (keep it in the allow-lists), or is it retired?
2. Does email sending move to `tractionadvisory.app`, or stay on `notify.tractionadvisory.com.au`?
3. Prefer a single `SITE_URL` environment variable everywhere, or keep hardcoded constants pointing at the new domain?
4. Should the stored security-contact website/email rows be updated too?
