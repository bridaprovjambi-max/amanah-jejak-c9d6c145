# E2E Tests

Skenario uji otomatis untuk alur autentikasi & logout.

## Setup

```bash
bun add -D @playwright/test
bunx playwright install chromium
```

## Menjalankan

Pastikan dev server berjalan (`bun run dev`), lalu:

```bash
BASE_URL=http://localhost:3000 \
TEST_EMAIL=you@example.com \
TEST_PASSWORD=yourpass \
bunx playwright test
```

## File

- `logout.spec.ts` — verifikasi logout dari dashboard, tombol Back browser,
  akses langsung tanpa sesi, dan sesi di-clear manual semuanya redirect
  ke landing (`/`).

## Catatan

Selector di `logout()` dan `login()` pakai role/label fallback.
Jika UI memakai label berbeda, tambahkan `data-testid="user-menu"` pada
trigger menu user dan `data-testid="logout-button"` pada tombol logout
agar test lebih stabil.
