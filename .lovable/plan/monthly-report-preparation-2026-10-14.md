# Monthly report preparation

## Approved experience
- Move preparation above the preview: compact period/file selection, Notes beside Personal video, then Generate draft and a versions expander.
- Place the existing Finalise, Email and PDF actions directly above the shown preview; collapse Past reports below it.
- Keep mobile in working order and keep all preparation controls hidden from Business Owners/Viewers.

## Video and notes
- Allow existing authorised client managers to save pending Loom video per client/period and edit draft video; require AAL2 and audit every save.
- Attach saved video when a draft is generated and carry it into new versions. Lock finalised/sent video, including concurrent finalisation.
- **Do not change note selection or generation timing.** Test the existing stored-note snapshot and Business Owner final-report read.

## Security and verification
- Use the existing caller-scoped manage-client predicate, never a role or supplied ID as a grant. Bare System Administrator, support, Business Owner and Viewer video writes remain denied.
- Add deny-by-default pending storage, guarded audited database functions, matrix/register entries and role/period/lock/snapshot tests.
- Run application tests and the security gate; inspect automatic compilation and desktop/mobile rendering. Report any session or security-posture blockers explicitly.

## Technical details
- Existing report delivery dialogs/functions and preview remain unchanged. Pending video and draft mutation use caller-scoped database transactions, not privileged browser writes.
- No financial calculations, report payload note construction, final/sent PDFs, memberships or entitlements change.