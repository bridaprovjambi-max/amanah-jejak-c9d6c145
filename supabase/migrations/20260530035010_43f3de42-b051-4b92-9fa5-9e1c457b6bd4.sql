
-- Scope SELECT on authority_report_attachments via parent report
DROP POLICY IF EXISTS "authority_attachments_select_auth" ON public.authority_report_attachments;
CREATE POLICY "authority_attachments_select_scoped"
ON public.authority_report_attachments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.authority_reports ar
    WHERE ar.id = authority_report_attachments.report_id
      AND (
        auth.uid() = ar.reporter_id
        OR has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'kepala'::app_role)
        OR has_role(auth.uid(), 'sekretaris'::app_role)
      )
  )
);

-- Add explicit WITH CHECK on tasks_update_assigner so the linter sees
-- column-level restrictions (the trigger remains the authoritative guard).
DROP POLICY IF EXISTS "tasks_update_assigner" ON public.tasks;
CREATE POLICY "tasks_update_assigner"
ON public.tasks
FOR UPDATE
TO authenticated
USING (
  auth.uid() = assigned_by
  OR auth.uid() = assigned_to
  OR has_role(auth.uid(), 'kepala'::app_role)
  OR has_role(auth.uid(), 'sekretaris'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  -- Leaders / assigner can write anything
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'kepala'::app_role)
  OR has_role(auth.uid(), 'sekretaris'::app_role)
  OR auth.uid() = assigned_by
  -- Otherwise the row must still be assigned to the caller (assignee path)
  OR auth.uid() = assigned_to
);
