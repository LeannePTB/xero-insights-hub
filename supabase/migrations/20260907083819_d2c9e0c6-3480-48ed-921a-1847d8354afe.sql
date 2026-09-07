CREATE TYPE public.gst_cycle AS ENUM ('monthly', 'quarterly', 'annual', 'not_registered');
CREATE TYPE public.payg_withholding_cycle AS ENUM ('monthly', 'quarterly', 'not_registered');

ALTER TABLE public.clients
  ADD COLUMN gst_cycle public.gst_cycle,
  ADD COLUMN payg_withholding_cycle public.payg_withholding_cycle;

COMMENT ON COLUMN public.clients.gst_cycle IS 'ATO GST lodgement cycle, set by the preparer. NULL = not set yet; never inferred from Xero.';
COMMENT ON COLUMN public.clients.payg_withholding_cycle IS 'ATO PAYG withholding cycle, set by the preparer. Not available from Xero. NULL = not set yet.';