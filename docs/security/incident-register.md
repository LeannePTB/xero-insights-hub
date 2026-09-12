# Incident register, drills and security contact

> **Status:** draft. Closes backlog 39 (c) and (f). The register is deliberately empty — do not add anything to it that did not happen.
> The existing plan is in `incident-response.md`; this file is the record that it is live and has been exercised.

## Security contact

An assessor will ask how someone reports a vulnerability to you, and will check that the route is published.

| | |
| --- | --- |
| Reporting address | **[CONFIRM: set up `security@tractionadvisory.com.au`]** |
| Published at | `https://tractionadvisory.com.au/security` **[CONFIRM: create this page]** |
| Acknowledged within | 2 business days |
| Owner | Leanne Ardern, Director |
| Backup contact | **[CONFIRM: name a second person, or state plainly that the practice is one person and there is no backup]** |

**Suggested page wording:**

> **Reporting a security issue.** If you believe you have found a security problem in Traction Advisory, email security@tractionadvisory.com.au. Please include enough detail for us to reproduce it. We will acknowledge your report within two business days and keep you informed while we investigate. Please do not access, change or download other people's data while testing, and give us a reasonable opportunity to fix the issue before disclosing it publicly. We do not currently offer a paid bounty.

The single-person practice point is worth stating honestly rather than inventing a roster. An assessor accepts a small practice; what they do not accept is a named process that nobody actually performs.

## Incident register

Every security incident is recorded here, including ones that turn out to be false alarms, and including ones with no client impact. An empty register with a date on it is credible; a register created after an incident is not.

| Date | What happened | Severity | Xero data involved | Clients affected | Xero notified | Closed | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| — | No incidents recorded. Register opened **[CONFIRM: date]**. | — | — | — | — | — | — |

**Severity guide**

- **High** — client accounting data was, or may have been, accessed by someone not entitled to it; a token or key was exposed; an account was taken over.
- **Medium** — a control failed but no data was reached, for example a permission gap found and closed before use.
- **Low** — no data or control impact, for example a dependency advisory with no exploitable path.

**Xero notification:** any incident involving Xero data or credentials is reported to Xero within 72 hours, as required by the Consumer Security Standard, regardless of whether client data was confirmed to be reached.

## Drill record

The plan in `incident-response.md` has never been tested. A tabletop drill takes about an hour and is the cheapest credibility you can buy for the assessment.

**Suggested first drill scenario:** an adviser's laptop is stolen, unlocked, with an active Traction Advisory session.

Walk through and write down what you actually did, not what the plan says:

1. How do you find out? Which screen or signal tells you?
2. How do you end that person's sessions right now?
3. How do you tell what they accessed, and over what period?
4. Which clients' data was in scope?
5. Do you notify Xero, and who writes it?
6. Do you notify the affected clients, and what do you say?
7. What do you change afterwards?

| Date | Scenario | Who took part | What worked | What did not | Actions raised |
| --- | --- | --- | --- | --- | --- |
| — | No drill performed yet | — | — | — | — |

**Schedule:** one drill every twelve months, and one after any High-severity incident.

## What the product already gives you

Useful when you run the drill — these are real capabilities, not plan text:

- Sign-in history with IP and device, retained two years.
- An append-only audit trail of every read of a client's figures, showing who, which client, which Xero file, what kind of figures and when — retained two years.
- Auditor exports on the Security page: security events, client data reads, or everything, over 30 days, 90 days or 12 months.
- Xero disconnection, which revokes at Xero and verifies the revocation.
- Super admins can reset a person's MFA factors, and membership can be removed immediately.
