# Data hosting & third-party access

## Hosting

- **Application runtime**: Lovable Cloud on Cloudflare Workers (Australia / Sydney edge).
- **Database & auth**: Supabase managed Postgres, Australian region.
- **Object storage**: Supabase Storage (none enabled today).

No data is hosted in high-risk jurisdictions.

## Sub-processors

| Provider | Purpose | Data |
| --- | --- | --- |
| Cloudflare | TLS termination, edge runtime, DDoS protection | Request metadata |
| Supabase | Managed Postgres, auth, storage | Application data |
| Xero | Accounting data source | OAuth tokens, accounting records pulled on demand |
| Resend (via Lovable) | Transactional and auth emails | Email address, message body |

## Third-party access to customer data

- No third party reads customer data outside the integrations the customer explicitly authorises (currently Xero). Each connection is per-firm and revocable from the admin console — disconnecting deletes the stored tokens immediately.
- Sub-processors above act on our behalf under their published security and privacy commitments. They do not use customer data for their own purposes.

## Data residency on request

Customers requiring data residency outside Australia must contact the practice principal; we do not currently offer alternate regions.
