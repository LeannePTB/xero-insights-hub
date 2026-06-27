## Where the page is

The super-admin Tier options page still exists at **`/settings/tiers`** (file `src/routes/_authenticated/settings.tiers.tsx`). Nothing was removed — it lets you enable/disable each tier and pick which widgets each tier shows.

Today it's only linked from one spot: the **"Tier widgets"** button in the top-right of `/dashboard`. If you've been spending time in `/admin` or the client settings pages, it looks like it disappeared.

## Plan

1. Add a **"Tier widgets"** link/button in the admin console header at `src/routes/_authenticated/admin.index.tsx`, pointing to `/settings/tiers`, visible only to super admins (the page is already super-admin gated).
2. Add the same link to the admin sub-nav in `src/routes/_authenticated/admin.tsx` so it shows on every admin sub-page (Security, Firms, etc.).
3. No changes to the tier page itself or its server functions.

You can also jump straight there now via `https://tractionadvisory.app/settings/tiers`.