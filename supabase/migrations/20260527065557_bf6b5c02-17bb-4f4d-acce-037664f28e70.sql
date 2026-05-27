ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS ai_summary text,
  ADD COLUMN IF NOT EXISTS ai_key_points jsonb,
  ADD COLUMN IF NOT EXISTS ai_entities jsonb,
  ADD COLUMN IF NOT EXISTS ai_status text NOT NULL DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS ai_error text,
  ADD COLUMN IF NOT EXISTS ai_analyzed_at timestamptz;