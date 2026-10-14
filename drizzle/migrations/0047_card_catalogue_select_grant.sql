-- Records the 14 Oct hot-fix: signed-in browser/server-function reads of the
-- card catalogue include report_sections, which had no column grant. RLS and
-- the restrictive aal2 policy still apply. GRANT is idempotent.
-- card_modules keeps its existing column grants: every column read by app code
-- (module_key, label, description, sort_order) is already granted.
grant select on table public.card_catalogue to authenticated;