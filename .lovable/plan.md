## Goal
A multi-tenant web app where each client signs in, connects their own Xero organisation via OAuth 2.0, and views a dashboard of their financials (P&L first, with a flexible widget system to add more views later).

## Step 1 — Bring in your existing GitHub code
Lovable can't import an existing GitHub repo directly. Two practical options:
1. **Recommended:** Continue building here, then connect this project to GitHub via the **+ menu → GitHub → Connect project**. Once connected, paste your existing files into the matching paths (or share the repo contents in chat and I'll fold the relevant bits in).
2. Paste your most important files (Xero auth code, any data fetchers, dashboard components) into chat now and I'll wire them in before we move on.

I'll pause after the foundation is in place so you can do this without us duplicating work.

## Step 2 — Enable Lovable Cloud
Needed for: user auth (email/password + Google), and Postgres tables to store each user's Xero connection (tenant id, access/refresh tokens, expiry) and any cached snapshots.

## Step 3 — Xero OAuth 2.0 (per-user)
Xero is not in Lovable's connector list, so we set up standard OAuth ourselves:
- You create an app in the Xero Developer portal (App type: Web app). Redirect URI: `https://<your-published-domain>/api/public/xero/callback` (I'll give you the exact URL once we know your project URL).
- Required scopes for P&L + flexibility: `offline_access openid profile email accounting.reports.read accounting.transactions.read accounting.contacts.read accounting.settings.read`.
- You give me the **Client ID** and **Client Secret** — I'll request them as Lovable secrets (`XERO_CLIENT_ID`, `XERO_CLIENT_SECRET`).
- Server routes I'll build:
  - `GET /api/xero/connect` — starts the OAuth flow (state stored against the logged-in user).
  - `GET /api/public/xero/callback` — exchanges code for tokens, fetches the list of authorized tenants, stores them.
  - Token-refresh helper that runs before any Xero API call when the access token is within 60s of expiry.

## Step 4 — Data layer
Tables (with RLS so each user only sees their own rows):
- `xero_connections` — user_id, tenant_id, tenant_name, access_token, refresh_token, expires_at.
- `dashboard_configs` — user_id, layout JSON (which widgets, order, params).
- `report_cache` — user_id, tenant_id, report_key, params hash, payload, fetched_at (so we don't hammer Xero on every page load).

## Step 5 — Dashboard UI
- **Auth pages**: sign up / sign in / sign out (email + Google).
- **Connect Xero** screen with a "Connect to Xero" button; if multiple organisations are authorized, a tenant switcher in the header.
- **Dashboard page** with a widget grid. v1 widget set:
  - P&L summary (revenue, gross profit, net profit) for a selectable period (this month / last month / quarter / YTD / custom).
  - Revenue vs expenses trend chart (last 12 months).
  - Top expense categories.
- **Widget framework**: each widget is a self-contained React component with `{ key, title, fetcher, render }`. Adding a new dashboard option later = drop in one new widget file and register it. This is the "we will build different options" hook.

## Step 6 — Polish & deploy
- Loading skeletons, error states, empty state for "not connected yet".
- Manual refresh button per widget + a global "Refresh all".
- Publish so the Xero redirect URI is stable.

## Technical notes
- Stack: TanStack Start (already scaffolded) + Lovable Cloud (Postgres + Auth) + Recharts for charts.
- All Xero calls happen in `createServerFn` handlers so tokens never reach the browser.
- The OAuth callback lives under `/api/public/xero/callback` because Xero needs to hit it without our app auth.
- Token refresh uses Xero's `offline_access` refresh token; refresh tokens rotate on every use, so we always write the new pair back to the DB inside a transaction.

## Open questions before I build
1. Sign-in methods: default to **email/password + Google** — OK, or email only?
2. Should one user be able to see **multiple Xero organisations** they're connected to (switcher), or strictly one org per user?
3. Any branding/colours you want from the start, or should I pick a clean professional accountant-friendly look (neutral palette, blue/teal accent) and we iterate?

## What I'll do first if you approve
Foundation only, so you can drop your GitHub code in cleanly:
1. Enable Lovable Cloud.
2. Add email + Google auth and a basic protected `/dashboard` route.
3. Create the three tables above with RLS.
4. Stub the Xero OAuth start/callback routes (no secrets requested yet — I'll ask for `XERO_CLIENT_ID` / `XERO_CLIENT_SECRET` right after, with instructions on where in Xero to get them).
5. Render a "Connect your Xero" empty state on the dashboard.

Then we pause for your GitHub code + Xero credentials before wiring real data and widgets.