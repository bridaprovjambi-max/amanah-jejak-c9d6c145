import { useLocation } from "@tanstack/react-router";

export function RouteTransition({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  return (
    <div
      key={location.pathname}
      className="animate-fade-in-up"
      style={{ willChange: "opacity, transform" }}
    >
      {children}
    </div>
  );
}
