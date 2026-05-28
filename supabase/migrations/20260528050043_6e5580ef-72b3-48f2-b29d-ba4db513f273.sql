
CREATE TABLE public.staff_review_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.staff_reviews(id) ON DELETE CASCADE,
  changed_by uuid,
  from_status staff_review_status,
  to_status staff_review_status NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_staff_review_history_review_id ON public.staff_review_history(review_id, created_at DESC);

GRANT SELECT ON public.staff_review_history TO authenticated;
GRANT ALL ON public.staff_review_history TO service_role;

ALTER TABLE public.staff_review_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY staff_review_history_select_auth
  ON public.staff_review_history FOR SELECT
  TO authenticated
  USING (true);

CREATE OR REPLACE FUNCTION public.log_staff_review_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.staff_review_history (review_id, changed_by, from_status, to_status, notes)
    VALUES (NEW.id, NEW.reporter_id, NULL, NEW.status, NULL);
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status
     OR (NEW.disposisi_notes IS DISTINCT FROM OLD.disposisi_notes AND NEW.disposisi_notes IS NOT NULL) THEN
    INSERT INTO public.staff_review_history (review_id, changed_by, from_status, to_status, notes)
    VALUES (NEW.id, auth.uid(), OLD.status, NEW.status, NEW.disposisi_notes);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_staff_review_history
AFTER INSERT OR UPDATE ON public.staff_reviews
FOR EACH ROW EXECUTE FUNCTION public.log_staff_review_status_change();
