
-- Tabel laporan pelaksanaan wewenang per jenjang
CREATE TABLE public.authority_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id UUID NOT NULL,
  jenjang public.jenjang NOT NULL,
  period_year INTEGER NOT NULL,
  period_month INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  authority_description TEXT NOT NULL,
  execution_summary TEXT NOT NULL,
  obstacles TEXT,
  follow_up_notes TEXT,
  status TEXT NOT NULL DEFAULT 'submitted',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_authority_reports_reporter ON public.authority_reports(reporter_id);
CREATE INDEX idx_authority_reports_period ON public.authority_reports(period_year, period_month);
CREATE INDEX idx_authority_reports_jenjang ON public.authority_reports(jenjang);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.authority_reports TO authenticated;
GRANT ALL ON public.authority_reports TO service_role;

ALTER TABLE public.authority_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY authority_reports_select_auth ON public.authority_reports
  FOR SELECT TO authenticated USING (true);

CREATE POLICY authority_reports_insert_own ON public.authority_reports
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY authority_reports_update_own ON public.authority_reports
  FOR UPDATE TO authenticated
  USING (auth.uid() = reporter_id OR has_role(auth.uid(), 'kepala'::app_role) OR has_role(auth.uid(), 'sekretaris'::app_role));

CREATE POLICY authority_reports_delete_own ON public.authority_reports
  FOR DELETE TO authenticated
  USING (auth.uid() = reporter_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_authority_reports_updated_at
  BEFORE UPDATE ON public.authority_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Tabel lampiran bukti
CREATE TABLE public.authority_report_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES public.authority_reports(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_authority_report_attachments_report ON public.authority_report_attachments(report_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.authority_report_attachments TO authenticated;
GRANT ALL ON public.authority_report_attachments TO service_role;

ALTER TABLE public.authority_report_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY authority_attachments_select_auth ON public.authority_report_attachments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY authority_attachments_insert_own ON public.authority_report_attachments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY authority_attachments_delete_own ON public.authority_report_attachments
  FOR DELETE TO authenticated
  USING (auth.uid() = uploaded_by OR has_role(auth.uid(), 'admin'::app_role));
