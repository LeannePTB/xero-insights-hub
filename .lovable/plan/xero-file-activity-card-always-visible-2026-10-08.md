# Xero file activity card — always visible

## Why it's missing

The "Xero file activity" card (who last signed in to the Xero file) is currently only rendered when the client has the **Tax obligations** card enabled. Bangkok on King has 5 cards enabled (Business Health, Notes, Payables, P&L, Receivables) but not Tax obligations, so the activity card never appears.

## Change

In `src/routes/_authenticated/clients.$clientId.index.tsx`, move the `XeroActivityWidget` out of the `widgets.includes("tax_obligations")` gate so it renders for every connected Xero file on the client's live dashboard:

- Render `block.activity` unconditionally inside the per-Xero-file loop (same place it sits today, beside the statutory block).
- Keep the existing `taxObligations` gate for the Tax obligations card itself — unchanged.

## What stays the same

- **No access change.** The card reads the stored nightly snapshot through the existing AAL2-gated, caller-scoped server function (`getXeroUserActivity`). Viewers who can see the dashboard can already read that snapshot data; this only changes whether the card is displayed, not who can read what.
- Files not yet reconnected with the new Xero permission still show "Not available yet — reconnect this Xero file…" until the next overnight refresh.
- The Clients overview "Last Xero login" column is unchanged.

## Security classification

Security-relevant (touches display of client data). Verified current state before planning: the gate is at `clients.$clientId.index.tsx` line 271 (`widgets.includes("tax_obligations")`), and Bangkok on King's `client_cards` row confirms `tax_obligations` is not enabled. No policy, grant, or function changes — presentation gating only. After the edit: typecheck + `bun run security:check`, and note the change in the security backlog.
