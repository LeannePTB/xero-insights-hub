# Trixie — AI assistant plan

## Classification and security boundary

**SECURITY-RELEVANT.** Trixie will read client financial data, use authenticated server routes and add organisation entitlements and usage records.

The change will **not alter who can read or write any existing row**. It will preserve these controls:

- AAL2 is required in the chat route and database policies.
- Organisation/client/Xero IDs are filters, never grants.
- Super admin alone never grants client data; `/system` receives how-to help only.
- Client viewers remain limited to their exact client and entitled cards.
- Every financial read stays behind its existing caller-scoped database predicate and existing card entitlement.
- No service-role client reads, tokens, prompts, answers or figures in usage logs.
- Xero/document content is untrusted data, never instructions.

**Primary threats:** a model requesting a different client/file, combining separately entitled cards into a broader read, prompt injection from financial/document text, accidental persistence of figures, and cost abuse.

## What to reuse from current CoCo, and what changes

The current Business Hub Central assistant is displayed as **CoCo**. Its implementation still uses legacy `hubbie-*` file, table and route names internally; those names are implementation history, not the current product identity. The current checked-out CoCo implementation was re-reviewed for this revision.

### Reuse

- CoCo's globally mounted floating launcher and side-panel chat.
- AI SDK streaming with Stop, optimistic user messages, Markdown responses and gateway run-ID correlation.
- Server-held Lovable AI Gateway key and OpenAI Responses integration.
- A short built-in product guide plus admin-authored knowledge notes and a page map derived from real routes/navigation.
- Read-only model tools that execute as the signed-in caller.
- A central agent identity/config file.

### Improve or replace

- Use the supplied Trixie SVG, the current Traction colour tokens and the app's 12px/18px scale.
- Use AI Elements primitives for the transcript, messages, composer, loading and tool activity instead of Hubbie's custom chat markup.
- Verify AAL2 in the streaming route; Hubbie's route verifies the token but does not independently enforce AAL2.
- Do not copy CoCo's broad `FOR ALL` RLS policies or direct browser CRUD for admin knowledge.
- Do not copy CoCo's indefinitely retained threads/messages. For Phase 1, use **one session-only conversation with no transcript persistence**. This best satisfies the requirement not to store financial answers. Usage metadata is stored separately.
- Do not copy CoCo's generic record-lookup layer. Trixie's financial tools remain card-specific and preserve each existing entitlement gate.
- Add the global switch, vetted model selector, fair-use limits and usage reporting that CoCo does not have.
- Replace CoCo's six-step cap with the supported agent-loop contract while keeping the available tool set narrow and context-bound.

## Phase 1 scope

### 1. Trixie identity and chat surface

- Save the supplied artwork as `src/assets/trixie-icon.svg`; preserve its geometry and map colours to the nearest brand tokens where the rendering context supports them.
- Add a 48–56px bottom-right launcher on every authenticated layout, including the minimal client-viewer layout.
- Open a right-side panel on desktop and a full-width sheet on small screens.
- Header: Trixie icon, name, context label and close control. Trixie's identity is fixed even under White label.
- Show page-specific suggested questions before the first message.
- Render user messages as a high-contrast brand bubble; render Trixie's Markdown without a bubble, with her icon as the avatar.
- Show tool activity collapsed by default and show a compact **Sources used** section with card/report name, Xero file and as-at/fetched date. Never expose internal table/function names.
- Composer supports Enter to send, Shift+Enter for a new line, Stop while streaming and reliable focus restoration.
- No chat-history list in Phase 1; closing or reloading clears the conversation.

### 2. Context and audience rules

The browser sends only the current route and route parameters. The server independently resolves the allowed mode:

