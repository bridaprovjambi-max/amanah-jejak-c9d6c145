import { Outlet, useRouterState } from "@tanstack/react-router";

/**
 * Consistent route transition wrapper.
 *
 * Keys the rendered <Outlet /> on the current pathname so React remounts
 * the subtree on every navigation. The wrapper element animates in using
 * the shared `animate-fade-in-up` utility, which reads timing from the
 * global motion tokens in src/styles.css (--motion-base, --ease-out-soft).
 *
 * Mount at every Outlet boundary where we want a transition — currently
 * the root layout and the authenticated app shell — so navigating
 * Login → Signup → Penugasan all share the same fade/slide motion.
 */
export function RouteTransition() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div key={pathname} className="route-transition animate-fade-in-up">
      <Outlet />
    </div>
  );
}
