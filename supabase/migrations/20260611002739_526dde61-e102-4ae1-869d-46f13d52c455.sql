
-- Per-user card ordering for a client dashboard
CREATE TABLE public.dashboard_card_order (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  "order" TEXT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, client_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dashboard_card_order TO authenticated;
GRANT ALL ON public.dashboard_card_order TO service_role;

ALTER TABLE public.dashboard_card_order ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own card order"
ON public.dashboard_card_order FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE TRIGGER set_dashboard_card_order_updated_at
BEFORE UPDATE ON public.dashboard_card_order
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Login activity log
CREATE TABLE public.login_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT,
  ip TEXT,
  user_agent TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX login_events_occurred_at_idx ON public.login_events (occurred_at DESC);
CREATE INDEX login_events_user_id_idx ON public.login_events (user_id);

GRANT SELECT, INSERT ON public.login_events TO authenticated;
GRANT ALL ON public.login_events TO service_role;

ALTER TABLE public.login_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert their own login event"
ON public.login_events FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Advisors view all login events"
ON public.login_events FOR SELECT TO authenticated
USING (public.is_advisor(auth.uid()));
