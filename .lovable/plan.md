## Move File Audit into the Business Health section

Right now the `AuditSummaryCard` renders inside the **Advanced dashboard** grid (draggable, one per Xero org). Move it up so it sits with the Business Health block at the top of the client page.

### Changes — `src/routes/_authenticated/clients.$clientId.index.tsx`

1. Stop pushing `xero_audit` cards into the `advancedCards` array (remove the `if (widgets.includes("xero_audit"))` branch inside the org loop).
2. In the "orgs > 0" render branch, directly under `<HealthWidget … />`, render one `<AuditSummaryCard />` per connected org when the `xero_audit` widget tier is enabled:

```tsx
{showHealth && (
  <>
    <HealthWidget … />
    {widgets.includes("xero_audit") &&
      orgs.map((o) => o.xero_connections?.tenant_id ? (
        <AuditSummaryCard
          key={`${o.id}:xero_audit`}
          tenantId={o.xero_connections.tenant_id}
          tenantName={o.xero_connections.tenant_name ?? "Unknown"}
          clientId={clientId}
        />
      ) : null)}
  </>
)}
```

3. No changes to `AuditSummaryCard.tsx`, `HealthWidget.tsx`, tier config, or the widget picker — the audit stays a tier-gated feature, it just lives in the Business Health area instead of the advanced grid.

### Notes

- Because the card is no longer in `SortableCardGrid`, it will not be drag-orderable — it always sits directly below Business Health. Confirm that's what you want; if you'd rather keep drag ordering, we'd instead move it to the top of `standardCards` conditionally.
- If `showHealth` is off but `xero_audit` is on, the audit card would not appear under this plan. Say the word if it should always show regardless of the Health tier.
