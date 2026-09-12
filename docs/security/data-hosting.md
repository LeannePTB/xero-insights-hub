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
| Stripe | Subscription payments (the practice's own account) | Billing contact and payment details. **No Xero accounting data.** |

## Third-party access to customer data

- No third party reads customer data outside the integrations the customer explicitly authorises (currently Xero). Each connection belongs to one organisation and is revocable from the admin console: disconnecting revokes the grant at Xero first and only then marks the connection disconnected, so the tokens are dead immediately — and the same update removes the stored tokens, so nothing is left at rest. The connection row itself is kept (deleting it would destroy the link between the client and their Xero file, which a reconnect relies on).
- Sub-processors above act on our behalf under their published security and privacy commitments. They do not use customer data for their own purposes.

## Data residency on request

Customers requiring data residency outside Australia must contact the practice principal; we do not currently offer alternate regions.
