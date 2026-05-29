## Tujuan

Refactor + polish DeLapan agar:
1. **Lebih cepat** dimuat (terutama di Android / koneksi lambat)
2. **Konsisten** secara visual antar halaman
3. **Nyaman** dipakai di layar 360px
4. **Aksesibel** (label, focus, kontras, tap target)

Pekerjaan dipecah jadi **5 batch** agar tiap perubahan mudah diverifikasi dan tidak menumpuk risiko regresi. Setelah tiap batch saya akan jeda agar Anda bisa cek hasilnya sebelum lanjut.

---

## Batch 1 — Pondasi performa (low risk, dampak besar)

1. **Preload navigasi**: aktifkan `defaultPreload: "intent"` di `src/router.tsx` agar route ter-prefetch saat di-hover/tap. Murah, langsung terasa.
2. **Service worker bersih**:
   - Hapus `/dashboard` dari `SHELL` (route terproteksi tidak boleh di-cache sebagai shell).
   - Tambahkan versioning + skip cache untuk request dengan header `Authorization`.
   - Tambahkan `?v=` saat register di `PWAManager` agar update SW tidak macet.
3. **Lazy-load berat**: route besar (`telaah-staf`, `documents`, `dashboard`, `kinerja`, `tasks.$taskId`) — gunakan pola `.lazy.tsx` hanya untuk yang >500 baris agar bundle awal turun.
4. **Font**: hapus duplikasi import font (`Plus Jakarta Sans` di `__root.tsx` tidak dipakai — design system pakai Instrument Serif + Outfit + Work Sans).
5. **Query limit awareness**: tambahkan `.limit()` eksplisit di list query yang berpotensi >1000 baris (tasks, documents, activity).

## Batch 2 — Mobile Android (360px) & tap target

1. **AppShell mobile**:
   - Drawer animasi slide-in halus, tutup dengan swipe / ESC.
   - Header mobile: tinggi konsisten 56px, tombol min 44×44.
   - Tambahkan `safe-area-inset` untuk perangkat dengan notch.
2. **Tipografi responsif**: heading `Instrument Serif` di mobile diturunkan (clamp), agar tidak overflow horizontal di 360px.
3. **Tabel → kartu**: di `users`, `activity`, `tasks.index` — di bawah `sm` ganti tabel jadi list kartu (sudah pola umum, beberapa halaman masih horizontal scroll).
4. **Form**: input min-height 44px, label di atas (stack) pada mobile.
5. **Padding container**: standarkan `px-4 lg:px-10` (sudah ada di AppShell) — audit halaman yang menambahkan padding ganda.

## Batch 3 — Konsistensi desain

1. **Page header pattern**: buat komponen `PageHeader` (judul + deskripsi + actions) — ganti semua halaman yang menulis pola ini manual (kira-kira 12 file).
2. **Empty state**: komponen `EmptyState` reusable (icon + judul + deskripsi + CTA). Saat ini tiap halaman bikin sendiri.
3. **Loading state**: skeleton konsisten via komponen `PageSkeleton` (saat ini campur spinner + "Loading…").
4. **Card style**: standarkan ke kelas `card-elegant` yang sudah ada di `styles.css` — beberapa halaman pakai `bg-card border` manual.
5. **StatusBadge**: perluas pakai di semua status (task, review, document) — saat ini ada warna ad-hoc.

## Batch 4 — Aksesibilitas

1. **Tombol icon-only**: audit semua `<Button size="icon">` tanpa `aria-label` (sudah dimulai di telaah-staf, lanjutkan ke seluruh app).
2. **Focus ring**: pastikan semua interaktif punya `focus-visible:ring`. Tambahkan token global di `styles.css`.
3. **Form**: setiap `Input`/`Textarea`/`Select` punya `<Label htmlFor>` atau `aria-label`.
4. **Skip-link**: tambahkan "Lompat ke konten" di AppShell untuk keyboard user.
5. **Landmark**: pastikan tepat satu `<main>` per halaman (sudah ada di AppShell — verifikasi tidak ada duplikat).
6. **Kontras**: ganti `text-muted-foreground/50` atau warna gray-* manual ke token.

## Batch 5 — Polish halaman publik

1. **Landing (`index.tsx`)**: optimasi LCP — preload hero image, lazy-load `PublicStatsSection`.
2. **Login / signup**: tambahkan loading state, error handling lebih ramah, autofocus field pertama (di modal/form saja).
3. **Meta SEO**: lengkapi `head()` per route (title unik, description, og:title/description).

---

## Detail teknis untuk pengembang

- **Code-splitting**: pakai `*.lazy.tsx` companion file dengan `createLazyFileRoute` + `getRouteApi` (jangan import Route dari file kritikal).
- **Service worker**: bump `CACHE = "delapan-v2"`, tambahkan filter `req.headers.get("authorization")` skip cache.
- **Preload**: `defaultPreload: "intent"` + `defaultPreloadDelay: 50`. TanStack Query tetap pegang freshness karena `defaultPreloadStaleTime: 0` sudah ada.
- **PageHeader, EmptyState, PageSkeleton**: komponen baru di `src/components/ui/` atau `src/components/`.
- **Tipografi responsif**: utility `text-display-lg`, `text-display-md` dengan `clamp()` di `styles.css`.
- **Tabel responsif**: gunakan pattern `hidden sm:table` + `sm:hidden` list kartu (sudah ada di beberapa file, dijadikan helper).

---

## Yang TIDAK saya ubah

- Skema database & RLS (sudah cukup baik berdasarkan struktur saat ini).
- Auth flow & business logic.
- Warna brand & palette (Navy Trust tetap).
- Struktur route URL (tidak ada rename yang merusak bookmark).

---

## Cara saya bekerja

- Setelah tiap batch saya akan **berhenti dan lapor**, sertakan ringkasan file yang berubah + apa yang perlu Anda cek.
- Jika ada perubahan yang berisiko (mis. ubah service worker), saya jelaskan cara hard-refresh.
- Jika di tengah jalan Anda mau prioritaskan halaman tertentu, tinggal bilang dan saya skip yang lain.

**Setujui rencana ini untuk mulai dari Batch 1**, atau beri tahu kalau ada batch yang ingin di-skip / urutannya diubah.