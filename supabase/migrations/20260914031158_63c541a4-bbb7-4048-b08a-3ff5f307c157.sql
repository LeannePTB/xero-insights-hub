ALTER TABLE public.client_reports
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS video_heading text,
  ADD COLUMN IF NOT EXISTS video_message text,
  ADD COLUMN IF NOT EXISTS video_set_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS video_set_at timestamptz;

COMMENT ON COLUMN public.client_reports.video_url IS 'Optional Loom share/embed URL for a personal message. Outside the frozen payload, so it never reaches the rendered PDF. Set only by a platform super admin who also has write access to the organisation, and only while the report is a draft.';