-- Trixie help search: the database still decides WHICH articles the caller may
-- read (aal2, caller access context, active, audience); ranking moves to the
-- shared TypeScript ranker so it can be tested. Candidate cap raised to 50.
CREATE OR REPLACE FUNCTION public.search_trixie_knowledge(_query text,_client_id uuid DEFAULT NULL,_firm_id uuid DEFAULT NULL,_system boolean DEFAULT false,_limit integer DEFAULT 6)
RETURNS TABLE(id uuid,title text,body text,tags text[],audience text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='public' AS $$
DECLARE c record; BEGIN PERFORM app_private.assert_aal2(); SELECT * INTO c FROM public.trixie_access_context(_client_id,_firm_id,_system);
 RETURN QUERY SELECT k.id,k.title,k.body,k.tags,k.audience FROM public.trixie_knowledge k WHERE k.active AND k.audience IN('all',c.audience)
 ORDER BY k.updated_at DESC LIMIT LEAST(GREATEST(_limit,1),50); END; $$;
REVOKE ALL ON FUNCTION public.search_trixie_knowledge(text,uuid,uuid,boolean,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.search_trixie_knowledge(text,uuid,uuid,boolean,integer) TO authenticated,service_role;