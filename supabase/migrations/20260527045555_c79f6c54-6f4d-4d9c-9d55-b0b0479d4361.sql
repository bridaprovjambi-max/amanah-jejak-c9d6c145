ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS folder text NOT NULL DEFAULT 'Umum';
CREATE INDEX IF NOT EXISTS idx_documents_folder ON public.documents(folder);