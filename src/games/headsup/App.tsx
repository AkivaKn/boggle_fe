import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { navigate, replace, type HeadSupRoute } from "../../router";
import { FinalBoard } from "./components/FinalBoard";
import { Home } from "./components/Home";
import { HowToPlay } from "./components/HowToPlay";
import { DeckManager } from "./components/DeckManager";
import { PlayScreen } from "./components/PlayScreen";
import { PlayerManager } from "./components/PlayerManager";
import { Setup } from "./components/Setup";
import { TurnIntro } from "./components/TurnIntro";
import { TurnSummary } from "./components/TurnSummary";
import { BUILTIN_DECKS } from "./decks";
import {
  MAX_PLAYERS,
  addPlayer,
  applyGesture,
  createGame,
  finishTurn,
  nextTurn,
  renamePlayer,
} from "./game";
import { playCorrect, playEnd, playPass } from "./sound";
import {
  loadCustomDecks,
  loadSetup,
  saveCustomDecks,
  saveSetup,
  uid,
} from "./storage";
import type {
  ActiveGame,
  Deck,
  Player,
  SetupConfig,
  TiltGesture,
} from "./types";
import { useTilt } from "./useTilt";
import { useWakeLock } from "./useWakeLock";
import "./headsup.css";

const GAME_PATH = "/forehead-charades/game";
const SETUP_PATH = "/forehead-charades/setup";
const HOME_PATH = "/forehead-charades";

