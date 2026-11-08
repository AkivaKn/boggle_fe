import { useState } from "react";
import { MAX_PLAYER_NAME_LENGTH, MAX_PLAYERS } from "../game";
import type { Player } from "../types";

const cleanName = (value: string): string =>
  value.trim().replace(/\s+/g, " ");

export function PlayerManager({
  players,
  isFinal,
  onAdd,
  onRename,
  onClose,
}: {
  players: Player[];
  isFinal: boolean;
  onAdd: (name: string) => void;
  onRename: (playerId: string, name: string) => void;
  onClose: () => void;
}) {
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isDuplicate = (name: string, exceptId?: string): boolean =>
    players.some(
      (player) =>
        player.id !== exceptId &&
        player.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
    );

  const validate = (name: string, exceptId?: string): string | null => {
    if (!name) return "Enter a name.";
    if (isDuplicate(name, exceptId)) return "That name is already in the game.";
    return null;
  };

  const add = () => {
    const name = cleanName(newName);
    if (players.length >= MAX_PLAYERS) {
      setError("Twelve players is the limit.");
      return;
    }
    const problem = validate(name);
    if (problem) {
      setError(problem);
      return;
    }
    onAdd(name);
    setNewName("");
    setError(null);
  };

  const startRename = (player: Player) => {
    setEditingId(player.id);
    setEditName(player.name);
    setError(null);
  };

  const saveRename = () => {
    if (!editingId) return;
    const name = cleanName(editName);
    const problem = validate(name, editingId);
    if (problem) {
      setError(problem);
      return;
    }
    onRename(editingId, name);
    setEditingId(null);
    setError(null);
  };

  return (
    <div
      className="fc-sheet"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fc-players-title"
    >
      <div className="fc-sheet-card">
        <div className="fc-sheet-head">
          <div>
            <p className="fc-eyebrow">Roster</p>
            <h2 id="fc-players-title" className="fc-display text-2xl">
              Players
            </h2>
          </div>
          <button
            type="button"
            className="fc-icon-btn"
            aria-label="Close player manager"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <p className="fc-muted mt-2 text-sm">
          Rename anyone, or add someone who joined late. New players join at
          the end of the turn order with a fresh score.
        </p>
        {isFinal && (
          <p className="fc-note mt-3">
            The game is finished, so anyone added here gets their missed turn
            straight away.
          </p>
        )}

        <ul className="fc-player-list mt-4">
          {players.map((player, index) => (
            <li key={player.id} className="fc-player-row">
              <span className="fc-player-num" aria-hidden>
                {index + 1}
              </span>
              {editingId === player.id ? (
                <form
                  className="fc-player-edit"
                  onSubmit={(event) => {
                    event.preventDefault();
                    saveRename();
                  }}
                >
                  <input
                    className="fc-field fc-field-sm"
                    value={editName}
                    onChange={(event) => {
                      setEditName(event.target.value);
                      setError(null);
                    }}
                    maxLength={MAX_PLAYER_NAME_LENGTH}
                    aria-label={`Rename ${player.name}`}
                    autoFocus
                  />
                  <button type="submit" className="fc-link">
                    Save
                  </button>
                  <button
                    type="button"
                    className="fc-link fc-muted"
                    onClick={() => {
                      setEditingId(null);
                      setError(null);
                    }}
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <>
                  <span className="fc-player-name">{player.name}</span>
                  <button
                    type="button"
                    className="fc-link"
                    onClick={() => startRename(player)}
                  >
                    Rename
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>

        <form
          className="mt-5"
          onSubmit={(event) => {
            event.preventDefault();
            add();
          }}
        >
          <label htmlFor="fc-new-player" className="fc-label">
            Add a player
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id="fc-new-player"
              className="fc-field"
              value={newName}
              onChange={(event) => {
                setNewName(event.target.value);
                setError(null);
              }}
              placeholder={
                players.length >= MAX_PLAYERS
                  ? "Roster full"
                  : "Player name"
              }
              maxLength={MAX_PLAYER_NAME_LENGTH}
              disabled={players.length >= MAX_PLAYERS}
            />
            <button
              type="submit"
              className="fc-btn fc-btn-primary fc-btn-compact"
              disabled={players.length >= MAX_PLAYERS}
            >
              Add
            </button>
          </div>
        </form>

        {error && (
          <p className="fc-banner fc-banner-danger anim-shake mt-3" role="alert">
            {error}
          </p>
        )}

        <button
          type="button"
          className="fc-btn fc-btn-ghost mt-5"
          onClick={onClose}
        >
          Done
        </button>
      </div>
    </div>
  );
}
