# src/lib/health
- Business Health is one pure builder (`health-checks.ts`) fed by one stored-data loader (`health-checks.server.ts`) for card, list badge and report, so they never disagree and cost no Xero calls.
- Next tax payment prefers open ATO activity-statement bills (`lodgedAtoBills`), else the period-end balance method; past-due tax bills count only when billed to the ATO, so supplier notional-GST lines never raise tax alerts.
