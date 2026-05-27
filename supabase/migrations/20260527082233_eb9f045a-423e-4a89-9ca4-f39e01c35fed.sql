
CREATE TABLE public.report_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_report_attachments_report_id ON public.report_attachments(report_id);

GRANT SELECT, INSERT, DELETE ON public.report_attachments TO authenticated;
GRANT ALL ON public.report_attachments TO service_role;

ALTER TABLE public.report_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "report_attachments_select_auth"
ON public.report_attachments FOR SELECT TO authenticated
USING (true);

CREATE POLICY "report_attachments_insert_own"
ON public.report_attachments FOR INSERT TO authenticated
WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "report_attachments_delete_own_or_admin"
ON public.report_attachments FOR DELETE TO authenticated
USING (auth.uid() = uploaded_by OR has_role(auth.uid(), 'admin'::app_role));
