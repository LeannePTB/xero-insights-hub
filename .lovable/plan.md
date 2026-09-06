# Replace role checks with access checks on write paths

`assertAdvisor` asks *what role do you hold*, never *what may you touch*. Any user holding `advisor`, `super_admin`, `firm_owner` or `firm_staff` — that is, essentially every staff account in every organisation — passes it, and the function then writes with `supabaseAdmin`, which bypasses RLS. The caller-supplied `clientId` / `firmId` / `tier` is used only as a filter on the write, exactly the shape invariant 4 forbids.

Everything below was read this turn from the named files and from the database catalogue.

## 1. The answer you care about most: which writes reach other organisations' clients

Three, all via `supabaseAdmin` after nothing but a role check:

- **`saveClientTierWidgets`** (`tier-config.functions.ts:127`) — writes/deletes `tier_widget_config` rows for **any `clientId`**, in any organisation.
- **`saveClientWidgets`** (`tier-config.functions.ts:575`) — updates `clients.dashboard_widgets` for **any `clientId`**.
- **`uploadStatementLines`** and **`deleteUpload`** (`unreconciled.functions.ts:139`, `:236`) — insert `unreconciled_uploads` / `unreconciled_lines` against **any `clientId`**, and delete **any `uploadId`** (no client resolution at all). Its local `assertAdvisor` is narrower — literally the `advisor` role only — but still not tied to the client.

`saveFirmDefaultWidgets` (`tier-config.functions.ts:684`) reaches **any organisation and all of its clients** for a super admin, because its membership check is bypassed by an explicit `isSuper` branch; for everyone else the membership check holds.

## 2. Per-function inventory

### `src/lib/tier-config.functions.ts`

| Function | Writes | Reach | Current gate | Can write to an unrelated org/client today? |
|---|---|---|---|---|
| `savePlatformTierWidgets` :86 | `tier_widget_config` platform row (`client_id IS NULL AND firm_id IS NULL`) | Platform-wide, every organisation without its own row | `assertAdvisor` | Yes — any `firm_staff` in any organisation can rewrite the platform default |
| `saveClientTierWidgets` :127 | `tier_widget_config` client row (insert/update/delete) | Any client | `assertAdvisor` | **Yes** |
| `setTierEnabled` :377 | `tier_settings` upsert | Platform-wide tier kill switch | `assertAdvisor` | Yes — platform row, any staff |
| `saveClientWidgets` :575 | `clients.dashboard_widgets` | Any client | `assertAdvisor` | **Yes** |
| `saveFirmDefaultWidgets` :684 | `firms.default_widgets` + `clients.dashboard_widgets` for every client in the organisation | Any organisation, for super admins | `assertAdvisor`, then membership unless `super_admin` | Yes for a super admin; no for others |
| `resetOrgTierToPlatformDefault` :306 | via `public.reset_org_tier_widgets` | One organisation, one tier | RPC: `app_private.has_firm_access` | No — correct today |
| `setOrgWidget` :338 | via `public.set_org_widget_enabled` | One organisation | RPC: membership | No — correct today |
| `setClientWidget` :799 | via `public.set_client_widget_enabled` | One client | RPC | No — gate lives in the database |
| `listTierConfig`, `getEffectiveWidgets`, `getOrgWidgetMatrix`, `getFirmPlanSummary`, `getClientWidgets`, `getClientWidgetMatrix`, `getUpgradeOptions`, `listTierSettings` | none | — | caller session / RLS | reads only, out of scope |
| `listOrgTierOverrides` :270 | none, but reads every organisation's override list with `supabaseAdmin` behind `assertAdvisor` | Platform metadata | `assertAdvisor` | Read-only; see §6 |

Quoted gate, identical in every case above:

```ts
async function assertAdvisor(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId)
    .in("role", ["advisor", "super_admin", "firm_owner", "firm_staff"]);
  if (!data || data.length === 0) throw new Error("Advisor only.");
}
```

and `saveFirmDefaultWidgets`'s extra check, which is the app restating a database rule and then punching a hole in it:

```ts
const isSuper = (roles ?? []).some((r: any) => r.role === "super_admin");
if (!isSuper) { /* firm_members lookup */ if (!member) throw new Error("Not a member of this organisation."); }
```

### `src/lib/billing.functions.ts`

`setClientComp` :91 and `setClientTrial` :150 write `client_subscriptions` for any client via `supabaseAdmin`, gated by `assertSuperAdmin`. That is a bare role check reaching client rows, but §8 of the spec makes comps and trials a deliberate super-admin revenue decision, and both write audit rows. **No change proposed** — flagged only. `setClientDashboardTier` :225 writes through `context.supabase`, so RLS decides; correct. `setAllClientTiers` :295 delegates to the membership-gated RPC; correct.

### `src/lib/admin.functions.ts`

Everything is `assertSuperAdmin` over organisation *metadata* — names, members, subscriptions, audit, password resets. That is Path C and legitimately role-based. **No change proposed.**

### `src/lib/clients.functions.ts`

Writes here use `context.supabase` (RLS) or resolve access first, with super-admin branches falling back to `supabaseAdmin` for `deleteClient` :393, `setClientXeroAllowance` :509, `createClient` :272, `inviteClientViewer` :654, `createClientViewerWithPassword` :722. These are role-gated super-admin escalations over client rows, of the same family as invariant 3, but they are pre-existing platform-operations paths with their own shapes. **Out of scope for this change; listed as a follow-up item, not planned here.**

### `src/lib/unreconciled.functions.ts`

`uploadStatementLines` and `deleteUpload` as described in §1. `assertClientAccess` (used by the read paths) also grants any `advisor` blanket access — a read problem, listed as a question below.

