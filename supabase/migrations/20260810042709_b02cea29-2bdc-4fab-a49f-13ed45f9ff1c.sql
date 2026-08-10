-- 1. Plan level catalogue
CREATE TABLE public.plan_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL CHECK (scope IN ('firm','dashboard')),
  key text NOT NULL,
  label text NOT NULL,
  description text NOT NULL DEFAULT '',
  client_limit integer NOT NULL DEFAULT 5,
  xero_org_limit integer NOT NULL DEFAULT 1,
  allows_multi_org boolean NOT NULL DEFAULT false,
  widgets text[] NOT NULL DEFAULT '{}',
  sort_order integer NOT NULL DEFAULT 100,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scope, key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.plan_levels TO authenticated;
GRANT ALL ON public.plan_levels TO service_role;

ALTER TABLE public.plan_levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plan_levels_read" ON public.plan_levels
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "plan_levels_write" ON public.plan_levels
  FOR ALL TO authenticated
  USING (public.me_is_super_admin())
  WITH CHECK (public.me_is_super_admin());

CREATE TRIGGER plan_levels_set_updated_at
  BEFORE UPDATE ON public.plan_levels
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- 2. Seed current levels
INSERT INTO public.plan_levels (scope, key, label, description, client_limit, xero_org_limit, allows_multi_org, sort_order) VALUES
  ('firm','starter','Starter','Up to 5 client subscriptions.',5,1,false,10),
  ('firm','growth','Growth','Up to 10 client subscriptions.',10,1,false,20),
  ('firm','scale','Scale','Up to 20 client subscriptions.',20,1,false,30),
  ('firm','firm','Firm','Up to 50 client subscriptions.',50,1,false,40),
  ('firm','free','Free forever','No charge, unlimited clients.',9999,1,false,50),
  ('firm','legacy','Legacy','Pre-billing organisation, unlimited clients.',9999,1,false,60);

INSERT INTO public.plan_levels (scope, key, label, description, client_limit, xero_org_limit, allows_multi_org, widgets, sort_order) VALUES
  ('dashboard','basic','Standard','Health, receivables, payables, P&L and unreconciled transactions.',0,1,false,
    ARRAY['health','receivables','payables','pnl','unreconciled'],10),
  ('dashboard','advisory','Advisory','Everything in Standard plus tax, super and break-even analysis.',0,1,false,
    ARRAY['health','receivables','payables','pnl','unreconciled','tax_liability','superannuation','accounting_breakeven','true_breakeven','cashflow','xero_audit','loan_consolidation'],20),
  ('dashboard','investigate','Investigate the Numbers','Full advisory view across one Xero organisation.',0,1,false,
    ARRAY['health','receivables','payables','pnl','unreconciled','tax_liability','superannuation','accounting_breakeven','true_breakeven','cashflow','xero_audit','loan_consolidation'],30),
  ('dashboard','multi_company','Multi company','Full dashboard across the number of Xero organisations allowed for this subscription.',0,5,true,
    ARRAY['health','receivables','payables','pnl','unreconciled','tax_liability','superannuation','accounting_breakeven','true_breakeven','cashflow','xero_audit','loan_consolidation'],40);

-- 3. Convert enum columns to text keys
DROP VIEW IF EXISTS public.admin_firm_overview;

ALTER TABLE public.subscriptions ALTER COLUMN tier DROP DEFAULT;
ALTER TABLE public.subscriptions ALTER COLUMN tier TYPE text USING tier::text;
ALTER TABLE public.subscriptions ALTER COLUMN tier SET DEFAULT 'starter';

ALTER TABLE public.client_access ALTER COLUMN tier DROP DEFAULT;
ALTER TABLE public.client_access ALTER COLUMN tier TYPE text USING tier::text;
ALTER TABLE public.client_access ALTER COLUMN tier SET DEFAULT 'basic';

ALTER TABLE public.tier_settings ALTER COLUMN tier TYPE text USING tier::text;
ALTER TABLE public.tier_widget_config ALTER COLUMN tier TYPE text USING tier::text;

CREATE VIEW public.admin_firm_overview AS
  SELECT f.id AS firm_id,
     f.name AS firm_name,
     f.is_always_free,
     f.created_at AS firm_created_at,
     s.tier,
     s.status,
     s.trial_ends_at,
     s.current_period_end,
     s.cancel_at_period_end,
     COALESCE(xc.connection_count, 0) AS connection_count,
     COALESCE(be.recent_error_count, 0) AS recent_error_count
    FROM public.firms f
      LEFT JOIN public.subscriptions s ON s.firm_id = f.id
      LEFT JOIN LATERAL ( SELECT count(*)::integer AS connection_count
            FROM public.xero_connections xc_1
           WHERE xc_1.firm_id = f.id) xc ON true
      LEFT JOIN LATERAL ( SELECT count(*)::integer AS recent_error_count
            FROM public.billing_events be_1
           WHERE be_1.firm_id = f.id AND be_1.type LIKE '%failed%' AND be_1.occurred_at > (now() - '30 days'::interval)) be ON true;

GRANT SELECT ON public.admin_firm_overview TO authenticated;
GRANT ALL ON public.admin_firm_overview TO service_role;

-- 4. Super-admin client limit override
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS client_limit_override integer;

-- 5. Xero file allowance no longer gated by the multi_company tier
CREATE OR REPLACE FUNCTION public.enforce_client_max_xero_orgs()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_used integer;
BEGIN
  IF NEW.max_xero_orgs < 1 THEN
    RAISE EXCEPTION 'Xero file allowance must be at least 1';
  END IF;

  SELECT count(*)::integer INTO v_used
  FROM public.client_xero_orgs cxo
  WHERE cxo.client_id = NEW.id;

  IF NEW.max_xero_orgs < v_used THEN
    RAISE EXCEPTION 'Unlink Xero files before reducing the allowance below %', v_used;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.enforce_client_xero_org_allowance()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_limit integer;
  v_used integer;
BEGIN
  SELECT c.max_xero_orgs INTO v_limit FROM public.clients c WHERE c.id = NEW.client_id;
  IF v_limit IS NULL THEN
    RAISE EXCEPTION 'Client subscription not found';
  END IF;

  SELECT count(*)::integer INTO v_used
  FROM public.client_xero_orgs cxo
  WHERE cxo.client_id = NEW.client_id
    AND (TG_OP <> 'UPDATE' OR cxo.id <> NEW.id);

  IF v_used >= v_limit THEN
    RAISE EXCEPTION 'This client subscription has reached its Xero file allowance of %', v_limit;
  END IF;

  RETURN NEW;
END;
$function$;