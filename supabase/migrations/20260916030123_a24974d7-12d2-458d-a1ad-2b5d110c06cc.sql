ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS setup_ack jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.clients.setup_ack IS
  'Setup checklist acknowledgements: { "<item>": { "at": timestamptz, "by": uuid, "choice": text } }. Display/workflow only — never an access grant. Written through the clients RLS write policies (app_private.user_can_manage_client); no new policy or grant.';