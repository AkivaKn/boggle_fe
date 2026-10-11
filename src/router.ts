/**
 * The hub's router — three routes, deliberately hand-rolled.
 *
 * This lives apart from the components on purpose: `react-refresh` only
 * hot-reloads a module that exports components alone, and a fast-refresh
 * break in the file that switches games would be a confusing thing to debug.
 */
export type Route = "/" | "/boggle" | "/millionaire";

const ROUTES: Route[] = ["/", "/boggle", "/millionaire"];

/** Resolve a pathname to a known route (unknown → the lobby). */
export const resolveRoute = (pathname: string): Route => {
  const clean = pathname.replace(/\/+$/, "") || "/";
  return (ROUTES as string[]).includes(clean) ? (clean as Route) : "/";
};

/** Client-side navigation: push the path, then let the listener re-render. */
export const navigate = (to: Route) => {
  if (window.location.pathname === to) return;
  window.history.pushState({}, "", to);
  window.dispatchEvent(new PopStateEvent("popstate"));
};