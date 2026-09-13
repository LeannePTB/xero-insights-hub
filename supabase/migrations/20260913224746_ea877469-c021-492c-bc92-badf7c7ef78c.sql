ALTER TABLE public.email_unsubscribe_tokens
  DROP CONSTRAINT IF EXISTS email_unsubscribe_tokens_email_key;
CREATE INDEX IF NOT EXISTS email_unsubscribe_tokens_email_idx
  ON public.email_unsubscribe_tokens (email);