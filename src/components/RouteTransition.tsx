import { useEffect, useRef, useState } from "react";
import { useRouter } from "@tanstack/react-router";

export function RouteTransition({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [key, setKey] = useState(router.state.location.pathname);
  const [animating, setAnimating] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsub = router.subscribe("onResolved", () => {
      const next = router.state.location.pathname;
      setKey((prev) => {
        if (prev !== next) {
          setAnimating(true);
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          timeoutRef.current = setTimeout(() => setAnimating(false), 550);
        }
        return next;
      });
    });
    return () => {
      unsub();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [router]);

  return (
    <div
      key={key}
      className={animating ? "animate-fade-in-up" : ""}
      style={{ willChange: "opacity, transform" }}
    >
      {children}
    </div>
  );
}
