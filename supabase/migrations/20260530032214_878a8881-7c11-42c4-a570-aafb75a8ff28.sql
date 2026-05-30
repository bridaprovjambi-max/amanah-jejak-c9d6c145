-- 1) Add PPTK flag to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_pptk boolean NOT NULL DEFAULT false;

-- 2) PPTK reports table (workflow: submitted -> reviewed -> approved/rejected)
CREATE TABLE public.pptk_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id uuid NOT NULL,
  period_year integer NOT NULL,
  period_month integer NOT NULL,
  kegiatan text NOT NULL,
  uraian_pelaksanaan text NOT NULL,
  realisasi_fisik text,
  realisasi_keuangan text,
  kendala text,
  tindak_lanjut text,
  status text NOT NULL DEFAULT 'submitted',
  sekretaris_id uuid,
  sekretaris_notes text,
  sekretaris_at timestamp with time zone,
  kepala_id uuid,
  kepala_notes text,
  kepala_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pptk_reports TO authenticated;
GRANT ALL ON public.pptk_reports TO service_role;

ALTER TABLE public.pptk_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY pptk_reports_select_auth ON public.pptk_reports
  FOR SELECT TO authenticated USING (true);

CREATE POLICY pptk_reports_insert_own ON public.pptk_reports
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY pptk_reports_update_workflow ON public.pptk_reports
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = reporter_id
    OR public.has_role(auth.uid(), 'sekretaris'::public.app_role)
    OR public.has_role(auth.uid(), 'kepala'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

CREATE POLICY pptk_reports_delete_own_or_admin ON public.pptk_reports
  FOR DELETE TO authenticated
  USING (auth.uid() = reporter_id OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER pptk_reports_set_updated_at
  BEFORE UPDATE ON public.pptk_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) PPTK report attachments
CREATE TABLE public.pptk_report_attachments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id uuid NOT NULL REFERENCES public.pptk_reports(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL,
  file_path text NOT NULL,
  file_name text NOT NULL,
  file_size bigint NOT NULL,
  mime_type text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pptk_report_attachments TO authenticated;
GRANT ALL ON public.pptk_report_attachments TO service_role;

ALTER TABLE public.pptk_report_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY pptk_attachments_select_auth ON public.pptk_report_attachments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY pptk_attachments_insert_own ON public.pptk_report_attachments
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY pptk_attachments_delete_own_or_admin ON public.pptk_report_attachments
  FOR DELETE TO authenticated
  USING (auth.uid() = uploaded_by OR public.has_role(auth.uid(), 'admin'::public.app_role));

-- 4) Update handle_new_user to include is_pptk metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, jabatan, nip, pangkat_golongan, jenjang, is_pptk)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'jabatan',
    NEW.raw_user_meta_data->>'nip',
    NEW.raw_user_meta_data->>'pangkat_golongan',
    'pokja'::public.jenjang,
    COALESCE((NEW.raw_user_meta_data->>'is_pptk')::boolean, false)
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'pokja_member'::public.app_role);

  RETURN NEW;
END;
$function$;