# Rent report and rental property consolidation

## What you will get

1. **Property setup (per client, in Client Settings)** — a "Rental properties" list. For each property you enter:
   - Name (for example "12 Smith St")
   - How to find its rent in Xero, picked from a list loaded from that client's file. Choose one:
     - **Account** — tick the income account(s) for this property
     - **Tracking category option** — pick a category and option (for example Property: 12 Smith St)
     - **Contact** — pick the tenant or managing agent
   - Expected rent and frequency (weekly, fortnightly, monthly), and optionally the lease start date
   
   This covers "it varies": each client, and each property, can use a different method.

2. **Rent report card (client live dashboard, Advisory section)** — one row per property showing:
   - Last payment date and amount
   - Paid up to (worked out from total rent received and the expected rent)
   - Status: green **Paid ahead**, amber **Due**, red **In arrears** (with dollar amount and days behind)
   - Rent received this month, and over the last 12 months

3. **Rental consolidation report (across companies)** — uses the existing organisation consolidation groups. One combined table of every property across all companies in the group, with totals for rent received, total arrears and number of properties behind. Each row shows which company owns it. Available on Monthly management reports and as a card.

4. **Clients overview** — optional "Rent arrears" column showing the number of properties behind, so you can spot it without opening each client.

## How the figures are collected

- The overnight Xero refresh reads received payments and bank receipts once a day, stores them, and the cards read from storage. No live Xero calls when someone opens a page, so this won't cause another request burst.
- It uses only the existing read-only Xero permissions, so clients don't need to reconnect.
- If no rent is found for a property, the card says **No rent found**. It never shows a guessed amount.

## Who can see and change it

- Organisation owners and team members can set up properties and expected rent. All changes are recorded in the audit log.
- Anyone who can already view a client's dashboard can view its rent report. External advisers and business owners can view it but not change it.
- Consolidation shows only companies the viewer can already see. It follows the same Advisory level rule as the existing consolidation.

## Technical details

- New table `client_rental_properties` (client_id, name, match_type enum account|tracking|contact, match_ids jsonb of Xero IDs only, expected_amount, frequency, lease_start). RLS on, revoke all then grant needed privileges, per-command policies; reads use the existing client read predicate. Writes go only through an aal2, caller-scoped, audited definer function that uses `user_can_write_client`. Add rows to the access matrix.
- New snapshot key `rent_receipts` (Accounting API `Payments` on ACCREC plus `BankTransactions` type RECEIVE, with a 13-month modified-since window, paged). Counts against the existing 25-call-per-file budget. Matching happens on the server using Xero account IDs, tracking option IDs and contact IDs, not names.
- Xero pickers come from cached Accounts, TrackingCategories and Contacts reads, through the existing `xeroGet` helper.
- Paid-up-to calculation: lease start, or the first matched receipt, + (sum received ÷ expected per period) periods. Covered by unit tests for weekly, fortnightly and monthly periods, part payments and arrears.
- The consolidation server function resolves group members on the server through existing consolidation functions. It requires aal2 and uses Zod validation.
- Security gate: `security:check`, linter, security report, backlog update.

## Not included

- Rent the client pays (it can be added later on the same setup).
- Bond, outgoings or property expenses and net yield (these could be a later step).
