import { useEffect, useState } from "react";
import { MAX_PLAYER_NAME_LENGTH, MAX_PLAYERS } from "../game";
import type { Deck, SetupConfig } from "../types";

const TURN_OPTIONS = [30, 60, 90, 120];

const cleanName = (value: string): string =>
  value.trim().replace(/\s+/g, " ");

export function Setup({
  decks,
  initial,
  onStart,
  onBack,
  onManageDecks,
  onSave,
}: {
  decks: Deck[];
  initial: SetupConfig;
  onStart: (config: SetupConfig) => void;
  onBack: () => void;
  onManageDecks: () => void;
  onSave: (config: SetupConfig) => void;
}) {
  const [names, setNames] = useState<string[]>(initial.playerNames);
  const [nameInput, setNameInput] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editInput, setEditInput] = useState("");
  const [selectedDecks, setSelectedDecks] = useState<string[]>(() => {
    const valid = initial.deckIds.filter((id) =>
      decks.some((deck) => deck.id === id),
    );
    if (valid.length) return valid;
    return decks.length ? [decks[0].id] : [];
  });
  const [turnSeconds, setTurnSeconds] = useState(initial.turnSeconds);
  const [shuffleOrder, setShuffleOrder] = useState(initial.shuffleOrder);

  useEffect(() => {
    onSave({
      playerNames: names,
      deckIds: selectedDecks,
      turnSeconds,
      shuffleOrder,
    });
  }, [names, selectedDecks, turnSeconds, shuffleOrder, onSave]);

  const addName = () => {
    const name = cleanName(nameInput);
    if (!name) return;
    if (names.length >= MAX_PLAYERS) {
      setNameError("Twelve players is the limit.");
      return;
    }
    if (
      names.some(
        (existing) =>
          existing.toLocaleLowerCase() === name.toLocaleLowerCase(),
      )
    ) {
      setNameError("That name is already in the game.");
      return;
    }
    setNames((current) => [...current, name]);
    setNameInput("");
    setNameError(null);
  };

  const removeName = (index: number) => {
    setNames((current) => current.filter((_, i) => i !== index));
    if (editingIndex === index) {
      setEditingIndex(null);
      setNameError(null);
    }
  };

  const startRename = (index: number) => {
    setEditingIndex(index);
    setEditInput(names[index]);
    setNameError(null);
  };

  const saveRename = () => {
    if (editingIndex === null) return;
    const name = cleanName(editInput);
    if (!name) {
      setNameError("Enter a name.");
      return;
    }
    if (
      names.some(
        (existing, index) =>
          index !== editingIndex &&
          existing.toLocaleLowerCase() === name.toLocaleLowerCase(),
      )
    ) {
      setNameError("That name is already in the game.");
      return;
    }
    setNames((current) =>
      current.map((existing, index) =>
        index === editingIndex ? name : existing,
      ),
    );
    setEditingIndex(null);
    setNameError(null);
  };

  const toggleDeck = (id: string) => {
    setSelectedDecks((current) =>
      current.includes(id)
        ? current.filter((candidate) => candidate !== id)
        : [...current, id],
    );
  };

  const groupedDecks = decks.reduce<Record<string, Deck[]>>((groups, deck) => {
    const key = deck.group ?? (deck.builtin ? "More decks" : "Your decks");
    (groups[key] ??= []).push(deck);
    return groups;
  }, {});
  const groupOrder = [
    "Everyday",
    "Culture & People",
    "World & Ideas",
    "More decks",
    "Your decks",
  ].filter((title) => groupedDecks[title]?.length);

  const selectedWordCount = decks
    .filter((deck) => selectedDecks.includes(deck.id))
    .reduce((total, deck) => total + deck.words.length, 0);

  const canStart = names.length >= 2 && selectedDecks.length > 0;
  const startHint =
    names.length < 2
      ? "Add at least two players."
      : selectedDecks.length === 0
        ? "Choose at least one deck."
        : null;

  return (
    <div className="anim-fade-in flex w-full flex-1 flex-col py-6">
      <button type="button" className="fc-link self-start" onClick={onBack}>
        ← Home
      </button>

      <header className="mt-5 text-center">
        <p className="fc-eyebrow">Pass the phone</p>
        <h1 className="fc-display mt-1 text-4xl">SET UP</h1>
        <p className="fc-muted mt-2 text-sm">
          Players, decks, and how long each turn lasts.
        </p>
      </header>

      <section className="mt-7">
        <div className="flex items-center justify-between gap-3">
          <h2 className="fc-display text-2xl">Players</h2>
          <span className="fc-chip">
            {names.length}/{MAX_PLAYERS}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {names.length === 0 && (
            <p className="fc-muted text-sm">Add the people in the room.</p>
          )}
          {names.map((name, index) =>
            editingIndex === index ? (
              <form
                key={`edit-${index}`}
                className="fc-player-chip fc-player-chip-editing"
                onSubmit={(event) => {
                  event.preventDefault();
                  saveRename();
                }}
              >
                <input
                  className="fc-field fc-field-sm"
                  value={editInput}
                  onChange={(event) => {
                    setEditInput(event.target.value);
                    setNameError(null);
                  }}
                  maxLength={MAX_PLAYER_NAME_LENGTH}
                  aria-label={`Rename ${name}`}
                  autoFocus
                />
                <button type="submit" className="fc-link">
                  Save
                </button>
                <button
                  type="button"
                  className="fc-link fc-muted"
                  onClick={() => {
                    setEditingIndex(null);
                    setNameError(null);
                  }}
                >
                  Cancel
                </button>
              </form>
            ) : (
              <span key={`${name}-${index}`} className="fc-player-chip">
                {name}
                <button
                  type="button"
                  className="fc-icon-btn fc-icon-btn-sm"
                  aria-label={`Rename ${name}`}
                  onClick={() => startRename(index)}
                >
                  ✎
                </button>
                <button
                  type="button"
                  className="fc-icon-btn fc-icon-btn-sm fc-icon-btn-danger"
                  aria-label={`Remove ${name}`}
                  onClick={() => removeName(index)}
                >
                  ×
                </button>
              </span>
            ),
          )}
        </div>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            addName();
          }}
        >
          <input
            className="fc-field"
            value={nameInput}
            onChange={(event) => {
              setNameInput(event.target.value);
              setNameError(null);
            }}
            placeholder="Player name"
            maxLength={MAX_PLAYER_NAME_LENGTH}
            disabled={names.length >= MAX_PLAYERS}
          />
          <button
            type="submit"
            className="fc-btn fc-btn-ghost fc-btn-compact shrink-0"
            disabled={names.length >= MAX_PLAYERS}
          >
            Add
          </button>
        </form>
        {nameError && (
          <p className="fc-banner fc-banner-danger anim-shake mt-3" role="alert">
            {nameError}
          </p>
        )}
      </section>

      <section className="mt-8">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="fc-display text-2xl">Decks</h2>
            <p className="fc-muted mt-1 text-xs">
              {selectedWordCount} words in the pool
            </p>
          </div>
          <span className="fc-chip">
            {selectedDecks.length}/{decks.length}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
          <button
            type="button"
            className="fc-link"
            onClick={() => setSelectedDecks(decks.map((deck) => deck.id))}
          >
            Select all
          </button>
          <button
            type="button"
            className="fc-link fc-muted"
            onClick={() => setSelectedDecks([])}
          >
            Clear
          </button>
          <button type="button" className="fc-link" onClick={onManageDecks}>
            Manage custom decks
          </button>
        </div>
        <div className="mt-4 space-y-5">
          {groupOrder.map((title) => (
            <div key={title}>
              <h3 className="fc-deck-group-title">{title}</h3>
              <div className="mt-2 space-y-2">
                {groupedDecks[title].map((deck) => {
                  const selected = selectedDecks.includes(deck.id);
                  return (
                    <button
                      key={deck.id}
                      type="button"
                      className={`fc-deck-card ${
                        selected ? "fc-deck-card-selected" : ""
                      }`}
                      aria-pressed={selected}
                      onClick={() => toggleDeck(deck.id)}
                    >
                      <span className="fc-deck-emoji" aria-hidden>
                        {deck.emoji}
                      </span>
                      <span className="min-w-0 flex-1 text-left">
                        <span className="fc-deck-name">{deck.name}</span>
                        <span className="fc-deck-meta">
                          {deck.words.length} words
                          {deck.builtin ? "" : " · custom"}
                        </span>
                      </span>
                      <span
                        className={`fc-deck-check ${
                          selected ? "fc-deck-check-on" : ""
                        }`}
                        aria-hidden
                      >
                        {selected ? "✓" : "+"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="fc-display text-2xl">Turn length</h2>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {TURN_OPTIONS.map((seconds) => (
            <button
              key={seconds}
              type="button"
              className={`fc-choice ${
                turnSeconds === seconds ? "fc-choice-selected" : ""
              }`}
              aria-pressed={turnSeconds === seconds}
              onClick={() => setTurnSeconds(seconds)}
            >
              {seconds}s
            </button>
          ))}
        </div>
      </section>

      <label className="fc-check-row mt-6">
        <input
          type="checkbox"
          className="fc-check"
          checked={shuffleOrder}
          onChange={(event) => setShuffleOrder(event.target.checked)}
        />
        <span>
          <span className="fc-check-title">Shuffle the turn order</span>
          <span className="fc-check-hint">
            Nobody can plan who goes next.
          </span>
        </span>
      </label>

      <div className="mt-6 grid gap-3">
        <button
          type="button"
          className="fc-btn fc-btn-primary"
          disabled={!canStart}
          onClick={() =>
            onStart({
              playerNames: names,
              deckIds: selectedDecks,
              turnSeconds,
              shuffleOrder,
            })
          }
        >
          Start game
        </button>
        {startHint && (
          <p className="fc-muted text-center text-sm">{startHint}</p>
        )}
        <button type="button" className="fc-link justify-self-center" onClick={onBack}>
          Back to home
        </button>
      </div>
    </div>
  );
}
