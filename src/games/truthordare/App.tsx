import { useCallback, useEffect, useRef, useState } from "react";
import { navigate, type TruthOrDareRoute } from "../../router";
import {
  createGame,
  drawPrompt,
  finishGame,
  forfeitPrompt,
  nextTurn,
  restartGame,
} from "./game";
import { Home } from "./components/Home";
import { HowToPlay } from "./components/HowToPlay";
import { Game } from "./components/Game";
import { Setup } from "./components/Setup";
import { loadSetup, saveSetup } from "./storage";
import type { ActiveGame, SetupConfig, TodKind } from "./types";
import "./truthordare.css";

const HOME_PATH = "/truth-or-dare";
const SETUP_PATH = "/truth-or-dare/setup";
const HOWTO_PATH = "/truth-or-dare/how-to-play";
const GAME_PATH = "/truth-or-dare/game";

export default function TruthOrDareApp({
  route,
}: {
  route: TruthOrDareRoute;
}) {
  const [setup, setSetup] = useState<SetupConfig>(loadSetup);
  const [game, setGame] = useState<ActiveGame | null>(null);
  const [prevRoute, setPrevRoute] = useState<TruthOrDareRoute>(route);
  const gameRef = useRef<ActiveGame | null>(game);

  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  if (prevRoute !== route) {
    setPrevRoute(route);
    if (prevRoute === "game" && route !== "game") {
      setGame(null);
    }
  }

  const startGame = useCallback((config: SetupConfig) => {
    setSetup(config);
    saveSetup(config);
    setGame(createGame(config));
    navigate(GAME_PATH);
  }, []);

  const handleDraw = useCallback((kind: TodKind) => {
    setGame((current) =>
      current && current.stage === "choose"
        ? drawPrompt(current, kind)
        : current,
    );
  }, []);

  const handleSwap = useCallback(() => {
    setGame((current) =>
      current?.currentPrompt
        ? drawPrompt(current, current.currentPrompt.kind, current.currentPrompt.id)
        : current,
    );
  }, []);

  const handleDone = useCallback(() => {
    setGame((current) =>
      current && current.stage === "prompt" ? nextTurn(current) : current,
    );
  }, []);

  const handleForfeit = useCallback(() => {
    setGame((current) =>
      current && current.stage === "prompt" ? forfeitPrompt(current) : current,
    );
  }, []);

  const handleFinish = useCallback(() => {
    setGame((current) => (current ? finishGame(current) : current));
  }, []);

  const handlePlayAgain = useCallback(() => {
    setGame((current) => (current ? restartGame(current) : current));
  }, []);

  const leaveGame = useCallback((to: string) => {
    const current = gameRef.current;
    if (
      current &&
      current.stage !== "final" &&
      !window.confirm("Leave this game? Progress will be lost.")
    ) {
      return;
    }
    setGame(null);
    navigate(to);
  }, []);

  const handleAllGames = useCallback(() => {
    leaveGame("/");
  }, [leaveGame]);

  return (
    <div className="tod-theme tod-shell">
      <div className="tod-bg" aria-hidden />
      <div className="tod-frame">
        {route === "home" && (
          <Home
            onPlay={() => navigate(SETUP_PATH)}
            onHowTo={() => navigate(HOWTO_PATH)}
            onAllGames={handleAllGames}
          />
        )}

        {route === "howto" && (
          <HowToPlay onBack={() => navigate(HOME_PATH)} />
        )}

        {route === "setup" && (
          <Setup
            initial={setup}
            onStart={startGame}
            onBack={() => navigate(HOME_PATH)}
          />
        )}

        {route === "game" && game && (
          <Game
            game={game}
            onDraw={handleDraw}
            onSwap={handleSwap}
            onDone={handleDone}
            onForfeit={handleForfeit}
            onFinish={handleFinish}
            onPlayAgain={handlePlayAgain}
            onChangeSetup={() => leaveGame(SETUP_PATH)}
            onHome={() => leaveGame(HOME_PATH)}
            onAllGames={handleAllGames}
          />
        )}

        {route === "game" && !game && (
          <section className="tod-screen tod-empty anim-fade-in">
            <div className="tod-panel tod-empty-card">
              <p className="tod-eyebrow">No game in progress</p>
              <h1 className="tod-title">Nothing to play yet</h1>
              <p className="tod-body-copy">
                This URL holds a live pass-the-phone game. Set up the players
                and packs to start one.
              </p>
              <div className="tod-setup-actions">
                <button
                  type="button"
                  className="tod-btn tod-btn-primary"
                  onClick={() => navigate(SETUP_PATH)}
                >
                  Set up a game
                </button>
                <button
                  type="button"
                  className="tod-btn tod-btn-ghost"
                  onClick={() => navigate(HOME_PATH)}
                >
                  Back to game home
                </button>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
