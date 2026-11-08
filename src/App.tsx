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

type GameCardProps = {
  to: Route;
  title: string;
  blurb: string;
  emoji: string;
  tag: string;
  accent: "teal" | "amber" | "indigo";
};

const GameCard = ({ to, title, blurb, emoji, tag, accent }: GameCardProps) => (
  <a
    href={to}
    onClick={(e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      navigate(to);
    }}
    className={`hub-card hub-card-${accent}`}
  >
    <span className="hub-card-accent" aria-hidden />
    <span className="hub-card-top">
      <span className="hub-card-emoji" aria-hidden>
        {emoji}
      </span>
      <span className="hub-card-tag">{tag}</span>
    </span>
    <span className="hub-card-title">{title}</span>
    <span className="hub-card-blurb">{blurb}</span>
    <span className="hub-card-cta" aria-hidden>
      Play
      <span className="hub-card-arrow">→</span>
    </span>
  </a>
);

const Lobby = () => (
  <div className="hub-shell">
    <div className="hub-bg" aria-hidden />
    <main className="hub-main safe-area">
      <header className="hub-header">
        <p className="hub-kicker">Arcade</p>
        <h1 className="hub-title">What are we playing?</h1>
        <p className="hub-subtitle">
          Pick a game and jump in.
        </p>
      </header>

      <div className="hub-grid">
        <GameCard
          to="/forehead-charades"
          title="Forehead Charades"
          blurb="Hold the phone up, get clues from your team, and beat the clock."
          emoji="🙈"
          tag="Pass the phone"
          accent="teal"
        />
        <GameCard
          to="/money-ladder"
          title="The Money Ladder"
          blurb="Climb fifteen rungs, use your lifelines, and chase the top prize."
          emoji="💰"
          tag="Quiz"
          accent="amber"
        />
        <GameCard
          to="/word-grid"
          title="Word Grid"
          blurb="Find as many words as you can before the three minutes run out."
          emoji="🔤"
          tag="Word game"
          accent="indigo"
        />
      </div>
    </main>
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
