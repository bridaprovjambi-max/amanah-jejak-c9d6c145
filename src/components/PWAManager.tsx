import { useEffect, useState } from "react";
import { Download, X, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "delapan_pwa_dismissed_at";
const DISMISS_DAYS = 14;

export function PWAManager() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [offline, setOffline] = useState(
    typeof navigator !== "undefined" ? !navigator.onLine : false,
  );

  // Register service worker (production only — never in preview/iframe)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (window.location.hostname === "localhost") return;

    // Guard against Lovable preview / iframe contexts: SW would cache the
    // preview shell and break hot updates. Unregister any leftover SW too.
    const inIframe = (() => {
      try { return window.self !== window.top; } catch { return true; }
    })();
    const isPreviewHost =
      window.location.hostname.includes("id-preview--") ||
      window.location.hostname.includes("lovableproject.com") ||
      window.location.hostname.includes("lovable.dev");

    if (inIframe || isPreviewHost) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => r.unregister());
      }).catch(() => undefined);
      return;
    }

    const onLoad = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch((err) => console.warn("SW registration failed", err));
    };
    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad, { once: true });
  }, []);

  // Online / offline indicator
  useEffect(() => {
    if (typeof window === "undefined") return;
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  // Capture install prompt
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (e: Event) => {
      e.preventDefault();
      const dismissed = localStorage.getItem(DISMISS_KEY);
      if (dismissed) {
        const age = (Date.now() - Number(dismissed)) / 86400000;
        if (age < DISMISS_DAYS) return;
      }
      setDeferred(e as BeforeInstallPromptEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setShow(false);
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setShow(false);
  };

  return (
    <>
      {offline && (
        <div className="fixed top-2 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-amber-500 px-3 py-1 text-xs font-medium text-white shadow-lg flex items-center gap-1.5">
          <WifiOff className="h-3 w-3" />
          Mode Offline
        </div>
      )}
      {show && deferred && (
        <div className="fixed bottom-4 left-1/2 z-50 w-[min(92vw,420px)] -translate-x-1/2 rounded-lg border bg-card p-4 shadow-2xl">
          <div className="flex items-start gap-3">
            <div className="rounded-md bg-primary/10 p-2 text-primary">
              <Download className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="font-display text-sm font-semibold">Install DeLapan</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Pasang sebagai aplikasi untuk akses cepat dan dapat dibuka tanpa internet.
              </p>
              <div className="mt-3 flex gap-2">
                <Button size="sm" onClick={handleInstall}>
                  Pasang
                </Button>
                <Button size="sm" variant="ghost" onClick={handleDismiss}>
                  Nanti saja
                </Button>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDismiss}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Tutup"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
