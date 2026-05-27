
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS reminder_sent_h3 boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reminder_sent_h1 boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reminder_sent_overdue boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_tasks_deadline_status ON public.tasks (deadline, status)
  WHERE deadline IS NOT NULL AND status <> 'completed';
