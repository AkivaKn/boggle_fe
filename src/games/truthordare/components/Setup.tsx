import { useEffect, useState } from "react";
import {
  LEVEL_META,
  MAX_NAME_LENGTH,
  MAX_PLAYERS,
  MIN_PLAYERS,
} from "../game";
import { uid } from "../storage";
import type { SetupConfig, TodLevel } from "../types";

type DraftPlayer = {
  id: string;
  name: string;
};

const LEVELS: TodLevel[] = ["pg", "spicy", "nsfw"];

export function Setup({
  initial,
  onStart,
  onBack,
}: {
  initial: SetupConfig;
  onStart: (config: SetupConfig) => void;
  onBack: () => void;
}) {
  const [players, setPlayers] = useState<DraftPlayer[]>(() =>
    initial.playerNames.map((name) => ({ id: uid(), name })),
  );
  const [name, setName] = useState("");
  const [levels, setLevels] = useState<TodLevel[]>(initial.levels);
  const [shuffleOrder, setShuffleOrder] = useState(initial.shuffleOrder);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [ageGate, setAgeGate] = useState<"select" | "start" | null>(null);

  const cleanNames = players.map((player) => player.name.trim());
  const filledPlayers = cleanNames.filter(Boolean).length;
  const canStart =
    filledPlayers >= MIN_PLAYERS &&
    filledPlayers === players.length &&
    levels.length > 0;

  const addPlayer = () => {
    const trimmed = name.trim().slice(0, MAX_NAME_LENGTH);
    if (!trimmed || players.length >= MAX_PLAYERS) return;
    setPlayers((current) => [...current, { id: uid(), name: trimmed }]);
    setName("");
  };

  const renamePlayer = (id: string, value: string) => {
    setPlayers((current) =>
      current.map((player) =>
        player.id === id
          ? { ...player, name: value.slice(0, MAX_NAME_LENGTH) }
          : player,
      ),
    );
  };

  const removePlayer = (id: string) => {
    setPlayers((current) => current.filter((player) => player.id !== id));
  };

  const start = () => {
    if (!canStart) return;
    if (levels.includes("nsfw") && !ageConfirmed) {
      setAgeGate("start");
      return;
    }
    onStart({
      playerNames: cleanNames,
      levels,
      shuffleOrder,
    });
  };

  const toggleLevel = (level: TodLevel) => {
    if (levels.includes(level)) {
      setLevels((current) => current.filter((item) => item !== level));
      return;
    }
    if (level === "nsfw" && !ageConfirmed) {
      setAgeGate("select");
      return;
    }
    setLevels((current) => [...current, level]);
  };

  const confirmAge = () => {
    setAgeConfirmed(true);
    if (ageGate === "select") {
      setLevels((current) =>
        current.includes("nsfw") ? current : [...current, "nsfw"],
      );
    }
    if (ageGate === "start") {
      onStart({
        playerNames: cleanNames,
        levels,
        shuffleOrder,
      });
    }
    setAgeGate(null);
  };

  useEffect(() => {
    if (!ageGate) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.code === "Escape") setAgeGate(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ageGate]);

  return (
    <section className="tod-screen tod-setup anim-fade-in">
      <button type="button" className="tod-back" onClick={onBack}>
        <span aria-hidden>←</span> Back
      </button>

      <header className="tod-page-head">
        <p className="tod-eyebrow">Set up</p>
        <h1 className="tod-title">Who is playing?</h1>
        <p className="tod-tagline">
          Add the group, choose your packs, and pass the phone.
        </p>
      </header>

      <div className="tod-panel">
        <div className="tod-section-head">
          <h2 className="tod-section-title">Players</h2>
          <span className="tod-count">
            {players.length}/{MAX_PLAYERS}
          </span>
        </div>

        {players.length > 0 && (
          <div className="tod-player-list">
            {players.map((player, index) => (
              <div className="tod-player-row" key={player.id}>
                <span className="tod-player-num" aria-hidden>
                  {index + 1}
                </span>
                <input
                  className="tod-player-input"
                  value={player.name}
                  onChange={(event) => renamePlayer(player.id, event.target.value)}
                  onBlur={() => {
                    if (!player.name.trim()) {
                      renamePlayer(player.id, `Player ${index + 1}`);
                    }
                  }}
                  maxLength={MAX_NAME_LENGTH}
                  aria-label={`Player ${index + 1} name`}
                />
                <button
                  type="button"
                  className="tod-icon-btn"
                  onClick={() => removePlayer(player.id)}
                  aria-label={`Remove ${player.name || `player ${index + 1}`}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        {players.length < MAX_PLAYERS && (
          <form
            className="tod-add-player"
            onSubmit={(event) => {
              event.preventDefault();
              addPlayer();
            }}
          >
            <input
              className="tod-input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={MAX_NAME_LENGTH}
              placeholder="Add a player"
              aria-label="New player name"
            />
            <button
              type="submit"
              className="tod-btn tod-btn-small"
              disabled={!name.trim()}
            >
              Add
            </button>
          </form>
        )}

        {filledPlayers < MIN_PLAYERS && (
          <p className="tod-form-hint">Add at least two players to start.</p>
        )}
      </div>

      <div className="tod-panel">
        <div className="tod-section-head">
          <h2 className="tod-section-title">Card packs</h2>
          <span className="tod-count">Pick one or more</span>
        </div>

        <div className="tod-level-list">
          {LEVELS.map((level) => {
            const meta = LEVEL_META[level];
            const selected = levels.includes(level);
            return (
              <button
                key={level}
                type="button"
                className={`tod-level-card tod-level-${level} ${
                  selected ? "tod-level-selected" : ""
                }`}
                aria-pressed={selected}
                onClick={() => toggleLevel(level)}
              >
                <span className="tod-level-mark" aria-hidden>
                  {selected ? "✓" : "+"}
                </span>
                <span className="tod-level-copy">
                  <span className="tod-level-title">
                    {meta.label}
                    <span className="tod-level-rating">{meta.rating}</span>
                  </span>
                  <span className="tod-level-desc">{meta.description}</span>
                </span>
              </button>
            );
          })}
        </div>
        {levels.length === 0 && (
          <p className="tod-form-hint">Choose at least one card pack.</p>
        )}
      </div>

      <label className="tod-check-row">
        <input
          type="checkbox"
          className="tod-check"
          checked={shuffleOrder}
          onChange={(event) => setShuffleOrder(event.target.checked)}
        />
        <span>
          <span className="tod-check-title">Shuffle turn order</span>
          <span className="tod-check-hint">
            The first player is picked at random.
          </span>
        </span>
      </label>

      <div className="tod-setup-actions">
        <button
          type="button"
          className="tod-btn tod-btn-primary"
          onClick={start}
          disabled={!canStart}
        >
          Start game
        </button>
        <button type="button" className="tod-btn tod-btn-ghost" onClick={onBack}>
          Back to game home
        </button>
      </div>

      {ageGate && (
        <div
          className="tod-modal-backdrop"
          role="presentation"
          onClick={() => setAgeGate(null)}
        >
          <div
            className="tod-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="age-gate-title"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="tod-eyebrow">Before you start</p>
            <h2 id="age-gate-title" className="tod-modal-title">
              NSFW is 18+
            </h2>
            <p className="tod-body-copy">
              This pack contains adult themes. Only continue if everyone
              playing is 18 or over.
            </p>
            <div className="tod-modal-actions">
              <button
                type="button"
                className="tod-btn tod-btn-primary"
                onClick={confirmAge}
                autoFocus
              >
                I am 18 or older
              </button>
              <button
                type="button"
                className="tod-btn tod-btn-ghost"
                onClick={() => setAgeGate(null)}
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
