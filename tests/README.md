# E2E Tests (Playwright)

Tes responsif filter bar untuk halaman **Penugasan**, **PPTK**, **Wewenang**, dan **Telaah Staf** pada lebar viewport 360 (mobile), 768 (tablet), dan 1280 (desktop).

## Setup

1. Salin `.env.example` ke `.env` dan isi kredensial user test:
   ```
   PLAYWRIGHT_TEST_EMAIL=test@brida.jambi.go.id
   PLAYWRIGHT_TEST_PASSWORD=••••••••
   ```
   User ini sebaiknya akun khusus testing dengan email sudah terkonfirmasi.

2. (Sekali saja) Browser Chromium sudah terpasang oleh setup. Jika perlu ulang:
   ```
   bunx playwright install chromium
   ```

## Menjalankan

```
bun run test:e2e               # semua viewport
bun run test:e2e:mobile        # 360px saja
bun run test:e2e:tablet        # 768px saja
bun run test:e2e:desktop       # 1280px saja
bun run test:e2e:ui            # mode UI interaktif
```

Default Playwright akan menjalankan `bun run dev` sendiri. Jika dev server
sudah jalan di port lain, set `PLAYWRIGHT_BASE_URL=http://localhost:XXXX`.

## Yang diuji

Untuk setiap halaman × viewport:

- Tidak ada horizontal scroll pada body.
- Search input terlihat penuh, tidak terpotong di kanan/kiri viewport.
- Semua Select trigger terlihat dan masih di dalam viewport.
- Container filter bar (`shadow-card-elegant`) tidak overflow horizontal.
