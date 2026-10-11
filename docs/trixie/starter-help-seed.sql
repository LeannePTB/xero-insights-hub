-- Owner-requested data-only starter seed. No schema, grants, policies or identities changed.
-- Fixed IDs make this insert-only seed repeatable; existing owner edits are never overwritten.
WITH inserted AS (
 INSERT INTO public.trixie_knowledge(id,title,body,tags,audience,active)
 VALUES
('48e0db1d-10fe-50d2-a061-8b437fbf94dc'::uuid,'Adding a client: Add client from Xero or New client','1. Choose the organisation in the workspace switcher, then open Clients.
2. In Add clients, check the number of clients used against the client allowance. Both add actions are disabled when the limit is reached; contact support to change the allowance.
3. To add from Xero, click Add client from Xero (the current button name), sign in to Xero and authorise the correct file. The new client is named after the Xero organisation. Follow any file-selection prompt shown on return.
4. To add manually, click New client, enter Client name and click Create client. Connect the file later under Client settings → Xero connections.
5. An external adviser with access to every client in the organisation will also see newly added clients. Check access before creating a client.',ARRAY['starter','clients','onboarding','xero','client-limits']::text[],'staff',true),
('3913ed7f-ff8f-5a99-8008-8a9abd824e86'::uuid,'Connecting, reconnecting and unlinked Xero files','1. Open the client, then Client settings → Xero connections.
2. Click Connect a Xero file, sign in to Xero and tick the file belonging to this client. Approve the requested permissions. The client file allowance still applies.
3. For an expired, disconnected or incomplete connection, click Reconnect to Xero beside the affected file. Tick that same file and approve all permissions. Reconnecting keeps its saved history; it does not guarantee the figures have already refreshed.
4. If permissions are still missing, use Reconnect and approve them again. Check the status after returning.
5. Where the existing-file selector is available, choose an authorised file and click Link selected. Read any move confirmation carefully: moving a file removes its link from the previous client.
6. An unlinked Xero file is a connection without a client link. A connection alone does not put figures on a client dashboard or give anyone access. Ask your organisation team to link the correct file; platform-wide unlinked monitoring is not part of the client dashboard.',ARRAY['starter','xero','connections','reconnect','unlinked']::text[],'staff',true),
('8fee343f-aa9f-5e6c-8405-3a8099ca6a29'::uuid,'Consolidations: Groups, Loan matrix, Loan groups and Loan accounts','1. In the organisation menu, open Consolidations → Groups. Consolidation needs the multi-company plan and at least two eligible clients with Xero files linked.
2. Click New group, enter Group name, tick the companies and click Create group. A company can belong to only one consolidation group. Use Edit and Save group to change it.
3. Click Open on a group to see its consolidated view, or Loan consolidation to review intercompany loans.
4. Open Consolidations → Loan matrix to compare loan balances across companies in the chosen group. Investigate differences rather than assuming both sides agree.
5. Open Consolidations → Loan groups to create or edit the company grouping used by the loan views.
6. Open Consolidations → Loan accounts. Choose the group, match the corresponding accounts under Side A and Side B, then click Save pairing. Pair only genuine counterparties. The consolidated view uses the configured loan pairings for eliminations.',ARRAY['starter','consolidation','groups','loans','loan-matrix']::text[],'staff',true),
('97384a7e-39be-517a-8369-a6da6e1cb842'::uuid,'Settings → Card defaults','1. Choose the organisation, then open Settings → Card defaults.
2. Tick the cards new clients should start with. This is a starting template, not an extra dashboard entitlement.
3. Click Save default card set. New clients receive that default when they are created; existing clients keep their own selections.
4. To replace existing clients’ selections, click Apply to all clients in this organisation and confirm. Save the default first. This overwrites their individual card selections.
5. Organisation owners and active team members with organisation write access can change defaults. Viewer and temporary support access cannot.
6. Only cards covered by the organisation’s purchase or an unexpired trial are offered. Consolidation also needs more than one client. A default never buys a card or starts a trial; unfinished cards are not usable just because a group is available.',ARRAY['starter','card-defaults','cards','settings','entitlements']::text[],'staff',true),
('b6bc4f3a-09a4-5cff-ab78-5bf0ccfad5ec'::uuid,'Monthly reports: prepare, preview, finalise and email','1. Open the client → Monthly reports. Under Generate, choose Period and, if offered, Xero organisation, then click Generate draft.
2. Review the draft preview and any completeness or mapping warnings. A draft PDF is marked DRAFT. Do not finalise missing or misleading figures.
3. In Past reports, click Open to review a saved version or PDF to download it. Click Finalise on the approved draft and complete the confirmation. Finalising fixes that version’s PDF; generating again creates another version rather than overwriting a finalised or sent report.
4. Click Email on a finalised report. In Email this report, enter recipients and the link expiry, then click Send. Each recipient receives a private report link and must confirm the email address it was sent to. A report link does not grant general dashboard access.
5. Set the organisation’s report logo under Settings → General → Organisation logo. The primary report logo uses the organisation logo first, then the platform logo, with the bundled logo as the final fallback. An eligible client logo is separate and does not replace this primary-logo order.
6. Trixie does not draft monthly report commentary in Phase 1.',ARRAY['starter','reports','monthly-reports','pdf','report-logo']::text[],'staff',true),
('80b43004-082e-5c56-acf0-a9390d5a21ba'::uuid,'People & access: invite business owners and external advisers','1. Open the organisation → People & access, then the Business owner or External adviser section. Use the invitation form if your access permits it; otherwise ask the organisation owner.
2. Enter the person’s name and email. Under Relationship, choose External adviser — read-only access or Business owner — selected clients only; self-service is not enabled yet.
3. Under Which clients should they see?, choose Only the clients I tick and select the intended clients. Only external advisers can be given Every client in this organisation, including ones added later.
4. Review the access summary and click Send invitation.
5. Both relationships are read-only now and do not make the person an organisation team member. Business owners see only their assigned clients and client-safe dashboard/report information. External advisers see only their selected clients unless explicitly granted every client, including future clients.
6. Use Client settings → People to review access associated with an individual client. Use People & access to manage invitations and access scope.',ARRAY['starter','people','invitations','business-owner','external-adviser']::text[],'staff',true),
('65b1907d-7019-5c35-b649-8b2ba006ca8b'::uuid,'Team members, ownership and support access','1. Open the organisation → People & access → Team members to review owners and staff. Team membership gives access to the organisation’s clients; it is different from a read-only client invitation.
2. Where Invite team member is available, enter the team member’s details and create the invitation. This control is currently restricted to super admins; if it is not available, contact support rather than using a business-owner invitation for staff.
3. Use Settings → Ownership for ownership changes. Inviting staff does not transfer ownership. Owners can remove staff; non-owner staff can leave their own membership.
4. For temporary troubleshooting, open Settings → Support access. A named platform staff member requests access; the organisation owner approves it. Support access is read-only, audited and expires within 72 hours. Revoke it when no longer needed.
5. Add me as staff is a separate control for eligible platform staff on an organisation’s System Admin detail page. It creates organisation staff membership, not a temporary read-only support grant. Use Leave organisation afterwards if that membership is no longer required.
6. System Admin status alone never grants access to client figures. Do not treat a support grant, viewer invitation or administrator badge as interchangeable with organisation membership.',ARRAY['starter','team','ownership','support','add-me-as-staff']::text[],'staff',true),
('6600073a-4d9a-5fb7-9491-6d9669b9d0c4'::uuid,'Client settings tour','1. Open a client → Client settings → General for the client’s basic details.
2. Open Cards & report branding to choose eligible dashboard/report cards and, where entitled, set the client’s report branding. Selecting a card does not buy it.
3. Open People to review the client’s viewers. Manage organisation invitations and scopes through People & access.
4. Open Xero connections to connect or reconnect files and review their connection status.
5. Open Tax & reporting for tax/reporting setup and Bank accounts & credit cards. Explicitly classify the correct Xero account as Bank account or Credit card when needed; this app setting does not change Xero. Do not classify from the name or a negative balance alone.
6. Open Cost & cash commitments for the cost and commitment settings used by the client’s calculations.
7. Open Danger zone only for deliberate destructive changes. Read the confirmation and consequences before continuing.
Settings changes require the appropriate staff access. Viewer and temporary support access do not allow editing.',ARRAY['starter','client-settings','setup','branding','bank-classification']::text[],'staff',true),
('da335bc5-e954-5bbd-811c-e53590a863f8'::uuid,'Reading the Overview and seven-day changes','1. Open Overview in an organisation, or All organisations for your authorised cross-organisation view. Use the client search and status filters to focus the list.
2. Read the status buckets: In trouble needs urgent review; Needs attention indicates concerns; Watch means monitor; All clear means no flagged issue from the available data. Can’t assess means the app cannot make a reliable assessment. A green status is not a guarantee.
3. Cash at bank shows bank cash. Net cash is cash at bank less credit card debt. Check account classification if the two seem wrong; do not assume every negative bank account is a credit card.
4. Check the seven-day cash change and What changed — last 7 days. Missing comparisons show a dash, not zero. The feed highlights recorded changes, not every transaction.
5. Protected money is money needed for tax and super obligations, not spare cash. Its percentage compares these obligations with net cash; more than 100% means net cash does not cover them.
6. Hover over bank warnings. Bank not reconciled since a date means the figures may not reflect the real position. Ask the team to reconcile in Xero and check refreshed data. Missing or old figures must not be treated as current balances.
7. Open the client for detail. The Overview no longer has Unreconciled since or Last Xero login columns.',ARRAY['starter','overview','health','protected-money','reconciliation']::text[],'staff',true),
('970035be-98ef-5af9-880c-16ee79b38cd1'::uuid,'Understanding Live Dashboard cards and Accrual/Cash','1. Open your client → Live Dashboard. You see only the cards available for that client and your access. Check the period, source dates and missing-data warnings before using any amount.
2. Cash cards show bank cash and cash pressures. Cash at bank is bank money; Net cash subtracts credit card debt. Protected money is needed for tax and super, so it is not free spending money.
3. Profit & Loss compares income with expenses for the displayed period. Profit is not the same as money in the bank.
4. Tax obligations show the recorded tax/super position. Check the dates and ask your adviser about amounts you need to set aside.
5. Payables are amounts the business owes. Receivables are amounts customers owe the business. Overdue items need follow-up; they are not proof that money has already moved.
6. Breakeven estimates the sales needed to cover the costs used in the calculation. Treat missing inputs or warnings as a reason to check with your adviser.
7. The health verdict summarises concerns from available figures. Read its reasons, not just its colour. It is guidance, not a guarantee or a replacement for advice.
8. Where Report basis is offered, choose Accrual or Cash. Accrual records income and expenses when earned or incurred; Cash records them when paid. This changes the supported report/card view, not transactions in Xero. It is not a switch that adds cash to your bank balance.
If the numbers are missing, old or unexpected, contact your organisation team. Do not assume a blank or dash means zero.',ARRAY['starter','dashboard','cash','pnl','tax','breakeven','accrual']::text[],'all',true),
('6934f6e1-6021-5c74-b5d9-aefdc0de93ea'::uuid,'For business owners: your dashboard and monthly reports','1. Sign in and complete two-factor verification. Open the client you have been invited to view.
2. Select Live Dashboard to read the available cards. You can see only clients assigned to you and their permitted client-safe information, not other businesses or staff administration.
3. Check the date and period first. Profit is not your bank balance. Some bank cash may be needed for tax and super. Read warnings and ask your adviser if a figure is old or missing.
4. Where Accrual and Cash are offered, Accrual shows income/expenses when earned or incurred; Cash shows them when paid. This does not change your Xero records.
5. Select Monthly reports, then Open or PDF on a report available to you. A monthly report is a saved period/version, not a live bank statement. If you receive a report email, use your private link and confirm the address it was sent to.
6. Your access is read-only; business-owner self-service is not enabled. Ask the organisation team or adviser who invited you for corrections, refreshed data, different cards, invitations or settings changes. Trixie can explain the dashboard but cannot make those changes.',ARRAY['starter','business-owner','viewer','dashboard','monthly-reports']::text[],'viewer',true),
('942f0eaa-2164-56f0-a69b-dff4592244fd'::uuid,'Organisation settings, report logo and Subscription','1. Choose the organisation → Settings → General. The organisation owner can change the organisation name using the name form.
2. Use Organisation logo to upload the logo for reports. The upload accepts PNG or JPEG up to 2 MB; use a clear, preferably transparent PNG at least 320 px wide.
3. Reports use the organisation logo first, then the platform logo if no organisation logo is available. While White label is active, the organisation branding is also used in its app and emails. White label does not rename Trixie or change anyone’s access.
4. Open Settings → Card defaults for the starting card selection, Ownership for ownership changes, or Support access for temporary read-only support.
5. Open Settings → Subscription to review your organisation’s plan, client allowance and active options. Subscription is read-only here: contact support to change the plan or options. Do not look for a self-service purchase button.
6. Trixie is included free for every organisation. It is not a paid/trial option and has no control or indicator in Subscription or Plan & options. Its question allowance is managed separately in System Admin → Trixie.',ARRAY['starter','organisation','settings','subscription','white-label','logo']::text[],'staff',true),
('8b34cd6c-af8e-5357-a861-c77b0b856476'::uuid,'System Admin overview and Trixie limits and alerts','1. Choose System Admin in the workspace switcher. Organisations is the platform organisation register. Open an organisation to review its platform settings, Plan & options and Billing lifecycle. These controls do not grant access to client data.
2. Open Platform staff to manage platform staff, or Platform branding for the platform identity and logo settings. System Admin status alone is never a client-data grant.
3. Open Xero monitoring for request allowance, API errors and unlinked connections. An unlinked connection is not automatically attached to a client. Security & Compliance is the separate security-monitoring menu.
4. Open Trixie. Month-to-date spend and Daily spend — last 30 days are at the top; Alerts can be acknowledged with Dismiss.
5. In Settings, use Trixie enabled for the global switch, Model for the currently offered model, Default organisation allowance and Warning threshold (%) for fair use, and System Admin allowance for the separate platform pool. Blank allowances mean Unlimited. Default organisation fair use is 100 questions/month with an 80% warning.
6. Set Cost guard per question (USD), Spend alert thresholds (USD, month to date) and Daily spike multiplier, then click Save settings. Initial defaults are US$0.25/question, US$25/50/100 spend thresholds and a 3× daily spike against the trailing seven-day daily average.
7. In Organisation allowances, set a finite or Unlimited per-organisation override. Client questions count against the organisation owning the client; System Admin questions use the separate platform allowance.
8. In Knowledge, click Edit to review an article’s Title, Article, Tags, Audience and Active state, then Save article. Starter articles are active and tagged starter. Archive removes an article from help search without deleting it; Restore makes it available again.
9. Use Usage to review metadata. Alerts cover spend thresholds, organisation allowance milestones and daily spikes; the monthly summary is scheduled for the 1st. Alerts/emails contain usage, not prompts, answers or client financial figures. Conversations are session-only; usage metadata is retained for 13 months.
10. Trixie in System Admin provides how-to help only. Phase 2 report-commentary drafting is deferred. There is no Trixie plan option or Organisations-list indicator.',ARRAY['starter','system-admin','platform','billing','branding','xero','trixie','alerts']::text[],'platform',true)
 ON CONFLICT(id) DO NOTHING
 RETURNING id,audience,active
)
INSERT INTO public.audit_log(actor_user_id,action,target_type,target_id,meta)
SELECT NULL,'trixie_starter_article_seeded','trixie_knowledge',id::text,
 jsonb_build_object('audience',audience,'active',active,'source','owner_requested_starter_seed','actor_context','system_data_seed')
FROM inserted;
