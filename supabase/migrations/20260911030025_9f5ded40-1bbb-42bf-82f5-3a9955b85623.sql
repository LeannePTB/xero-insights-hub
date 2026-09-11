DO $mig$
DECLARE
  src text;
  before_len int;
  blk text;
  anchor text := '  return jsonb_build_object(''generated_at'', now(), ''checks'', checks);';
BEGIN
  SELECT pg_get_functiondef('public.security_posture'::regproc) INTO src;

  -- 1. definer_guards: require the aal2 guard specifically.
  before_len := length(src);
  src := replace(
    src,
    '''(assert_aal2|is_aal2|me_is_super_admin|is_super_admin|has_firm_access|has_client_access|user_can_[a-z_]+|auth\.uid)''',
    '''(assert_aal2|is_aal2)''');
  IF length(src) = before_len THEN
    RAISE EXCEPTION 'definer_guards pattern not found — aborting';
  END IF;

  src := replace(src,
    '''Every definer function signed-in users can call mentions a caller guard.''',
    '''Every definer function signed-in users can call references the aal2 guard.''');
  src := replace(src,
    'else n || '' callable definer function(s) with no caller guard.'' end,',
    'else n || '' callable definer function(s) do not reference app_private.assert_aal2()/is_aal2().'' end,');
  src := replace(src,
    '''Text heuristic only: pg_proc.prosrc is searched for a guard name,',
    '''Text heuristic only: pg_proc.prosrc is searched for assert_aal2 or is_aal2,');

  -- 2. new access_tests check, appended just before the final return.
  blk := $blk$
  checks := checks || (
    select case when r.id is null then
      jsonb_build_object(
        'id','access_tests','title','Access tests',
        'status','warn',
        'detail','Never run. Run the access tests to prove the access matrix still holds.',
        'evidence','public.security_test_runs is empty')
    else
      jsonb_build_object(
        'id','access_tests','title','Access tests',
        'status', case when r.failed > 0 or not r.fingerprint_match then 'action'
                       when r.ran_at < now() - interval '7 days' then 'warn'
                       else 'ok' end,
        'detail', case when r.failed > 0 then r.failed || ' unexpected failure(s) in the last run.'
                       when not r.fingerprint_match then 'The test fixture no longer matches the live database.'
                       when r.ran_at < now() - interval '7 days'
                         then 'Last run was more than 7 days ago.'
                       else r.passed || ' checks passed, no unexpected failures.' end,
        'evidence', 'Last run ' || to_char(r.ran_at, 'YYYY-MM-DD HH24:MI') || ' UTC, layer ' || r.layer
                    || ', ' || r.passed || ' passed, ' || r.failed || ' failed, '
                    || jsonb_array_length(r.known_failures) || ' known failure(s) carried.',
        'matches', r.known_failures)
    end
    from (select 1) x
    left join lateral (
      select * from public.security_test_runs order by ran_at desc limit 1
    ) r on true
  );

$blk$;

  IF position(anchor in src) = 0 THEN
    RAISE EXCEPTION 'return anchor not found — aborting';
  END IF;
  src := replace(src, anchor, blk || anchor);

  EXECUTE src;
END
$mig$;