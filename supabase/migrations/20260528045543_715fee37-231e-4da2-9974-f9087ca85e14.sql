
ALTER TABLE public.staff_reviews
  DROP COLUMN IF EXISTS latar_belakang,
  DROP COLUMN IF EXISTS maksud_tujuan,
  DROP COLUMN IF EXISTS permasalahan,
  DROP COLUMN IF EXISTS analisis_hukum,
  DROP COLUMN IF EXISTS analisis_sosial,
  DROP COLUMN IF EXISTS analisis_ekonomi,
  DROP COLUMN IF EXISTS analisis_teknis,
  DROP COLUMN IF EXISTS alternatif_pemecahan,
  DROP COLUMN IF EXISTS rekomendasi;

ALTER TABLE public.staff_reviews
  ADD COLUMN pokok_persoalan text NOT NULL DEFAULT '',
  ADD COLUMN pra_anggapan text NOT NULL DEFAULT '',
  ADD COLUMN fakta_data text NOT NULL DEFAULT '',
  ADD COLUMN pembahasan text NOT NULL DEFAULT '',
  ADD COLUMN saran jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.staff_reviews
  ALTER COLUMN pokok_persoalan DROP DEFAULT,
  ALTER COLUMN pra_anggapan DROP DEFAULT,
  ALTER COLUMN fakta_data DROP DEFAULT,
  ALTER COLUMN pembahasan DROP DEFAULT;
