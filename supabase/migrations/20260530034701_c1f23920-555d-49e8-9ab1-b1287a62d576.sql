
-- 1. Prevent assignees from changing task ownership fields
CREATE OR REPLACE FUNCTION public.prevent_task_metadata_tampering()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF has_role(auth.uid(), 'admin'::app_role)
     OR has_role(auth.uid(), 'kepala'::app_role)
     OR has_role(auth.uid(), 'sekretaris'::app_role)
     OR auth.uid() = OLD.assigned_by THEN
    RETURN NEW;
  END IF;

  IF NEW.assigned_by IS DISTINCT FROM OLD.assigned_by THEN
    RAISE EXCEPTION 'Not allowed to change assigned_by';
  END IF;
  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
    RAISE EXCEPTION 'Not allowed to change assigned_to';
  END IF;
  IF NEW.assigned_to_pokja IS DISTINCT FROM OLD.assigned_to_pokja THEN
    RAISE EXCEPTION 'Not allowed to change assigned_to_pokja';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.prevent_task_metadata_tampering() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_prevent_task_metadata_tampering ON public.tasks;
CREATE TRIGGER trg_prevent_task_metadata_tampering
BEFORE UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.prevent_task_metadata_tampering();

-- 2. Scope SELECT on staff_reviews
DROP POLICY IF EXISTS "staff_reviews_select_auth" ON public.staff_reviews;
CREATE POLICY "staff_reviews_select_scoped"
ON public.staff_reviews
FOR SELECT
TO authenticated
USING (
  auth.uid() = reporter_id
  OR auth.uid() = recipient_id
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'kepala'::app_role)
  OR has_role(auth.uid(), 'sekretaris'::app_role)
);

-- 3. Scope SELECT on staff_review_history via parent review
DROP POLICY IF EXISTS "staff_review_history_select_auth" ON public.staff_review_history;
CREATE POLICY "staff_review_history_select_scoped"
ON public.staff_review_history
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.staff_reviews sr
    WHERE sr.id = staff_review_history.review_id
      AND (
        auth.uid() = sr.reporter_id
        OR auth.uid() = sr.recipient_id
        OR has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'kepala'::app_role)
        OR has_role(auth.uid(), 'sekretaris'::app_role)
      )
  )
);

-- 4. Scope SELECT on staff_review_attachments via parent review
DROP POLICY IF EXISTS "staff_review_attachments_select_auth" ON public.staff_review_attachments;
CREATE POLICY "staff_review_attachments_select_scoped"
ON public.staff_review_attachments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.staff_reviews sr
    WHERE sr.id = staff_review_attachments.review_id
      AND (
        auth.uid() = sr.reporter_id
        OR auth.uid() = sr.recipient_id
        OR has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'kepala'::app_role)
        OR has_role(auth.uid(), 'sekretaris'::app_role)
      )
  )
);

-- 5. Scope SELECT on pptk_reports
DROP POLICY IF EXISTS "pptk_reports_select_auth" ON public.pptk_reports;
CREATE POLICY "pptk_reports_select_scoped"
ON public.pptk_reports
FOR SELECT
TO authenticated
USING (
  auth.uid() = reporter_id
  OR auth.uid() = sekretaris_id
  OR auth.uid() = kepala_id
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'kepala'::app_role)
  OR has_role(auth.uid(), 'sekretaris'::app_role)
);

-- 6. Scope SELECT on authority_reports
DROP POLICY IF EXISTS "authority_reports_select_auth" ON public.authority_reports;
CREATE POLICY "authority_reports_select_scoped"
ON public.authority_reports
FOR SELECT
TO authenticated
USING (
  auth.uid() = reporter_id
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'kepala'::app_role)
  OR has_role(auth.uid(), 'sekretaris'::app_role)
);
