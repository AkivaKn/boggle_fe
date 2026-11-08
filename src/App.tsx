import { useCallback, useEffect, useState } from "react";
import BoggleApp from "./games/BoggleApp";
import ForeheadCharadesApp from "./games/headsup/App";
import MillionaireApp from "./games/millionaire/App";
import {
  isHeadSupPath,
  navigate,
  resolveHeadSupRoute,
  resolveRoute,
  type Route,
} from "./router";

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
        to="/forehead-charades"
        title="FOREHEAD CHARADES"
        blurb="Hold the phone up. Guess the word. Beat the clock."
        accent="text-emerald-300"
      />
      <GameCard
        to="/money-ladder"
        title="THE MONEY LADDER"
        blurb="Fifteen rungs, one life, £1,000,000."
        accent="text-gold-300"
      />
      <GameCard
        to="/word-grid"
        title="WORD GRID"
        blurb="Find the words before the three minutes run out."
        accent="text-indigo-300"
      />
    </div>
  </div>
);

export default function App() {
  const [path, setPath] = useState(() => window.location.pathname);

  const sync = useCallback(() => {
    setPath(window.location.pathname);
  }, []);

  useEffect(() => {
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, [sync]);

  if (isHeadSupPath(path)) {
    return <ForeheadCharadesApp route={resolveHeadSupRoute(path)} />;
  }

  const route: Route = resolveRoute(path);
  if (route === "/word-grid") return <BoggleApp />;
  if (route === "/money-ladder") return <MillionaireApp />;
  return <Lobby />;
}
