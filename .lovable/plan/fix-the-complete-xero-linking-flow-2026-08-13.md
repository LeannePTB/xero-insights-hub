# Fix the complete Xero linking flow

## Confirmed problems

- The OAuth callback asks for selectable files without passing the signed-in user. That makes the callback treat even a super admin as an ordinary organisation user and remove Xero files currently stamped to another organisation before the picker can offer **Move here**.
- The pre-connect subscription check uses the first organisation on the signed-in user's account, rather than the organisation that owns the target client. Advisors and platform admins can therefore be checked against the wrong organisation and plan.
- Xero returns every file already authorised for that Xero login. The app must safely classify those files after the callback; it cannot assume the consent screen returned only the newly selected file.
- The database management rule only recognises organisation owners. It does not match the server-side rule that also permits organisation staff, advisors and super admins.
- Current data confirms **DRTABT Projects Pty Ltd** is still linked to the old **DRTABT Projects** client under **Positive Traction Clients**, while the intended client under the **DRTABT Projects** organisation has no linked file.

## What will change

### 1. Resolve permissions and plan limits from the target client

- Add one shared server-side access resolver for a target client and its organisation.
- Permit:
  - organisation owners and staff for clients in their organisation;
  - advisors for managed organisation clients;
  - super admins for any organisation.
- Make `startXeroConnect` check the target organisation's subscription status and Xero-file limit, not the caller's first organisation.
- Keep client-level file allowance checks in place.

### 2. Make the OAuth callback preserve every valid candidate

- Bind the completed OAuth result to the initiating user, client and organisation from the saved state.
- Upsert refreshed tokens without reassigning an existing file before the user confirms its destination.
- Pass the initiating user into candidate resolution so super-admin and advisor permissions are applied correctly.
- Classify every Xero tenant returned as:
  - available to link;
  - already linked to this client;
  - linked elsewhere in the same organisation and movable;
  - linked to another organisation and movable only by a super admin;
  - unavailable to the current user.
- Auto-link only when exactly one candidate is genuinely available and the target allowance has room. Otherwise always show the picker.

### 3. Make linking and moving one reliable operation

- Centralise link/move validation so the callback, **Link selected**, and **Move here** use the same permission, organisation and allowance rules.
- Move an existing link to the target client as one database operation, then stamp the Xero connection to the target organisation.
- Keep the original link intact if the target insert fails.
- Clear an organisation stamp only when a file is unlinked and no client holds it.
- Record link, move and unlink actions in the audit log.

### 4. Align database protection with the application rules

- Update the client-management database helper so it recognises super admins, advisors, and members of the client's organisation consistently.
- Keep client viewers read-only.
- Preserve row-level isolation so ordinary organisation users cannot discover or move another organisation's Xero files.

### 5. Make the picker explain the result

- Keep all returned candidates visible when the caller is allowed to know about them.
- Show clear statuses: **Available**, **Already linked here**, **Linked to another client**, or **Move here**.
- Replace “newly authorised” wording because Xero returns all files authorised for that login.
- After a successful link or move, close the chooser state and refresh the linked-file count and list.

### 6. Repair the confirmed DRTABT link

- Move **DRTABT Projects Pty Ltd** from the old client under **Positive Traction Clients** to the existing **DRTABT Projects Pty Ltd** client under the **DRTABT Projects** organisation.
- Do not delete either client record as part of this fix.

## Verification

Test the whole flow for each role:

1. Organisation owner/staff connects a new Xero file to their own client.
2. Organisation owner/staff reconnects an already-authorised file without seeing files from other organisations.
3. Advisor connects and links a file for an organisation client.
4. Super admin sees a cross-organisation conflict and successfully uses **Move here**.
5. A client at its allowance or organisation plan limit is blocked with the correct message.
6. Client viewers cannot start, link, move, unlink or discover Xero connections.
7. The repaired DRTABT client opens with the intended Xero file linked and its dashboard can load that tenant.

## Technical notes

- Refactor the shared access/target-firm logic into server-only helpers used by `connections.functions.ts`, the callback route, and client unlink paths.
- Update the existing database helper through a migration; no new tables are required.
- Add focused tests for candidate classification and target-organisation limit resolution, then run authenticated browser checks for the settings picker and move confirmation.
