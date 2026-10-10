DO $mig$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.security_posture()'::regprocedure);
  IF position('get_platform_branding' in d) = 0 THEN
    d := replace(d, $q$and p.proname not in ('xero_required_scopes','session_is_active')$q$,
                    $q$and p.proname not in ('xero_required_scopes','session_is_active','get_platform_branding')$q$);
    d := replace(d, 'Two documented exclusions: xero_required_scopes (a constant list, no data access), and session_is_active',
                    'Three documented exclusions: xero_required_scopes (a constant list, no data access), get_platform_branding (anon-callable by design so sign-in pages can show public platform branding; returns no organisation, client or personal data), and session_is_active');
    EXECUTE d;
  END IF;
END
$mig$;