export default function ForeheadCharadesApp({
  route,
}: {
  route: HeadSupRoute;
}) {
  const [customDecks, setCustomDecks] = useState<Deck[]>(loadCustomDecks);
  const [setup, setSetup] = useState<SetupConfig>(loadSetup);
  const [game, setGame] = useState<ActiveGame | null>(null);
  const [managingPlayers, setManagingPlayers] = useState(false);
  const lastScoreAtRef = useRef(0);
  const gameRef = useRef<ActiveGame | null>(game);
  const [prevRoute, setPrevRoute] = useState<HeadSupRoute>(route);

  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  if (prevRoute !== route) {
    setPrevRoute(route);
    if (prevRoute === "game" && route !== "game") {
      setGame(null);
      setManagingPlayers(false);
    }
  }

  useEffect(() => {
    if (route !== "game" || game) return;
    const timer = window.setTimeout(() => replace(SETUP_PATH), 0);
    return () => window.clearTimeout(timer);
  }, [route, game]);

  const allDecks = useMemo(
    () => [...BUILTIN_DECKS, ...customDecks],
    [customDecks],
  );

  const startGame = useCallback(
    (config: SetupConfig) => {
      const decks = allDecks.filter((deck) =>
        config.deckIds.includes(deck.id),
      );
      if (decks.length === 0) return;
      const players = config.playerNames.map((name) => ({ id: uid(), name }));
      const nextGame = createGame({
        players,
        decks,
        turnSeconds: config.turnSeconds,
        shuffleOrder: config.shuffleOrder,
      });
      setSetup(config);
      saveSetup(config);
      setGame(nextGame);
      navigate(GAME_PATH);
    },
    [allDecks],
  );

  const beginTurn = useCallback(() => {
    setGame((current) =>
      current && current.stage === "intro"
        ? { ...current, stage: "playing" }
        : current,
    );
  }, []);

  const handleScore = useCallback((gesture: TiltGesture) => {
    const current = gameRef.current;
    if (!current || current.stage !== "playing") return;
    const now = performance.now();
    if (now - lastScoreAtRef.current < 260) return;
    lastScoreAtRef.current = now;

    if (gesture === "correct") {
      playCorrect();
      navigator.vibrate?.(30);
    } else {
      playPass();
      navigator.vibrate?.([20, 40, 20]);
    }
    setGame((state) =>
      state && state.stage === "playing"
        ? applyGesture(state, gesture)
        : state,
    );
  }, []);

  const handleEndTurn = useCallback(() => {
    if (gameRef.current?.stage !== "playing") return;
    playEnd();
    setGame((state) =>
      state && state.stage === "playing" ? finishTurn(state) : state,
    );
  }, []);

  const handleNext = useCallback(() => {
    setGame((state) => (state ? nextTurn(state) : state));
  }, []);

  const handlePlayAgain = useCallback(() => {
    const current = gameRef.current;
    if (!current) return;
    const decks = allDecks.filter((deck) =>
      current.deckIds.includes(deck.id),
    );
    if (decks.length === 0) {
      setGame(null);
      navigate(SETUP_PATH);
      return;
    }
    setGame(
      createGame({
        players: current.players,
        decks,
        turnSeconds: current.turnSeconds,
        shuffleOrder: false,
      }),
    );
  }, [allDecks]);

  const leaveGame = useCallback((to: string) => {
    const current = gameRef.current;
    if (
      current &&
      current.stage !== "final" &&
      !window.confirm("Leave this game? Scores will be lost.")
    ) {
      return;
    }
    setManagingPlayers(false);
    setGame(null);
    navigate(to);
  }, []);

  const handleChangeSetup = useCallback(() => {
    setManagingPlayers(false);
    setGame(null);
    navigate(SETUP_PATH);
  }, []);

  const handleHome = useCallback(() => {
    setManagingPlayers(false);
    setGame(null);
    navigate(HOME_PATH);
  }, []);

  const handleAllGames = useCallback(() => {
    setManagingPlayers(false);
    setGame(null);
    navigate("/");
  }, []);

  const syncSetupNames = useCallback((players: Player[]) => {
    setSetup((current) => {
      const next = {
        ...current,
        playerNames: players.map((player) => player.name),
      };
      saveSetup(next);
      return next;
    });
  }, []);

  const handleAddPlayer = useCallback(
    (name: string) => {
      const current = gameRef.current;
      if (!current || current.players.length >= MAX_PLAYERS) return;
      const player: Player = { id: uid(), name };
      const next = addPlayer(current, player);
      gameRef.current = next;
      setGame(next);
      syncSetupNames(next.players);
    },
    [syncSetupNames],
  );

  const handleRenamePlayer = useCallback(
    (playerId: string, name: string) => {
      const current = gameRef.current;
      if (!current) return;
      const next = renamePlayer(current, playerId, name);
      gameRef.current = next;
      setGame(next);
      syncSetupNames(next.players);
    },
    [syncSetupNames],
  );

  const handleDecksChange = useCallback((decks: Deck[]) => {
    setCustomDecks(decks);
    saveCustomDecks(decks);
  }, []);

  const handleSetupSave = useCallback((config: SetupConfig) => {
    setSetup(config);
    saveSetup(config);
  }, []);

  const tilt = useTilt({
    enabled: route === "game" && game?.stage === "playing",
    onGesture: handleScore,
  });

  useWakeLock(
    route === "game" &&
      (game?.stage === "intro" || game?.stage === "playing"),
  );

  const inProgress =
    route === "game" && game !== null && game.stage !== "final";
  useEffect(() => {
    if (!inProgress) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [inProgress]);

  const deckReturn =
    new URLSearchParams(window.location.search).get("from") === "setup"
      ? SETUP_PATH
      : HOME_PATH;

  return (
    <div className="fc-theme fc-shell relative flex flex-col overflow-hidden">
      <div className="fc-bg pointer-events-none absolute inset-0" aria-hidden />
      <div className="safe-area relative mx-auto flex w-full max-w-md flex-1 flex-col items-center">
        {route === "home" && (
          <Home
            onPlay={() => navigate(SETUP_PATH)}
            onHowTo={() => navigate("/forehead-charades/how-to-play")}
            onDecks={() => navigate("/forehead-charades/decks")}
            onAllGames={handleAllGames}
          />
        )}

        {route === "howto" && (
          <HowToPlay onBack={() => navigate(HOME_PATH)} />
        )}

        {route === "setup" && (
          <Setup
            decks={allDecks}
            initial={setup}
            onStart={startGame}
            onBack={() => navigate(HOME_PATH)}
            onManageDecks={() => navigate("/forehead-charades/decks?from=setup")}
            onSave={handleSetupSave}
          />
        )}

        {route === "decks" && (
          <DeckManager
            decks={allDecks}
            customDecks={customDecks}
            onChange={handleDecksChange}
            onBack={() => navigate(deckReturn)}
          />
        )}

        {route === "game" && game && (
          <>
            {game.stage === "intro" && (
              <TurnIntro
                player={game.players[game.turnIndex]}
                turnNumber={game.turnIndex + 1}
                totalTurns={game.players.length}
                turnSeconds={game.turnSeconds}
                tilt={tilt}
                onBegin={beginTurn}
                onManagePlayers={() => setManagingPlayers(true)}
                onSettings={() => leaveGame(SETUP_PATH)}
                onHome={() => leaveGame(HOME_PATH)}
              />
            )}
            {game.stage === "playing" && (
              <PlayScreen
                game={game}
                tilt={tilt}
                onScore={handleScore}
                onEndTurn={handleEndTurn}
                onManagePlayers={() => setManagingPlayers(true)}
                onSettings={() => leaveGame(SETUP_PATH)}
                onHome={() => leaveGame(HOME_PATH)}
              />
            )}
            {game.stage === "summary" && (
              <TurnSummary
                game={game}
                onNext={handleNext}
                onManagePlayers={() => setManagingPlayers(true)}
                onSettings={() => leaveGame(SETUP_PATH)}
                onHome={() => leaveGame(HOME_PATH)}
              />
            )}
            {game.stage === "final" && (
              <FinalBoard
                game={game}
                onPlayAgain={handlePlayAgain}
                onChangeSetup={handleChangeSetup}
                onManagePlayers={() => setManagingPlayers(true)}
                onHome={handleHome}
                onAllGames={handleAllGames}
              />
            )}
          </>
        )}

        {route === "game" && !game && (
          <section className="fc-plate anim-fade-in my-auto w-full p-6 text-center">
            <p className="fc-eyebrow">No game in progress</p>
            <h1 className="fc-display mt-2 text-3xl">Nothing to play yet</h1>
            <p className="fc-muted mt-3 text-sm">
              This URL only holds a live pass-the-phone game. Set up the
              players and decks to start one.
            </p>
            <div className="mt-6 grid gap-3">
              <button
                type="button"
                className="fc-btn fc-btn-primary"
                onClick={() => navigate(SETUP_PATH)}
              >
                Set up a game
              </button>
              <button
                type="button"
                className="fc-btn fc-btn-ghost"
                onClick={() => navigate(HOME_PATH)}
              >
                Back to the game home
              </button>
            </div>
          </section>
        )}

        {managingPlayers && game && (
          <PlayerManager
            players={game.players}
            isFinal={game.stage === "final"}
            onAdd={handleAddPlayer}
            onRename={handleRenamePlayer}
            onClose={() => setManagingPlayers(false)}
          />
        )}
      </div>
    </div>
  );
}
