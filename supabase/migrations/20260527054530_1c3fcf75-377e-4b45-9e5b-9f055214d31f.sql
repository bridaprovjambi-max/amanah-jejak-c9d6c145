CREATE TABLE public.document_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  hint text,
  sort_order integer NOT NULL DEFAULT 0,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_folders TO authenticated;
GRANT ALL ON public.document_folders TO service_role;

ALTER TABLE public.document_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "folders_select_auth" ON public.document_folders
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "folders_manage_leaders" ON public.document_folders
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'kepala'::app_role) OR has_role(auth.uid(),'sekretaris'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'kepala'::app_role) OR has_role(auth.uid(),'sekretaris'::app_role));

CREATE TRIGGER document_folders_set_updated_at
  BEFORE UPDATE ON public.document_folders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.document_folders (slug, name, hint, sort_order, is_system) VALUES
  ('Kepala','Kepala','Dokumen pimpinan & kebijakan strategis',1,true),
  ('Sekretaris','Sekretaris','Administrasi & koordinasi kesekretariatan',2,true),
  ('Kasubbag','Kasubbag','Dokumen sub-bagian & operasional',3,true),
  ('Pokja Riset','Pokja Riset','Materi & laporan kelompok kerja riset',4,true),
  ('Pokja Inovasi','Pokja Inovasi','Materi & laporan kelompok kerja inovasi',5,true),
  ('Jafung','Jafung','Dokumen jabatan fungsional',6,true),
  ('Staf','Staf','Dokumen staf pelaksana',7,true),
  ('Umum','Umum','Dokumen umum lintas tim',8,true);