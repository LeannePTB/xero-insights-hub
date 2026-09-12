DO $$
DECLARE
  r record;
  q text;
  w text;
  roles text;
BEGIN
  FOR r IN
    SELECT c.relname, p.polname, p.polrelid, p.polqual, p.polwithcheck, p.polroles
    FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND p.polcmd = '*' AND p.polpermissive
    ORDER BY c.relname, p.polname
  LOOP
    q := pg_get_expr(r.polqual, r.polrelid);
    w := pg_get_expr(r.polwithcheck, r.polrelid);
    SELECT string_agg(quote_ident(role_oid::regrole::text), ', ')
      INTO roles
      FROM unnest(r.polroles) AS role_oid;
    IF roles IS NULL THEN
      RAISE EXCEPTION 'policy % on % has no explicit role', r.polname, r.relname;
    END IF;
    IF q IS NULL OR w IS NULL THEN
      RAISE EXCEPTION 'policy % on % is missing USING or WITH CHECK', r.polname, r.relname;
    END IF;

    EXECUTE format('DROP POLICY %I ON public.%I', r.polname, r.relname);

    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO %s USING (%s)',
      r.polname || ' (select)', r.relname, roles, q);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO %s WITH CHECK (%s)',
      r.polname || ' (insert)', r.relname, roles, w);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO %s USING (%s) WITH CHECK (%s)',
      r.polname || ' (update)', r.relname, roles, q, w);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO %s USING (%s)',
      r.polname || ' (delete)', r.relname, roles, q);
  END LOOP;
END $$;