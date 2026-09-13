# Periodic access review

> **Status:** draft procedure, first review not yet performed. Closes backlog 39 (g).

## Why

Access accumulates. People change roles, a support grant gets approved and forgotten, a viewer stays on a client long after the engagement ends. Controls stop drift being introduced; a review catches what has already drifted.

## How often

Every six months, and additionally whenever someone joins or leaves the practice.

## What to check, and where

Everything below is visible in the product — no database access needed.

| # | Question | Where to look | What "correct" looks like |
| --- | --- | --- | --- |
| 1 | Does every person with a login still need one? | Advisors page | Nobody who has left the practice |
| 2 | Does everyone have multi-factor authentication? | Security page, "Everyone has a second factor" | All OK, not Warn |
| 3 | Do the super admins still need to be super admins? | Advisors page | As few as the practice can operate with |
| 4 | Is every organisation membership still justified? | Each organisation's People page | No leftover staff on organisations they no longer work on |
| 5 | Are there any active support grants? | Security page, "Active support grants" | Zero, unless one is genuinely in use right now |
| 6 | Does every client viewer still need their access? | Each organisation's People page, viewers section | No viewers from finished engagements |
| 7 | Does every "all clients" standing grant still need to exist? | Same page, badged "All clients" | Each one is a current arrangement, not a leftover |
| 8 | Is every connected Xero file still a live client? | Each client's settings | No connections for departed clients |
| 9 | Is the practice team list current? | Advisors page | Only people who should be added to new client organisations |
| 10 | Do the test accounts show as contained? | Security page, "Security test accounts are contained" | All OK |

## Recording the review

Fill this in each time. The value is the date and the signature, not the prose.

| Date | Reviewed by | Users | Super admins | Organisations | Support grants found | Viewers removed | Memberships removed | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| — | No review performed yet | — | — | — | — | — | — | — |
| 13 Sep 2026 | Leanne Ardern | 4 real accounts (plus 3 contained test accounts) | 3 — admin@, allyce@, chantelle@ | 4 — DRTABT Projects (9 clients), Positive Traction, Bangkok On Darby, Autotek NSW; 14 clients; none handed over | 0 | 0 — no real client viewers exist | 0 | See notes below |

## Baseline as at 12 September 2026

Recorded here so the first review has something to compare against. Not a review — nobody has signed anything off yet.

- 4 user accounts, 2 with a verified second factor.
- 3 super admins, 1 without a verified second factor (Chantelle — will be required to enrol at next sign-in).
- 3 people on the practice team (Leanne, Allyce, Chantelle).
- 4 organisations, 12 clients, 12 connected Xero files.
- 0 active support grants.
- 0 client viewers, 0 standing grants.
- 3 test accounts, all blocked from signing in and confined to the test organisation.

## First review

**Performed 13 September 2026 by Leanne Ardern. Next review due 13 March 2027** (six months), or sooner if someone joins or leaves the practice.

Notes from the 13 September 2026 review:

- One dormant account found (`leanne@astrovisual.com.au`): no MFA, no role, no membership, last sign-in 15 June 2026. Its last remaining row (a leftover `client_viewer` role) was revoked on 13 September 2026 as a result of this review, through the audited advisor-removal function with the removal attributed to the owner in the audit trail. The account now holds no role, membership, grant or practice-team row and can reach nothing. **The login itself could not be deleted in the same pass** — the product's only account-deletion path is the advisors page, which lists advisor accounts only, and this account is not one. Recorded as a backlog item; the owner will delete the login when a path exists, and re-add it when testing requires.
- One standing viewer grant exists, held by `zz-security-viewer@tractionadvisory.com.au` on `ZZ Security Test Org`. Test-suite data, correctly confined, retained deliberately.
- One super admin (chantelle@) has no verified second factor. Server enforcement means she reaches no client data until she enrols, which will be required at her next sign-in. Carried forward as an open action.
- 12 Xero connections, all connected and all assigned to an organisation.
