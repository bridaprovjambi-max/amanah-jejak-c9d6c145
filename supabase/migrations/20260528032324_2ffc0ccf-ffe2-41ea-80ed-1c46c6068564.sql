
CREATE TYPE public.staff_review_category AS ENUM ('perencanaan', 'keuangan', 'kepegawaian');
CREATE TYPE public.staff_review_status AS ENUM ('draft', 'submitted', 'reviewed', 'approved', 'rejected');

CREATE TABLE public.staff_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id UUID NOT NULL,
  recipient_id UUID NOT NULL,
  category public.staff_review_category NOT NULL,
  judul TEXT NOT NULL,
  latar_belakang TEXT NOT NULL,
  maksud_tujuan TEXT NOT NULL,
  permasalahan JSONB NOT NULL DEFAULT '[]'::jsonb,
  analisis_hukum TEXT,
  analisis_sosial TEXT,
  analisis_ekonomi TEXT,
  analisis_teknis TEXT,
  alternatif_pemecahan JSONB NOT NULL DEFAULT '[]'::jsonb,
  kesimpulan TEXT NOT NULL,
  rekomendasi JSONB NOT NULL DEFAULT '[]'::jsonb,
  status public.staff_review_status NOT NULL DEFAULT 'submitted',
  disposisi_notes TEXT,
  disposisi_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_staff_reviews_reporter ON public.staff_reviews(reporter_id);
CREATE INDEX idx_staff_reviews_recipient ON public.staff_reviews(recipient_id);
CREATE INDEX idx_staff_reviews_category ON public.staff_reviews(category);
CREATE INDEX idx_staff_reviews_status ON public.staff_reviews(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_reviews TO authenticated;
GRANT ALL ON public.staff_reviews TO service_role;

ALTER TABLE public.staff_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY staff_reviews_select_auth ON public.staff_reviews
  FOR SELECT TO authenticated USING (true);

CREATE POLICY staff_reviews_insert_own ON public.staff_reviews
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY staff_reviews_update_own_or_recipient ON public.staff_reviews
  FOR UPDATE TO authenticated
  USING (auth.uid() = reporter_id OR auth.uid() = recipient_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY staff_reviews_delete_own_or_admin ON public.staff_reviews
  FOR DELETE TO authenticated
  USING (auth.uid() = reporter_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_staff_reviews_updated_at
  BEFORE UPDATE ON public.staff_reviews
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.staff_review_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  review_id UUID NOT NULL REFERENCES public.staff_reviews(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_staff_review_attachments_review ON public.staff_review_attachments(review_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_review_attachments TO authenticated;
GRANT ALL ON public.staff_review_attachments TO service_role;

ALTER TABLE public.staff_review_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY staff_review_attachments_select_auth ON public.staff_review_attachments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY staff_review_attachments_insert_own ON public.staff_review_attachments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY staff_review_attachments_delete_own ON public.staff_review_attachments
  FOR DELETE TO authenticated
  USING (auth.uid() = uploaded_by OR has_role(auth.uid(), 'admin'::app_role));
