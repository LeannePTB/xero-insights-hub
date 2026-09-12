# Backup, restore and recovery objectives

> **Status:** draft. Closes the backup half of backlog 39 (e). Almost every fact here needs confirming from the backend project settings.

## What is backed up

| Data | Where it lives | Backup | Retention |
| --- | --- | --- | --- |
| Application database (all client records, snapshots, audit trail, encrypted Xero tokens) | Supabase managed PostgreSQL 17.6.1.127, **Asia Pacific (Singapore)** | Platform-managed automated backups | **[CONFIRM: check the backup settings — daily? point-in-time recovery?]** |
| Object storage | No buckets in use beyond `client-reports` (private) | Platform-managed | **[CONFIRM]** |
| Application code and migrations | Lovable project, and the connected Git repository | Every change is a commit | Indefinite |
| Secrets | Lovable Cloud secrets | **Not backed up.** They are set by hand and are not recoverable from a database restore. | — |

**The secrets point matters.** If the project were lost entirely, a database restore without `TOKEN_ENC_KEY` would leave every stored Xero token unreadable and every client would have to reconnect. Keep a copy of that key somewhere safe and separate — a password manager entry with restricted access is enough. **[CONFIRM: do this, and note where.]**

## Recovery objectives

Proposed, to be confirmed once you know the platform's actual backup frequency.

| | Target | Reasoning |
| --- | --- | --- |
| Recovery point objective (how much data we could lose) | **[CONFIRM: 24 hours if daily backups; minutes if point-in-time recovery is enabled]** | Client figures are re-derivable from Xero, so the true loss is notes, classifications and the audit trail |
| Recovery time objective (how long to be running again) | 8 business hours | Single-developer practice; no 24/7 cover is claimed |

Say what is true. A small practice claiming a one-hour RTO with one person is less credible than an honest eight hours.

## What a restore would and would not bring back

- **Would:** clients, notes, cost classifications, statutory accounts, snapshots, the audit trail, memberships and grants.
- **Would not, without the key:** usable Xero tokens. Every file would need reconnecting.
- **Would not:** anything written after the backup point.
- **Not needed:** the figures themselves are always re-derivable from Xero once reconnected.

## Restore test

No restore has ever been tested. Untested backups are the most common gap an assessor finds, and the most embarrassing one to discover during a real incident.

**Suggested test, low risk:** restore a backup into a scratch project rather than over the live one. Confirm the row counts for `clients`, `audit_log` and `xero_snapshots` match the backup point, and confirm the application starts against it.

| Date | Backup point | Method | Result | Time taken | Issues found |
| --- | --- | --- | --- | --- | --- |
| — | No restore test performed yet | — | — | — | — |

**Schedule:** once every twelve months, and after any change to how data is stored.

## Hosting and region

| | |
| --- | --- |
| Database and auth | Supabase managed PostgreSQL 17.6.1.127, **Asia Pacific (Singapore)** — confirmed 12 Sep 2026 |
| Application and edge | Lovable Cloud on Cloudflare |
| Encryption at rest | Platform-managed AES-256, plus application-level AES-256-GCM on Xero token columns |
| Encryption in transit | TLS 1.2+ with HSTS, verified continuously by the posture check |

See `data-residency-decision.md` for the residency position and the reasoning behind remaining on this region.

## Platform attestations

An assessor may want Supabase's and Cloudflare's SOC 2 or ISO reports to back the hosting claims. These are requested from each provider, not produced by us. Note that both are **sub-processors of Lovable**, not direct suppliers of the practice — Lovable's Data Processing Agreement binds them to equivalent obligations, and that DPA plus the sub-processor list are held on file as at 12 September 2026.

| Provider | Attestation | Obtained | Where filed |
| --- | --- | --- | --- |
| Lovable | Data Processing Agreement (signed) | 12 Sep 2026 | **[CONFIRM: where]** |
| Lovable | Sub-processor list | 12 Sep 2026 | **[CONFIRM: where]** |
| Supabase | SOC 2 Type II | **[CONFIRM: request via their trust page or support]** | |
| Cloudflare | SOC 2 / ISO 27001 | **[CONFIRM: publicly available on their trust portal]** | |
| Stripe | PCI DSS | **[CONFIRM: publicly available]** | |
