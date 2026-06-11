CREATE TABLE public.unreconciled_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  filename text NOT NULL,
  line_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX unreconciled_uploads_client_idx ON public.unreconciled_uploads(client_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.unreconciled_uploads TO authenticated;
GRANT ALL ON public.unreconciled_uploads TO service_role;

ALTER TABLE public.unreconciled_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Advisors manage all uploads"
ON public.unreconciled_uploads FOR ALL
TO authenticated
USING (public.is_advisor(auth.uid()))
WITH CHECK (public.is_advisor(auth.uid()));

CREATE POLICY "Viewers can read uploads for their client"
ON public.unreconciled_uploads FOR SELECT
TO authenticated
USING (public.has_client_access(auth.uid(), client_id));

CREATE TABLE public.unreconciled_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id uuid NOT NULL REFERENCES public.unreconciled_uploads(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  account_name text NOT NULL,
  account_number text,
  row_index integer NOT NULL DEFAULT 0,
  txn_date date,
  payee text,
  reference text,
  spent numeric(14,2),
  received numeric(14,2),
  tax text,
  source_comment text,
  client_comment text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX unreconciled_lines_upload_idx ON public.unreconciled_lines(upload_id, row_index);
CREATE INDEX unreconciled_lines_client_idx ON public.unreconciled_lines(client_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.unreconciled_lines TO authenticated;
GRANT ALL ON public.unreconciled_lines TO service_role;

ALTER TABLE public.unreconciled_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Advisors manage all lines"
ON public.unreconciled_lines FOR ALL
TO authenticated
USING (public.is_advisor(auth.uid()))
WITH CHECK (public.is_advisor(auth.uid()));

CREATE POLICY "Viewers can read lines for their client"
ON public.unreconciled_lines FOR SELECT
TO authenticated
USING (public.has_client_access(auth.uid(), client_id));

CREATE POLICY "Viewers can update comments for their client"
ON public.unreconciled_lines FOR UPDATE
TO authenticated
USING (public.has_client_access(auth.uid(), client_id))
WITH CHECK (public.has_client_access(auth.uid(), client_id));

CREATE TRIGGER unreconciled_lines_set_updated_at
BEFORE UPDATE ON public.unreconciled_lines
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();