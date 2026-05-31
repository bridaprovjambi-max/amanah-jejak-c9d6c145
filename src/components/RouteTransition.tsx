import { Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

/**
 * Consistent route transition wrapper with direction awareness.
 *
 * - Keys the rendered <Outlet /> on pathname so React remounts on every nav.
 * - Detects whether the navigation is "forward" (new route pushed) or
 *   "back" (browser back / swipe-back gesture) by tracking a path stack
 *   and listening to popstate, and applies a directional slide.
 *
 * Animation classes (`animate-route-forward` / `animate-route-back`)
 * are defined in src/styles.css and read the global motion tokens
 * (--motion-base, --ease-out-soft) so timing stays in sync with the rest
 * of the app.
 */
export function RouteTransition() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Stack of visited paths used to infer direction.
  const stackRef = useRef<string[]>([pathname]);
  // Flag flipped to true by popstate; consumed on the next pathname change.
  const popFlagRef = useRef(false);
  const [direction, setDirection] = useState<"forward" | "back">("forward");

  // Mark the next navigation as "back" when the browser fires popstate
  // (covers desktop back button, Android back, iOS swipe-back gesture).
  useEffect(() => {
    const onPop = () => {
      popFlagRef.current = true;
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  // Update direction + stack whenever the path changes.
  useEffect(() => {
    const stack = stackRef.current;
    const last = stack[stack.length - 1];
    if (last === pathname) return;

    const prev = stack[stack.length - 2];
    if (popFlagRef.current || prev === pathname) {
      // Back navigation: pop the stack tail.
      setDirection("back");
      if (prev === pathname) stack.pop();
    } else {
      // Forward navigation: push the new path.
      setDirection("forward");
      stack.push(pathname);
    }
    popFlagRef.current = false;
  }, [pathname]);

  const animClass =
    direction === "back" ? "animate-route-back" : "animate-route-forward";

  return (
    <div key={pathname} className={`route-transition ${animClass}`}>
      <Outlet />
    </div>
  );
}
