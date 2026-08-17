# Rebrand "Positive Traction" to "Traction Advisory"

## Goal
Find all occurrences of "Positive Traction" in the app and database, replace visible copy with "Traction Advisory", and update the default fallback email/website to match.

## Current references found
- Footer copy: `src/routes/signup.$token.tsx`, `src/routes/set-password.tsx`, `src/routes/auth.tsx`
- Logo alt text / aria-label: `src/components/BrandMark.tsx`, `src/components/AppHeader.tsx`
- Support access card copy: `src/components/admin/SupportAccessCard.tsx`
- Excel export metadata: `src/lib/loan-consolidation-export.server.ts`
- Root title / meta: `src/routes/__root.tsx`
- Xero callback error message: `src/routes/api/public/xero/callback.ts`
- Database defaults: `supabase/migrations/20260627060009_7a4c713a-f82f-403a-bb93-931eeaa7133d.sql`
- Palette comment: `src/styles.css`

## Changes
1. Replace "Positive Traction" text with "Traction Advisory" in all UI files and export metadata.
2. Update `__root.tsx` title from "Traction Advisory — Xero dashboards by Positive Traction" to "Traction Advisory — Xero dashboards".
3. Update default fallback values in SQL seed/migration: `trading_name`, `website`, `primary_contact_email` to `tractionadvisory.com.au` / `admin@tractionadvisory.com.au`.
4. Update the `styles.css` palette comment to "Traction Advisory palette".
5. Leave the logo image asset untouched until a new Traction Advisory logo is provided.

## Out of scope
- Logo image replacement (needs a new asset file). This will be handled separately if you upload one.

## Questions
- Do you want the logo image asset replaced with a new Traction Advisory logo? If so, upload the asset.
- Should we also update the default `primary_contact_email` to `admin@tractionadvisory.com.au`, or do you have a different default support email?
