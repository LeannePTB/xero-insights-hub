CREATE TABLE public.firm_support_access (
  firm_id uuid PRIMARY KEY REFERENCES public.firms(id) ON DELETE CASCADE,
  granted boolean NOT NULL DEFAULT false,
  granted_by uuid REFERENCES auth.users(id),
  granted_at timestamptz,
  revoked_at timestamptz,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.firm_support_access TO authenticated;
GRANT ALL ON public.firm_support_access TO service_role;

ALTER TABLE public.firm_support_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners and members read support access"
ON public.firm_support_access FOR SELECT TO authenticated
USING (
  app_private.is_super_admin(auth.uid())
  OR app_private.has_firm_access(auth.uid(), firm_id)
  OR EXISTS (SELECT 1 FROM public.firms f WHERE f.id = firm_id AND f.owner_user_id = auth.uid())
);

CREATE POLICY "Owners insert support access"
ON public.firm_support_access FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.firms f WHERE f.id = firm_id AND f.owner_user_id = auth.uid())
);

CREATE POLICY "Owners update support access"
ON public.firm_support_access FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.firms f WHERE f.id = firm_id AND f.owner_user_id = auth.uid())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.firms f WHERE f.id = firm_id AND f.owner_user_id = auth.uid())
);

CREATE TRIGGER firm_support_access_set_updated_at
BEFORE UPDATE ON public.firm_support_access
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE OR REPLACE FUNCTION app_private.firm_support_access_active(_firm_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.firm_support_access fsa
    WHERE fsa.firm_id = _firm_id AND fsa.granted = true
  )
$$;

CREATE OR REPLACE FUNCTION app_private.platform_staff_can_access_firm(_user_id uuid, _firm_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT _firm_id IS NOT NULL
     AND (
       app_private.has_firm_access(_user_id, _firm_id)
       OR app_private.firm_support_access_active(_firm_id)
     )
$$;

CREATE OR REPLACE FUNCTION app_private.user_can_manage_client(_user_id uuid, _client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.clients c
    WHERE c.id = _client_id
      AND (
        c.owner_user_id = _user_id
        OR (c.firm_id IS NOT NULL AND app_private.has_firm_access(_user_id, c.firm_id))
        OR (
          app_private.is_super_admin(_user_id)
          AND app_private.platform_staff_can_access_firm(_user_id, c.firm_id)
        )
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.firm_support_access_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.audit_log (actor_user_id, firm_id, action, target_type, target_id, meta)
  VALUES (auth.uid(), NEW.firm_id,
          CASE WHEN NEW.granted THEN 'support_access_granted' ELSE 'support_access_revoked' END,
          'firm', NEW.firm_id::text,
          jsonb_build_object('granted', NEW.granted, 'note', NEW.note));
  RETURN NEW;
END $$;

CREATE TRIGGER firm_support_access_audit_ins
AFTER INSERT ON public.firm_support_access
FOR EACH ROW EXECUTE FUNCTION public.firm_support_access_audit();

CREATE TRIGGER firm_support_access_audit_upd
AFTER UPDATE OF granted ON public.firm_support_access
FOR EACH ROW WHEN (NEW.granted IS DISTINCT FROM OLD.granted)
EXECUTE FUNCTION public.firm_support_access_audit();