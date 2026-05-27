-- Update folder display names to match new UI branding
UPDATE public.document_folders
SET name = 'Kelompok Kerja'
WHERE name = 'Pokja Riset';

UPDATE public.document_folders
SET name = 'Kelompok Kerja Inovasi'
WHERE name = 'Pokja Inovasi';