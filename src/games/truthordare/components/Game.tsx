import { useEffect, useState } from "react";
import { LEVEL_META, currentPlayer } from "../game";
import type { ActiveGame, TodKind } from "../types";

export function Game({
  game,
  onDraw,
  onSwap,
  onDone,
  onFinish,
  onPlayAgain,
  onChangeSetup,
  onHome,
  onAllGames,
}: {
  game: ActiveGame;
  onDraw: (kind: TodKind) => void;
  onSwap: () => void;
  onDone: () => void;
  onFinish: () => void;
  onPlayAgain: () => void;
  onChangeSetup: () => void;
  onHome: () => void;
  onAllGames: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.code === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  if (game.stage === "final") {
    return (
      <FinalScreen
        game={game}
        onPlayAgain={onPlayAgain}
        onChangeSetup={onChangeSetup}
        onHome={onHome}
        onAllGames={onAllGames}
      />
    );
  }

  const player = currentPlayer(game);
  const prompt = game.currentPrompt;

  return (
    <section className="tod-screen tod-game anim-fade-in">
      <header className="tod-game-head">
        <div>
          <p className="tod-eyebrow">Turn {game.turnNumber}</p>
          <h1 className="tod-player-name">{player.name}</h1>
          <div className="tod-level-badges" aria-label="Active packs">
            {game.levels.map((level) => (
              <span
                key={level}
                className={`tod-level-badge tod-level-badge-${level}`}
              >
                {LEVEL_META[level].label}
              </span>
            ))}
          </div>
        </div>
        <button
          type="button"
          className="tod-icon-btn tod-menu-btn"
          onClick={() => setMenuOpen(true)}
          aria-label="Open game menu"
        >
          ☰
        </button>
      </header>

      {game.stage === "choose" && (
        <div className="tod-choose">
          <p className="tod-prompt-lead">
            {player.name}, <span>truth or dare?</span>
          </p>
          <div className="tod-choice-grid">
            <button
              type="button"
              className="tod-choice tod-choice-truth"
              onClick={() => onDraw("truth")}
            >
              <span className="tod-choice-icon" aria-hidden>
                ?
              </span>
              <span className="tod-choice-title">Truth</span>
            </button>
            <button
              type="button"
              className="tod-choice tod-choice-dare"
              onClick={() => onDraw("dare")}
            >
              <span className="tod-choice-icon" aria-hidden>
                !
              </span>
              <span className="tod-choice-title">Dare</span>
            </button>
          </div>
        </div>
      )}

      {game.stage === "prompt" && prompt && (
        <div
          key={prompt.id}
          className={`tod-prompt tod-prompt-${prompt.kind} tod-prompt-in`}
          aria-live="polite"
        >
          <div className="tod-prompt-top">
            <span className={`tod-kind tod-kind-${prompt.kind}`}>
              {prompt.kind}
            </span>
            {game.levels.length > 1 && (
              <span
                className={`tod-level-badge tod-level-badge-${prompt.level}`}
              >
                {LEVEL_META[prompt.level].label}
              </span>
            )}
          </div>
          <p className="tod-prompt-text">{prompt.text}</p>
          <div className="tod-prompt-actions">
            <button
              type="button"
              className="tod-btn tod-btn-ghost"
              onClick={onSwap}
            >
              Swap prompt
            </button>
            <button
              type="button"
              className="tod-btn tod-btn-primary"
              onClick={onDone}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {menuOpen && (
        <div
          className="tod-modal-backdrop"
          role="presentation"
          onClick={() => setMenuOpen(false)}
        >
          <div
            className="tod-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tod-menu-title"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="tod-eyebrow">Game menu</p>
            <h2 id="tod-menu-title" className="tod-modal-title">
              Paused
            </h2>
            <p className="tod-body-copy">
              Take a breather, or end this game and start fresh.
            </p>
            <div className="tod-modal-actions">
              <button
                type="button"
                className="tod-btn tod-btn-primary"
                onClick={() => setMenuOpen(false)}
                autoFocus
              >
                Keep playing
              </button>
              <button
                type="button"
                className="tod-btn tod-btn-ghost"
                onClick={() => {
                  setMenuOpen(false);
                  onFinish();
                }}
              >
                End game
              </button>
              <button
                type="button"
                className="tod-btn tod-btn-ghost"
                onClick={() => {
                  setMenuOpen(false);
                  onChangeSetup();
                }}
              >
                Change setup
              </button>
              <button type="button" className="tod-link" onClick={onHome}>
                Back to home
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function FinalScreen({
  game,
  onPlayAgain,
  onChangeSetup,
  onHome,
  onAllGames,
}: {
  game: ActiveGame;
  onPlayAgain: () => void;
  onChangeSetup: () => void;
  onHome: () => void;
  onAllGames: () => void;
}) {
  return (
    <section className="tod-screen tod-final anim-fade-in">
      <div className="tod-final-card">
        <p className="tod-eyebrow">Game over</p>
        <h1 className="tod-final-title">That's a wrap</h1>
        <p className="tod-tagline">
          {game.completedTurns === 0
            ? "No turns played."
            : game.completedTurns === 1
              ? "One turn played."
              : `${game.completedTurns} turns played.`}{" "}
          Same group, another round?
        </p>

        <div className="tod-final-players" aria-label="Players">
          {game.players.map((player) => (
            <span key={player.id} className="tod-final-player">
              {player.name}
            </span>
          ))}
        </div>

        <div className="tod-final-actions">
          <button
            type="button"
            className="tod-btn tod-btn-primary"
            onClick={onPlayAgain}
          >
            Play again
          </button>
          <button
            type="button"
            className="tod-btn tod-btn-ghost"
            onClick={onChangeSetup}
          >
            Change setup
          </button>
          <button type="button" className="tod-btn tod-btn-ghost" onClick={onHome}>
            Back to home
          </button>
        </div>

        <button type="button" className="tod-link" onClick={onAllGames}>
          All games
        </button>
      </div>
    </section>
  );
}