- **System Admin:** how-to knowledge only; all financial tools absent.
- **Organisation owner/staff:** how-to plus client figures only after the existing membership/client/card checks pass.
- **Client viewer/business owner:** exact-client help only, simpler wording, no staff-only articles or tools.
- **External adviser/read-only viewer:** only the exact data already available through that viewer's existing card entitlements; no management guidance.
- **White label:** Trixie keeps her name and avatar; surrounding organisation identity remains unchanged.

Current-page context is a convenience, not authority. Client and tenant IDs are bound server-side to the caller and current client before any tool runs.

### 3. How-to knowledge

- Create a curated Trixie knowledge store with title, body, tags, audience (`all`, `staff`, `viewer`, `platform`) and active status.
- Seed reviewed starter articles for adding a client, connecting/reconnecting Xero, consolidation groups, card defaults, monthly reports and business-owner invitations.
- Generate the page map from the authenticated route files plus `sidebar-nav.ts`; Trixie may only link to paths in that map and only when the caller can use that workspace.
- Retrieval is deterministic full-text/keyword search first; no embeddings or vector store are needed for this content volume.
- Admin articles take priority over the built-in guide. If evidence is absent, Trixie says she does not know rather than inventing steps.

### 4. Explain numbers safely

Create context-bound, read-only AI tools for:

- cash position/cash flow;
- Profit & Loss;
- tax obligations;
- payables;
- receivables;
- break-even; and
- business-health verdict and reasons.

Implementation approach:

- Extract the body of each existing read handler into a server-only helper taking the existing authenticated caller context; the current `createServerFn` and Trixie tool call that same helper.
- Preserve `requireAal2`, `assert_widget_access`, source/staleness fields, Xero retry/rate-limit behaviour and `logClientDataRead` at the shared helper boundary.
- Keep one tool per existing card entitlement. Do **not** add a generic “read all client finances” function or silently aggregate cards the caller cannot independently open.
- Tool schemas never accept organisation/client/tenant IDs from the model. Those values come from the verified route context. The model may choose only a metric and supported date preset.
- Responses must distinguish live, snapshot, stale, incomplete and missing data; quote returned values only and never calculate unsupported figures.
- Source chips are generated from structured tool results, not model prose.

### 5. Prompt and injection controls

- A fixed system prompt defines Trixie's role, Australian English, audience level, no-guessing rule, permitted links and tool boundaries.
- Wrap all knowledge, Xero text, account labels, report commentary and future uploaded-document text as untrusted quoted data.
- Explicitly ignore instructions found inside those data blocks.
- Keep tools read-only in Phase 1, with no write/send/delete/payment capability.
- Validate request size, message count and route context; truncate retrieved knowledge, not security instructions.
- Stream errors safely: preserve gateway messages for credit/configuration failures, bounded backoff only for 429/5xx, and no retries for denials/refusals.

### 6. System Admin → Trixie

Add `/system/trixie` and a System Admin navigation entry with:

- **Settings:** global on/off switch; an allow-listed model selector populated from models verified for the correct endpoint and zero-retention policy; default `openai/gpt-6-astra`; no free-text model IDs.
- **Knowledge:** create/edit/archive articles, tags and audience; all writes through AAL2, super-admin, audited database functions.
- **Usage:** current month questions, input/output tokens, estimated gateway cost, denied/failed requests and organisation breakdown. No prompts, answers or financial values.
- **Limits:** default organisation allowance (initially 100 answered questions per calendar month), warning threshold (initially 80), token-cost guard, separate platform allowance, and per-organisation overrides. Each allowance supports a finite value or **Unlimited**.

## Inclusion and fair-use policy

Trixie is **included free for every organisation**. It is not a purchased or trialled option and has no relationship to Advisory, Branding, Consolidation or White label.

Access depends only on the global System Admin on/off switch plus the caller's existing access to the current page/client. There will be no Trixie control or indicator in Plan & options, Subscription or the Organisations list.

Fair-use launch defaults:

