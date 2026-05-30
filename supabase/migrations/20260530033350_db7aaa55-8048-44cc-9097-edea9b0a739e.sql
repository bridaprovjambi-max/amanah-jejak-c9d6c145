-- Tambahkan kolom target_fisik_bulan, target_realisasi_keuangan, dan faktor_pendukung
-- pada tabel pptk_reports agar sesuai format laporan PPTK yang baru

ALTER TABLE public.pptk_reports
  ADD COLUMN IF NOT EXISTS target_fisik_bulan text,
  ADD COLUMN IF NOT EXISTS target_realisasi_keuangan text,
  ADD COLUMN IF NOT EXISTS faktor_pendukung text;

-- Update existing rows: uraian_pelaksanaan -> sub_kegiatan
-- We don't rename the column to keep compatibility, but we update the label in UI