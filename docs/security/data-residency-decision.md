# Data residency — decision record and disclosure wording

**Decision date:** 12 September 2026
**Decided by:** Leanne Ardern, Director, Positive Traction Bookkeeping
**Status:** current. Review triggers listed at the end.

## The facts

- The application database is Supabase managed PostgreSQL 17.6.1.127 in the **Asia Pacific (Singapore)** region. Confirmed from the backend project settings on 12 September 2026.
- The application and edge layer runs on Lovable Cloud / Cloudflare.
- Lovable Cloud offers three region groupings only: Americas, Europe, and Asia Pacific. There is no country-level choice, so **no Australian option exists** on this platform. Asia Pacific was preselected based on the practice's location and resolved to Singapore.
- The region is chosen when a project is created and **cannot be changed afterwards**.
- Documentation in this repository previously stated an Australian region. That was incorrect and was corrected on 12 September 2026.

## The decision

**The practice will remain on Singapore and disclose it, rather than migrate.**

### Why

1. **No in-place alternative exists.** Australian residency is not available on Lovable Cloud at any price. Achieving it would require exporting the data, standing up a separate Supabase project in Sydney (ap-southeast-2), connecting it to a new Lovable project and rebuilding — there is no one-click migration from Cloud to a self-managed Supabase project. That is a substantial project, not a setting change.
2. **Nothing protecting the data depends on geography.** Encryption at rest and in transit, server-enforced multi-factor authentication, the database-level access model, the audit trail and the two-year retention are identical wherever the database sits. Location changes which laws apply, not how well the data is defended.
3. **Singapore is a mainstream, well-regulated jurisdiction** for cloud hosting, widely used by Australian businesses.
4. **No client has asked for Australian residency.** At twelve clients, the cost of migrating outweighs a requirement nobody has raised.
5. **The obligation this creates is disclosure, not relocation.** Offshore hosting is lawful and common; leaving it unsaid is the actual risk.

### What we are doing as a result

| Action | Owner | Status |
| --- | --- | --- |
| Correct every residency statement in `docs/security/` | Leanne | Done 12 Sep 2026 |
| Add the disclosure wording below to the privacy policy | Leanne | **[CONFIRM: date]** |
| Add the disclosure wording to client-facing terms or the engagement letter | Leanne | **[CONFIRM: date]** |
| Answer the Xero assessment honestly, naming Singapore | Leanne | Pending assessment |
| Confirm with a privacy adviser whether the Australian Privacy Principles apply to the practice, and in particular APP 8 on cross-border disclosure | Leanne | **[CONFIRM — this record is not legal advice]** |

### Review triggers

Revisit this decision if any of the following happens. Do not wait for a scheduled date.

- A client asks for, or contractually requires, Australian data residency.
- The practice pursues government, defence or other work with residency conditions.
- Lovable Cloud adds a country-level or Australian region.
- The client count grows past roughly fifty, at which point a migration becomes materially harder and should be reconsidered while it is still feasible.
- A privacy adviser advises that offshore storage is not appropriate for this data.

---

## Privacy policy wording

Plain English, no hedging. Adjust the headings to match your existing policy.

### Short version — if your policy is brief

> **Where your information is stored.** Traction Advisory stores its data with Supabase, on servers located in Singapore, and uses Cloudflare to deliver the service. This means your business's financial information, and your employees' payroll information where payroll is connected, is stored outside Australia. It is encrypted both in transit and at rest, and access is restricted to people you have authorised. We remain responsible for how your information is handled, wherever it is stored.

### Fuller version — if your policy has an overseas-disclosure section

> **Overseas storage and disclosure**
>
> Traction Advisory is delivered using cloud infrastructure located outside Australia. Specifically:
>
> - Your data — including your Xero accounting data, and payroll information where a payroll-enabled Xero file is connected — is stored in a database hosted by Supabase in **Singapore**.
> - The service is delivered through Cloudflare's global network.
> - Where you use our billing features, payment details are handled by Stripe.
> - Emails we send you are delivered through our email provider.
>
> These providers store and process information on our behalf. They do not use your accounting data for their own purposes.
>
> Your information is encrypted while it travels and while it is stored. Access to your Xero data requires a second factor at sign-in, and is limited to people you have authorised: our bookkeeping team while we work with you, anyone you invite to view your business, and — only with your specific approval and for a maximum of 72 hours — read-only support access. Every time someone views your figures, we record who, when and what kind of information, and keep that record for two years.
>
> We remain accountable for your information wherever it is held. If you would prefer your data to be stored in Australia, please talk to us before connecting your Xero file, as this is not something we can change once your account is set up.

### One line for an engagement letter or terms

> Your data is stored on servers in Singapore, encrypted at rest and in transit; we remain responsible for it and can talk you through our security arrangements on request.

---

## What to say if a client asks directly

Have the answer ready rather than improvising:

> "It's stored in Singapore, with Supabase, who host a lot of Australian businesses. It's encrypted, it needs two-factor to get into, and we log every single time anyone looks at your numbers — including us. Australia isn't offered by our platform, so if Australian storage is a hard requirement for you, tell me now and we'll work out what to do."

Honesty here reads as competence. Vagueness does not.

---

## What to say in the Xero assessment

> The application database is Supabase managed PostgreSQL in the Asia Pacific (Singapore) region; the application and edge layer runs on Lovable Cloud / Cloudflare. The platform offers region groupings only (Americas, Europe, Asia Pacific) with no country-level selection, and the region cannot be changed after a project is created. The practice has recorded a deliberate decision to remain on this region and to disclose offshore storage to clients in its privacy policy and engagement terms, with documented triggers for revisiting it. Data is encrypted at rest by the platform, Xero tokens carry an additional application-level AES-256-GCM wrap with a server-only key, and all access requires multi-factor authentication enforced server-side.

---

**This document is a business decision record, not legal advice.** Whether the Australian Privacy Act and APP 8 apply to the practice, and what they require, is a question for a qualified adviser.
