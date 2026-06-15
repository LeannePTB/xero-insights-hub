
CREATE TABLE IF NOT EXISTS public.rate_limit_buckets (
  key text NOT NULL,
  window_start timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window_start)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rate_limit_buckets TO service_role;

ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rate_limit_buckets service only" ON public.rate_limit_buckets
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  _key text,
  _max integer,
  _window_seconds integer
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bucket timestamptz := to_timestamp((extract(epoch from now())::bigint / _window_seconds) * _window_seconds);
  cur integer;
BEGIN
  INSERT INTO public.rate_limit_buckets(key, window_start, count)
  VALUES (_key, bucket, 1)
  ON CONFLICT (key, window_start)
  DO UPDATE SET count = public.rate_limit_buckets.count + 1
  RETURNING count INTO cur;

  DELETE FROM public.rate_limit_buckets WHERE window_start < now() - interval '1 day';

  RETURN cur <= _max;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer) TO service_role;
