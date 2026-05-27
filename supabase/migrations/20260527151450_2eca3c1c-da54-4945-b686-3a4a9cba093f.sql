
-- Comments table
CREATE TABLE public.task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL,
  author_id uuid NOT NULL,
  content text NOT NULL,
  mentioned_user_ids uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_comments TO authenticated;
GRANT ALL ON public.task_comments TO service_role;

ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY task_comments_select_auth ON public.task_comments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY task_comments_insert_own ON public.task_comments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY task_comments_update_own ON public.task_comments
  FOR UPDATE TO authenticated USING (auth.uid() = author_id);
CREATE POLICY task_comments_delete_own_or_admin ON public.task_comments
  FOR DELETE TO authenticated USING (auth.uid() = author_id OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER trg_task_comments_updated_at
  BEFORE UPDATE ON public.task_comments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_task_comments_task ON public.task_comments(task_id, created_at);

-- Status history
CREATE TABLE public.task_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL,
  changed_by uuid,
  from_status public.task_status,
  to_status public.task_status NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.task_status_history TO authenticated;
GRANT ALL ON public.task_status_history TO service_role;

ALTER TABLE public.task_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY task_status_history_select_auth ON public.task_status_history
  FOR SELECT TO authenticated USING (true);

CREATE INDEX idx_task_status_history_task ON public.task_status_history(task_id, created_at);

-- Trigger to log task status changes
CREATE OR REPLACE FUNCTION public.log_task_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.task_status_history (task_id, changed_by, from_status, to_status)
    VALUES (NEW.id, NEW.assigned_by, NULL, NEW.status);
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.task_status_history (task_id, changed_by, from_status, to_status)
    VALUES (NEW.id, auth.uid(), OLD.status, NEW.status);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_tasks_log_status
  AFTER INSERT OR UPDATE OF status ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.log_task_status_change();
