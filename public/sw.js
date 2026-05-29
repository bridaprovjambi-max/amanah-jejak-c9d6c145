// DeLapan service worker — offline shell + runtime cache
const CACHE = "delapan-v2";
// Only cache truly public resources. Protected routes (/dashboard, etc.) must
// never be in the shell because they require auth and leak across users.
const SHELL = ["/", "/manifest.webmanifest", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => undefined),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  // Never cache anything with credentials/auth headers
  if (req.headers.get("authorization")) return;

  const url = new URL(req.url);

  // Never cache Supabase / API / auth / server fns — always go to network
  if (
    url.hostname.includes("supabase.co") ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/_serverFn") ||
    url.pathname.startsWith("/auth/")
  ) {
    return;
  }

  // Navigations: network-first, fall back to cached shell ("/")
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // Only cache successful, basic-type responses for the landing shell
          if (res.ok && url.pathname === "/") {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => undefined);
          }
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match("/")))
    );
    return;
  }

  // Static assets: stale-while-revalidate
  if (
    url.origin === self.location.origin &&
    /\.(?:js|css|png|jpg|jpeg|svg|webp|woff2?|ico|webmanifest)$/.test(url.pathname)
  ) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const fetchPromise = fetch(req)
          .then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => undefined);
            }
            return res;
          })
          .catch(() => cached);
        return cached || fetchPromise;
      })
    );
  }
});
