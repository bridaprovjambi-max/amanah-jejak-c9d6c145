Saya akan mengerjakan 3 fitur besar secara bertahap. Karena ini cukup luas, saya pecah menjadi langkah konkret berikut:

## 1. Dashboard dengan Metrik Real-Time
- Tambah halaman `/dashboard` (atau perbarui halaman index `_authenticated`) berisi:
  - Kartu ringkasan: total tugas, pending, in_progress, completed, overdue
  - Pie/Donut chart distribusi status tugas (Recharts)
  - Bar chart performa per pokja/jenjang
  - Widget "Tugas Perlu Perhatian" (deadline ≤ 3 hari atau overdue, milik user/pokja)
- Data diambil dari tabel `tasks` + `reports` via Supabase client (sesuai pola yang sudah ada di app)
- Realtime: subscribe perubahan `tasks` untuk refresh otomatis

## 2. Sistem Deadline & Pengingat Otomatis
- Kolom `deadline` sudah ada di `tasks` — pastikan UI form tugas mendukung input tanggal (sudah ada). Tambahkan badge "Overdue" / "H-N" di kartu tugas & detail tugas
- Tambah kolom baru di `tasks`:
  - `reminder_sent_h3 boolean default false`
  - `reminder_sent_h1 boolean default false`
  - `reminder_sent_overdue boolean default false`
- Buat TanStack server route publik `/api/public/hooks/task-reminders` yang:
  - Query tugas dengan deadline mendekati / lewat & status ≠ completed
  - Kirim notifikasi via Telegram (menggunakan TELEGRAM_API_KEY) ke `profiles.telegram_chat_id` pemilik tugas
  - Tandai flag reminder agar tidak dobel
- Schedule via `pg_cron` setiap 1 jam (saya minta approval insert SQL setelah migration disetujui)

## 3. Laporan Berkala & Rekap PDF
- Tambah halaman `/reports/rekap` dengan filter periode (tanggal mulai-selesai), pokja, jenjang, status
- Tombol "Export PDF" memanggil server function `generateRekapPdf` yang:
  - Query tugas+laporan sesuai filter (via `requireSupabaseAuth`)
  - Bangun PDF dengan header BRIDA (judul, periode, tabel rekap, ringkasan)
  - Return base64 PDF, di-trigger download di sisi client
- Gunakan library `pdf-lib` (Worker-compatible) untuk bangun PDF

## Urutan Eksekusi
1. Migrasi DB (kolom reminder flags) — minta approval
2. Setelah disetujui: implement Dashboard, halaman Rekap, server fn PDF, server route reminders
3. Setup pg_cron via insert SQL — minta approval terpisah
4. Tambah link navigasi ke Dashboard & Rekap

## Detail Teknis
- Charts: tetap pakai `recharts` (sudah ada di shadcn template)
- PDF: `bun add pdf-lib`
- Telegram: pakai endpoint sendMessage bot yang sudah terhubung (@BRIDAberkata_bot)
- Tidak mengubah RLS yang ada; query menggunakan policy `select_auth`

Konfirmasi untuk lanjut? Atau ada bagian yang ingin diprioritaskan/diskip dulu (misal pg_cron setup nanti saja)?