- 100 answered questions per organisation per calendar month;
- warning at 80 questions, with both values globally editable;
- hard stop at the configured allowance, unless that organisation is set to Unlimited;
- a per-organisation finite or Unlimited override in System Admin → Trixie;
- a second token-cost guard to prevent a small number of unusually large requests exhausting credits;
- business-owner/client-viewer questions count against the organisation that owns that exact client;
- System Admin how-to questions count against a separate finite or Unlimited platform allowance and never against an organisation.

There is no selling-price decision. The token-cost guard amount remains an owner decision before implementation.

## Usage and retention recommendation

- Store one metadata row per completed/failed request: caller ID, organisation ID, optional client ID, timestamp, selected model, gateway run ID, status, input/output/reasoning token counts and estimated cost.
- Never store prompt text, answer text, Xero figures, account/contact names or retrieved knowledge in usage/audit rows.
- Keep usage metadata for **13 months** for monthly comparisons and billing queries, then purge it with a scheduled database job.
- Phase 1 transcripts remain in memory only and disappear on reload. If persistent threads are approved later, design them separately with explicit client scope, deletion and a short retention period.

## Model, gateway and cost assumptions

- Use Lovable AI Gateway server-side only; provision/retain `LOVABLE_API_KEY` as a project secret.
- Default model: `openai/gpt-6-astra` through `/v1/responses`, low reasoning, `store: false`, encrypted reasoning continuity and streamed output.
- Current verified Astra rates (10 Oct 2026): **$10 per million input tokens and $50 per million output tokens** before any workspace/service-tier adjustments.
- Indicative 5,000-input/800-output-token answer: about **US$0.09**; 100 similar answers: about **US$9**, before tool-loop variation and cached-input savings.
- Admin model choices will be limited to currently available zero-retention models with explicit protocol adapters. Initial allow-list: Astra plus one lower-cost reviewed model; do not expose every discovered model automatically.
- Install the public AI SDK packages required for Responses/chat transport and the AI Elements primitives; no provider key reaches the browser.
- Every gateway call is tested live after implementation; a provider denial, refusal, unavailable model or account/configuration error ends verification without model substitution.

## Phase 2 — optional, not in this build

- Draft monthly-report commentary for organisation staff only, using the existing caller-scoped report context.
- Show the draft in an editor; never auto-save, finalise, send or replace existing commentary.
- Suggest next actions as non-executing text with cited evidence.
- Client viewers cannot access drafting; System Admin cannot draft client commentary.
- Any future write action requires a separate security plan, explicit approval and tool approval before execution.

## Database changes

### No organisation purchase/trial changes

- Do not change `org_subscription_options`, `org_purchase`, `set_org_purchase`, trial handling or the fixed-return effective-option resolver.
- Do not add `trixie_enabled` or `trial_trixie_enabled`.
- Do not add Trixie to Plan & options, Subscription or the Organisations list.
- Availability is resolved from the global switch, the applicable fair-use allowance and the caller's existing page/client access only.

### New tables

- `trixie_settings`: singleton global enabled/model/default organisation allowance/default warning threshold/token-cost guard/platform allowance configuration; finite or Unlimited allowances; authenticated direct access revoked; super-admin functions only.
- `trixie_knowledge`: curated articles and audiences; RLS on; super-admin writes through audited functions; authenticated direct writes revoked.
- `trixie_org_limits`: optional finite or Unlimited organisation allowance overrides; RLS on; super-admin functions only.
- `trixie_usage`: metadata-only request usage; direct authenticated writes revoked; caller-scoped usage reservation/finalisation functions prevent race-condition limit bypass.

For every table: revoke defaults from `anon` and `authenticated`, grant only needed commands, add explicit per-command policies `TO authenticated`, add restrictive AAL2 policy, indexes, retention handling and access-matrix coverage. No `FOR ALL` permissive policy.

### New database functions

