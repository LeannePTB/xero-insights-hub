# Coming soon teasers + practice-only Notes

Classification: SECURITY-RELEVANT. Part 2 removes read access to existing rows (client_notes) from Business Owners and Viewers. Part 1 adds a new System Administrator table and a new enquiry type. Neither part widens access.

## Part 1 — "Coming soon"

**Data**
- New table `coming_soon_entries`, holding:
  - key, name, description, optional timing, sort order
  - "Show" and "Show on website" ticks (website off by default)
  - an optional link to a module or card
  - who updated it and when
- RLS on, with nothing granted to signed-out users or signed-in users directly. Every read goes through a definer function.
- Audited, aal2 System-Administrator-only save and delete functions.
- Seed one entry: "Rental properties — Rent received per property from Xero", linked to the WIP `rental_properties` module, Show on, timing blank.

**Readers (one rule each, in the database)**
- `coming_soon_for_client(client)`:
  - aal2, the caller can read the client, and is an active member of the client's organisation or a System Administrator. Business Owners and Viewers get nothing.
  - Returns shown entries whose linked module or card is still Work in progress, so an entry drops off automatically once its module is Available.
  - Each entry carries an `early_access` flag for the organisation.
- `coming_soon_for_upgrade(firm)`: same practice-only gate, for the Upgrade page.
- The existing anon website reader gains only the entries ticked "Show on website" (name, description, timing).
- Packages & modules flags any entry whose linked module is now Available ("Now available — hidden from Coming soon").
- None of these readers touches `client_cards_v2`, so Coming soon never makes a card visible or usable.

**Interest**
- Add a `kind` column to `upgrade_enquiries` ('enquiry' default, or 'interest') and an `entry_key` column.
- A new function `register_coming_soon_interest(client, entry)` uses the same practice-only gate, the existing 3/hour rate limit and the audit log. It queues the existing enquiry alert to hello@ through the current email queue.
- System Admin → Enquiries gets a Type column (Enquiry or Interest), the module name and a type filter.

**UI**
- On the client dashboard, a slim collapsible "Coming soon" row directly under "More with Advisory", in the same tile style, collapsed by default on mobile and hidden when empty.
- Each tile shows "I'm interested", which turns into "Interest noted" after clicking, or "You have early access".
- A "Coming soon" section at the bottom of the Upgrade page.
- The public website section appears only when a website-ticked entry exists.
- Packages & modules gets a Coming soon editor: add, edit, show ticks, sort, and an optional module or card link.

## Part 2 — Notes practice-only

- Remove the `notes` card from the catalogue's offered list by marking it retired: it stays in the table, so no ticks or notes are deleted. Notes are then gone from the dashboard, Package ticks, the Standard list and the Upgrade page.
- Remove the dashboard NotesCard render.
- Keep NotesCard on the Monthly reports page unchanged.
- Report generation is unchanged. I confirmed that included notes are copied into the stored report (`payload.notes`), and PDFs render from that copy, so later edits or deletes don't change a sent report.
- Report sections: "notes" is still added for every report through the Standard default, not through the retired card. The current report contents stay the same.
- RLS: drop the policy "Client viewers read notes" (`has_client_read_access`). The practice-member read, insert, update and delete policies stay as they are.
- Check the note readers (`clients.functions.ts`, `report-verdict.server.ts`) still work for practice users. Business Owners and Viewers get empty results, with no errors.
- Trixie: any note text goes through the same RLS-scoped reads, so Business Owners and Viewers get nothing.

## Tests and access matrix

- Business Owners and Viewers never see Coming soon on the client or Upgrade readers.
- Coming soon on a WIP card leaves `client_visible_cards` and `assert_widget_access` refusing it.
- Interest: the 4th request in an hour is refused, and an alert row is queued.
- client_notes: Business Owners and Viewers can't select anything; Owner and Staff can create, read, update and delete.
- A Business Owner can read a finalised report payload that contains notes.
- New definer register and matrix rows, refreshed fixtures, then tsgo, build, `bun run test` and `bun run security:check`.

## Open question (default assumed)

- A "retired" catalogue status would hide Notes from every list. Default: add `status = 'retired'`, which offer surfaces already exclude like `wip`, but which System Administrators also never see on dashboards.
