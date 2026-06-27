## Two issues

**1. "Failed to load README"** — `/api/public/docs/security/$file.ts` uses `readFileSync(join(process.cwd(), "docs", "security", file))`. In the Cloudflare Worker SSR runtime there is no real filesystem mapped to the repo, so every fetch 404s. The PoliciesViewer, the "Download all (.md)" zip, and the "Download Xero PDF" print page all fail for the same reason.

**2. Seed the Security & Compliance contact details** with the values from the screenshot.

## Fix

### A. Bundle the markdown at build time

Rewrite `src/routes/api/public/docs/security/$file.ts` to use Vite `?raw` static imports of each `.md` under `docs/security/`, then serve them from an in-memory map. No filesystem access at runtime.

```ts
import readme from "../../../../../../docs/security/README.md?raw";
// …one import per file…
const DOCS: Record<string, string> = {
  "README.md": readme,
  // …
};
```

Handler returns the matching string with `Content-Type: text/markdown`, or 404. URL contract stays the same, so `PoliciesViewer`, zip download, and print page all start working.

### B. Seed the contact details

Upsert the singleton row in `public.security_contact_details` with:

- Company legal name: `Astro Visual The Trustee for Ardern Family Trust`
- Trading name: `Positive Traction`
- ABN / ACN: `64 629 433 886`
- Registered address: `13 Trinity Place, Gleneagle, QLD 4285`
- Website: `https://www.positivetraction.com.au/`
- App name: `Bushub CRM`
- Xero client ID: `74AC025B105E4C639FE3CEBAEC3EB428`
- Primary contact name: `Leanne Ardern`
- Primary contact role: `Director`
- Primary contact email: `admin@positivetraction.com.au`
- Primary contact phone: `0421274073`
- Assessment date: left blank (no value shown)

Done via `supabase--insert` against `public.security_contact_details` with `ON CONFLICT (singleton) DO UPDATE`.

## Out of scope

No schema changes, no UI changes to `ContactDetailsCard` or `PoliciesViewer` — the existing UI will display the seeded values and the markdown once the endpoint returns content.
