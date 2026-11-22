import { useEffect, useRef } from "react";
import { currentWord } from "../game";
import type { ActiveGame, TiltGesture } from "../types";
import type { TiltController } from "../useTilt";
import { useTurnClock } from "../useTurnClock";
import { playTick } from "../sound";

export function PlayScreen({
  game,
  tilt,
  onScore,
  onEndTurn,
  onManagePlayers,
  onSettings,
  onHome,
}: {
  game: ActiveGame;
  tilt: TiltController;
  onScore: (gesture: TiltGesture) => void;
  onEndTurn: () => void;
  onManagePlayers: () => void;
  onSettings: () => void;
  onHome: () => void;
}) {
  const touchDevice =
    typeof navigator !== "undefined" && navigator.maxTouchPoints > 0;
  const waitingForCalibration =
    tilt.permission === "granted" && tilt.calibrating && touchDevice;

  return (
    <div className="fc-play relative">
      {waitingForCalibration ? (
        <div className="fc-overlay">
          <div className="fc-overlay-card">
            <span className="fc-calibrate-ring" aria-hidden />
            <p className="fc-display mt-4 text-2xl">Hold still</p>
            <p className="fc-muted mt-2 text-sm">
              Calibrating the tilt controls. The word appears in a moment.
            </p>
          </div>
        </div>
      ) : (
        <RoundBody
          game={game}
          onScore={onScore}
          onEndTurn={onEndTurn}
          onManagePlayers={onManagePlayers}
          onSettings={onSettings}
          onHome={onHome}
        />
      )}
    </div>
  );
}

function RoundBody({
  game,
  onScore,
  onEndTurn,
  onManagePlayers,
  onSettings,
  onHome,
}: {
  game: ActiveGame;
  onScore: (gesture: TiltGesture) => void;
  onEndTurn: () => void;
  onManagePlayers: () => void;
  onSettings: () => void;
  onHome: () => void;
}) {
  const word = currentWord(game);
  const { remainingSec, progress, paused, pause, resume } = useTurnClock(
    game.turnSeconds,
    onEndTurn,
  );
  const lastTickRef = useRef(0);

  useEffect(() => {
    const seconds = remainingSec;
    if (!paused && seconds > 0 && seconds <= 3 && seconds !== lastTickRef.current) {
      lastTickRef.current = seconds;
      playTick();
    }
  }, [remainingSec, paused]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (paused || event.repeat) return;
      if (
        event.code === "Space" ||
        event.code === "ArrowDown" ||
        event.code === "Enter"
      ) {
        event.preventDefault();
        onScore("correct");
      } else if (event.code === "ArrowUp" || event.code === "Backspace") {
        event.preventDefault();
        onScore("pass");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paused, onScore]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== "Escape") return;
      event.preventDefault();
      if (paused) resume();
      else pause();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paused, pause, resume]);

  const danger = remainingSec <= 10;

  return (
    <>
      <div className="fc-timer-track" aria-hidden>
        <div
          className={`fc-timer-bar ${danger ? "fc-timer-danger" : ""}`}
          style={{
            width: `${Math.max(0, Math.min(100, progress * 100))}%`,
          }}
        />
      </div>

      <div aria-hidden>
        <button
          type="button"
          tabIndex={-1}
          className="fc-tap-zone fc-tap-zone-pass"
          onClick={() => onScore("pass")}
        />
        <button
          type="button"
          tabIndex={-1}
          className="fc-tap-zone fc-tap-zone-correct"
          onClick={() => onScore("correct")}
        />
      </div>

      <div className="fc-stage">
        <button
          type="button"
          className="fc-menu-btn"
          onClick={pause}
          aria-label="Pause turn and open the menu"
        >
          <span aria-hidden>Ⅱ</span>
          <span className="sr-only">Menu</span>
        </button>

        <h2 key={`${game.cursor}-${word}`} className="fc-word fc-word-in">
          {word}
        </h2>
        <p
          className={`fc-clock ${danger ? "fc-clock-danger" : ""}`}
          aria-live="off"
        >
          {remainingSec}s
        </p>
      </div>

      {paused && (
        <div className="fc-overlay">
          <div className="fc-overlay-card">
            <p className="fc-eyebrow">Turn paused</p>
            <h2 className="fc-display mt-1 text-3xl">Paused</h2>
            <p className="fc-muted mt-2 text-sm">
              The clock is stopped. Resume when everyone is ready.
            </p>
            <div className="fc-pause-actions mt-5">
              <button
                type="button"
                className="fc-btn fc-btn-primary"
                onClick={resume}
              >
                Resume turn
              </button>
              <button
                type="button"
                className="fc-btn fc-btn-ghost"
                onClick={onManagePlayers}
              >
                Edit players
              </button>
              <button
                type="button"
                className="fc-btn fc-btn-ghost"
                onClick={onSettings}
              >
                Back to settings
              </button>
              <button type="button" className="fc-link" onClick={onHome}>
                Back to home
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
