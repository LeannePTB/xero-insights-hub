# Support access card + logo branding

## 1. Support access card shows the wrong state for you

You now have client-data access to this organisation (you added yourself as staff), but the card still shows "Not granted" and "Support staff cannot open client dashboards…". That copy only looks at the owner's grant switch and ignores membership.

Fix: make the card reflect the viewer's actual access.

- If you are a member of the organisation: show a green "Access via membership" badge and the line "You can open this organisation's client data because you're a member of it."
- If you are platform staff without membership and the owner has granted access: "Granted" as today.
- If neither: keep today's "Not granted" wording.
- The owner still sees the on/off switch exactly as now; the grant state line stays visible underneath so the owner knows whether outside support staff (non-members) have access.

No backend change needed — `getSupportAccess` already returns `viewerIsMember`, `viewerIsPlatformStaff` and `viewerHasClientData`; the card just isn't using them.

## 2. "Positive Traction" text

All app text and the database records already say Traction Advisory (organisation names are "Traction Advisory" and "DRTABT Projects"). The only remaining source is the header logo image file itself — the artwork still has the old Positive Traction wordmark baked into the picture.

Options:
- You upload a Traction Advisory logo and I swap the image in.
- Or I generate a simple Traction Advisory wordmark to use until you have final artwork.

If you tell me where else you see the words (page/screen), I'll track that one down too.

## Technical notes

- File: `src/components/admin/SupportAccessCard.tsx` — branch the badge and status line on `viewerIsMember` / `viewerHasClientData`.
- Logo: `src/assets/pt-logo.png.asset.json`, used by `src/components/AppHeader.tsx`.
