
-- Enums
DO $$ BEGIN
  CREATE TYPE public.client_subscription_type AS ENUM ('paid', 'free_forever', 'trial');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.client_subscription_status AS ENUM ('active', 'trialing', 'past_due', 'cancelled', 'free_forever');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Table
CREATE TABLE public.client_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL UNIQUE REFERENCES public.clients(id) ON DELETE CASCADE,
  stripe_customer_id text,
  stripe_subscription_id text UNIQUE,
  plan_name text,
  subscription_type public.client_subscription_type NOT NULL DEFAULT 'paid',
  status public.client_subscription_status NOT NULL DEFAULT 'trialing',
  current_period_end timestamptz,
  trial_end timestamptz,
  past_due_since timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX client_subscriptions_status_idx ON public.client_subscriptions (status);
CREATE INDEX client_subscriptions_stripe_customer_idx ON public.client_subscriptions (stripe_customer_id);

-- Grants
GRANT SELECT ON public.client_subscriptions TO authenticated;
GRANT ALL ON public.client_subscriptions TO service_role;

-- RLS
ALTER TABLE public.client_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "firm members read client subscriptions"
  ON public.client_subscriptions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = client_subscriptions.client_id
        AND (
          (c.firm_id IS NOT NULL AND app_private.has_firm_access(auth.uid(), c.firm_id))
          OR app_private.has_client_access(auth.uid(), c.id)
        )
    )
  );

CREATE POLICY "super admin manages client subscriptions"
  ON public.client_subscriptions FOR ALL
  TO authenticated
  USING (public.me_is_super_admin())
  WITH CHECK (public.me_is_super_admin());

CREATE TRIGGER client_subscriptions_set_updated_at
  BEFORE UPDATE ON public.client_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