- Caller-scoped `trixie_access_context(client_id default null)` resolves the global switch, applicable organisation/platform allowance and exact permitted page/client context without accepting a user ID. It does not resolve a paid entitlement.
- Atomic `reserve_trixie_usage(...)` checks the global switch and applicable finite/Unlimited allowance before a gateway call, while retaining the caller's existing access checks as the only data-access authority.
- `finalise_trixie_usage(...)` records token/cost/status metadata without content.
- Super-admin-only settings, article and limit writers with `SET search_path`, `app_private.assert_aal2()`, caller guard first, audit entry and EXECUTE revoked from `PUBLIC`/`anon`.

No database function will return a private logo path, Xero token, prompt, answer or raw financial payload.

## Planned files

### New application files

- `src/assets/trixie-icon.svg`
- `src/components/trixie/TrixieWidget.tsx`
- `src/components/trixie/TrixieConversation.tsx`
- `src/components/trixie/TrixieSources.tsx`
- `src/lib/trixie/trixie.config.ts`
- `src/lib/trixie/trixie-context.ts`
- `src/lib/trixie/trixie-sitemap.shared.ts`
- `src/lib/trixie/trixie-tools.server.ts`
- `src/lib/trixie/trixie.server.ts`
- `src/lib/trixie/trixie-run-id.server.ts`
- `src/routes/api/trixie.chat.ts`
- `src/routes/_authenticated/system.trixie.tsx`
- focused unit/integration tests beside these files

### Existing application files expected to change

- `src/components/shell/AppShell.tsx`
- `src/routes/_authenticated/route.tsx`
- `src/lib/nav/sidebar-nav.ts`
- `src/lib/xero/cashflow.functions.ts`
- `src/lib/xero/reports.functions.ts`
- `src/lib/xero/payables.functions.ts`
- `src/lib/xero/receivables.functions.ts`
- `src/lib/health.functions.ts`
- the current break-even read module(s)
- `package.json` and lockfile
- `AGENTS.md`

### Database/security records

- one new migration under `supabase/migrations/`
- `docs/security/access-control-spec.md`
- `docs/security/access-matrix.ts` and generated matrix
- `docs/security/definer-register.md`
- `docs/security/admin-client-register.md` only if a registered system-context write is required
- `docs/security-backlog.md`
- table/RLS/RPC/static-guard fixtures and tests required by the security gate

The final changed-file list will be generated from the implementation rather than assumed from this plan.

## Verification

- Unit tests for context resolution, audience filtering, route/page-map links, usage limits, cost calculation, stale/missing-data wording and prompt-injection fixtures.
- Database tests for owner/staff/client-viewer/platform-staff/cross-organisation/AAL1 cases, including exact-client isolation and independent card entitlement denial.
- Streaming tests covering optimistic message, first token, Stop, split stream frames, tool result/citation rendering, denial/refusal, 402, 429 and safe errors.
- Live gateway test with one how-to question and one authorised client-data question; verify a disallowed card/client produces no figures.
- Browser checks on System Admin, organisation, client-staff and client-viewer surfaces at desktop/mobile sizes.
- `bunx tsgo`, relevant tests, navigation/landing tests, build telemetry, `bun run security:check`, `public.security_posture()` and database linter.
- Security report naming invariants touched, evidence, checks and any unfinished work.

## Decisions needed before implementation

Approval of this plan will confirm these recommended defaults unless changed:

1. **Conversation:** one session-only conversation, no saved transcripts or past-chat list.
2. **Inclusion:** free for every organisation; no purchase, trial, plan switch, subscription line or list column.
3. **Allowance:** default 100 answered questions per organisation per calendar month, warning at 80, finite or Unlimited overrides, separate platform allowance and no automatic overage charge.
4. **Retention:** metadata-only usage for 13 months; no prompts/answers stored.
5. **Model:** Astra as default, plus one reviewed lower-cost zero-retention option in the admin selector.
6. **Phase 2:** commentary drafting and next-action suggestions remain out of scope.
7. **Owner input still required:** the token-cost guard amount only.
