ALTER TABLE public.xero_connections
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'connected',
  ADD COLUMN IF NOT EXISTS disconnected_at timestamptz;