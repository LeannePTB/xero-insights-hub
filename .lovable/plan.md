Add the Xero-branded sign-in button to `/auth` per Xero App Store Checkpoint 1 branding requirements. **This is the button only — no OAuth backend wiring yet.** Clicking it shows a toast explaining the flow isn't enabled.

## Changes

### 1. Extend `ConnectWithXeroButton.tsx`
Add a `"signin"` variant to the existing `Variant` union:
- Label: `"Sign in with Xero"`
- Same blue `#13B5EA` filled style as `connect`
- Same Xero "X" mark, sizes, focus ring

No other component changes — keeps a single branded button source for all Xero CTAs.

### 2. Update `src/routes/auth.tsx`
In the right-hand sign-in panel, after the email/password `Sign in` button:

- Add a divider: thin border with centred `"or"` label (muted text).
- Render `<ConnectWithXeroButton variant="signin" />` full-width below the divider.
- On click: `toast.info("Sign in with Xero is coming soon. Use your email and password for now.")` — placeholder until the OAuth flow is built in a later pass.

No changes to existing email/password logic, MFA routing, or the forgot-password link.

## Out of scope (explicit)
- OAuth backend route, Xero identity callback, email-match provisioning — separate piece.
- Auth page on `/signup.$token` — invite flow stays unchanged.
- No new env vars, migrations, or server functions.

## Technical notes
- `ConnectWithXeroButton` already has `forwardRef` + size/className props, so adding a variant is a one-line `LABELS` entry plus including `"signin"` in the filled-style branch (it can share the `connect` styling).
- Full-width button: pass `className="w-full"` from `auth.tsx`.
- Brand compliance: keep the official blue, white text, undistorted "X" mark, min 40px height (matches existing `md` size).