# Data hosting & third-party access

## Hosting

- **Application runtime**: Lovable Cloud on Cloudflare (edge network; no single edge location is claimed — we have no evidence for a specific edge city).
- **Database & auth**: Supabase managed PostgreSQL 17.6.1.127, **Asia Pacific (Singapore)** region — confirmed against the backend on 12 September 2026.
- **Object storage**: Supabase Storage (none enabled today).

No data is hosted in high-risk jurisdictions.

## Sub-processors

| Provider | Purpose | Data |
| --- | --- | --- |
| Cloudflare | TLS termination, edge runtime, DDoS protection | Request metadata |
| Supabase | Managed Postgres, auth, storage | Application data |
| Xero | Accounting data source | OAuth tokens, accounting records pulled on demand |
| Resend (via Lovable) | Transactional and auth emails | Email address, message body |
| Stripe | Subscription payments (the practice's own account) | Billing contact and payment details. **No Xero accounting data.** |

## Third-party access to customer data

- No third party reads customer data outside the integrations the customer explicitly authorises (currently Xero). Each connection belongs to one organisation and is revocable from the admin console: disconnecting revokes the grant at Xero first and only then marks the connection disconnected, so the tokens are dead immediately — and the same update removes the stored tokens, so nothing is left at rest. The connection row itself is kept (deleting it would destroy the link between the client and their Xero file, which a reconnect relies on).
- Sub-processors above act on our behalf under their published security and privacy commitments. They do not use customer data for their own purposes.

## Data residency

**Confirmed region: Asia Pacific (Singapore).** The database (Supabase managed
PostgreSQL 17.6.1.127) and auth are hosted in Singapore. The application and
edge layer run on Lovable Cloud / Cloudflare; we do not claim a specific edge
location.

**This was previously documented incorrectly.** Earlier versions of this page
(and the Xero assessment inputs) stated an Australian region and a Sydney edge.
That was wrong and was corrected on 12 September 2026 after the owner checked
the backend directly. Singapore is offshore from the practice's own
jurisdiction, and this page — not memory — is the record an assessor should be
shown.

**The region cannot be changed in place.** Supabase does not support moving an
existing project's region. Two options exist:

1. **Keep Singapore and disclose it** — record the offshore hosting in the
   practice's privacy policy and client terms.
2. **Migrate to an Australian region via a new project** — create a new
   Supabase project in an Australian region, migrate the data, and repoint the
   application. This is a real migration with downtime and re-verification
   work, not a configuration toggle.

The choice between these is an **open owner decision** (backlog 45). Nothing in
this repository makes or implies that decision.

Customers with questions about where their data is stored should contact the
practice principal.
