
-- documents table
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT,
  uploaded_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "documents_select_auth" ON public.documents
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "documents_insert_own" ON public.documents
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "documents_delete_own_or_leader" ON public.documents
  FOR DELETE TO authenticated USING (
    auth.uid() = uploaded_by
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'kepala'::public.app_role)
    OR public.has_role(auth.uid(), 'sekretaris'::public.app_role)
  );

CREATE INDEX idx_documents_created_at ON public.documents (created_at DESC);

-- storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "documents_storage_select" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'documents');

CREATE POLICY "documents_storage_insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "documents_storage_delete" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'documents' AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'kepala'::public.app_role)
      OR public.has_role(auth.uid(), 'sekretaris'::public.app_role)
    )
  );
