CREATE TABLE public.task_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL,
  uploaded_by UUID NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_task_attachments_task_id ON public.task_attachments(task_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_attachments TO authenticated;
GRANT ALL ON public.task_attachments TO service_role;

ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_attachments_select_auth"
ON public.task_attachments
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "task_attachments_insert_own"
ON public.task_attachments
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "task_attachments_delete_own_or_admin"
ON public.task_attachments
FOR DELETE
TO authenticated
USING ((auth.uid() = uploaded_by) OR has_role(auth.uid(), 'admin'::app_role));