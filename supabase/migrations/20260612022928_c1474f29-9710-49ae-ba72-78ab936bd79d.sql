
-- 1. Unreconciled lines: enforce that non-advisors can only change client_comment
CREATE OR REPLACE FUNCTION public.enforce_unreconciled_line_viewer_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_advisor(auth.uid()) THEN
    RETURN NEW;
  END IF;
  IF NEW.account_name IS DISTINCT FROM OLD.account_name
     OR NEW.account_number IS DISTINCT FROM OLD.account_number
     OR NEW.row_index IS DISTINCT FROM OLD.row_index
     OR NEW.txn_date IS DISTINCT FROM OLD.txn_date
     OR NEW.payee IS DISTINCT FROM OLD.payee
     OR NEW.reference IS DISTINCT FROM OLD.reference
     OR NEW.spent IS DISTINCT FROM OLD.spent
     OR NEW.received IS DISTINCT FROM OLD.received
     OR NEW.tax IS DISTINCT FROM OLD.tax
     OR NEW.source_comment IS DISTINCT FROM OLD.source_comment
     OR NEW.upload_id IS DISTINCT FROM OLD.upload_id
     OR NEW.client_id IS DISTINCT FROM OLD.client_id THEN
    RAISE EXCEPTION 'Viewers can only modify client_comment on unreconciled_lines';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS unreconciled_lines_viewer_column_guard ON public.unreconciled_lines;
CREATE TRIGGER unreconciled_lines_viewer_column_guard
BEFORE UPDATE ON public.unreconciled_lines
FOR EACH ROW EXECUTE FUNCTION public.enforce_unreconciled_line_viewer_columns();

-- 2. client_notes: drop the author-based update/delete policies; advisors-only policy already covers them
DROP POLICY IF EXISTS "Authors update own notes" ON public.client_notes;
DROP POLICY IF EXISTS "Authors delete own notes" ON public.client_notes;

-- 3. Set search_path on email queue helpers
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;
