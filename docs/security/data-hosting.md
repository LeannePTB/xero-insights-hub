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
PostgreSQL 17.6.1.127) and auth are hosted in Singapore, confirmed from the
backend project settings on 12 September 2026. The application and edge layer
run on Lovable Cloud / Cloudflare; we do not claim a specific edge location.

**Platform limits.** Lovable Cloud offers three region groupings only —
Americas, Europe and Asia Pacific — with no country-level choice, so no
Australian option exists on this platform. The region is chosen when a project
is created and cannot be changed afterwards.

**This was previously documented incorrectly.** Earlier versions of this page
(and the Xero assessment inputs) stated an Australian region and a Sydney edge.
That was wrong and was corrected on 12 September 2026 after the owner checked
the backend directly.

**The decision is recorded:** the practice will remain on Singapore and
disclose the offshore hosting, rather than migrate. The full decision record,
review triggers and the privacy-policy disclosure wording are in
[data-residency-decision.md](./data-residency-decision.md).

Customers with questions about where their data is stored should contact the
practice principal.
