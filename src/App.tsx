import { useCallback, useEffect, useState } from "react";
import BoggleApp from "./games/BoggleApp";
import MillionaireApp from "./games/millionaire/App";
import { navigate, resolveRoute, type Route } from "./router";

/**
 * The GAMES HUB — one SPA serving every game from one endpoint.
 *
 * Why hand-rolled instead of a router package: the whole app is two games and
 * three routes, and the deploy already builds this repo with a plain
 * `npm run build`. A dependency here would be a dependency to re-audit on
 * every bump for three routes' worth of behaviour. History API + a popstate
 * listener is the entire requirement.
 *
 * Route table (deliberately shallow):
 *   /            the lobby — pick a game
 *   /boggle      Boggle
 *   /millionaire Millionaire
 * Anything else falls back to the lobby, so a stale bookmark can never land
 * the player on a blank screen.
 */
const GameCard = ({
  to,
  title,
  blurb,
  accent,
}: {
  to: Route;
  title: string;
  blurb: string;
  accent: string;
}) => (
  <a
    href={to}
    onClick={(e) => {
      // Left-click, no modifier: let the browser handle the rest (new tab).
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      navigate(to);
    }}
    className="group block rounded-3xl border border-white/10 bg-stage-900/70 p-6 text-center transition active:scale-[0.98] hover:border-gold-500/40"
  >
    <span
      className={`block font-display text-3xl font-black tracking-tight ${accent}`}
    >
      {title}
    </span>
    <span className="mt-2 block text-sm text-muted">{blurb}</span>
    <span className="mt-4 block text-xs font-black uppercase tracking-[0.3em] text-gold-400 opacity-0 transition group-hover:opacity-100">
      Play →
    </span>
  </a>
);

const Lobby = () => (
  <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center bg-stage-void px-4 py-10">
    <h1 className="text-center font-display text-4xl font-black tracking-tight text-gold-400">
      GAMES
    </h1>
    <p className="mt-2 text-center text-sm text-muted">Pick your poison.</p>
    <div className="mt-8 grid w-full gap-4">
      <GameCard
        to="/millionaire"
        title="WHO WANTS TO BE A MILLIONAIRE?"
        blurb="Fifteen rungs, one life, £1,000,000."
        accent="text-gold-300"
      />
      <GameCard
        to="/boggle"
        title="BOGGLE"
        blurb="Find the words before the three minutes run out."
        accent="text-indigo-300"
      />
    </div>
  </div>
);

export default function App() {
  const [route, setRoute] = useState<Route>(() =>
    resolveRoute(window.location.pathname),
  );

  const sync = useCallback(() => {
    setRoute(resolveRoute(window.location.pathname));
  }, []);

  useEffect(() => {
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, [sync]);

  // Each game keeps its state in localStorage keyed by its own namespace, so
  // moving between games must NOT unmount-and-recreate the other one
  // silently — but rendering exactly one at a time is the point: the two
  // games are independent machines, and a lobby → game → back → game cycle
  // simply remounts (which is what each game's own mount logic expects).
  if (route === "/boggle") return <BoggleApp />;
  if (route === "/millionaire") return <MillionaireApp />;
  return <Lobby />;
}