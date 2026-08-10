# Skip the landing page after login — send each person where they belong

Today everyone lands on `/dashboard` after signing in. For a super admin that page is now a duplicate of the Admin → Organisations list, so it is an extra click with no value. For other people it still does real work, so the fix is a role-aware landing router rather than a blanket redirect to Admin.

## What each person sees after login

| Who signs in | Lands on |
| --- | --- |
| Super admin | `/admin` (Organisations, with the left sidebar) |
| Advisor / org owner with one organisation | That organisation's page `/firms/<id>` — clients, plan and settings |
| Advisor belonging to several organisations | The organisation chooser (current `/dashboard` list, trimmed) |
| Client viewer with one dashboard | Their client dashboard (already happens today) |
| Client viewer with several dashboards | The dashboard chooser |

So separate organisations are unaffected in spirit: they never saw the platform-wide list anyway, they just skip one hop and go straight into their own organisation. The chooser page stays alive for the multi-org and multi-dashboard cases, so nothing becomes unreachable.

## Details

- `/dashboard` stays as the fallback/chooser route; it gains a redirect for the single-destination cases instead of rendering a list of one card.
- The Admin header's "Back" button currently returns to `/dashboard`. For a super admin that would bounce straight back to Admin, so Back is removed for super admins (their sidebar is the navigation) and kept for advisor-admins.
- Advisors who land inside their organisation still reach Admin (Tier widgets, Advisors) via the existing Admin entry point.
- Sign-out and the MFA / set-password / invite flows keep pointing at `/dashboard`, which then forwards to the right place — no duplicated redirect logic in five files.

## Technical notes

- Add the routing decision in `src/routes/_authenticated/dashboard.tsx` using the existing `getMyContext` result (`isSuperAdmin`, `isAdvisor`, `viewerClients`) plus `listMyFirms` for the advisor firm count, redirecting with `replace: true` so Back does not loop.
- Show the existing loading spinner while context resolves so no list flashes before the redirect.
- Adjust the Back button condition in `src/routes/_authenticated/admin.index.tsx`.
- No database, permission or server-function changes.
