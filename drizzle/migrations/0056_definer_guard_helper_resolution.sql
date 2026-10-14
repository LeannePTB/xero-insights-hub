DO $mig$
DECLARE d text; o text;
BEGIN
  d := pg_get_functiondef('public.security_posture()'::regprocedure);
  o := d;
  d := replace(d, $a$'(assert_aal2|is_aal2)'))[1],
             'none') pat$a$, $b$'(assert_aal2|is_aal2)'))[1],
             (select h.proname::text || ' → ' || (regexp_match(h.prosrc, '(assert_aal2|is_aal2)'))[1]
                from pg_proc h join pg_namespace hn on hn.oid = h.pronamespace
               where hn.nspname in ('public','app_private') and h.oid <> p.oid
                 and h.prosrc ~ '(assert_aal2|is_aal2)'
                 and p.prosrc ~ ('\m' || h.proname || '\s*\(')
               order by h.proname limit 1),
             'none') pat$b$);
  d := replace(d, $a$('xero_required_scopes','session_is_active','get_platform_branding')$a$,
                  $b$('xero_required_scopes','session_is_active','get_platform_branding','get_public_website_settings','public_coming_soon')$b$);
  d := replace(d, 'pg_proc.prosrc is searched for assert_aal2 or is_aal2, it',
                  'pg_proc.prosrc is searched for assert_aal2 or is_aal2, or for a call to one helper (one level) whose own body references them, shown as helper → guard; it');
  d := replace(d, 'Three documented exclusions: xero_required_scopes',
                  'Five documented exclusions: get_public_website_settings and public_coming_soon (anon-callable by design for the public website: Calendly, video, poster and walkthrough settings, and Coming soon entries ticked Show on website; they return no organisation, client or personal data), xero_required_scopes');
  IF d = o OR position('public_coming_soon' in d) = 0 OR position(' → ' in d) = 0 OR position('Five documented' in d) = 0 THEN
    RAISE EXCEPTION 'security_posture patch did not apply cleanly';
  END IF;
  EXECUTE d;
END
$mig$;