## 3. The correct gate for each

- Platform rows (`savePlatformTierWidgets`, `setTierEnabled`) — Path C, super admin. `app_private.me_is_super_admin()` exists and is the spec's named function for this.
- Organisation rows (`saveFirmDefaultWidgets`) — `app_private.has_firm_access`. Membership only; support grants are read-only per §7.
- Client rows (`saveClientTierWidgets`, `saveClientWidgets`, `uploadStatementLines`, `deleteUpload`) — manage-level. The spec names `app_private.user_can_manage_client`; see the caveat in the questions section.

No existing public RPC covers these writes. `public.user_can_access_firm` is the wrong function — it admits Path B support grants. Each step therefore adds one small `SECURITY DEFINER` function in the shape of `public.reset_org_tier_widgets` (read `auth.uid()` internally, `RAISE EXCEPTION 'NO_ACCESS'`, do the write, write an audit row), and the TypeScript becomes a single `rpc()` call with no local check and no `supabaseAdmin`.

## 4. Effect on super admins, screen by screen

- **Platform tier-catalogue screen** (`savePlatformTierWidgets`, `setTierEnabled`): today any advisor or organisation staff member can save it. After the change it is super admin only. If a non-super-admin Positive Traction account currently uses that screen, it will stop working — that is the one behaviour change to confirm before step 1 is applied. The screen should also hide the controls for non-super-admins rather than fail on save.
- **Organisation card defaults** (`saveFirmDefaultWidgets`): a super admin who is *not* a member of the organisation loses the ability to save. Per §3 the fix is a `firm_members` row (Path A), not a bypass. Positive Traction is already a member of the organisations it set up, so the expected impact is nil, but this needs confirming against the member lists first.
- **Client card lists** (`saveClientTierWidgets`, `saveClientWidgets`): unchanged for members and for super admins holding an active support grant (via `user_can_manage_client`); staff of unrelated organisations lose access they should never have had.
- **Statement uploads**: `advisor`-role holders lose the ability to upload against clients they have no relationship with.

## 5. Should `assertAdvisor` survive?

No. Every remaining caller is either a write (replaced by a database gate) or `listOrgTierOverrides`, a platform-metadata read that belongs on the super-admin check instead. The plan deletes both copies at the end. `assertSuperAdmin` in `billing.functions.ts` and `admin.functions.ts` **does** survive: those are Path C platform operations where the role *is* the authorisation, and the spec says so.

## 6. Write-access problems that do not fit the four categories

1. **`deleteUpload` takes an `uploadId` and never resolves a client.** Even a correct client gate has to derive the client from the upload row inside the database function.
2. **`listOrgTierOverrides`** is a read, but it discloses every organisation's name and override state to any advisor or organisation staff member. Path C metadata behind a role that is not platform-scoped.
3. **`saveFirmDefaultWidgets` loops over clients issuing one `update` per client** with no transaction. A partial failure leaves the organisation half-applied. Moving it into a database function fixes this as a side effect.
4. **`assertClientAccess` in `unreconciled.functions.ts`** returns early for anyone holding the `advisor` role — blanket read access to any client's statement lines.

## Steps — each separately reversible

Each step is one migration adding one function, plus the matching call-site swap. No step changes a table, column, RLS policy, trigger, entitlement or plan limit. Reverting a step means reverting one migration and one file edit.

1. `public.set_platform_tier_widgets(_tier text, _excluded text[])` — gate `app_private.me_is_super_admin()`, audit row. Point `savePlatformTierWidgets` at it. *(Confirm the screen's audience first — see §4.)*
2. `public.set_tier_enabled(_tier text, _enabled boolean)` — same gate. Point `setTierEnabled` at it.
3. `public.set_client_tier_widgets(_client_id uuid, _tier text, _excluded text[] , _clear boolean)` — client manage gate, keeps the existing plan-tier validation inside the function. Point `saveClientTierWidgets` at it.
4. `public.set_client_dashboard_widgets(_client_id uuid, _widgets text[])` — client manage gate. Point `saveClientWidgets` at it.
5. `public.set_firm_default_widgets(_firm_id uuid, _widgets text[])` — `app_private.has_firm_access`, applies to the organisation's clients in one statement, audit row. Point `saveFirmDefaultWidgets` at it and delete the local membership check *and* its super-admin bypass.
6. `public.record_statement_upload(...)` and `public.delete_statement_upload(_upload_id uuid)` — client manage gate, the delete resolving the client from the upload row. Point `uploadStatementLines` / `deleteUpload` at them.
7. Move `listOrgTierOverrides` onto the super-admin check, then delete `assertAdvisor` from both files.

After every step: restate which §0 invariants it touches and why they hold.

## Questions for you

1. **`user_can_manage_client` admits support grants.** It returns true when `is_super_admin(_user_id) AND platform_staff_can_access_firm(...)` — that is Path B, and §7 makes Path B read-only. For the client *write* gates in steps 3, 4 and 6, do you want `user_can_manage_client` as the spec names it, or a membership-only variant (`clients.owner_user_id = uid OR has_firm_access(uid, clients.firm_id)`)? I have not chosen.
2. **Step 1's audience.** Is the platform tier-catalogue screen used by anyone who is not a `super_admin`? If yes, tightening it breaks their screen.
3. **Step 5's audience.** Are there organisations where a Positive Traction super admin edits the default card list without being a member? If so, the fix is a membership row, but I want to know before the gate lands.
4. **`assertClientAccess`'s blanket `advisor` read** (§6.4) — same class of problem, but a read. In scope for a later change, or leave it?
5. **`clients.functions.ts` super-admin `supabaseAdmin` branches** — separate piece of work, or fold into this one?
