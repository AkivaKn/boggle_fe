import { useEffect, useRef, useState } from "react";
import type { Player } from "../types";
import type { TiltController } from "../useTilt";
import { enterPlayDisplay } from "../display";
import { playCountdown, unlockAudio } from "../sound";

export function TurnIntro({
  player,
  turnNumber,
  totalTurns,
  turnSeconds,
  tilt,
  onBegin,
  onManagePlayers,
  onSettings,
  onHome,
}: {
  player: Player;
  turnNumber: number;
  totalTurns: number;
  turnSeconds: number;
  tilt: TiltController;
  onBegin: () => void;
  onManagePlayers: () => void;
  onSettings: () => void;
  onHome: () => void;
}) {
  const [count, setCount] = useState<number | null>(null);
  const beganRef = useRef(false);

  useEffect(() => {
    if (count === null) return;
    if (count === 0) {
      playCountdown(0);
      const timer = window.setTimeout(() => {
        if (!beganRef.current) {
          beganRef.current = true;
          onBegin();
        }
      }, 650);
      return () => window.clearTimeout(timer);
    }
    playCountdown(count);
    const timer = window.setTimeout(
      () => setCount((current) => (current === null ? null : current - 1)),
      750,
    );
    return () => window.clearTimeout(timer);
  }, [count, onBegin]);

  const start = async () => {
    if (count !== null) return;
    unlockAudio();
    void enterPlayDisplay();
    await tilt.requestPermission();
    setCount(3);
  };

  const tiltBlocked = tilt.permission === "denied";
  const tiltUnsupported = tilt.permission === "unsupported";

  return (
    <div className="relative flex w-full flex-1 flex-col justify-center py-6">
      <div className="fc-plate p-6 text-center">
        <p className="fc-eyebrow">
          Turn {turnNumber} of {totalTurns}
        </p>
        <h1 className="fc-masthead fc-display mt-3 text-4xl">
          {player.name}
        </h1>
        <p className="fc-muted mt-4 text-sm">
          Hold the phone against your forehead with the screen facing your team.
          You will not see the word — they will clue it.
        </p>
        <p className="fc-muted mt-2 text-sm">
          {turnSeconds} seconds. Tilt down for correct, up to pass — or use the
          tap zones.
        </p>

        {(tiltBlocked || tiltUnsupported) && (
          <p className="fc-banner fc-banner-warning mt-4" role="status">
            {tiltBlocked
              ? "Motion access was blocked — use the big tap zones instead."
              : "Motion controls are not available here — use the tap zones or keyboard."}
          </p>
        )}

        <button
          type="button"
          className="fc-btn fc-btn-primary mt-6"
          onClick={() => void start()}
          disabled={count !== null}
        >
          Start turn
        </button>

        <div className="fc-intro-links">
          <button type="button" className="fc-link" onClick={onManagePlayers}>
            Edit players
          </button>
          <button type="button" className="fc-link" onClick={onSettings}>
            Back to settings
          </button>
          <button type="button" className="fc-link fc-muted" onClick={onHome}>
            Home
          </button>
        </div>
      </div>

      {count !== null && (
        <div className="fc-overlay">
          <p className="fc-eyebrow">Get ready</p>
          <span key={count} className="fc-countdown fc-countdown-pop">
            {count === 0 ? "GO!" : count}
          </span>
          <p className="fc-muted text-sm">
            Phone on your forehead, screen out.
          </p>
        </div>
      )}
    </div>
  );
}
