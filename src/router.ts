export type Route =
  | "/"
  | "/word-grid"
  | "/money-ladder"
  | "/forehead-charades";

export type HeadSupRoute = "home" | "setup" | "howto" | "decks" | "game";

const ROUTES: Route[] = [
  "/",
  "/word-grid",
  "/money-ladder",
  "/forehead-charades",
];

const FOREHEAD_PREFIX = "/forehead-charades";

const cleanPath = (pathname: string): string =>
  pathname.replace(/\/+$/, "") || "/";

export const resolveRoute = (pathname: string): Route => {
  const clean = cleanPath(pathname);
  return (ROUTES as string[]).includes(clean) ? (clean as Route) : "/";
};

export const isHeadSupPath = (pathname: string): boolean => {
  const clean = cleanPath(pathname);
  return clean === FOREHEAD_PREFIX || clean.startsWith(`${FOREHEAD_PREFIX}/`);
};

export const resolveHeadSupRoute = (pathname: string): HeadSupRoute => {
  switch (cleanPath(pathname)) {
    case `${FOREHEAD_PREFIX}/setup`:
      return "setup";
    case `${FOREHEAD_PREFIX}/how-to-play`:
      return "howto";
    case `${FOREHEAD_PREFIX}/decks`:
      return "decks";
    case `${FOREHEAD_PREFIX}/game`:
      return "game";
    default:
      return "home";
  }
};

export const navigate = (to: string) => {
  const current = `${window.location.pathname}${window.location.search}`;
  if (current === to) return;
  window.history.pushState({}, "", to);
  window.dispatchEvent(new PopStateEvent("popstate"));
};

export const replace = (to: string) => {
  const current = `${window.location.pathname}${window.location.search}`;
  if (current === to) return;
  window.history.replaceState({}, "", to);
  window.dispatchEvent(new PopStateEvent("popstate"));
};
