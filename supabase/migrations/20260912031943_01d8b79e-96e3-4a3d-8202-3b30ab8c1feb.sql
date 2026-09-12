ALTER TABLE public.email_unsubscribe_tokens ADD COLUMN IF NOT EXISTS token_hash text;

UPDATE public.email_unsubscribe_tokens
SET token_hash = encode(digest(token, 'sha256'), 'hex')
WHERE token_hash IS NULL;

ALTER TABLE public.email_unsubscribe_tokens ALTER COLUMN token_hash SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS email_unsubscribe_tokens_token_hash_key
  ON public.email_unsubscribe_tokens (token_hash);

ALTER TABLE public.email_unsubscribe_tokens DROP COLUMN token;