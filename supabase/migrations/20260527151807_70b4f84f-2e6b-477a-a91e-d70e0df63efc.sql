
ALTER TABLE public.tasks
  ADD COLUMN parent_task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE;

CREATE INDEX idx_tasks_parent ON public.tasks(parent_task_id);
