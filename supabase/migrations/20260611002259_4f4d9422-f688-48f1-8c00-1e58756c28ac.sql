
CREATE TABLE public.client_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX client_notes_client_id_created_at_idx ON public.client_notes(client_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_notes TO authenticated;
GRANT ALL ON public.client_notes TO service_role;

ALTER TABLE public.client_notes ENABLE ROW LEVEL SECURITY;

-- Advisors: full access
CREATE POLICY "Advisors manage all notes"
ON public.client_notes FOR ALL TO authenticated
USING (public.is_advisor(auth.uid()))
WITH CHECK (public.is_advisor(auth.uid()));

-- Clients with access can read notes for their client
CREATE POLICY "Client viewers read notes"
ON public.client_notes FOR SELECT TO authenticated
USING (public.has_client_access(auth.uid(), client_id));

-- Author can update/delete their own notes
CREATE POLICY "Authors update own notes"
ON public.client_notes FOR UPDATE TO authenticated
USING (author_id = auth.uid())
WITH CHECK (author_id = auth.uid());

CREATE POLICY "Authors delete own notes"
ON public.client_notes FOR DELETE TO authenticated
USING (author_id = auth.uid());

CREATE TRIGGER set_client_notes_updated_at
BEFORE UPDATE ON public.client_notes
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
