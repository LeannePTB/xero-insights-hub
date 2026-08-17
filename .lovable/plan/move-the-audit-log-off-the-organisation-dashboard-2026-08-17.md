# Move the audit log off the organisation dashboard

## What's happening

The audit log is rendered on the organisation page that lists clients (`/firms/$firmId`), inside a "Super Admin View" wrapper. Only platform super admins can see it, but it still sits on the same page advisors use day to day — and it is doubled up: the wrapper prints "Audit log" and the card underneath prints its own "Audit log" heading again (visible in the screenshot).

The same audit log already exists in the Super Admin organisation page at `/admin/firms/$firmId`, alongside plan and members.

## The change

- Remove the audit log block from the organisation dashboard so that page only shows clients, cards defaults, support access and loan consolidation.
- Keep the audit log in the Super Admin organisation page (`/admin/firms/$firmId`), under plan and members, which is where organisation-level system events belong.
- Add a small "View audit log" link from the organisation dashboard to the Super Admin page, visible to super admins only, so it stays one click away.

## Technical detail

- `src/routes/_authenticated/firms.$firmId.index.tsx`: drop the `SuperAdminSection title="Audit log"` block and the now-unused `FirmAuditLogCard` import.
- `src/routes/_authenticated/admin.firms.$firmId.tsx`: no change to the existing `AuditSection`; confirm it renders after the plan and members sections.
- `src/components/admin/FirmAuditLogCard.tsx` stays in place (still used if we surface it elsewhere); no duplicate-heading problem once the wrapper is gone.
